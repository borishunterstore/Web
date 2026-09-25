class AdminOrders {
    constructor() {
        this.api = window.api;
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.statusFilter = 'all';
        this.statuses = [
            { value: 'pending', label: '⏳ Ожидание', color: '#FEE75C', bg: '#FEE75C', textColor: '#1e1f29' },
            { value: 'processing', label: '⚙️ В обработке', color: '#5865F2', bg: '#5865F2', textColor: '#ffffff' },
            { value: 'completed', label: '✅ Выполнен', color: '#57F287', bg: '#57F287', textColor: '#1e1f29' },
            { value: 'cancelled', label: '❌ Отменен', color: '#ED4245', bg: '#ED4245', textColor: '#ffffff' }
        ];
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
            
            <div style="overflow-x: auto;">
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
                const status = this.getStatusInfo(order.status);
                
                html += `
                    <tr style="border-bottom:1px solid #40444b;">
                        <td style="padding:12px;"><code style="color:#5865F2;">${this.escapeHtml(order.id)}</code></td>
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
                            <span style="background:${status.bg}; color:${status.textColor}; padding:5px 12px; border-radius:20px; font-size:12px;">${status.label}</span>
                        </td>
                        <td style="padding:12px; text-align:center;">
                            <button onclick="window.adminOrders.editOrder('${order.id}')" style="background:#5865F2; border:none; padding:8px 12px; border-radius:6px; color:white; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="window.adminOrders.openStatusModal('${order.id}')" style="background:#FEE75C; border:none; padding:8px 12px; border-radius:6px; color:#1e1f29; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-tag"></i>
                            </button>
                            <button onclick="window.adminOrders.deleteOrder('${order.id}')" style="background:#ED4245; border:none; padding:8px 12px; border-radius:6px; color:white; cursor:pointer; margin:0 3px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
        
        html += `</tbody></table></div>`;
        html += this.renderPagination();
        
        container.innerHTML = html;
        this.setupSearchListener();
    }

    getStatusInfo(status) {
        const found = this.statuses.find(s => s.value === status);
        return found || { value: status, label: status, bg: '#40444b', textColor: 'white' };
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

    // ============= НОВОЕ: КАСТОМНОЕ ОКНО ДЛЯ СТАТУСА =============
    openStatusModal(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Заказ не найден!');
            return;
        }

        const currentStatus = order.status || 'pending';
        const modalId = 'statusModal';

        // Удаляем старую модалку если есть
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        // Создаём модалку
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal status-modal';
        modal.style.cssText = `
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(8px);
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="
                background: #1e1f29;
                border-radius: 20px;
                padding: 35px;
                max-width: 450px;
                width: 100%;
                border: 1px solid #40444b;
                box-shadow: 0 25px 60px rgba(0,0,0,0.5);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="color: white; font-size: 20px; margin: 0;">
                        <i class="fas fa-tag" style="color: #FEE75C;"></i> 
                        Изменить статус
                    </h2>
                    <button onclick="window.adminOrders.closeStatusModal()" style="
                        background: none;
                        border: none;
                        color: #72767d;
                        font-size: 24px;
                        cursor: pointer;
                        transition: color 0.2s;
                    " onmouseover="this.style.color='white'" onmouseout="this.style.color='#72767d'">
                        ×
                    </button>
                </div>

                <div style="
                    background: #2a2b36;
                    border-radius: 12px;
                    padding: 12px 16px;
                    margin-bottom: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span style="color: #72767d; font-size: 13px;">Заказ</span>
                    <code style="color: #5865F2; font-weight: 600;">${this.escapeHtml(order.id)}</code>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${this.statuses.map(s => `
                        <button class="status-option" data-status="${s.value}" onclick="window.adminOrders.selectStatus('${s.value}')" style="
                            display: flex;
                            align-items: center;
                            gap: 14px;
                            padding: 14px 18px;
                            background: ${currentStatus === s.value ? '#2a2b36' : 'transparent'};
                            border: 2px solid ${currentStatus === s.value ? s.bg : '#40444b'};
                            border-radius: 12px;
                            cursor: pointer;
                            transition: all 0.25s ease;
                            color: white;
                            font-size: 15px;
                            font-weight: 500;
                            width: 100%;
                            text-align: left;
                        " onmouseover="if(this.dataset.status !== '${currentStatus}'){this.style.borderColor='${s.bg}';this.style.background='#2a2b36'}" onmouseout="if(this.dataset.status !== '${currentStatus}'){this.style.borderColor='#40444b';this.style.background='transparent'}">
                            <span style="
                                display: inline-block;
                                width: 12px;
                                height: 12px;
                                border-radius: 50%;
                                background: ${s.bg};
                                flex-shrink: 0;
                            "></span>
                            <span style="flex: 1;">${s.label}</span>
                            ${currentStatus === s.value ? `<i class="fas fa-check" style="color: ${s.bg}; font-size: 18px;"></i>` : ''}
                        </button>
                    `).join('')}
                </div>

                <div style="display: flex; gap: 10px; margin-top: 25px;">
                    <button onclick="window.adminOrders.closeStatusModal()" style="
                        flex: 1;
                        padding: 12px;
                        background: transparent;
                        border: 1px solid #40444b;
                        border-radius: 10px;
                        color: #72767d;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s;
                    " onmouseover="this.style.borderColor='#72767d';this.style.color='white'" onmouseout="this.style.borderColor='#40444b';this.style.color='#72767d'">
                        Отмена
                    </button>
                    <button id="applyStatusBtn" onclick="window.adminOrders.applyStatus('${order.id}')" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #5865F2, #4752c4);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fas fa-check"></i> Применить
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Сохраняем выбранный статус
        this.selectedStatus = currentStatus;
        this.currentOrderId = orderId;

        // Закрытие по клику вне окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeStatusModal();
        });

        // Закрытие по Escape
        document.addEventListener('keydown', this._handleEsc = (e) => {
            if (e.key === 'Escape') this.closeStatusModal();
        });
    }

    selectStatus(status) {
        this.selectedStatus = status;
        
        // Обновляем внешний вид кнопок
        document.querySelectorAll('.status-option').forEach(btn => {
            const isSelected = btn.dataset.status === status;
            const statusInfo = this.statuses.find(s => s.value === status);
            
            btn.style.borderColor = isSelected ? statusInfo.bg : '#40444b';
            btn.style.background = isSelected ? '#2a2b36' : 'transparent';
            
            // Обновляем галочку
            const checkMark = btn.querySelector('.fa-check');
            if (isSelected && !checkMark) {
                const span = document.createElement('span');
                span.innerHTML = `<i class="fas fa-check" style="color: ${statusInfo.bg}; font-size: 18px;"></i>`;
                btn.appendChild(span);
            } else if (!isSelected && checkMark) {
                checkMark.remove();
            }
        });
    }

    async applyStatus(orderId) {
        if (!this.selectedStatus) {
            alert('Выберите статус!');
            return;
        }

        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            const response = await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({ status: this.selectedStatus })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка обновления статуса');
            }

            this.closeStatusModal();
            await this.loadOrders();
            
            // Показываем уведомление
            this.showToast('✅ Статус заказа обновлён!', 'success');
            
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }

    closeStatusModal() {
        const modal = document.getElementById('statusModal');
        if (modal) modal.remove();
        if (this._handleEsc) {
            document.removeEventListener('keydown', this._handleEsc);
        }
        this.selectedStatus = null;
        this.currentOrderId = null;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#57F287' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 99999;
            animation: slideUp 0.4s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ============= ОСТАЛЬНЫЕ МЕТОДЫ =============

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
            this.showToast('✅ Заказ обновлён!', 'success');
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
            this.showToast('🗑️ Заказ удалён!', 'success');
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