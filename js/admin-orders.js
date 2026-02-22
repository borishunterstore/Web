class AdminOrders {
    constructor() {
        this.api = new BHStoreAPI();
    }

    async loadOrders() {
        try {
            const ordersData = await this.api.getAllOrders();
            this.renderOrders(ordersData);
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            throw error;
        }
    }

    renderOrders(ordersData) {
        const ordersContent = document.getElementById('ordersContent');
        if (!ordersContent) return;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="color: #b9bbbe;">
                    Всего заказов: <strong>${ordersData.total}</strong> | 
                    Общая выручка: <strong style="color: #57F287;">${ordersData.totalRevenue} ₽</strong>
                </div>
                <div>
                    <button class="btn-admin" onclick="exportOrders()">
                        <i class="fas fa-download"></i> Экспорт CSV
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Номер заказа</th>
                            <th>Пользователь</th>
                            <th>Товар</th>
                            <th>Сумма</th>
                            <th>Дата</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        ordersData.orders.forEach(order => {
            html += `
                <tr>
                    <td><code>${order.id}</code></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-user"></i>
                            <span>${order.username || 'Неизвестно'}</span>
                        </div>
                    </td>
                    <td>${order.productName}</td>
                    <td><strong style="color: #57F287;">${order.finalPrice} ₽</strong></td>
                    <td>${new Date(order.date).toLocaleString('ru-RU')}</td>
                    <td>
                        <span class="badge" style="background: #57F287; color: #1e1f29; padding: 4px 8px; border-radius: 12px;">
                            ${order.status === 'completed' ? '✅ Выполнен' : order.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn-admin" onclick="viewOrderDetails('${order.id}')">
                            <i class="fas fa-eye"></i> Просмотр
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        ordersContent.innerHTML = html;
    }

    viewOrderDetails(orderId) {
        alert(`Просмотр деталей заказа: ${orderId}\nЭта функция в разработке.`);
    }
}

window.AdminOrders = AdminOrders;
window.loadOrders = async function() {
    const adminOrders = new AdminOrders();
    await adminOrders.loadOrders();
};

window.viewOrderDetails = function(orderId) {
    const adminOrders = new AdminOrders();
    adminOrders.viewOrderDetails(orderId);
};