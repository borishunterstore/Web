class AdminStats {
    constructor() {
        this.api = new BHStoreAPI();
    }

    async loadStats() {
        try {
            const stats = await this.api.getStats();
            this.renderStats(stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            throw error;
        }
    }

    renderStats(stats) {
        const statsContent = document.getElementById('statsContent');
        if (!statsContent) return;

        statsContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Всего пользователей</div>
                    <div class="stat-value">${stats.stats.totalUsers}</div>
                    <div class="stat-label">+${stats.stats.newUsers} за неделю</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Всего заказов</div>
                    <div class="stat-value">${stats.stats.totalOrders}</div>
                    <div class="stat-label">+${stats.stats.newOrders} за неделю</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Общая выручка</div>
                    <div class="stat-value">${stats.stats.revenue} ₽</div>
                    <div class="stat-label">Средний чек: ${stats.stats.avgOrderValue} ₽</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Конверсия</div>
                    <div class="stat-value">${stats.stats.conversion}%</div>
                    <div class="stat-label">Покупают ${stats.stats.conversion}% пользователей</div>
                </div>
            </div>
            
            <div style="background: #1e1f29; padding: 20px; border-radius: 10px; margin-top: 30px;">
                <h3 style="color: #b9bbbe; margin-bottom: 15px;">📈 Быстрая статистика</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div style="background: #2a2b36; padding: 15px; border-radius: 8px;">
                        <div style="color: #b9bbbe; font-size: 0.9rem;">Заказов на пользователя</div>
                        <div style="color: #57F287; font-size: 1.5rem; font-weight: bold;">
                            ${(stats.stats.totalOrders / Math.max(stats.stats.totalUsers, 1)).toFixed(2)}
                        </div>
                    </div>
                    <div style="background: #2a2b36; padding: 15px; border-radius: 8px;">
                        <div style="color: #b9bbbe; font-size: 0.9rem;">Выручка на пользователя</div>
                        <div style="color: #57F287; font-size: 1.5rem; font-weight: bold;">
                            ${(stats.stats.revenue / Math.max(stats.stats.totalUsers, 1)).toFixed(0)} ₽
                        </div>
                    </div>
                    <div style="background: #2a2b36; padding: 15px; border-radius: 8px;">
                        <div style="color: #b9bbbe; font-size: 0.9rem;">Выручка на заказ</div>
                        <div style="color: #57F287; font-size: 1.5rem; font-weight: bold;">
                            ${(stats.stats.revenue / Math.max(stats.stats.totalOrders, 1)).toFixed(0)} ₽
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

window.AdminStats = AdminStats;
window.loadStats = async function() {
    const adminStats = new AdminStats();
    await adminStats.loadStats();
};