// admin-products.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class AdminProducts {
    constructor() {
        this.api = window.api;
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <div class="stats-grid" style="margin-bottom: 0; grid-template-columns: repeat(2, 1fr);">
                    <div class="stat-card" style="padding: 15px;">
                        <div class="stat-icon"><i class="fas fa-box"></i></div>
                        <div class="stat-value">${products.length}</div>
                        <div class="stat-label">Всего товаров</div>
                    </div>
                    <div class="stat-card" style="padding: 15px;">
                        <div class="stat-icon"><i class="fas fa-star"></i></div>
                        <div class="stat-value">${products.filter(p => p.popular).length}</div>
                        <div class="stat-label">Популярных</div>
                    </div>
                </div>
                <button class="btn-admin success" onclick="window.adminProducts.showAddProductForm()">
                    <i class="fas fa-plus"></i> Добавить товар
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th>ID</th>
                            <th>Категория</th>
                            <th>Цена</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (products.length === 0) {
            html += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 60px;">
                        <i class="fas fa-box-open" style="font-size: 3rem; color: #72767d;"></i>
                        <p style="margin-top: 15px;">Товары не найдены</p>
                        <button class="btn-admin success" onclick="window.adminProducts.showAddProductForm()" style="margin-top: 15px;">
                            <i class="fas fa-plus"></i> Добавить первый товар
                        </button>
                    </td>
                </tr>
            `;
        } else {
            products.forEach(product => {
                html += `
                    <tr data-product-id="${product.id}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                    <i class="${product.icon || 'fas fa-box'}" style="color: white; font-size: 1.2rem;"></i>
                                </div>
                                <div>
                                    <div style="color: white; font-weight: 600;">${this.escapeHtml(product.name)}</div>
                                    <div style="color: #72767d; font-size: 0.8rem;">${this.escapeHtml(product.description?.substring(0, 50))}${product.description?.length > 50 ? '...' : ''}</div>
                                </div>
                            </div>
                        </td>
                        <td><code style="color: var(--primary);">${product.id}</code></td>
                        <td><span class="badge" style="background: rgba(88,101,242,0.2); color: var(--primary);">${product.category || 'other'}</span></td>
                        <td style="color: var(--success); font-weight: 600; font-size: 1.1rem;">${product.price} ₽</td>
                        <td>${product.popular ? '<span style="color: var(--warning);"><i class="fas fa-star"></i> Популярный</span>' : '<span style="color: #72767d;">Обычный</span>'}</td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon" onclick="window.adminProducts.editProduct('${product.id}')" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon danger" onclick="window.adminProducts.deleteProduct('${product.id}')" title="Удалить">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="btn-icon" onclick="window.adminProducts.viewProduct('${product.id}')" title="Просмотр">
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
        modal.id = 'addProductModal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-plus-circle"></i> Добавить товар</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="addProductForm">
                    <div class="form-group">
                        <label>Название товара</label>
                        <input type="text" id="productName" required placeholder="Введите название">
                    </div>
                    
                    <div class="form-group">
                        <label>Описание</label>
                        <textarea id="productDescription" required placeholder="Введите описание"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Цена (₽)</label>
                            <input type="number" id="productPrice" required min="0" step="1" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Категория</label>
                            <select id="productCategory">
                                <option value="premium">Премиум</option>
                                <option value="services">Услуги</option>
                                <option value="events">Ивенты</option>
                                <option value="other">Другое</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Иконка (Font Awesome класс)</label>
                        <input type="text" id="productIcon" value="fas fa-box" placeholder="fas fa-box">
                    </div>
                    
                    <div class="form-group">
                        <label>Особенности (каждая с новой строки)</label>
                        <textarea id="productFeatures" rows="4" placeholder="Функция 1&#10;Функция 2&#10;Функция 3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="productPopular"> 
                            <i class="fas fa-star" style="color: var(--warning);"></i> Популярный товар
                        </label>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()">Отмена</button>
                        <button type="submit" class="btn-admin success">Добавить товар</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
    }

    async saveProduct() {
        try {
            const features = document.getElementById('productFeatures').value
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            
            const productData = {
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
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) throw new Error('Товар не найден');
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            const featuresText = product.features ? product.features.join('\n') : '';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-edit"></i> Редактировать товар</h2>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    
                    <form id="editProductForm">
                        <div class="form-group">
                            <label>Название товара</label>
                            <input type="text" id="editProductName" value="${this.escapeHtml(product.name)}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Описание</label>
                            <textarea id="editProductDescription" required>${this.escapeHtml(product.description)}</textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="form-group">
                                <label>Цена (₽)</label>
                                <input type="number" id="editProductPrice" value="${product.price}" required min="0">
                            </div>
                            <div class="form-group">
                                <label>Категория</label>
                                <select id="editProductCategory">
                                    <option value="premium" ${product.category === 'premium' ? 'selected' : ''}>Премиум</option>
                                    <option value="services" ${product.category === 'services' ? 'selected' : ''}>Услуги</option>
                                    <option value="events" ${product.category === 'events' ? 'selected' : ''}>Ивенты</option>
                                    <option value="other" ${product.category === 'other' ? 'selected' : ''}>Другое</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Иконка</label>
                            <input type="text" id="editProductIcon" value="${product.icon || 'fas fa-box'}">
                        </div>
                        
                        <div class="form-group">
                            <label>Особенности</label>
                            <textarea id="editProductFeatures" rows="4">${this.escapeHtml(featuresText)}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 10px;">
                                <input type="checkbox" id="editProductPopular" ${product.popular ? 'checked' : ''}> 
                                <i class="fas fa-star" style="color: var(--warning);"></i> Популярный товар
                            </label>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()">Отмена</button>
                            <button type="submit" class="btn-admin success">Сохранить</button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('editProductForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateProduct(productId);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
            this.showNotification('Ошибка загрузки данных товара', 'error');
        }
    }

    async updateProduct(productId) {
        try {
            const features = document.getElementById('editProductFeatures').value
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            
            const productData = {
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
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminProducts = AdminProducts;
window.adminProducts = new AdminProducts();