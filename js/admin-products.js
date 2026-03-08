// admin-products.js - Исправленная версия
class AdminProducts {
    constructor() {
        this.api = window.BHStoreAPI || window.api;
        this.baseUrl = 'https://bhstore.netlify.app';
        this.products = [];
    }

    async loadProducts() {
        try {
            const data = await this.api.getProducts();
            this.products = data.products || [];
            this.renderProducts();
        } catch (error) {
            console.error('❌ Ошибка загрузки товаров:', error);
            this.showNotification('Ошибка загрузки товаров', 'error');
        }
    }

    renderProducts() {
        const productsContent = document.getElementById('productsContent');
        if (!productsContent) return;

        const products = this.products || [];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="color: #b9bbbe;">
                    <i class="fas fa-box"></i> Всего товаров: <strong>${products.length}</strong>
                </div>
                <div>
                    <button class="btn-admin success" onclick="window.adminProducts.showAddProductForm()">
                        <i class="fas fa-plus"></i> Добавить товар
                    </button>
                </div>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Товар</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">ID</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Категория</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Цена</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Статус</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (products.length === 0) {
            html += `
                <tr>
                    <td colspan="6" style="padding: 40px; text-align: center; color: #b9bbbe;">
                        <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>Товары не найдены</p>
                        <button class="btn-primary" onclick="window.adminProducts.showAddProductForm()">
                            <i class="fas fa-plus"></i> Добавить первый товар
                        </button>
                    </td>
                </tr>
            `;
        } else {
            products.forEach(product => {
                html += `
                    <tr style="border-bottom: 1px solid #40444b;" data-product-id="${product.id}">
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #5865F2, #4752c4); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                    <i class="${product.icon || 'fas fa-box'}" style="color: white; font-size: 1.2rem;"></i>
                                </div>
                                <div>
                                    <div style="color: white; font-weight: 600;">${this.escapeHtml(product.name)}</div>
                                    <div style="color: #b9bbbe; font-size: 0.85rem; max-width: 300px;">${this.escapeHtml(product.description?.substring(0, 50))}${product.description?.length > 50 ? '...' : ''}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <code style="color: #5865F2;">${product.id}</code>
                        </td>
                        <td style="padding: 12px;">
                            <span class="badge" style="background: #5865F2; color: white; padding: 4px 12px; border-radius: 20px;">
                                ${product.category || 'other'}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div>
                                <span style="color: #57F287; font-weight: 600; font-size: 1.2rem;">${product.price} ₽</span>
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            ${product.popular ? 
                                '<span style="color: #FEE75C;"><i class="fas fa-star"></i> Популярный</span>' : 
                                '<span style="color: #72767d;">Обычный</span>'}
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-admin small" onclick="window.adminProducts.editProduct('${product.id}')" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-admin danger small" onclick="window.adminProducts.deleteProduct('${product.id}')" title="Удалить">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="btn-admin small" onclick="window.adminProducts.viewProduct('${product.id}')" title="Просмотр">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        productsContent.innerHTML = html;
    }

    showAddProductForm() {
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
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #5865F2; margin: 0;">
                        <i class="fas fa-plus-circle"></i> Добавить товар
                    </h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <form id="addProductForm" onsubmit="event.preventDefault(); window.adminProducts.saveProduct()">
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Название товара</label>
                        <input type="text" id="productName" required 
                               style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Описание</label>
                        <textarea id="productDescription" rows="3" required 
                                  style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Цена (₽)</label>
                            <input type="number" id="productPrice" required min="0" step="1"
                                   style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                        <div class="form-group">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Категория</label>
                            <select id="productCategory" 
                                    style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                                <option value="premium">Премиум</option>
                                <option value="services">Услуги</option>
                                <option value="events">Ивенты</option>
                                <option value="other">Другое</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Иконка (Font Awesome класс)</label>
                        <input type="text" id="productIcon" value="fas fa-box"
                               style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Особенности (каждая с новой строки)</label>
                        <textarea id="productFeatures" rows="4" placeholder="Функция 1&#10;Функция 2&#10;Функция 3"
                                  style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; resize: vertical;"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; color: #b9bbbe;">
                            <input type="checkbox" id="productPopular"> 
                            <i class="fas fa-star" style="color: #FEE75C;"></i> Популярный товар
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                        <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()">Отмена</button>
                        <button type="submit" class="btn-admin success">Добавить товар</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async saveProduct() {
        try {
            const features = document.getElementById('productFeatures').value
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            
            const productData = {
                id: 'prod_' + Date.now(),
                name: document.getElementById('productName').value,
                description: document.getElementById('productDescription').value,
                price: parseInt(document.getElementById('productPrice').value),
                category: document.getElementById('productCategory').value,
                icon: document.getElementById('productIcon').value || 'fas fa-box',
                features: features,
                popular: document.getElementById('productPopular').checked
            };
            
            await this.api.createProduct(productData);
            
            document.querySelector('.modal').remove();
            this.showNotification('Товар успешно добавлен', 'success');
            await this.loadProducts();
            
        } catch (error) {
            console.error('Ошибка сохранения товара:', error);
            this.showNotification('Ошибка при сохранении товара: ' + error.message, 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
        
        try {
            await this.api.deleteProduct(productId);
            this.showNotification('Товар успешно удален', 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            this.showNotification('Ошибка при удалении товара: ' + error.message, 'error');
        }
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showNotification('Товар не найден', 'error');
            return;
        }
        this.showEditProductForm(product);
    }

    showEditProductForm(product) {
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
        
        const featuresText = product.features ? product.features.join('\n') : '';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #5865F2; margin: 0;">
                        <i class="fas fa-edit"></i> Редактировать товар
                    </h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <form id="editProductForm" onsubmit="event.preventDefault(); window.adminProducts.updateProduct('${product.id}')">
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Название товара</label>
                        <input type="text" id="editProductName" value="${this.escapeHtml(product.name)}" required 
                               style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Описание</label>
                        <textarea id="editProductDescription" rows="3" required 
                                  style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; resize: vertical;">${this.escapeHtml(product.description)}</textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Цена (₽)</label>
                            <input type="number" id="editProductPrice" value="${product.price}" required min="0" step="1"
                                   style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                        <div class="form-group">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Категория</label>
                            <select id="editProductCategory" 
                                    style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                                <option value="premium" ${product.category === 'premium' ? 'selected' : ''}>Премиум</option>
                                <option value="services" ${product.category === 'services' ? 'selected' : ''}>Услуги</option>
                                <option value="events" ${product.category === 'events' ? 'selected' : ''}>Ивенты</option>
                                <option value="other" ${product.category === 'other' ? 'selected' : ''}>Другое</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Иконка (Font Awesome класс)</label>
                        <input type="text" id="editProductIcon" value="${product.icon || 'fas fa-box'}"
                               style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #b9bbbe; display: block; margin-bottom: 5px;">Особенности (каждая с новой строки)</label>
                        <textarea id="editProductFeatures" rows="4" 
                                  style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; resize: vertical;">${this.escapeHtml(featuresText)}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; color: #b9bbbe;">
                            <input type="checkbox" id="editProductPopular" ${product.popular ? 'checked' : ''}> 
                            <i class="fas fa-star" style="color: #FEE75C;"></i> Популярный товар
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                        <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()">Отмена</button>
                        <button type="submit" class="btn-admin success">Сохранить изменения</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async updateProduct(productId) {
        try {
            const features = document.getElementById('editProductFeatures').value
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            
            const productData = {
                id: productId,
                name: document.getElementById('editProductName').value,
                description: document.getElementById('editProductDescription').value,
                price: parseInt(document.getElementById('editProductPrice').value),
                category: document.getElementById('editProductCategory').value,
                icon: document.getElementById('editProductIcon').value || 'fas fa-box',
                features: features,
                popular: document.getElementById('editProductPopular').checked
            };
            
            await this.api.updateProduct(productId, productData);
            
            document.querySelector('.modal').remove();
            this.showNotification('Товар успешно обновлен', 'success');
            await this.loadProducts();
            
        } catch (error) {
            console.error('Ошибка обновления товара:', error);
            this.showNotification('Ошибка при обновлении товара: ' + error.message, 'error');
        }
    }

    viewProduct(productId) {
        window.open(`/shop.html#${productId}`, '_blank');
    }

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
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminProducts = AdminProducts;
window.adminProducts = new AdminProducts();