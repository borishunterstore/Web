// js/admin-users.js - Управление пользователями
class AdminUsers {
    constructor() {
        this.api = new BHStoreAPI();
    }

    async loadUsers() {
        try {
            const usersData = await this.api.getAllUsers();
            this.renderUsers(usersData);
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            throw error;
        }
    }

    renderUsers(usersData) {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="color: #b9bbbe;">
                    Всего пользователей: <strong>${usersData.total || 0}</strong>
                </div>
                <div>
                    <button class="btn-admin" onclick="exportUsers()">
                        <i class="fas fa-download"></i> Экспорт CSV
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Discord</th>
                            <th>Имя пользователя</th>
                            <th>Дата регистрации</th>
                            <th>Заказов</th>
                            <th>Баланс</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        const users = usersData.users || [];
        users.forEach(user => {
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
            
            const verifiedBadge = user.badges?.verified ? 
                '<span title="Верифицирован" style="color: #57F287; font-size: 0.9rem;"><i class="fas fa-check-circle"></i></span>' : 
                '<span title="Не верифицирован" style="color: #72767d; font-size: 0.9rem;"><i class="far fa-times-circle"></i></span>';
            
            html += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${avatarUrl}" 
                                 style="width: 32px; height: 32px; border-radius: 50%;"
                                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            <span>${user.discordId || 'N/A'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <strong>${user.username || 'Без имени'}</strong>
                            ${verifiedBadge}
                        </div>
                        <small style="color: #72767d;">${user.email || 'Нет email'}</small>
                    </td>
                    <td>${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ru-RU') : 'Нет данных'}</td>
                    <td><span class="badge" style="background: #5865F2; color: white; padding: 4px 8px; border-radius: 12px;">${user.orderCount || 0}</span></td>
                    <td>
                        <div style="color: #57F287; font-weight: 600; font-size: 1.1rem;">
                            ${user.balance || 0} ₽
                        </div>
                    </td>
                    <td>
                        ${user.badges?.verified ? 
                            '<span class="badge" style="background: #57F287; color: #1e1f29; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;"><i class="fas fa-check"></i> Верифицирован</span>' : 
                            '<span class="badge" style="background: #72767d; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">Не верифицирован</span>'}
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn-admin" onclick="openUserChat('${user.discordId}')" title="Открыть чат">
                                <i class="fas fa-comment"></i>
                            </button>
                            <button class="btn-admin success" onclick="addBalance('${user.discordId}', '${user.username}')" title="Пополнить баланс">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn-admin" onclick="removeBalance('${user.discordId}', '${user.username}')" title="Списать баланс" style="background: #FEE75C; color: #1e1f29;">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button class="btn-admin" onclick="setBalance('${user.discordId}', '${user.username}', ${user.balance || 0})" title="Установить баланс" style="background: #9B59B6; color: white;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-admin" onclick="viewBalanceHistory('${user.discordId}', '${user.username}')" title="История баланса" style="background: #3498db; color: white;">
                                <i class="fas fa-history"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        usersContent.innerHTML = html;
    }

    async addUserBalance(userId, amount, reason) {
        try {
            const response = await this.api.addUserBalance(userId, amount, reason);
            
            if (response.success) {
                this.showNotification(`Баланс пользователя пополнен на ${amount} ₽`, 'success');
                await this.loadUsers();
                return response;
            } else {
                throw new Error(response.error || 'Ошибка пополнения баланса');
            }
        } catch (error) {
            console.error('Ошибка пополнения баланса:', error);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
            throw error;
        }
    }

    showBalanceHistoryModal(userId, username, data) {
        // Удаляем существующее модальное окно
        const existingModal = document.getElementById('balanceHistoryModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Создаем модальное окно для истории
        const modal = document.createElement('div');
        modal.id = 'balanceHistoryModal';
        modal.className = 'modal';
        modal.style.cssText = `
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        `;
        
        let historyHtml = '';
        const transactions = data.transactions || [];
        if (transactions.length > 0) {
            historyHtml = transactions.map(transaction => `
                <div style="background: #1e1f29; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${transaction.amount > 0 ? '#57F287' : '#ED4245'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="font-weight: 600; color: ${transaction.amount > 0 ? '#57F287' : '#ED4245'}">
                            ${transaction.amount > 0 ? '+' : ''}${transaction.amount} ₽
                        </div>
                        <div style="color: #b9bbbe; font-size: 0.85rem;">
                            ${transaction.date ? new Date(transaction.date).toLocaleString('ru-RU') : 'Нет даты'}
                        </div>
                    </div>
                    <div style="color: #b9bbbe; font-size: 0.9rem;">
                        ${transaction.reason || 'Без причины'}
                    </div>
                    <div style="color: #72767d; font-size: 0.8rem; margin-top: 4px;">
                        ID: ${transaction.id || 'N/A'}
                    </div>
                </div>
            `).join('');
        } else {
            historyHtml = '<div style="text-align: center; padding: 2rem; color: #b9bbbe;">История транзакций пуста</div>';
        }
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #5865F2; margin: 0;">История баланса</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="background: #1e1f29; padding: 1rem; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #b9bbbe;">Пользователь:</span>
                        <span style="color: white; font-weight: 500;">${username}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #b9bbbe;">ID:</span>
                        <span style="color: #5865F2; font-family: monospace;">${userId}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #b9bbbe;">Всего пополнений:</span>
                        <span style="color: #57F287; font-weight: 600;">+${data.totalDeposits || 0} ₽</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                        <span style="color: #b9bbbe;">Всего списаний:</span>
                        <span style="color: #ED4245; font-weight: 600;">-${data.totalWithdrawals || 0} ₽</span>
                    </div>
                </div>
                
                <h3 style="color: #b9bbbe; margin-bottom: 15px;">Транзакции (${data.total || 0}):</h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${historyHtml}
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button class="btn-admin" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Закрытие по клику вне окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showNotification(message, type = 'info') {
        // Удаляем существующие уведомления
        document.querySelectorAll('.admin-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'admin-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : type === 'error' ? '#ED4245' : '#5865F2'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            padding: 1rem;
            border-radius: 8px;
            z-index: 1001;
            min-width: 300px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Добавьте CSS анимации если их еще нет
if (!document.getElementById('admin-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Экспорт
window.AdminUsers = AdminUsers;

// Функция для загрузки пользователей
window.loadUsers = async function() {
    const adminUsers = new AdminUsers();
    await adminUsers.loadUsers();
};