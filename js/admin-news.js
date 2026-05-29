class AdminNews {
    constructor() {
        this.api = window.api;
        this.baseUrl = 'https://bhstore.netlify.app';
        this.news = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredNews = [];
    }

    async loadNews() {
        try {
            const container = document.getElementById('newsContent');
            if (!container) return;

            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Загрузка новостей...</p>
                </div>
            `;

            const response = await fetch('/api/news');
            const data = await response.json();
            
            if (data.success) {
                this.news = data.news || [];
                this.filteredNews = [...this.news];
                this.renderNews();
            } else {
                throw new Error(data.error || 'Ошибка загрузки новостей');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки новостей:', error);
            this.showNotification('Ошибка загрузки новостей', 'error');
            this.renderError();
        }
    }

    renderNews() {
        const container = document.getElementById('newsContent');
        if (!container) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedNews = this.filteredNews.slice(startIndex, endIndex);

        const categoryColors = {
            'announcement': { bg: '#5865F2', color: 'white', icon: 'fa-bullhorn' },
            'updates': { bg: '#57F287', color: '#1e1f29', icon: 'fa-rocket' },
            'events': { bg: '#FEE75C', color: '#1e1f29', icon: 'fa-calendar-alt' },
            'promo': { bg: '#FF73FA', color: '#1e1f29', icon: 'fa-gift' }
        };

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <div class="stats-grid" style="margin-bottom: 0; grid-template-columns: repeat(2, 1fr);">
                    <div class="stat-card" style="padding: 15px;">
                        <div class="stat-icon"><i class="fas fa-newspaper"></i></div>
                        <div class="stat-value">${this.news.length}</div>
                        <div class="stat-label">Всего новостей</div>
                    </div>
                    <div class="stat-card" style="padding: 15px;">
                        <div class="stat-icon"><i class="fas fa-calendar-week"></i></div>
                        <div class="stat-value">${this.getWeeklyNewsCount()}</div>
                        <div class="stat-label">За последнюю неделю</div>
                    </div>
                </div>
                <button class="btn-admin success" onclick="window.adminNews.showAddNewsForm()">
                    <i class="fas fa-plus"></i> Добавить новость
                </button>
            </div>
            
            <div class="search-bar" style="margin-bottom: 20px;">
                <input type="text" id="searchNews" class="search-input" placeholder="Поиск по заголовку или содержимому...">
                <select id="filterCategory" class="search-input" style="width: auto;">
                    <option value="all">Все категории</option>
                    <option value="announcement">📢 Объявления</option>
                    <option value="updates">🚀 Обновления</option>
                    <option value="events">🎉 События</option>
                    <option value="promo">🎁 Акции</option>
                </select>
            </div>
            
            <div class="table-container">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left;">Новость</th>
                            <th style="padding: 12px; text-align: left;">Категория</th>
                            <th style="padding: 12px; text-align: left;">Дата</th>
                            <th style="padding: 12px; text-align: left;">Просмотры</th>
                            <th style="padding: 12px; text-align: left;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (paginatedNews.length === 0) {
            html += `
                <tr>
                    <td colspan="5" style="padding: 60px; text-align: center; color: #b9bbbe;">
                        <i class="fas fa-newspaper" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>Новости не найдены</p>
                        <button class="btn-admin success" onclick="window.adminNews.showAddNewsForm()" style="margin-top: 15px;">
                            <i class="fas fa-plus"></i> Добавить первую новость
                        </button>
                    </td>
                </tr>
            `;
        } else {
            paginatedNews.forEach(news => {
                const category = categoryColors[news.category] || categoryColors['announcement'];
                const date = news.date ? new Date(news.date).toLocaleDateString('ru-RU') : 'Дата неизвестна';
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;">
                        <td style="padding: 12px;">
                            <div>
                                <div style="color: white; font-weight: 600; margin-bottom: 5px;">${this.escapeHtml(news.title)}</div>
                                <div style="color: #b9bbbe; font-size: 0.85rem;">${this.escapeHtml(news.content?.substring(0, 100))}${news.content?.length > 100 ? '...' : ''}</div>
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${category.bg}; color: ${category.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                                <i class="fas ${category.icon}"></i> ${this.getCategoryName(news.category)}
                            </span>
                        </td>
                        <td style="padding: 12px; color: #b9bbbe;">
                            <i class="fas fa-calendar-alt"></i> ${date}
                        </td>
                        <td style="padding: 12px;">
                            <span style="color: #5865F2;">
                                <i class="fas fa-eye"></i> ${news.views || 0}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div class="table-actions">
                                <button class="btn-icon" onclick="window.adminNews.editNews(${news.id})" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="window.adminNews.viewNews(${news.id})" title="Просмотр">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon danger" onclick="window.adminNews.deleteNews(${news.id})" title="Удалить">
                                    <i class="fas fa-trash"></i>
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
            
            ${this.renderPagination()}
        `;

        container.innerHTML = html;
        this.setupFilters();
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredNews.length / this.itemsPerPage);
        
        if (totalPages <= 1) return '';
        
        let paginationHtml = `
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 30px;">
        `;
        
        paginationHtml += `
            <button class="btn-admin small" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="window.adminNews.changePage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHtml += `
                    <button class="btn-admin ${i === this.currentPage ? 'active' : ''}" 
                            onclick="window.adminNews.changePage(${i})"
                            style="${i === this.currentPage ? 'background: #5865F2;' : ''}">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHtml += `<span style="color: #b9bbbe;">...</span>`;
            }
        }
        
        paginationHtml += `
            <button class="btn-admin small" ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="window.adminNews.changePage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        paginationHtml += `</div>`;
        
        return paginationHtml;
    }

    changePage(page) {
        this.currentPage = page;
        this.renderNews();
        document.getElementById('newsContent').scrollIntoView({ behavior: 'smooth' });
    }

    setupFilters() {
        const searchInput = document.getElementById('searchNews');
        const categoryFilter = document.getElementById('filterCategory');
        
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterNews(e.target.value, categoryFilter?.value);
                }, 300);
            });
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filterNews(searchInput?.value, e.target.value);
            });
        }
    }

    filterNews(searchTerm = '', category = 'all') {
        this.filteredNews = this.news.filter(news => {
            // Фильтр по категории
            if (category !== 'all' && news.category !== category) return false;
            
            // Фильтр по поиску
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return news.title.toLowerCase().includes(term) ||
                       news.content.toLowerCase().includes(term) ||
                       (news.tags && news.tags.some(tag => tag.toLowerCase().includes(term)));
            }
            
            return true;
        });
        
        this.currentPage = 1;
        this.renderNews();
    }

    getWeeklyNewsCount() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return this.news.filter(news => {
            const newsDate = new Date(news.date);
            return newsDate >= oneWeekAgo;
        }).length;
    }

    getCategoryName(category) {
        const names = {
            'announcement': 'Объявление',
            'updates': 'Обновление',
            'events': 'Событие',
            'promo': 'Акция'
        };
        return names[category] || category;
    }

    showAddNewsForm() {
        // Удаляем старый модал если есть
        const existingModal = document.querySelector('.modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'addNewsModal';
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
            <div class="modal-content" style="max-width: 600px; width: 90%; background: #2a2b36; border-radius: 16px; padding: 0; overflow: hidden;">
                <div class="modal-header" style="padding: 20px; background: #1e1f29; border-bottom: 1px solid #40444b;">
                    <h2 style="margin: 0; color: white;">
                        <i class="fas fa-plus-circle" style="color: #57F287;"></i> 
                        Добавить новость
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <form id="addNewsForm" style="padding: 20px;">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Заголовок новости *</label>
                        <input type="text" id="newsTitle" required 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Содержание *</label>
                        <textarea id="newsContent" required rows="8" 
                                  style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Категория</label>
                            <select id="newsCategory" 
                                    style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                                <option value="announcement">📢 Объявление</option>
                                <option value="updates">🚀 Обновление</option>
                                <option value="events">🎉 Событие</option>
                                <option value="promo">🎁 Акция</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Дата публикации</label>
                            <input type="date" id="newsDate" value="${new Date().toISOString().split('T')[0]}" 
                                   style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Теги (через запятую)</label>
                        <input type="text" id="newsTags" placeholder="новость, обновление, акция" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: #b9bbbe;">Изображение (URL, опционально)</label>
                        <input type="url" id="newsImage" placeholder="https://example.com/image.jpg" 
                               style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()"
                                style="padding: 10px 20px; background: #40444b; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Отмена
                        </button>
                        <button type="submit" class="btn-admin success" 
                                style="padding: 10px 20px; background: #57F287; color: #1e1f29; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-plus"></i> Добавить новость
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const form = document.getElementById('addNewsForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNews();
            });
        }
        
        // Фокус на поле заголовка
        setTimeout(() => {
            const titleInput = document.getElementById('newsTitle');
            if (titleInput) titleInput.focus();
        }, 100);
    }


    async saveNews() {
        try {
            // Получаем значения с проверкой
            const title = document.getElementById('newsTitle')?.value?.trim() || '';
            const content = document.getElementById('newsContent')?.value?.trim() || '';
            const category = document.getElementById('newsCategory')?.value || 'announcement';
            const date = document.getElementById('newsDate')?.value || new Date().toISOString().split('T')[0];
            const image = document.getElementById('newsImage')?.value || null;
            
            // Получаем теги
            let tags = [];
            const tagsInput = document.getElementById('newsTags')?.value;
            if (tagsInput) {
                tags = tagsInput.split(',')
                    .map(t => t.trim())
                    .filter(t => t.length > 0);
            }
            
            console.log('📝 Данные формы:', {
                title: title,
                contentLength: content.length,
                category: category,
                date: date,
                tags: tags,
                image: image
            });
            
            // Проверка обязательных полей
            if (!title) {
                this.showNotification('Введите заголовок новости', 'error');
                return;
            }
            
            if (!content) {
                this.showNotification('Введите содержание новости', 'error');
                return;
            }
            
            if (content.length < 10) {
                this.showNotification('Содержание должно быть не менее 10 символов', 'error');
                return;
            }
            
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            const token = authData.token;
            
            if (!token) {
                this.showNotification('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                return;
            }
            
            const newsData = {
                title: title,
                content: content,
                category: category,
                date: date,
                tags: tags,
                image: image
            };
            
            console.log('📤 Отправка данных на сервер:', JSON.stringify(newsData, null, 2));
            
            const response = await fetch('/api/admin/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newsData)
            });
            
            console.log('📥 Статус ответа:', response.status);
            
            const result = await response.json();
            console.log('📥 Ответ сервера:', result);
            
            if (response.ok && result.success) {
                // Закрываем модальное окно
                const modal = document.querySelector('.modal');
                if (modal) modal.remove();
                
                this.showNotification('Новость успешно добавлена!', 'success');
                await this.loadNews();
            } else {
                throw new Error(result.error || `Ошибка сервера: ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка сохранения новости:', error);
            this.showNotification('Ошибка при сохранении новости: ' + error.message, 'error');
        }
    }
    
    async saveNews() {
        try {
            const tags = document.getElementById('newsTags').value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            
            const newsData = {
                title: document.getElementById('newsTitle').value,
                content: document.getElementById('newsContent').value,
                category: document.getElementById('newsCategory').value,
                date: document.getElementById('newsDate').value,
                tags: tags,
                image: document.getElementById('newsImage').value || null
            };
            
            const response = await fetch('/api/admin/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : ''}`
                },
                body: JSON.stringify(newsData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                document.querySelector('.modal').remove();
                this.showNotification('Новость успешно добавлена', 'success');
                await this.loadNews();
            } else {
                throw new Error(result.error || 'Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Ошибка сохранения новости:', error);
            this.showNotification('Ошибка при сохранении новости: ' + error.message, 'error');
        }
    }

    async editNews(newsId) {
        try {
            const news = this.news.find(n => n.id === newsId);
            if (!news) throw new Error('Новость не найдена');
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'editNewsModal';
            modal.style.display = 'flex';
            
            const tagsString = news.tags ? news.tags.join(', ') : '';
            const dateValue = news.date ? news.date.split('T')[0] : new Date().toISOString().split('T')[0];
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-edit"></i> Редактировать новость</h2>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    
                    <form id="editNewsForm">
                        <div class="form-group">
                            <label>Заголовок новости</label>
                            <input type="text" id="editNewsTitle" value="${this.escapeHtml(news.title)}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Содержание</label>
                            <textarea id="editNewsContent" required rows="8">${this.escapeHtml(news.content)}</textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="form-group">
                                <label>Категория</label>
                                <select id="editNewsCategory">
                                    <option value="announcement" ${news.category === 'announcement' ? 'selected' : ''}>📢 Объявление</option>
                                    <option value="updates" ${news.category === 'updates' ? 'selected' : ''}>🚀 Обновление</option>
                                    <option value="events" ${news.category === 'events' ? 'selected' : ''}>🎉 Событие</option>
                                    <option value="promo" ${news.category === 'promo' ? 'selected' : ''}>🎁 Акция</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Дата публикации</label>
                                <input type="date" id="editNewsDate" value="${dateValue}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Теги (через запятую)</label>
                            <input type="text" id="editNewsTags" value="${this.escapeHtml(tagsString)}">
                        </div>
                        
                        <div class="form-group">
                            <label>Изображение (URL)</label>
                            <input type="url" id="editNewsImage" value="${news.image || ''}">
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-admin" onclick="this.closest('.modal').remove()">Отмена</button>
                            <button type="submit" class="btn-admin success">Сохранить изменения</button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('editNewsForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateNews(newsId);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки новости:', error);
            this.showNotification('Ошибка загрузки данных новости', 'error');
        }
    }

    async updateNews(newsId) {
        try {
            const tags = document.getElementById('editNewsTags').value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            
            const newsData = {
                title: document.getElementById('editNewsTitle').value,
                content: document.getElementById('editNewsContent').value,
                category: document.getElementById('editNewsCategory').value,
                date: document.getElementById('editNewsDate').value,
                tags: tags,
                image: document.getElementById('editNewsImage').value || null
            };
            
            const response = await fetch(`/api/admin/news/${newsId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : ''}`
                },
                body: JSON.stringify(newsData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                document.querySelector('.modal').remove();
                this.showNotification('Новость успешно обновлена', 'success');
                await this.loadNews();
            } else {
                throw new Error(result.error || 'Ошибка при обновлении');
            }
        } catch (error) {
            console.error('Ошибка обновления новости:', error);
            this.showNotification('Ошибка при обновлении новости: ' + error.message, 'error');
        }
    }

    async deleteNews(newsId) {
        if (!confirm('Вы уверены, что хотите удалить эту новость?')) return;
        
        try {
            const response = await fetch(`/api/admin/news/${newsId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).token : ''}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Новость успешно удалена', 'success');
                await this.loadNews();
            } else {
                throw new Error(result.error || 'Ошибка при удалении');
            }
        } catch (error) {
            console.error('Ошибка удаления новости:', error);
            this.showNotification('Ошибка при удалении новости: ' + error.message, 'error');
        }
    }

    viewNews(newsId) {
        window.open(`/news.html?id=${newsId}`, '_blank');
    }

    renderError() {
        const container = document.getElementById('newsContent');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ED4245; margin-bottom: 20px;"></i>
                    <h3 style="color: white;">Ошибка загрузки новостей</h3>
                    <p style="color: #b9bbbe;">Не удалось загрузить список новостей</p>
                    <button class="btn-admin" onclick="window.adminNews.loadNews()">
                        <i class="fas fa-sync-alt"></i> Повторить
                    </button>
                </div>
            `;
        }
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

window.AdminNews = AdminNews;
window.adminNews = new AdminNews();