// admin-users.js - Управление пользователями
class AdminUsers {
    constructor() {
        this.api = new BHStoreAPI();
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
        this.users = [];
    }

    async loadUsers() {
        try {
            const data = await this.api.getAllUsers();
            this.users = data.users || [];
            this.renderUsers();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.showNotification(this.api.formatError(error), 'error');
        }
    }

    renderUsers() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        const users = this.users || [];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="color: #b9bbbe;">
                    <i class="fas fa-users"></i> Всего пользователей: <strong>${users.length}</strong>
                </div>
                <div>
                    <button class="btn-admin" onclick="window.adminUsers.exportUsers()">
                        <i class="fas fa-download"></i> Экспорт CSV
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <input type="text" id="searchUsers" placeholder="Поиск по имени или ID..." 
                       style="width: 100%; padding: 12px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Пользователь</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">ID</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Заказы</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Баланс</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Статус</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
        `;
        
        if (users.length === 0) {
            html += `
                <tr>
                    <td colspan="6" style="padding: 40px; text-align: center; color: #b9bbbe;">
                        <i class="fas fa-users-slash" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>Пользователи не найдены</p>
                    </td>
                </tr>
            `;
        } else {
            users.forEach(user => {
                const avatarUrl = user.avatar 
                    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                
                const verifiedBadge = user.badges?.verified ? 
                    '<span title="Верифицирован" style="color: #57F287;"><i class="fas fa-check-circle"></i></span>' : 
                    '';
                
                const partnerBadge = user.badges?.partner ? 
                    '<span title="Партнер" style="color: #FEE75C;"><i class="fas fa-crown"></i></span>' : '';
                
                const buyerBadge = user.badges?.buyer ? 
                    '<span title="Покупатель" style="color: #5865F2;"><i class="fas fa-shopping-bag"></i></span>' : '';
                
                const adminBadge = user.badges?.admin ? 
                    '<span title="Админ" style="color: #ED4245;"><i class="fas fa-shield-alt"></i></span>' : '';
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;" data-user-id="${user.discordId}">
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <img src="${avatarUrl}" 
                                     style="width: 40px; height: 40px; border-radius: 50%;"
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 5px; color: white; font-weight: 500;">
                                        ${this.escapeHtml(user.username || 'Без имени')}
                                        ${verifiedBadge}
                                        ${partnerBadge}
                                        ${buyerBadge}
                                        ${adminBadge}
                                    </div>
                                    <div style="color: #b9bbbe; font-size: 0.85rem;">${user.email || 'Нет email'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <code style="color: #5865F2;">${user.discordId || 'N/A'}</code>
                        </td>
                        <td style="padding: 12px;">
                            <span class="badge" style="background: #5865F2; color: white; padding: 4px 12px; border-radius: 20px;">
                                ${user.orderCount || 0}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div style="color: #57F287; font-weight: 600; font-size: 1.2rem;">
                                ${user.balance || 0} ₽
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <span class="badge" style="background: ${user.badges?.verified ? '#57F287' : '#72767d'}; color: ${user.badges?.verified ? '#1e1f29' : 'white'}; padding: 4px 12px; border-radius: 20px;">
                                ${user.badges?.verified ? 'Верифицирован' : 'Не верифицирован'}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn-admin small" onclick="openUserChat('${user.discordId}')" title="Открыть чат">
                                    <i class="fas fa-comment"></i>
                                </button>
                                <button class="btn-admin success small" onclick="addBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Пополнить баланс">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-admin small" onclick="removeBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Списать баланс" style="background: #FEE75C; color: #1e1f29;">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <button class="btn-admin small" onclick="viewBalanceHistory('${user.discordId}', '${this.escapeHtml(user.username)}')" title="История баланса" style="background: #3498db; color: white;">
                                    <i class="fas fa-history"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        usersContent.innerHTML = html;
        
        // Добавляем поиск
        setTimeout(() => {
            document.getElementById('searchUsers')?.addEventListener('input', (e) => {
                this.filterUsers(e.target.value);
            });
        }, 100);
    }

    filterUsers(query) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        const searchTerm = query.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent?.toLowerCase() || '';
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    async viewBalanceHistory(userId, username) {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            
            const response = await fetch(`${this.baseUrl}/admin-balance-history/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showBalanceHistoryModal(userId, username, data);
            } else {
                throw new Error(data.error || 'Ошибка загрузки истории');
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.showNotification('Ошибка загрузки истории баланса', 'error');
        }
    }

    showBalanceHistoryModal(userId, username, data) {
        const modal = document.getElementById('balanceHistoryModal');
        if (!modal) return;
        
        const content = document.getElementById('balanceHistoryContent');
        
        const transactions = data.transactions || [];
        let historyHtml = '';
        
        if (transactions.length > 0) {
            historyHtml = transactions.map(t => `
                <div style="background: #1e1f29; padding: 15px; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid ${t.amount > 0 ? '#57F287' : '#ED4245'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: ${t.amount > 0 ? '#57F287' : '#ED4245'}; font-size: 1.1rem;">
                            ${t.amount > 0 ? '+' : ''}${t.amount} ₽
                        </div>
                        <div style="color: #b9bbbe; font-size: 0.85rem;">
                            ${t.date ? new Date(t.date).toLocaleString('ru-RU') : 'Нет даты'}
                        </div>
                    </div>
                    <div style="color: #b9bbbe; margin-bottom: 5px;">
                        ${t.reason || 'Без причины'}
                    </div>
                    <div style="color: #72767d; font-size: 0.75rem;">
                        ID: ${t.id || 'N/A'}
                    </div>
                </div>
            `).join('');
        } else {
            historyHtml = '<div style="text-align: center; padding: 2rem; color: #b9bbbe;">История транзакций пуста</div>';
        }
        
        const totalDeposits = data.totalDeposits || 0;
        const totalWithdrawals = data.totalWithdrawals || 0;
        const netBalance = totalDeposits - totalWithdrawals;
        
        content.innerHTML = `
            <div style="background: #1e1f29; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="https://cdn.discordapp.com/embed/avatars/0.png" style="width: 40px; height: 40px; border-radius: 50%;">
                        <div>
                            <div style="color: white; font-weight: 600;">${this.escapeHtml(username)}</div>
                            <div style="color: #5865F2; font-size: 0.85rem;">${userId}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #b9bbbe; font-size: 0.85rem;">Текущий баланс</div>
                        <div style="color: #57F287; font-weight: 700; font-size: 1.5rem;">${netBalance} ₽</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                    <div style="background: rgba(87, 242, 135, 0.1); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="color: #57F287; font-size: 1.3rem; font-weight: 700;">+${totalDeposits} ₽</div>
                        <div style="color: #b9bbbe; font-size: 0.85rem;">Пополнений</div>
                    </div>
                    <div style="background: rgba(237, 66, 69, 0.1); padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="color: #ED4245; font-size: 1.3rem; font-weight: 700;">-${totalWithdrawals} ₽</div>
                        <div style="color: #b9bbbe; font-size: 0.85rem;">Списаний</div>
                    </div>
                </div>
            </div>
            
            <h3 style="color: #b9bbbe; margin-bottom: 15px; font-size: 1.1rem;">
                Транзакции (${transactions.length}):
            </h3>
            
            <div style="max-height: 300px; overflow-y: auto; padding-right: 5px;">
                ${historyHtml}
            </div>
        `;
        
        showModal('balanceHistoryModal');
    }

    exportUsers() {
        const users = this.users || [];
        const csv = [
            ['ID', 'Имя пользователя', 'Email', 'Баланс', 'Заказов', 'Верифицирован', 'Админ', 'Дата регистрации'],
            ...users.map(u => [
                u.discordId,
                u.username,
                u.email || '',
                u.balance || 0,
                u.orderCount || 0,
                u.badges?.verified ? 'Да' : 'Нет',
                u.badges?.admin ? 'Да' : 'Нет',
                u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('ru-RU') : ''
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = 'admin-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10001;
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация
window.AdminUsers = AdminUsers;
window.adminUsers = new AdminUsers();