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
        
        // Фильтр по статусу
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

        const statusCounts = {
            all: this.filteredOrders.length,
            completed: completedOrders,
            pending: pendingOrders,
            processing: processingOrders,
            cancelled: cancelledOrders
        };

        let html = `
            <div style="margin-bottom: 20px;">
                <!-- Статистика -->
                <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-shopping-cart"></i> Всего: <strong>${this.filteredOrders.length}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-check-circle" style="color: #57F287;"></i> Выполнено: <strong style="color: #57F287;">${completedOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-clock" style="color: #FEE75C;"></i> В обработке: <strong style="color: #FEE75C;">${processingOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-hourglass-half" style="color: #5865F2;"></i> Ожидают: <strong style="color: #5865F2;">${pendingOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-ban" style="color: #ED4245;"></i> Отменено: <strong style="color: #ED4245;">${cancelledOrders}</strong></span>
                    </div>
                    <div style="background: #1e1f29; padding: 12px 20px; border-radius: 12px;">
                        <span><i class="fas fa-coins" style="color: #FEE75C;"></i> Выручка: <strong style="color: #FEE75C;">${totalRevenue} ₽</strong></span>
                    </div>
                </div>
                
                <!-- Панель управления -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn-admin ${this.statusFilter === 'all' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('all')">📋 Все (${statusCounts.all})</button>
                        <button class="btn-admin ${this.statusFilter === 'completed' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('completed')" style="background: ${this.statusFilter === 'completed' ? '#57F287' : ''}">✅ Выполненные (${statusCounts.completed})</button>
                        <button class="btn-admin ${this.statusFilter === 'processing' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('processing')" style="background: ${this.statusFilter === 'processing' ? '#5865F2' : ''}">⚙️ В обработке (${statusCounts.processing})</button>
                        <button class="btn-admin ${this.statusFilter === 'pending' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('pending')" style="background: ${this.statusFilter === 'pending' ? '#FEE75C' : ''}">⏳ Ожидают (${statusCounts.pending})</button>
                        <button class="btn-admin ${this.statusFilter === 'cancelled' ? 'active' : ''}" onclick="window.adminOrders.setStatusFilter('cancelled')" style="background: ${this.statusFilter === 'cancelled' ? '#ED4245' : ''}">❌ Отменённые (${statusCounts.cancelled})</button>
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
                            <th style="padding: 12px; text-align: left;">№ заказа</th>
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
                    <tr style="border-bottom: 1px solid #40444b;" data-order-id="${order.id}">
                        <td style="padding: 12px;"><code style="color: #5865F2; font-weight: 600;">${order.id}</code></td>
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
                                <button class="btn-icon" onclick="window.adminOrders.editOrder('${order.id}')" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="window.adminOrders.changeStatusDropdown('${order.id}')" title="Изменить статус">
                                    <i class="fas fa-tag"></i>
                                </button>
                                <button class="btn-icon danger" onclick="window.adminOrders.deleteOrder('${order.id}')" title="Удалить">
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
    async changeStatusDropdown(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        const statuses = [
            { value: 'completed', label: '✅ Выполнен', color: '#57F287', icon: 'fa-check-circle' },
            { value: 'processing', label: '⚙️ В обработке', color: '#5865F2', icon: 'fa-cogs' },
            { value: 'pending', label: '⏳ Ожидание', color: '#FEE75C', icon: 'fa-clock' },
            { value: 'cancelled', label: '❌ Отменен', color: '#ED4245', icon: 'fa-ban' }
        ];
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 25px; max-width: 350px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;"><i class="fas fa-tag"></i> Изменить статус</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <p style="margin-bottom: 15px; color: #b9bbbe;">Заказ: <code style="color: #5865F2;">${order.id}</code></p>
                <p style="margin-bottom: 15px;">Товар: <strong>${this.escapeHtml(order.productName)}</strong></p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${statuses.map(s => `
                        <button onclick="window.adminOrders.updateOrderStatus('${orderId}', '${s.value}'); this.closest('.modal').remove();" 
                                style="background: ${s.color}; border: none; padding: 12px; border-radius: 8px; color: ${s.value === 'completed' || s.value === 'pending' ? '#1e1f29' : 'white'}; cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas ${s.icon}"></i> ${s.label}
                        </button>
                    `).join('')}
                </div>
                <button onclick="this.closest('.modal').remove()" style="margin-top: 15px; width: 100%; padding: 10px; background: #40444b; border: none; border-radius: 8px; color: white; cursor: pointer;">Отмена</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async updateOrderStatus(orderId, status) {
        try {
            const order = this.orders.find(o => o.id === orderId);
            if (!order) throw new Error('Заказ не найден');
            
            // Находим пользователя и обновляем статус заказа в БД
            const users = await this.api.getAllUsers();
            let found = false;
            
            for (const user of users.users) {
                const orders = user.orders || [];
                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    orders[orderIndex] = {
                        ...orders[orderIndex],
                        status: status,
                        updatedAt: new Date().toISOString()
                    };
                    
                    await this.api.request(`/admin/users/${user.discordId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ orders: orders })
                    });
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Прямой API вызов
                await this.api.request(`/admin/orders/${orderId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status })
                });
            }
            
            const statusNames = {
                'completed': '✅ Выполнен',
                'processing': '⚙️ В обработке',
                'pending': '⏳ Ожидание',
                'cancelled': '❌ Отменен'
            };
            
            this.showNotification(`Статус заказа изменён на "${statusNames[status] || status}"`, 'success');
            await this.loadOrders();
            
            // Отправляем уведомление пользователю
            if (status === 'cancelled') {
                await this.sendOrderNotification(order.userDiscordId, order.productName, 'cancelled');
            } else if (status === 'completed') {
                await this.sendOrderNotification(order.userDiscordId, order.productName, 'completed');
            }
            
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    // ========== РЕДАКТИРОВАНИЕ ЗАКАЗА ==========
    async editOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-edit"></i> Редактировать заказ</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="background: #1e1f29; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <p><strong>ID заказа:</strong> <code style="color: #5865F2;">${order.id}</code></p>
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
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Примечание (необязательно)</label>
                        <textarea id="editNote" rows="3" placeholder="Внутреннее примечание..." 
                                  style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">${order.note || ''}</textarea>
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
                date: new Date(document.getElementById('editDate').value).toISOString(),
                note: document.getElementById('editNote').value
            };
            
            try {
                // Находим пользователя и обновляем заказ
                const users = await this.api.getAllUsers();
                let found = false;
                
                for (const user of users.users) {
                    const orders = user.orders || [];
                    const orderIndex = orders.findIndex(o => o.id === orderId);
                    if (orderIndex !== -1) {
                        orders[orderIndex] = {
                            ...orders[orderIndex],
                            ...updatedData,
                            updatedAt: new Date().toISOString()
                        };
                        
                        await this.api.request(`/admin/users/${user.discordId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ orders: orders })
                        });
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    await this.api.request(`/admin/orders/${orderId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatedData)
                    });
                }
                
                modal.remove();
                this.showNotification('Заказ обновлён', 'success');
                await this.loadOrders();
            } catch (error) {
                this.showNotification('Ошибка обновления: ' + error.message, 'error');
            }
        });
    }

    // ========== УДАЛЕНИЕ ЗАКАЗА ==========
    async deleteOrder(orderId) {
        if (!confirm('⚠️ ВНИМАНИЕ! Удаление заказа также удалит его из истории пользователя. Это действие нельзя отменить. Продолжить?')) return;
        
        try {
            // Находим пользователя и удаляем заказ
            const users = await this.api.getAllUsers();
            let found = false;
            
            for (const user of users.users) {
                const orders = user.orders || [];
                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    orders.splice(orderIndex, 1);
                    
                    await this.api.request(`/admin/users/${user.discordId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ orders: orders })
                    });
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                await this.api.request(`/admin/orders/${orderId}`, { method: 'DELETE' });
            }
            
            this.showNotification('Заказ удалён', 'success');
            await this.loadOrders();
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    // ========== СОЗДАНИЕ ЗАКАЗА (ВРУЧНУЮ) ==========
    async showAddOrderModal() {
        // Загружаем список пользователей для выбора
        const usersData = await this.api.getAllUsers();
        const users = usersData.users || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
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
                        <input type="text" id="orderProductName" required placeholder="Например: Монтаж видео" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Сумма (₽)</label>
                        <input type="number" id="orderAmount" required min="0" step="1" placeholder="0" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
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
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Дата</label>
                        <input type="datetime-local" id="orderDate" value="${new Date().toISOString().slice(0, 16)}" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label>Примечание</label>
                        <textarea id="orderNote" rows="3" placeholder="Внутреннее примечание..." 
                                  style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;"></textarea>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="orderSubtractBalance" checked>
                            <span>Списать сумму с баланса пользователя</span>
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn-admin" style="flex: 1;">Отмена</button>
                        <button type="submit" class="btn-admin success" style="flex: 1;">Создать заказ</button>
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
        const date = document.getElementById('orderDate').value;
        const note = document.getElementById('orderNote').value;
        const subtractBalance = document.getElementById('orderSubtractBalance').checked;
        
        if (!userId || !productName || !amount) {
            this.showNotification('Заполните все обязательные поля', 'error');
            return;
        }
        
        try {
            // Получаем пользователя
            const userData = await this.api.getUser(userId);
            const user = userData.user;
            
            if (!user) {
                this.showNotification('Пользователь не найден', 'error');
                return;
            }
            
            const orderId = `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            
            const order = {
                id: orderId,
                productId: `manual_${Date.now()}`,
                productName: productName,
                price: amount,
                finalPrice: amount,
                originalPrice: amount,
                amount: amount,
                status: status,
                date: new Date(date).toISOString(),
                note: note,
                isManual: true,
                createdAt: new Date().toISOString()
            };
            
            // Если нужно списать баланс
            let newBalance = user.balance || 0;
            if (subtractBalance && status !== 'cancelled') {
                if (newBalance < amount) {
                    this.showNotification(`Недостаточно средств на балансе пользователя! Доступно: ${newBalance} ₽`, 'error');
                    return;
                }
                newBalance = newBalance - amount;
            }
            
            // Обновляем пользователя
            const orders = user.orders || [];
            orders.push(order);
            
            await this.api.request(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    orders: orders,
                    balance: newBalance
                })
            });
            
            this.showNotification(`Заказ ${orderId} создан!`, 'success');
            await this.loadOrders();
            
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            this.showNotification('Ошибка создания заказа: ' + error.message, 'error');
        }
    }

    // ========== ОТПРАВКА УВЕДОМЛЕНИЙ ==========
    async sendOrderNotification(userId, productName, status) {
        try {
            const statusMessages = {
                'completed': `✅ Ваш заказ "${productName}" выполнен! Спасибо за покупку!`,
                'cancelled': `❌ Ваш заказ "${productName}" был отменён администратором.`
            };
            
            const message = statusMessages[status];
            if (message && userId) {
                // Отправляем уведомление в чат
                await this.api.sendChatMessage(userId, message, true);
            }
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
        }
    }

    // ========== УТИЛИТЫ ==========
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
        notification.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; 
            background: ${type === 'success' ? '#57F287' : type === 'warning' ? '#FEE75C' : '#ED4245'}; 
            color: ${type === 'success' || type === 'warning' ? '#1e1f29' : 'white'}; 
            padding: 12px 20px; border-radius: 8px; z-index: 10001; 
            animation: slideIn 0.3s ease; font-weight: 500;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
}

window.AdminOrders = AdminOrders;
window.adminOrders = new AdminOrders();