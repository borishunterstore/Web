class AdminProducts {
    constructor() {
        this.api = new BHStoreAPI();
    }

    async loadProducts() {
        try {
            const products = await this.api.getProducts();
            this.renderProducts(products);
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            throw error;
        }
    }

    renderProducts(products) {
        const productsContent = document.getElementById('productsContent');
        if (!productsContent) return;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="color: #b9bbbe;">
                    Всего товаров: <strong>${products.products.length}</strong>
                </div>
                <div>
                    <button class="btn-admin success" onclick="showAddProductForm()">
                        <i class="fas fa-plus"></i> Добавить товар
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Название</th>
                            <th>Описание</th>
                            <th>Цена</th>
                            <th>Категория</th>
                            <th>Популярный</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        products.products.forEach(product => {
            html += `
                <tr>
                    <td><code>${product.id}</code></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="${product.icon || 'fas fa-box'}"></i>
                            <strong>${product.name}</strong>
                        </div>
                    </td>
                    <td>${product.description}</td>
                    <td><strong style="color: #57F287;">${product.price} ₽</strong></td>
                    <td>
                        <span class="badge" style="background: #5865F2; color: white; padding: 4px 8px; border-radius: 12px;">
                            ${product.category}
                        </span>
                    </td>
                    <td>
                        ${product.popular ? 
                            '<span style="color: #57F287;"><i class="fas fa-star"></i> Да</span>' : 
                            '<span style="color: #72767d;"><i class="far fa-star"></i> Нет</span>'}
                    </td>
                    <td>
                        <button class="btn-admin" onclick="editProduct('${product.id}')">
                            <i class="fas fa-edit"></i> Изменить
                        </button>
                        <button class="btn-admin danger" onclick="deleteProduct('${product.id}')">
                            <i class="fas fa-trash"></i> Удалить
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
        
        productsContent.innerHTML = html;
    }
}

window.AdminProducts = AdminProducts;
window.loadProducts = async function() {
    const adminProducts = new AdminProducts();
    await adminProducts.loadProducts();
};