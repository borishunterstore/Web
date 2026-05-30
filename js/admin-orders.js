class AdminOrders {
    constructor() {
        this.api = window.api;
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.statusFilter = 'all';
    }

    async loadOrders() {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            const response = await fetch('/api/admin/orders', {
                headers: {
                    'Authorization': 'Bearer ' + (authData.token || '')
                }
            });
            const data = await response.json();
            this.orders = data.orders || [];
            this.applyFilters();
            console.log('✅ Заказы загружены:', this.orders.length);
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            const container = document.getElementById('ordersContent');
            if (container) {
                container.innerHTML = `<div style="text-align:center;padding:40px;color:#ED4245;">Ошибка загрузки заказов: ${error.message}</div>`;
            }
        }
    }

    applyFilters() {
        let filtered = [...this.orders];
        if (this.statusFilter !== 'all') {
            filtered = filtered.filter(o => o.status === this.statusFilter);
        }
        this.filteredOrders = filtered;
        this.renderOrders();
    }

    setStatusFilter(status) {
        this.statusFilter = status;
        this.currentPage = 1;
        this.applyFilters();
    }

    renderOrders() {
        const container = document.getElementById('ordersContent');
        if (!container) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const paginatedOrders = this.filteredOrders.slice(startIndex, startIndex + this.itemsPerPage);
        
        const totalRevenue = this.filteredOrders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        const completedCount = this.filteredOrders.filter(o => o.status === 'completed').length;

        let html = `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">
                    <div class="stat-card" style="background:#1e1f29; padding:15px 25px; border-radius:12px;">
                        <div style="font-size:28px; font-weight:700;">${this.filteredOrders.length}</div>
                        <div style="color:#72767d;">Всего заказов</div>
                    </div>
                    <div class="stat-card" style="background:#1e1f29; padding:15px 25px; border-radius:12px;">
                        <div style="font-size:28px; font-weight:700; color:#57F287;">${completedCount}</div>
                        <div style="color:#72767d;">Выполнено</div>
                    </div>
                    <div class="stat-card" style="background:#1e1f29; padding:15px 25px; border-radius:12px;">
                        <div style="font-size:28px; font-weight:700; color:#FEE75C;">${totalRevenue} ₽</div>
                        <div style="color:#72767d;">Выручка</div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn-admin ${this.statusFilter === 'all' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('all')">📋 Все</button>
                        <button class="btn-admin ${this.statusFilter === 'completed' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('completed')">✅ Выполненные</button>
                        <button class="btn-admin ${this.statusFilter === 'processing' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('processing')">⚙️ В обработке</button>
                        <button class="btn-admin ${this.statusFilter === 'pending' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('pending')">⏳ Ожидают</button>
                        <button class="btn-admin ${this.statusFilter === 'cancelled' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('cancelled')">❌ Отменённые</button>
                    </div>
                    <div>
                        <input type="text" id="searchOrdersInput" placeholder="🔍 Поиск..." 
                               style="padding: 10px 15px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; width: 250px;">
                    </div>
                </div>
            </div>
            
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#2a2b36; border-bottom:2px solid #40444b;">
                        <th style="padding:15px 12px; text-align:left;">Заказ</th>
                        <th style="padding:15px 12px; text-align:left;">Пользователь</th>
                        <th style="padding:15px 12px; text-align:left;">Товар</th>
                        <th style="padding:15px 12px; text-align:left;">Сумма</th>
                        <th style="padding:15px 12px; text-align:left;">Дата</th>
                        <th style="padding:15px 12px; text-align:left;">Статус</th>
                        <th style="padding:15px 12px; text-align:center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (paginatedOrders.length === 0) {
            html += `<tr><td colspan="7" style="padding:60px; text-align:center; color:#72767d;">Нет заказов</td></tr>`;
        } else {
            for (const order of paginatedOrders) {
                const statusColors = {
                    'completed': { bg: '#57F287', color: '#1e1f29', text: 'Выполнен' },
                    'pending': { bg: '#FEE75C', color: '#1e1f29', text: 'Ожидание' },
                    'cancelled': { bg: '#ED4245', color: 'white', text: 'Отменен' },
                    'processing': { bg: '#5865F2', color: 'white', text: 'В обработке' }
                };
                const status = statusColors[order.status] || { bg: '#40444b', color: 'white', text: order.status };
                
                html += `
                    <tr style="border-bottom:1px solid #40444b;">
                        <td style="padding:12px;"><code style="color:#5865F2;">${order.id}</code></td>
                        <td style="padding:12px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <img src="${order.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width:32px; height:32px; border-radius:50%;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="color:white;">${this.escapeHtml(order.username || 'Неизвестно')}</div>
                                    <div style="color:#72767d; font-size:11px;">${order.userDiscordId}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding:12px;"><strong>${this.escapeHtml(order.productName)}</strong></td>
                        <td style="padding:12px;"><span style="color:#57F287; font-weight:700;">${order.finalPrice || order.amount} ₽</span></td>
                        <td style="padding:12px; color:#72767d;">${new Date(order.date || order.createdAt).toLocaleString()}</td>
                        <td style="padding:12px;">
                            <span style="background:${status.bg}; color:${status.color}; padding:5px 12px; border-radius:20px; font-size:12px;">${status.text}</span>
                        </td>
                        <td style="padding:12px; text-align:center;">
                            <button onclick="window.adminOrders.editOrder('${order.id}')" style="background:#5865F2; border:none; padding:8px 12px; border-radius:6px; color:white; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-edit"></i> Изменить
                            </button>
                            <button onclick="window.adminOrders.changeStatus('${order.id}')" style="background:#FEE75C; border:none; padding:8px 12px; border-radius:6px; color:#1e1f29; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-tag"></i> Статус
                            </button>
                            <button onclick="window.adminOrders.deleteOrder('${order.id}')" style="background:#ED4245; border:none; padding:8px 12px; border-radius:6px; color:white; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
        
        html += `</tbody></table>`;
        html += this.renderPagination();
        
        container.innerHTML = html;
        this.setupSearchListener();
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        if (totalPages <= 1) return '';
        
        let html = `<div style="display: flex; justify-content: center; gap: 8px; margin-top: 25px;">`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="btn-admin ${i === this.currentPage ? 'active' : ''}" onclick="window.adminOrders.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += `<span style="color:#72767d;">...</span>`;
            }
        }
        html += `</div>`;
        return html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderOrders();
    }

    setupSearchListener() {
        const input = document.getElementById('searchOrdersInput');
        if (!input) return;
        
        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (!term) {
                this.filteredOrders = [...this.orders];
            } else {
                this.filteredOrders = this.orders.filter(o => 
                    o.id?.toLowerCase().includes(term) ||
                    o.username?.toLowerCase().includes(term) ||
                    o.productName?.toLowerCase().includes(term)
                );
            }
            this.currentPage = 1;
            this.renderOrders();
        });
    }

    async editOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const newProductName = prompt('Название товара:', order.productName);
        if (!newProductName) return;
        
        const newAmount = prompt('Сумма (₽):', order.finalPrice || order.amount);
        if (!newAmount) return;
        
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({
                    productName: newProductName,
                    finalPrice: parseInt(newAmount)
                })
            });
            alert('Заказ обновлён!');
            await this.loadOrders();
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }

    async changeStatus(orderId) {
        const statuses = [
            { value: 'completed', label: '✅ Выполнен' },
            { value: 'processing', label: '⚙️ В обработке' },
            { value: 'pending', label: '⏳ Ожидание' },
            { value: 'cancelled', label: '❌ Отменен' }
        ];
        
        const menu = statuses.map(s => `${s.value}: ${s.label}`).join('\n');
        const newStatus = prompt(`Выберите статус:\n${menu}\n\nВведите значение:`, 'completed');
        
        if (!newStatus) return;
        
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            alert('Статус изменён!');
            await this.loadOrders();
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Удалить заказ?')) return;
        
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            await fetch(`/api/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authData.token}` }
            });
            alert('Заказ удалён!');
            await this.loadOrders();
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}

window.adminOrders = new AdminOrders();