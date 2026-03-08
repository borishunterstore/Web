// admin-users.js - ИСПРАВЛЕННАЯ ВЕРСИЯ (без автоматических вызовов)
class AdminUsers {
    constructor() {
        this.api = window.api;
        this.baseUrl = 'https://bhstore.netlify.app';
        this.users = [];
    }

    async loadUsers() {
        try {
            const data = await this.api.getAllUsers();
            this.users = data.users || [];
            this.renderUsers();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }

    renderUsers() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        const users = this.users || [];

        let html = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${users.length}</div>
                    <div class="stat-label">Всего пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-check"></i></div>
                    <div class="stat-value">${users.filter(u => u.badges?.verified).length}</div>
                    <div class="stat-label">Верифицированных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-crown"></i></div>
                    <div class="stat-value">${users.filter(u => u.badges?.admin).length}</div>
                    <div class="stat-label">Администраторов</div>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="text" id="searchUsers" class="search-input" placeholder="Поиск по имени или ID...">
                <button class="btn-admin" onclick="window.adminUsers.exportUsers()">
                    <i class="fas fa-download"></i> Экспорт CSV
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>ID</th>
                            <th>Заказы</th>
                            <th>Баланс</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
        `;
        
        if (users.length === 0) {
            html += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fas fa-users-slash" style="font-size: 3rem; color: #72767d;"></i>
                        <p style="margin-top: 10px;">Пользователи не найдены</p>
                    </td>
                </tr>
            `;
        } else {
            users.forEach(user => {
                const avatarUrl = user.avatar 
                    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                
                html += `
                    <tr data-user-id="${user.discordId}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarUrl}" style="width: 35px; height: 35px; border-radius: 50%;">
                                <div>
                                    <div style="color: white; font-weight: 500;">${this.escapeHtml(user.username || 'Без имени')}</div>
                                    <div style="color: #72767d; font-size: 0.8rem;">
                                        ${user.badges?.admin ? '<span class="badge badge-admin">Админ</span>' : ''}
                                        ${user.badges?.verified ? '<span class="badge badge-verified">✓</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td><code style="color: #5865F2;">${user.discordId}</code></td>
                        <td>${user.orderCount || 0}</td>
                        <td style="color: #57F287; font-weight: 600;">${user.balance || 0} ₽</td>
                        <td>
                            <span class="badge" style="background: ${user.badges?.verified ? '#57F287' : '#72767d'};">
                                ${user.badges?.verified ? 'Верифицирован' : 'Не верифицирован'}
                            </span>
                        </td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon" onclick="window.openUserChat('${user.discordId}')" title="Чат">
                                    <i class="fas fa-comment"></i>
                                </button>
                                <button class="btn-icon success" onclick="window.addBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Пополнить">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-icon warning" onclick="window.removeBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Списать">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <button class="btn-icon" onclick="window.viewBalanceHistory('${user.discordId}', '${this.escapeHtml(user.username)}')" title="История">
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
        document.getElementById('searchUsers')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });
    }

    filterUsers(query) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        const searchTerm = query.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent?.toLowerCase() || '';
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    async viewBalanceHistory(userId, username) {
        try {
            const data = await this.api.getUserBalanceHistory(userId);
            this.showBalanceHistoryModal(userId, username, data);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.showNotification('Ошибка загрузки истории баланса', 'error');
        }
    }

    showBalanceHistoryModal(userId, username, data) {
        const modal = document.getElementById('balanceHistoryModal');
        const content = document.getElementById('balanceHistoryContent');
        
        if (!modal || !content) return;
        
        const transactions = data.transactions || [];
        let historyHtml = '';
        
        if (transactions.length > 0) {
            historyHtml = transactions.map(t => `
                <div style="background: #1e1f29; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${t.amount > 0 ? '#57F287' : '#ED4245'};">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 600; color: ${t.amount > 0 ? '#57F287' : '#ED4245'};">${t.amount > 0 ? '+' : ''}${t.amount} ₽</span>
                        <span style="color: #72767d; font-size: 0.8rem;">${t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : ''}</span>
                    </div>
                    <div style="color: #b9bbbe; margin-top: 5px;">${t.reason || 'Без причины'}</div>
                    <div style="color: #72767d; font-size: 0.7rem; margin-top: 5px;">Тип: ${t.type === 'deposit' ? 'Пополнение' : 'Списание'}</div>
                </div>
            `).join('');
        } else {
            historyHtml = '<div style="text-align: center; padding: 40px; color: #72767d;">История транзакций пуста</div>';
        }
        
        content.innerHTML = `
            <div style="background: #1e1f29; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <div style="color: white; font-weight: 600;">${this.escapeHtml(username)}</div>
                        <div style="color: #5865F2; font-size: 0.85rem;">${userId}</div>
                    </div>
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${historyHtml}
            </div>
        `;
        
        modal.style.display = 'flex';
    }

    exportUsers() {
        const users = this.users || [];
        const csv = [
            ['ID', 'Имя пользователя', 'Email', 'Баланс', 'Заказов', 'Верифицирован', 'Админ'],
            ...users.map(u => [
                u.discordId,
                u.username || '',
                u.email || '',
                u.balance || 0,
                u.orderCount || 0,
                u.badges?.verified ? 'Да' : 'Нет',
                u.badges?.admin ? 'Да' : 'Нет'
            ])
        ].map(row => row.join(';')).join('\n');
        
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
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminUsers = AdminUsers;
window.adminUsers = new AdminUsers();