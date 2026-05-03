class AdminOrders {
    constructor() {
        this.api = window.api;
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.statusFilter = 'all';
    }

    async loadOrders() {
        try {
            const data = await this.api.getAllOrders();
            this.orders = data.orders || [];
            this.applyFilters();
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            this.showNotification('Ошибка загрузки заказов', 'error');
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
        const ordersContent = document.getElementById('ordersContent');
        if (!ordersContent) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
        
        const totalRevenue = this.filteredOrders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        const completedOrders = this.filteredOrders.filter(o => o.status === 'completed').length;
        const pendingOrders = this.filteredOrders.filter(o => o.status === 'pending').length;
        const cancelledOrders = this.filteredOrders.filter(o => o.status === 'cancelled').length;
        const processingOrders = this.filteredOrders.filter(o => o.status === 'processing').length;

        let html = `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-shopping-cart"></i> Всего: <strong>${this.filteredOrders.length}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-check-circle" style="color: #57F287;"></i> Выполнено: <strong style="color: #57F287;">${completedOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-cogs" style="color: #5865F2;"></i> В обработке: <strong style="color: #5865F2;">${processingOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-clock" style="color: #FEE75C;"></i> Ожидают: <strong style="color: #FEE75C;">${pendingOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-ban" style="color: #ED4245;"></i> Отменено: <strong style="color: #ED4245;">${cancelledOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-coins" style="color: #FEE75C;"></i> Выручка: <strong style="color: #FEE75C;">${totalRevenue} ₽</strong></span>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn-admin ${this.statusFilter === 'all' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('all')">📋 Все</button>
                        <button class="btn-admin ${this.statusFilter === 'completed' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('completed')" style="${this.statusFilter === 'completed' ? 'background: #57F287; color: #1e1f29;' : ''}">✅ Выполненные</button>
                        <button class="btn-admin ${this.statusFilter === 'processing' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('processing')" style="${this.statusFilter === 'processing' ? 'background: #5865F2;' : ''}">⚙️ В обработке</button>
                        <button class="btn-admin ${this.statusFilter === 'pending' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('pending')" style="${this.statusFilter === 'pending' ? 'background: #FEE75C; color: #1e1f29;' : ''}">⏳ Ожидают</button>
                        <button class="btn-admin ${this.statusFilter === 'cancelled' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('cancelled')" style="${this.statusFilter === 'cancelled' ? 'background: #ED4245;' : ''}">❌ Отменённые</button>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="searchOrders" placeholder="🔍 Поиск по заказам..." 
                               style="padding: 10px 15px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; width: 250px;">
                        <button class="btn-admin success" onclick="window.adminOrders.showAddOrderModal()">
                            <i class="fas fa-plus"></i> Создать заказ
                        </button>
                    </div>
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
                const statusConfig = {
                    'completed': { bg: '#57F287', color: '#1e1f29', text: '✅ Выполнен', icon: 'fa-check-circle' },
                    'pending': { bg: '#FEE75C', color: '#1e1f29', text: '⏳ Ожидание', icon: 'fa-clock' },
                    'cancelled': { bg: '#ED4245', color: 'white', text: '❌ Отменен', icon: 'fa-ban' },
                    'processing': { bg: '#5865F2', color: 'white', text: '⚙️ В обработке', icon: 'fa-cogs' }
                };
                const status = statusConfig[order.status] || { bg: '#40444b', color: 'white', text: order.status, icon: 'fa-question' };
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;">
                        <td style="padding: 12px;"><code style="color: #5865F2; font-weight: 600;">${this.escapeHtml(order.id)}</code></td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${order.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                                     style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" 
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="color: white; font-weight: 500;">${this.escapeHtml(order.username || 'Неизвестно')}</div>
                                    <div style="color: #72767d; font-size: 0.7rem;">${order.userDiscordId}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px; color: white;"><strong>${this.escapeHtml(order.productName)}</strong></td>
                        <td style="padding: 12px;"><span style="color: #57F287; font-weight: 700; font-size: 1.1rem;">${order.finalPrice || order.amount} ₽</span></td>
                        <td style="padding: 12px; color: #72767d; font-size: 0.8rem;">
                            <i class="fas fa-calendar-alt"></i> ${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${status.bg}; color: ${status.color}; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
                                <i class="fas ${status.icon}"></i> ${status.text}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                <button class="btn-icon" onclick="window.adminOrders.editOrderModal('${order.id}')" title="Редактировать" style="background: #5865F2; border: none; padding: 8px; border-radius: 6px; cursor: pointer; color: white;">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="window.adminOrders.changeStatus('${order.id}')" title="Изменить статус" style="background: #FEE75C; border: none; padding: 8px; border-radius: 6px; cursor: pointer; color: #1e1f29;">
                                    <i class="fas fa-tag"></i>
                                </button>
                                <button class="btn-icon" onclick="window.adminOrders.deleteOrderConfirm('${order.id}')" title="Удалить" style="background: #ED4245; border: none; padding: 8px; border-radius: 6px; cursor: pointer; color: white;">
                                    <i class="fas fa-trash"></i>
                                </button>
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
        document.getElementById('ordersContent')?.scrollIntoView({ behavior: 'smooth' });
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

    // ========== ИЗМЕНЕНИЕ СТАТУСА ==========
    async changeStatus(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 25px; max-width: 350px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;"><i class="fas fa-tag"></i> Изменить статус</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <p style="margin-bottom: 15px; color: #b9bbbe;">Заказ: <code style="color: #5865F2;">${this.escapeHtml(order.id)}</code></p>
                <p style="margin-bottom: 15px;">Товар: <strong>${this.escapeHtml(order.productName)}</strong></p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="window.adminOrders.updateStatus('${orderId}', 'completed'); this.closest('.modal').remove();" 
                            style="background: #57F287; border: none; padding: 12px; border-radius: 8px; color: #1e1f29; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-check-circle"></i> ✅ Выполнен
                    </button>
                    <button onclick="window.adminOrders.updateStatus('${orderId}', 'processing'); this.closest('.modal').remove();" 
                            style="background: #5865F2; border: none; padding: 12px; border-radius: 8px; color: white; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-cogs"></i> ⚙️ В обработке
                    </button>
                    <button onclick="window.adminOrders.updateStatus('${orderId}', 'pending'); this.closest('.modal').remove();" 
                            style="background: #FEE75C; border: none; padding: 12px; border-radius: 8px; color: #1e1f29; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-clock"></i> ⏳ Ожидание
                    </button>
                    <button onclick="window.adminOrders.updateStatus('${orderId}', 'cancelled'); this.closest('.modal').remove();" 
                            style="background: #ED4245; border: none; padding: 12px; border-radius: 8px; color: white; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-ban"></i> ❌ Отменен
                    </button>
                </div>
                <button onclick="this.closest('.modal').remove()" style="margin-top: 15px; width: 100%; padding: 10px; background: #40444b; border: none; border-radius: 8px; color: white; cursor: pointer;">Отмена</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async updateStatus(orderId, status) {
        try {
            // Ищем заказ и обновляем статус
            let found = false;
            for (const order of this.orders) {
                if (order.id === orderId) {
                    order.status = status;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                throw new Error('Заказ не найден');
            }
            
            // Обновляем через API (нужно добавить в server.js)
            const response = await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : '')
                },
                body: JSON.stringify({ status: status })
            });
            
            const result = await response.json();
            
            const statusNames = {
                'completed': 'Выполнен',
                'processing': 'В обработке',
                'pending': 'Ожидание',
                'cancelled': 'Отменен'
            };
            
            this.showNotification(`Статус заказа изменён на "${statusNames[status]}"`, 'success');
            await this.loadOrders();
            
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    // ========== РЕДАКТИРОВАНИЕ ==========
    async editOrderModal(orderId) {
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
                    <p><strong>ID заказа:</strong> <code style="color: #5865F2;">${this.escapeHtml(order.id)}</code></p>
                    <p><strong>Пользователь:</strong> ${this.escapeHtml(order.username)} (${order.userDiscordId})</p>
                </div>
                <form id="editOrderForm">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Название товара</label>
                        <input type="text" id="editProductName" value="${this.escapeHtml(order.productName)}" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Сумма (₽)</label>
                        <input type="number" id="editAmount" value="${order.finalPrice || order.amount}" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Статус</label>
                        <select id="editStatus" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ Выполнен</option>
                            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>⚙️ В обработке</option>
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Ожидание</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Отменен</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Дата</label>
                        <input type="datetime-local" id="editDate" value="${new Date(order.date || order.createdAt).toISOString().slice(0, 16)}" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
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
                const response = await fetch(`/api/admin/orders/${orderId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : '')
                    },
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

    // ========== УДАЛЕНИЕ ==========
    async deleteOrderConfirm(orderId) {
        if (!confirm('⚠️ ВНИМАНИЕ! Удаление заказа нельзя отменить. Продолжить?')) return;
        
        try {
            const response = await fetch(`/api/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : '')
                }
            });
            
            this.showNotification('Заказ удалён', 'success');
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    // ========== СОЗДАНИЕ ЗАКАЗА ==========
    async showAddOrderModal() {
        const usersData = await this.api.getAllUsers();
        const users = usersData.users || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-plus-circle"></i> Создать заказ</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <form id="addOrderForm">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Пользователь</label>
                        <select id="orderUserId" required style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                            <option value="">Выберите пользователя...</option>
                            ${users.map(u => `<option value="${u.discordId}">${this.escapeHtml(u.username)} (${u.discordId})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Название товара</label>
                        <input type="text" id="orderProductName" required style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Сумма (₽)</label>
                        <input type="number" id="orderAmount" required min="0" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Статус</label>
                        <select id="orderStatus" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                            <option value="completed">✅ Выполнен</option>
                            <option value="processing">⚙️ В обработке</option>
                            <option value="pending">⏳ Ожидание</option>
                            <option value="cancelled">❌ Отменен</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn-admin" style="flex: 1;">Отмена</button>
                        <button type="submit" class="btn-admin success" style="flex: 1;">Создать</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addOrderForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createOrder();
            modal.remove();
        });
    }

    async createOrder() {
        const userId = document.getElementById('orderUserId').value;
        const productName = document.getElementById('orderProductName').value;
        const amount = parseInt(document.getElementById('orderAmount').value);
        const status = document.getElementById('orderStatus').value;
        
        if (!userId || !productName || !amount) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }
        
        try {
            const orderId = `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            
            const orderData = {
                userId: userId,
                productName: productName,
                amount: amount,
                status: status,
                orderId: orderId,
                isManual: true
            };
            
            const response = await fetch('/api/admin/orders/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : '')
                },
                body: JSON.stringify(orderData)
            });
            
            this.showNotification(`Заказ ${orderId} создан!`, 'success');
            await this.loadOrders();
            
        } catch (error) {
            this.showNotification('Ошибка создания: ' + error.message, 'error');
        }
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; 
            background: ${type === 'success' ? '#57F287' : '#ED4245'}; 
            color: ${type === 'success' ? '#1e1f29' : 'white'}; 
            padding: 12px 20px; border-radius: 8px; z-index: 10001; 
            animation: slideIn 0.3s ease; font-weight: 500;
        `;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminOrders = AdminOrders;
window.adminOrders = new AdminOrders();