class AdminUsers {
    constructor() {
        this.api = window.api;
        this.users = [];
        this.filteredUsers = [];
    }

    async loadUsers() {
        try {
            const data = await this.api.getAllUsers();
            this.users = data.users || [];
            this.filteredUsers = [...this.users];
            this.renderUsers();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }

    renderUsers() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        let html = `
            <div class="stats-grid" style="margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div class="stat-card" style="background: linear-gradient(135deg, #5865F2, #4752c4); padding: 15px; border-radius: 12px;">
                    <div class="stat-value" style="color: white; font-size: 1.5rem;">${this.users.length}</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">Всего</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #57F287, #4ad477); padding: 15px; border-radius: 12px;">
                    <div class="stat-value" style="color: #1e1f29; font-size: 1.5rem;">${this.users.filter(u => u.badges?.verified).length}</div>
                    <div class="stat-label" style="color: #1e1f29;">Верифицированных</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #FEE75C, #e6d048); padding: 15px; border-radius: 12px;">
                    <div class="stat-value" style="color: #1e1f29; font-size: 1.5rem;">${this.users.filter(u => u.badges?.admin).length}</div>
                    <div class="stat-label" style="color: #1e1f29;">Администраторов</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #9B59B6, #8E44AD); padding: 15px; border-radius: 12px;">
                    <div class="stat-value" style="color: white; font-size: 1.5rem;">${this.users.reduce((sum, u) => sum + (u.balance || 0), 0)} ₽</div>
                    <div class="stat-label" style="color: rgba(255,255,255,0.8);">Общий баланс</div>
                </div>
            </div>
            
            <div class="search-bar" style="margin-bottom: 20px; display: flex; gap: 10px;">
                <input type="text" id="searchUsers" placeholder="Поиск по имени или ID..." style="flex: 1; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                <button class="btn-admin" onclick="window.adminUsers.exportUsers()"><i class="fas fa-download"></i> CSV</button>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left;">Пользователь</th>
                            <th style="padding: 12px; text-align: left;">ID</th>
                            <th style="padding: 12px; text-align: left;">Баланс</th>
                            <th style="padding: 12px; text-align: left;">Бейджи</th>
                            <th style="padding: 12px; text-align: left;">Заказы</th>
                            <th style="padding: 12px; text-align: left;">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
        `;
        
        if (this.filteredUsers.length === 0) {
            html += `<tr><td colspan="6" style="padding: 60px; text-align: center; color: #72767d;"><i class="fas fa-users-slash"></i><p>Пользователи не найдены</p></td></tr>`;
        } else {
            this.filteredUsers.forEach(user => {
                const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png';
                
                let badgesHtml = '';
                if (user.badges?.admin) badgesHtml += '<span class="badge badge-admin" style="background: #5865F2;">Admin</span> ';
                if (user.badges?.verified) badgesHtml += '<span class="badge badge-verified" style="background: #57F287;">✓ Вериф.</span> ';
                if (user.badges?.partner) badgesHtml += '<span class="badge badge-partner" style="background: #FF73FA;">🤝 Партнёр</span> ';
                if (user.badges?.vip) badgesHtml += '<span class="badge badge-vip" style="background: #9B59B6;">💎 VIP</span> ';
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;">
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarUrl}" style="width: 40px; height: 40px; border-radius: 50%;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="color: white; font-weight: 500;">${this.escapeHtml(user.username || 'Без имени')}</div>
                                    <div style="color: #72767d; font-size: 0.75rem;">${user.email || 'Нет email'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px;"><code style="color: #5865F2;">${user.discordId}</code></td>
                        <td style="padding: 12px;"><span style="color: #57F287; font-weight: 600;">${user.balance || 0} ₽</span></td>
                        <td style="padding: 12px;">${badgesHtml || '<span style="color: #72767d;">Нет</span>'}</td>
                        <td style="padding: 12px;">${user.orderCount || 0}</td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                <button class="btn-icon" onclick="window.adminUsers.editUser('${user.discordId}')" title="Редактировать"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon" onclick="window.adminUsers.manageBadges('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Бейджи"><i class="fas fa-medal"></i></button>
                                <button class="btn-icon success" onclick="window.addBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Пополнить"><i class="fas fa-plus"></i></button>
                                <button class="btn-icon warning" onclick="window.removeBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Списать"><i class="fas fa-minus"></i></button>
                                <button class="btn-icon" onclick="window.openUserChat('${user.discordId}')" title="Чат"><i class="fas fa-comment"></i></button>
                                <button class="btn-icon danger" onclick="window.adminUsers.deleteUser('${user.discordId}')" title="Удалить"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table></div>`;
        usersContent.innerHTML = html;
        
        document.getElementById('searchUsers')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            this.filteredUsers = this.users.filter(u => 
                u.username?.toLowerCase().includes(term) || 
                u.discordId?.toString().includes(term) ||
                u.email?.toLowerCase().includes(term)
            );
            this.renderUsers();
        });
    }

    async editUser(userId) {
        const user = this.users.find(u => u.discordId === userId);
        if (!user) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 450px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-user-edit"></i> Редактировать</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <form id="editUserForm">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Имя пользователя</label>
                        <input type="text" id="editUsername" value="${this.escapeHtml(user.username)}" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Email</label>
                        <input type="email" id="editEmail" value="${user.email || ''}" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Баланс (₽)</label>
                        <input type="number" id="editBalance" value="${user.balance || 0}" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn-admin" style="flex: 1;">Отмена</button>
                        <button type="submit" class="btn-admin success" style="flex: 1;">Сохранить</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await this.api.request(`/admin/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        username: document.getElementById('editUsername').value,
                        email: document.getElementById('editEmail').value,
                        balance: parseInt(document.getElementById('editBalance').value)
                    })
                });
                modal.remove();
                this.showNotification('Пользователь обновлён', 'success');
                await this.loadUsers();
            } catch (error) {
                this.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    }

    async manageBadges(userId, username) {
        const user = this.users.find(u => u.discordId === userId);
        if (!user) return;
        
        const badges = user.badges || {};
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 400px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-medal"></i> Бейджи: ${this.escapeHtml(username)}</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="badge_admin" ${badges.admin ? 'checked' : ''}>
                        <span><i class="fas fa-crown" style="color: #FEE75C;"></i> Администратор</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="badge_verified" ${badges.verified ? 'checked' : ''}>
                        <span><i class="fas fa-check-circle" style="color: #57F287;"></i> Верифицированный</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="badge_partner" ${badges.partner ? 'checked' : ''}>
                        <span><i class="fas fa-handshake" style="color: #FF73FA;"></i> Партнёр</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="badge_vip" ${badges.vip ? 'checked' : ''}>
                        <span><i class="fas fa-gem" style="color: #9B59B6;"></i> VIP</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="badge_buyer" ${badges.buyer ? 'checked' : ''}>
                        <span><i class="fas fa-shopping-bag" style="color: #FEE75C;"></i> Покупатель</span>
                    </label>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 25px;">
                    <button onclick="this.closest('.modal').remove()" class="btn-admin" style="flex: 1;">Отмена</button>
                    <button id="saveBadgesBtn" class="btn-admin success" style="flex: 1;">Сохранить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('saveBadgesBtn').addEventListener('click', async () => {
            const newBadges = {
                admin: document.getElementById('badge_admin').checked,
                verified: document.getElementById('badge_verified').checked,
                partner: document.getElementById('badge_partner').checked,
                vip: document.getElementById('badge_vip').checked,
                buyer: document.getElementById('badge_buyer').checked
            };
            
            try {
                for (const [key, value] of Object.entries(newBadges)) {
                    await this.api.request(`/admin/users/${userId}/badges`, {
                        method: 'POST',
                        body: JSON.stringify({ badgeKey: key, value })
                    });
                }
                
                modal.remove();
                this.showNotification('Бейджи обновлены', 'success');
                await this.loadUsers();
            } catch (error) {
                this.showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    }

    async deleteUser(userId) {
        if (!confirm('⚠️ ВНИМАНИЕ! Удаление пользователя также удалит все его сообщения, заказы, отзывы и уведомления. Это действие нельзя отменить. Продолжить?')) return;
        
        try {
            await this.api.request(`/admin/users/${userId}`, { method: 'DELETE' });
            this.showNotification('Пользователь удалён', 'success');
            await this.loadUsers();
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    async viewBalanceHistory(userId, username) {
        try {
            const data = await this.api.getUserBalanceHistory(userId);
            this.showBalanceHistoryModal(userId, username, data);
        } catch (error) {
            this.showNotification('Ошибка загрузки истории', 'error');
        }
    }

    showBalanceHistoryModal(userId, username, data) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        const transactions = data.transactions || [];
        let historyHtml = transactions.length === 0 ? '<p style="text-align: center; color: #72767d;">Нет транзакций</p>' : '';
        
        transactions.forEach(t => {
            historyHtml += `
                <div style="background: #1e1f29; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${t.amount > 0 ? '#57F287' : '#ED4245'};">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: ${t.amount > 0 ? '#57F287' : '#ED4245'}; font-weight: 600;">${t.amount > 0 ? '+' : ''}${t.amount} ₽</span>
                        <span style="color: #72767d; font-size: 0.75rem;">${new Date(t.created_at).toLocaleString()}</span>
                    </div>
                    <div style="color: #b9bbbe; font-size: 0.85rem; margin-top: 5px;">${t.reason || 'Без причины'}</div>
                </div>
            `;
        });
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 25px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-history"></i> История баланса</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <div style="background: #1e1f29; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                    <p><strong>${this.escapeHtml(username)}</strong></p>
                    <code style="color: #5865F2;">${userId}</code>
                </div>
                <div style="max-height: 400px; overflow-y: auto;">${historyHtml}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    exportUsers() {
        const csv = [['ID', 'Имя', 'Email', 'Баланс', 'Заказов', 'Верифицирован', 'Админ']];
        this.users.forEach(u => {
            csv.push([
                u.discordId,
                u.username || '',
                u.email || '',
                u.balance || 0,
                u.orderCount || 0,
                u.badges?.verified ? 'Да' : 'Нет',
                u.badges?.admin ? 'Да' : 'Нет'
            ]);
        });
        
        const blob = new Blob(['\uFEFF' + csv.map(row => row.join(';')).join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${type === 'success' ? '#57F287' : '#ED4245'}; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10001; animation: slideIn 0.3s ease;`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminUsers = AdminUsers;
window.adminUsers = new AdminUsers();