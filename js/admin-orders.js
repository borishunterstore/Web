// admin-orders.js - Адаптирован для Netlify Functions
class AdminOrders {
    constructor() {
        this.api = new BHStoreAPI();
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
    }

    async loadOrders() {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            
            const response = await fetch(`${this.baseUrl}/admin-orders`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.orders = data.orders || [];
                this.filteredOrders = [...this.orders];
                this.renderOrders();
            } else {
                throw new Error(data.error || 'Ошибка загрузки заказов');
            }
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            throw error;
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
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="color: #b9bbbe;">
                    <span style="margin-right: 20px;">
                        <i class="fas fa-shopping-cart"></i> Всего: <strong>${this.filteredOrders.length}</strong>
                    </span>
                    <span style="margin-right: 20px;">
                        <i class="fas fa-check-circle" style="color: #57F287;"></i> Выполнено: <strong style="color: #57F287;">${completedOrders}</strong>
                    </span>
                    <span>
                        <i class="fas fa-coins" style="color: #FEE75C;"></i> Выручка: <strong style="color: #FEE75C;">${totalRevenue} ₽</strong>
                    </span>
                </div>
                <div>
                    <input type="text" 
                           id="searchOrders" 
                           placeholder="Поиск по заказам..." 
                           style="padding: 8px 15px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; width: 250px;">
                </div>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Заказ</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Пользователь</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Товар</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Сумма</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Дата</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Статус</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (paginatedOrders.length === 0) {
            html += `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: #b9bbbe;">
                        <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>Заказы не найдены</p>
                    </td>
                </tr>
            `;
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
                    <tr style="border-bottom: 1px solid #40444b;" onclick="window.adminOrders.viewOrderDetails('${order.id}')" style="cursor: pointer;">
                        <td style="padding: 12px;">
                            <code style="color: #5865F2;">${order.id}</code>
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${order.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                                     style="width: 30px; height: 30px; border-radius: 50%;"
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="color: white;">${order.username || 'Неизвестно'}</div>
                                    <div style="color: #b9bbbe; font-size: 0.8rem;">${order.userDiscordId}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px; color: white;">
                            <strong>${order.productName}</strong>
                            ${order.promocodes ? `
                                <div style="color: #FEE75C; font-size: 0.8rem; margin-top: 4px;">
                                    <i class="fas fa-ticket-alt"></i> ${order.promocodes.join(', ')}
                                </div>
                            ` : ''}
                        </td>
                        <td style="padding: 12px;">
                            <div>
                                <span style="color: #57F287; font-weight: 600; font-size: 1.1rem;">${order.finalPrice || order.amount} ₽</span>
                                ${order.discount ? `
                                    <div style="color: #b9bbbe; font-size: 0.8rem;">
                                        <span style="text-decoration: line-through;">${order.originalPrice} ₽</span>
                                        <span style="color: #57F287;"> -${order.discount}%</span>
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td style="padding: 12px; color: #b9bbbe;">
                            <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>
                            ${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${status.bg}; color: ${status.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.9rem;">
                                ${status.text}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <button class="btn-admin small" onclick="event.stopPropagation(); window.adminOrders.viewOrderDetails('${order.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-admin small" onclick="event.stopPropagation(); window.adminOrders.exportOrder('${order.id}')" style="margin-left: 5px;">
                                <i class="fas fa-download"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            
            ${this.renderPagination()}
        `;
        
        ordersContent.innerHTML = html;
        this.setupSearchListener();
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        
        if (totalPages <= 1) return '';
        
        let paginationHtml = `
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 30px;">
        `;
        
        // Кнопка "Назад"
        paginationHtml += `
            <button class="btn-admin small" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="window.adminOrders.changePage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Номера страниц
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHtml += `
                    <button class="btn-admin ${i === this.currentPage ? 'active' : ''}" 
                            onclick="window.adminOrders.changePage(${i})"
                            style="${i === this.currentPage ? 'background: #5865F2;' : ''}">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHtml += `<span style="color: #b9bbbe;">...</span>`;
            }
        }
        
        // Кнопка "Вперед"
        paginationHtml += `
            <button class="btn-admin small" ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="window.adminOrders.changePage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        paginationHtml += `</div>`;
        
        return paginationHtml;
    }

    changePage(page) {
        this.currentPage = page;
        this.renderOrders();
        document.getElementById('ordersContent').scrollIntoView({ behavior: 'smooth' });
    }

    setupSearchListener() {
        const searchInput = document.getElementById('searchOrders');
        if (!searchInput) return;
        
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchOrders(e.target.value);
            }, 300);
        });
    }

    searchOrders(query) {
        if (!query.trim()) {
            this.filteredOrders = [...this.orders];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredOrders = this.orders.filter(order => 
                order.id?.toLowerCase().includes(searchTerm) ||
                order.username?.toLowerCase().includes(searchTerm) ||
                order.productName?.toLowerCase().includes(searchTerm) ||
                order.userDiscordId?.includes(searchTerm) ||
                (order.promocodes && order.promocodes.some(p => p.toLowerCase().includes(searchTerm)))
            );
        }
        
        this.currentPage = 1;
        this.renderOrders();
    }

    async viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #5865F2; margin: 0;">Детали заказа</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="background: #1e1f29; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Номер заказа</div>
                            <code style="color: #5865F2;">${order.id}</code>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Дата</div>
                            <div style="color: white;">${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}</div>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Пользователь</div>
                            <div style="color: white;">${order.username || 'Неизвестно'}</div>
                            <div style="color: #b9bbbe; font-size: 0.8rem;">${order.userDiscordId}</div>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Товар</div>
                            <div style="color: white; font-weight: 600;">${order.productName}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #40444b;">
                        <h3 style="color: white; margin-bottom: 15px;">Детали оплаты</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <div style="color: #b9bbbe;">Оригинальная цена</div>
                                <div style="color: #b9bbbe; text-decoration: line-through;">${order.originalPrice || order.amount} ₽</div>
                            </div>
                            <div>
                                <div style="color: #b9bbbe;">Итоговая цена</div>
                                <div style="color: #57F287; font-weight: 600; font-size: 1.2rem;">${order.finalPrice || order.amount} ₽</div>
                            </div>
                            ${order.discount ? `
                                <div>
                                    <div style="color: #b9bbbe;">Скидка</div>
                                    <div style="color: #57F287;">${order.discount}% (-${order.discountAmount} ₽)</div>
                                </div>
                            ` : ''}
                            ${order.promocodes ? `
                                <div>
                                    <div style="color: #b9bbbe;">Промокоды</div>
                                    <div style="color: #FEE75C;">${order.promocodes.join(', ')}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <div style="color: #b9bbbe; margin-bottom: 10px;">Статус</div>
                        <span style="background: ${order.status === 'completed' ? '#57F287' : '#FEE75C'}; 
                                   color: #1e1f29; padding: 6px 12px; border-radius: 20px;">
                            ${order.status === 'completed' ? '✅ Выполнен' : order.status}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">
                        Закрыть
                    </button>
                    ${order.status !== 'completed' ? `
                        <button class="btn-primary" onclick="window.adminOrders.markAsCompleted('${order.id}')">
                            <i class="fas fa-check"></i> Отметить как выполненный
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async markAsCompleted(orderId) {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            
            const response = await fetch(`${this.baseUrl}/admin-update-order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authData.token || ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: orderId,
                    status: 'completed'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadOrders();
                this.showNotification('Статус заказа обновлен', 'success');
            } else {
                throw new Error(data.error || 'Ошибка обновления заказа');
            }
        } catch (error) {
            console.error('Ошибка обновления заказа:', error);
            this.showNotification('Ошибка обновления заказа', 'error');
        }
    }

    exportOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const data = JSON.stringify(order, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-${orderId}.json`;
        a.click();
    }

    exportOrders() {
        const data = JSON.stringify(this.orders, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

window.AdminOrders = AdminOrders;
window.adminOrders = new AdminOrders();

window.loadOrders = async function() {
    await window.adminOrders.loadOrders();
};

window.viewOrderDetails = function(orderId) {
    window.adminOrders.viewOrderDetails(orderId);
};