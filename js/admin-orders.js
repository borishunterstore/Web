class AdminOrders {
    constructor() {
        this.api = window.api;
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
    }

    async loadOrders() {
        try {
            const data = await this.api.getAllOrders();
            this.orders = data.orders || [];
            this.filteredOrders = [...this.orders];
            this.renderOrders();
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            this.showNotification('Ошибка загрузки заказов', 'error');
        }
    }

    renderOrders() {
        const ordersContent = document.getElementById('ordersContent');
        if (!ordersContent) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
        
        const totalRevenue = this.filteredOrders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        const completedOrders = this.filteredOrders.filter(o => o.status === 'completed').length;

        let html = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; gap: 20px; background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                    <span><i class="fas fa-shopping-cart"></i> Всего: <strong>${this.filteredOrders.length}</strong></span>
                    <span><i class="fas fa-check-circle" style="color: #57F287;"></i> Выполнено: <strong style="color: #57F287;">${completedOrders}</strong></span>
                    <span><i class="fas fa-coins" style="color: #FEE75C;"></i> Выручка: <strong style="color: #FEE75C;">${totalRevenue} ₽</strong></span>
                </div>
                <div>
                    <input type="text" id="searchOrders" placeholder="Поиск по ID, пользователю, товару..." 
                           style="padding: 10px 15px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; width: 280px;">
                </div>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left;">Заказ</th>
                            <th style="padding: 12px; text-align: left;">Пользователь</th>
                            <th style="padding: 12px; text-align: left;">Товар</th>
                            <th style="padding: 12px; text-align: left;">Сумма</th>
                            <th style="padding: 12px; text-align: left;">Дата</th>
                            <th style="padding: 12px; text-align: left;">Статус</th>
                            <th style="padding: 12px; text-align: left;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (paginatedOrders.length === 0) {
            html += `<tr><td colspan="7" style="padding: 60px; text-align: center; color: #72767d;"><i class="fas fa-box-open" style="font-size: 3rem;"></i><p>Заказы не найдены</p></td></tr>`;
        } else {
            paginatedOrders.forEach(order => {
                const statusColors = {
                    'completed': { bg: '#57F287', color: '#1e1f29', text: '✅ Выполнен' },
                    'pending': { bg: '#FEE75C', color: '#1e1f29', text: '⏳ Ожидание' },
                    'cancelled': { bg: '#ED4245', color: 'white', text: '❌ Отменен' },
                    'processing': { bg: '#5865F2', color: 'white', text: '⚙️ В обработке' }
                };
                const status = statusColors[order.status] || { bg: '#40444b', color: 'white', text: order.status };
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;">
                        <td style="padding: 12px;"><code style="color: #5865F2;">${order.id}</code></td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${order.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                                     style="width: 30px; height: 30px; border-radius: 50%;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div><div style="color: white;">${order.username || 'Неизвестно'}</div><div style="color: #72767d; font-size: 0.75rem;">${order.userDiscordId}</div></div>
                            </div>
                        </td>
                        <td style="padding: 12px; color: white;"><strong>${order.productName}</strong></td>
                        <td style="padding: 12px;"><span style="color: #57F287; font-weight: 600;">${order.finalPrice || order.amount} ₽</span></td>
                        <td style="padding: 12px; color: #72767d; font-size: 0.85rem;">${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}</td>
                        <td style="padding: 12px;"><span style="background: ${status.bg}; color: ${status.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">${status.text}</span></td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-icon" onclick="window.adminOrders.editOrder('${order.id}')" title="Редактировать"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon" onclick="window.adminOrders.updateOrderStatus('${order.id}')" title="Изменить статус"><i class="fas fa-tag"></i></button>
                                <button class="btn-icon danger" onclick="window.adminOrders.deleteOrder('${order.id}')" title="Удалить"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table></div>${this.renderPagination()}`;
        ordersContent.innerHTML = html;
        this.setupSearchListener();
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        if (totalPages <= 1) return '';
        
        let html = `<div style="display: flex; justify-content: center; gap: 8px; margin-top: 20px;">`;
        html += `<button class="btn-admin small" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.adminOrders.changePage(${this.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="btn-admin ${i === this.currentPage ? 'active' : ''}" onclick="window.adminOrders.changePage(${i})" style="${i === this.currentPage ? 'background: #5865F2;' : ''}">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += `<span style="color: #72767d;">...</span>`;
            }
        }
        
        html += `<button class="btn-admin small" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.adminOrders.changePage(${this.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
        html += `</div>`;
        return html;
    }

    changePage(page) {
        this.currentPage = page;
        this.renderOrders();
        document.getElementById('ordersContent').scrollIntoView({ behavior: 'smooth' });
    }

    setupSearchListener() {
        const searchInput = document.getElementById('searchOrders');
        if (!searchInput) return;
        
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const term = e.target.value.toLowerCase();
                if (!term) {
                    this.filteredOrders = [...this.orders];
                } else {
                    this.filteredOrders = this.orders.filter(o => 
                        o.id?.toLowerCase().includes(term) ||
                        o.username?.toLowerCase().includes(term) ||
                        o.productName?.toLowerCase().includes(term) ||
                        o.userDiscordId?.includes(term)
                    );
                }
                this.currentPage = 1;
                this.renderOrders();
            }, 300);
        });
    }

    async editOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-edit"></i> Редактировать заказ</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <div style="background: #1e1f29; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <p><strong>Заказ:</strong> <code>${order.id}</code></p>
                    <p><strong>Пользователь:</strong> ${order.username} (${order.userDiscordId})</p>
                </div>
                <form id="editOrderForm">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Товар</label>
                        <input type="text" id="editProductName" value="${this.escapeHtml(order.productName)}" class="form-control" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Сумма (₽)</label>
                        <input type="number" id="editAmount" value="${order.finalPrice || order.amount}" class="form-control" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Статус</label>
                        <select id="editStatus" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ Выполнен</option>
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Ожидание</option>
                            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>⚙️ В обработке</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Отменен</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Дата</label>
                        <input type="datetime-local" id="editDate" value="${new Date(order.date || order.createdAt).toISOString().slice(0, 16)}" class="form-control" style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn-admin" style="flex: 1;">Отмена</button>
                        <button type="submit" class="btn-admin success" style="flex: 1;">Сохранить</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('editOrderForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                productName: document.getElementById('editProductName').value,
                finalPrice: parseInt(document.getElementById('editAmount').value),
                status: document.getElementById('editStatus').value,
                date: new Date(document.getElementById('editDate').value).toISOString()
            };
            
            try {
                await this.api.request(`/admin/orders/${orderId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedData)
                });
                modal.remove();
                this.showNotification('Заказ обновлён', 'success');
                await this.loadOrders();
            } catch (error) {
                this.showNotification('Ошибка обновления: ' + error.message, 'error');
            }
        });
    }

    async updateOrderStatus(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const statuses = [
            { value: 'completed', label: '✅ Выполнен', color: '#57F287' },
            { value: 'pending', label: '⏳ Ожидание', color: '#FEE75C' },
            { value: 'processing', label: '⚙️ В обработке', color: '#5865F2' },
            { value: 'cancelled', label: '❌ Отменен', color: '#ED4245' }
        ];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 25px; max-width: 350px; width: 90%;">
                <h3 style="margin: 0 0 20px 0;">Изменить статус заказа</h3>
                <p style="margin-bottom: 15px;">Заказ: <code>${order.id}</code></p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${statuses.map(s => `
                        <button onclick="window.adminOrders.setOrderStatus('${orderId}', '${s.value}'); this.closest('.modal').remove();" 
                                style="background: ${s.color}; border: none; padding: 12px; border-radius: 8px; color: ${s.value === 'completed' || s.value === 'pending' ? '#1e1f29' : 'white'}; cursor: pointer;">
                            ${s.label}
                        </button>
                    `).join('')}
                </div>
                <button onclick="this.closest('.modal').remove()" style="margin-top: 15px; width: 100%; padding: 10px; background: #40444b; border: none; border-radius: 8px; color: white; cursor: pointer;">Отмена</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async setOrderStatus(orderId, status) {
        try {
            await this.api.request(`/admin/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            this.showNotification(`Статус заказа изменён на "${status}"`, 'success');
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.')) return;
        
        try {
            await this.api.request(`/admin/orders/${orderId}`, { method: 'DELETE' });
            this.showNotification('Заказ удалён', 'success');
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
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

window.AdminOrders = AdminOrders;
window.adminOrders = new AdminOrders();