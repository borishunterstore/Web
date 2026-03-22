admin.html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Админ | BHStore</title>
    
    <!-- Стили - ТОЛЬКО general.css И admin.css -->
    <link rel="stylesheet" href="css/general.css">
    <link rel="stylesheet" href="css/admin.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/png" href="/image/logo.png">
    
    <!-- Yandex.Metrika counter -->
    <script type="text/javascript">
        (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=107215097','ym');
        
        ym(107215097,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/107215097" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    
    <!-- Скрипты (в правильном порядке) -->
    <script src="js/api.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/admin-stats.js"></script>
    <script src="js/admin-users.js"></script>
    <script src="js/admin-orders.js"></script>
    <script src="js/admin-chat.js"></script>
    <script src="js/admin-products.js"></script>
    <script src="js/main.js"></script>
    <script src="js/cursor.js"></script>
    <script src="js/pkm.js"></script>
    <script src="js/mobile-nav.js"></script>
    
    <!-- Эффекты -->
    <div class="custom-cursor"></div>
    <canvas id="webCanvas"></canvas>
    <div class="scroll-indicator">
        <span class="scroll-value">0%</span>
    </div>
</head>
<body>
    <!-- Навигация -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="/" class="nav-logo">
                <img src="image/logo.png" alt="BHStore" style="width: 50px;">
                <span class="logo-text">BHStore</span>
            </a>
            <div class="nav-menu">
                <a href="/" class="nav-link"><i class="fas fa-home"></i> Главная</a>
                <a href="/shop.html" class="nav-link"><i class="fas fa-shopping-cart"></i> Магазин</a>
                <a href="/admin.html" class="nav-link active"><i class="fas fa-crown"></i> Админ панель</a>
                <a href="/profile.html" class="nav-link"><i class="fas fa-user"></i> Профиль</a>
            </div>
            <div class="nav-auth">
                <button id="authBtn" class="btn-discord">
                    <i class="fab fa-discord"></i> Войти
                </button>
            </div>
            <button class="mobile-menu-btn">
                <i class="fas fa-bars"></i>
            </button>
        </div>
    </nav>

    <!-- Основной контейнер -->
    <div class="admin-container">
        <div class="admin-header">
            <h1>
                <i class="fas fa-crown"></i>
                Админ панель
            </h1>
            <div class="admin-user-info">
                <i class="fas fa-user-shield"></i>
                <span id="adminUsername">Загрузка...</span>
            </div>
        </div>

        <div id="adminContent"></div>
    </div>

    <!-- Модальные окна -->
    <div id="addBalanceModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-plus-circle"></i> Пополнить баланс</h2>
                <button class="modal-close" onclick="closeModal('addBalanceModal')">×</button>
            </div>
            <form id="addBalanceForm">
                <input type="hidden" id="balanceUserId">
                
                <div class="user-info-card">
                    <div class="user-info-label">Пользователь:</div>
                    <div class="user-info-value" id="balanceUserName">Загрузка...</div>
                </div>
                
                <div class="form-group">
                    <label for="balanceAmount">Сумма пополнения (₽)</label>
                    <input type="number" id="balanceAmount" min="1" step="1" required placeholder="Введите сумму">
                </div>
                
                <div class="quick-amounts">
                    <button type="button" class="quick-amount-btn" onclick="document.getElementById('balanceAmount').value = 100">100 ₽</button>
                    <button type="button" class="quick-amount-btn" onclick="document.getElementById('balanceAmount').value = 500">500 ₽</button>
                    <button type="button" class="quick-amount-btn" onclick="document.getElementById('balanceAmount').value = 1000">1000 ₽</button>
                    <button type="button" class="quick-amount-btn" onclick="document.getElementById('balanceAmount').value = 5000">5000 ₽</button>
                </div>
                
                <div class="form-group">
                    <label for="balanceReason">Причина</label>
                    <select id="balanceReason">
                        <option value="Пополнение администратором">Пополнение администратором</option>
                        <option value="Бонус за активность">Бонус за активность</option>
                        <option value="Возврат средств">Возврат средств</option>
                        <option value="Конкурс/Розыгрыш">Конкурс/Розыгрыш</option>
                        <option value="Другое">Другое</option>
                    </select>
                </div>
                
                <div class="form-group" id="balanceCustomReasonGroup" style="display: none;">
                    <label for="balanceCustomReason">Укажите причину</label>
                    <input type="text" id="balanceCustomReason" placeholder="Введите свою причину">
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-admin" onclick="closeModal('addBalanceModal')">Отмена</button>
                    <button type="submit" class="btn-admin success">
                        <i class="fas fa-plus"></i> Пополнить
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="removeBalanceModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-minus-circle"></i> Списать баланс</h2>
                <button class="modal-close" onclick="closeModal('removeBalanceModal')">×</button>
            </div>
            <form id="removeBalanceForm">
                <input type="hidden" id="removeBalanceUserId">
                
                <div class="user-info-card">
                    <div class="user-info-label">Пользователь:</div>
                    <div class="user-info-value" id="removeBalanceUserName">Загрузка...</div>
                </div>
                
                <div class="form-group">
                    <label for="removeBalanceAmount">Сумма списания (₽)</label>
                    <input type="number" id="removeBalanceAmount" min="1" step="1" required placeholder="Введите сумму">
                </div>
                
                <div class="form-group">
                    <label for="removeBalanceReason">Причина</label>
                    <input type="text" id="removeBalanceReason" placeholder="Например: Штраф, возврат" value="Списание администратором">
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-admin" onclick="closeModal('removeBalanceModal')">Отмена</button>
                    <button type="submit" class="btn-admin warning">
                        <i class="fas fa-minus"></i> Списать
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="balanceHistoryModal" class="modal">
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2><i class="fas fa-history"></i> История баланса</h2>
                <button class="modal-close" onclick="closeModal('balanceHistoryModal')">×</button>
            </div>
            <div id="balanceHistoryContent" class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка истории...</p>
            </div>
        </div>
    </div>

    <script>
        // Глобальные функции
        window.showModal = function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'flex';
        };

        window.closeModal = function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'none';
        };

        // Инициализация
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('🚀 Админ панель загружается...');
            
            try {
                const authData = api.getAuthData();
                
                if (!authData.token) {
                    window.location.href = '/profile.html';
                    return;
                }
                
                const isAdmin = await api.isAdmin();
                
                if (!isAdmin) {
                    document.getElementById('adminContent').innerHTML = `
                        <div class="access-denied">
                            <i class="fas fa-ban"></i>
                            <h2>Доступ запрещен</h2>
                            <p>Требуются права администратора для доступа к этой странице.</p>
                            <a href="/" class="btn-admin">
                                <i class="fas fa-home"></i> Вернуться на главную
                            </a>
                        </div>
                    `;
                    return;
                }
                
                document.getElementById('adminUsername').textContent = authData.username || 'Администратор';
                loadAdminPanel();
                
            } catch (error) {
                console.error('❌ Ошибка инициализации:', error);
                document.getElementById('adminContent').innerHTML = `
                    <div class="access-denied">
                        <i class="fas fa-exclamation-triangle" style="color: #ED4245;"></i>
                        <h2 style="color: #ED4245;">Ошибка загрузки</h2>
                        <p>${error.message || 'Не удалось загрузить админ панель'}</p>
                        <button onclick="location.reload()" class="btn-admin">
                            <i class="fas fa-sync-alt"></i> Обновить страницу
                        </button>
                    </div>
                `;
            }
        });

        function loadAdminPanel() {
            document.getElementById('adminContent').innerHTML = `
                <div class="admin-nav">
                    <button class="admin-nav-btn active" data-section="stats">
                        <i class="fas fa-chart-bar"></i> Статистика
                    </button>
                    <button class="admin-nav-btn" data-section="users">
                        <i class="fas fa-users"></i> Пользователи
                    </button>
                    <button class="admin-nav-btn" data-section="orders">
                        <i class="fas fa-shopping-bag"></i> Заказы
                    </button>
                    <button class="admin-nav-btn" data-section="chat">
                        <i class="fas fa-comments"></i> Чат поддержки
                    </button>
                    <button class="admin-nav-btn" data-section="products">
                        <i class="fas fa-box"></i> Товары
                    </button>
                </div>
                
                <div class="admin-section active" id="section-stats">
                    <h2><i class="fas fa-chart-bar"></i> Статистика магазина</h2>
                    <div id="statsContent" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка статистики...</p>
                    </div>
                </div>
                
                <div class="admin-section" id="section-users">
                    <h2><i class="fas fa-users"></i> Пользователи</h2>
                    <div id="usersContent" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка пользователей...</p>
                    </div>
                </div>
                
                <div class="admin-section" id="section-orders">
                    <h2><i class="fas fa-shopping-bag"></i> Заказы</h2>
                    <div id="ordersContent" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка заказов...</p>
                    </div>
                </div>
                
                <div class="admin-section" id="section-chat">
                    <h2><i class="fas fa-comments"></i> Чат поддержки</h2>
                    <div id="chatContent" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка чата...</p>
                    </div>
                </div>
                
                <div class="admin-section" id="section-products">
                    <h2><i class="fas fa-box"></i> Управление товарами</h2>
                    <div id="productsContent" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка товаров...</p>
                    </div>
                </div>
            `;
            
            // Навигация
            document.querySelectorAll('.admin-nav-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
                    
                    const sectionId = this.dataset.section;
                    document.getElementById(`section-${sectionId}`).classList.add('active');
                    
                    loadSectionData(sectionId);
                });
            });
            
            loadSectionData('stats');
            initFormHandlers();
        }

        async function loadSectionData(section) {
            try {
                switch(section) {
                    case 'stats':
                        if (window.adminStats) await window.adminStats.loadStats();
                        break;
                    case 'users':
                        if (window.adminUsers) await window.adminUsers.loadUsers();
                        break;
                    case 'orders':
                        if (window.adminOrders) await window.adminOrders.loadOrders();
                        break;
                    case 'chat':
                        if (window.adminChat) await window.adminChat.init();
                        break;
                    case 'products':
                        if (window.adminProducts) await window.adminProducts.loadProducts();
                        break;
                }
            } catch (error) {
                console.error(`Ошибка загрузки секции ${section}:`, error);
                const contentElement = document.getElementById(`${section}Content`);
                if (contentElement) {
                    contentElement.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #ED4245;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 15px;"></i>
                            <p>Ошибка загрузки: ${error.message}</p>
                            <button onclick="loadSectionData('${section}')" class="btn-admin" style="margin-top: 15px;">
                                <i class="fas fa-sync-alt"></i> Повторить
                            </button>
                        </div>
                    `;
                }
            }
        }

        function initFormHandlers() {
            // Форма пополнения
            const addBalanceForm = document.getElementById('addBalanceForm');
            if (addBalanceForm) {
                addBalanceForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const userId = document.getElementById('balanceUserId').value;
                    const amount = parseInt(document.getElementById('balanceAmount').value);
                    let reason = document.getElementById('balanceReason').value;
                    
                    if (reason === 'Другое') {
                        reason = document.getElementById('balanceCustomReason').value || 'Пополнение администратором';
                    }
                    
                    if (!amount || amount <= 0) {
                        alert('Введите корректную сумму');
                        return;
                    }
                    
                    try {
                        await api.addUserBalance(userId, amount, reason);
                        closeModal('addBalanceModal');
                        showNotification(`Баланс пополнен на ${amount} ₽`, 'success');
                        if (window.adminUsers) await window.adminUsers.loadUsers();
                    } catch (error) {
                        alert('Ошибка пополнения баланса: ' + error.message);
                    }
                });
            }
            
            // Причина пополнения
            const balanceReason = document.getElementById('balanceReason');
            if (balanceReason) {
                balanceReason.addEventListener('change', function() {
                    const customGroup = document.getElementById('balanceCustomReasonGroup');
                    customGroup.style.display = this.value === 'Другое' ? 'block' : 'none';
                });
            }
            
            // Форма списания
            const removeBalanceForm = document.getElementById('removeBalanceForm');
            if (removeBalanceForm) {
                removeBalanceForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const userId = document.getElementById('removeBalanceUserId').value;
                    const amount = parseInt(document.getElementById('removeBalanceAmount').value);
                    const reason = document.getElementById('removeBalanceReason').value || 'Списание администратором';
                    
                    if (!amount || amount <= 0) {
                        alert('Введите корректную сумму');
                        return;
                    }
                    
                    try {
                        await api.removeUserBalance(userId, amount, reason);
                        closeModal('removeBalanceModal');
                        showNotification(`Списано ${amount} ₽ с баланса`, 'success');
                        if (window.adminUsers) await window.adminUsers.loadUsers();
                    } catch (error) {
                        alert('Ошибка списания баланса: ' + error.message);
                    }
                });
            }
        }

        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }

        // Закрытие модалок по клику на фон
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Глобальные функции
        window.openUserChat = function(userId) {
            const chatBtn = document.querySelector('.admin-nav-btn[data-section="chat"]');
            if (chatBtn) {
                chatBtn.click();
                setTimeout(() => {
                    if (window.adminChat) window.adminChat.selectUser(userId);
                }, 500);
            }
        };

        window.addBalance = function(userId, username) {
            document.getElementById('balanceUserId').value = userId;
            document.getElementById('balanceUserName').textContent = username;
            document.getElementById('balanceAmount').value = '';
            document.getElementById('balanceReason').value = 'Пополнение администратором';
            document.getElementById('balanceCustomReasonGroup').style.display = 'none';
            showModal('addBalanceModal');
        };

        window.removeBalance = function(userId, username) {
            document.getElementById('removeBalanceUserId').value = userId;
            document.getElementById('removeBalanceUserName').textContent = username;
            document.getElementById('removeBalanceAmount').value = '';
            document.getElementById('removeBalanceReason').value = 'Списание администратором';
            showModal('removeBalanceModal');
        };

        window.viewBalanceHistory = function(userId, username) {
            if (window.adminUsers) window.adminUsers.viewBalanceHistory(userId, username);
        };

        window.exportUsers = function() {
            if (window.adminUsers) window.adminUsers.exportUsers();
        };

        window.showAddProductForm = function() {
            if (window.adminProducts) window.adminProducts.showAddProductForm();
        };

        window.editProduct = function(productId) {
            if (window.adminProducts) window.adminProducts.editProduct(productId);
        };

        window.deleteProduct = function(productId) {
            if (window.adminProducts) window.adminProducts.deleteProduct(productId);
        };
    </script>
</body>
</html>

js\admin-users.js
// admin-users.js - ИСПРАВЛЕННАЯ ВЕРСИЯ (без автоматических вызовов)
class AdminUsers {
    constructor() {
        this.api = window.api;
        this.baseUrl = 'https://bhstore.netlify.app';
        this.users = [];
    }

    async loadUsers() {
        try {
            const data = await this.api.getAllUsers();
            this.users = data.users || [];
            this.renderUsers();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }

    renderUsers() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        const users = this.users || [];

        let html = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${users.length}</div>
                    <div class="stat-label">Всего пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-check"></i></div>
                    <div class="stat-value">${users.filter(u => u.badges?.verified).length}</div>
                    <div class="stat-label">Верифицированных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-crown"></i></div>
                    <div class="stat-value">${users.filter(u => u.badges?.admin).length}</div>
                    <div class="stat-label">Администраторов</div>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="text" id="searchUsers" class="search-input" placeholder="Поиск по имени или ID...">
                <button class="btn-admin" onclick="window.adminUsers.exportUsers()">
                    <i class="fas fa-download"></i> Экспорт CSV
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>ID</th>
                            <th>Заказы</th>
                            <th>Баланс</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
        `;
        
        if (users.length === 0) {
            html += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fas fa-users-slash" style="font-size: 3rem; color: #72767d;"></i>
                        <p style="margin-top: 10px;">Пользователи не найдены</p>
                    </td>
                </tr>
            `;
        } else {
            users.forEach(user => {
                const avatarUrl = user.avatar 
                    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                
                html += `
                    <tr data-user-id="${user.discordId}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${avatarUrl}" style="width: 35px; height: 35px; border-radius: 50%;">
                                <div>
                                    <div style="color: white; font-weight: 500;">${this.escapeHtml(user.username || 'Без имени')}</div>
                                    <div style="color: #72767d; font-size: 0.8rem;">
                                        ${user.badges?.admin ? '<span class="badge badge-admin">Админ</span>' : ''}
                                        ${user.badges?.verified ? '<span class="badge badge-verified">✓</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td><code style="color: #5865F2;">${user.discordId}</code></td>
                        <td>${user.orderCount || 0}</td>
                        <td style="color: #57F287; font-weight: 600;">${user.balance || 0} ₽</td>
                        <td>
                            <span class="badge" style="background: ${user.badges?.verified ? '#57F287' : '#72767d'};">
                                ${user.badges?.verified ? 'Верифицирован' : 'Не верифицирован'}
                            </span>
                        </td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon" onclick="window.openUserChat('${user.discordId}')" title="Чат">
                                    <i class="fas fa-comment"></i>
                                </button>
                                <button class="btn-icon success" onclick="window.addBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Пополнить">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-icon warning" onclick="window.removeBalance('${user.discordId}', '${this.escapeHtml(user.username)}')" title="Списать">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <button class="btn-icon" onclick="window.viewBalanceHistory('${user.discordId}', '${this.escapeHtml(user.username)}')" title="История">
                                    <i class="fas fa-history"></i>
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
        
        usersContent.innerHTML = html;
        
        // Добавляем поиск
        document.getElementById('searchUsers')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });
    }

    filterUsers(query) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        const searchTerm = query.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent?.toLowerCase() || '';
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    async viewBalanceHistory(userId, username) {
        try {
            const data = await this.api.getUserBalanceHistory(userId);
            this.showBalanceHistoryModal(userId, username, data);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.showNotification('Ошибка загрузки истории баланса', 'error');
        }
    }

    showBalanceHistoryModal(userId, username, data) {
        const modal = document.getElementById('balanceHistoryModal');
        const content = document.getElementById('balanceHistoryContent');
        
        if (!modal || !content) return;
        
        const transactions = data.transactions || [];
        let historyHtml = '';
        
        if (transactions.length > 0) {
            historyHtml = transactions.map(t => `
                <div style="background: #1e1f29; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${t.amount > 0 ? '#57F287' : '#ED4245'};">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 600; color: ${t.amount > 0 ? '#57F287' : '#ED4245'};">${t.amount > 0 ? '+' : ''}${t.amount} ₽</span>
                        <span style="color: #72767d; font-size: 0.8rem;">${t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : ''}</span>
                    </div>
                    <div style="color: #b9bbbe; margin-top: 5px;">${t.reason || 'Без причины'}</div>
                    <div style="color: #72767d; font-size: 0.7rem; margin-top: 5px;">Тип: ${t.type === 'deposit' ? 'Пополнение' : 'Списание'}</div>
                </div>
            `).join('');
        } else {
            historyHtml = '<div style="text-align: center; padding: 40px; color: #72767d;">История транзакций пуста</div>';
        }
        
        content.innerHTML = `
            <div style="background: #1e1f29; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <div style="color: white; font-weight: 600;">${this.escapeHtml(username)}</div>
                        <div style="color: #5865F2; font-size: 0.85rem;">${userId}</div>
                    </div>
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${historyHtml}
            </div>
        `;
        
        modal.style.display = 'flex';
    }

    exportUsers() {
        const users = this.users || [];
        const csv = [
            ['ID', 'Имя пользователя', 'Email', 'Баланс', 'Заказов', 'Верифицирован', 'Админ'],
            ...users.map(u => [
                u.discordId,
                u.username || '',
                u.email || '',
                u.balance || 0,
                u.orderCount || 0,
                u.badges?.verified ? 'Да' : 'Нет',
                u.badges?.admin ? 'Да' : 'Нет'
            ])
        ].map(row => row.join(';')).join('\n');
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
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

window.AdminUsers = AdminUsers;
window.adminUsers = new AdminUsers();

js\admin-stats.js
// admin-stats.js - Статистика
class AdminStats {
    constructor() {
        this.api = window.api; 
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
    }

    async loadStats() {
        try {
            const data = await this.api.getStats();
            this.renderStats(data);
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.showNotification(this.api.formatError(error), 'error');
        }
    }

    renderStats(data) {
        const statsContent = document.getElementById('statsContent');
        if (!statsContent) return;

        const stats = data.stats || {};
        const totalUsers = stats.totalUsers || 0;
        const totalOrders = stats.totalOrders || 0;
        const revenue = stats.revenue || 0;
        const newUsers = stats.newUsers || 0;
        const newOrders = stats.newOrders || 0;
        const conversion = stats.conversion || 0;

        statsContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="stat-card" style="background: linear-gradient(135deg, #5865F2, #4752c4); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-users" style="font-size: 1.5rem; color: white;"></i>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">Всего пользователей</div>
                            <div style="color: white; font-size: 2.5rem; font-weight: 700;">${totalUsers}</div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">+${newUsers} за неделю</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #57F287, #4ad477); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-shopping-cart" style="font-size: 1.5rem; color: #1e1f29;"></i>
                        </div>
                        <div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Всего заказов</div>
                            <div style="color: #1e1f29; font-size: 2.5rem; font-weight: 700;">${totalOrders}</div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">+${newOrders} за неделю</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #FEE75C, #e6d048); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(30,31,41,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-coins" style="font-size: 1.5rem; color: #1e1f29;"></i>
                        </div>
                        <div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Общая выручка</div>
                            <div style="color: #1e1f29; font-size: 2.5rem; font-weight: 700;">${revenue.toLocaleString('ru-RU')} ₽</div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Ср. чек: ${stats.avgOrderValue || 0} ₽</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #9B59B6, #8E44AD); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-chart-line" style="font-size: 1.5rem; color: white;"></i>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">Конверсия</div>
                            <div style="color: white; font-size: 2.5rem; font-weight: 700;">${conversion}%</div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">${stats.totalOrders} заказов</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 30px;">
                <div style="background: #2a2b36; border-radius: 16px; padding: 20px; border: 1px solid #40444b;">
                    <h3 style="color: white; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-chart-pie" style="color: #5865F2;"></i>
                        Детальная статистика
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Заказов на пользователя</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? (totalOrders / totalUsers).toFixed(2) : 0}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Выручка на пользователя</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? Math.round(revenue / totalUsers) : 0} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Выручка на заказ</span>
                            <span style="color: #57F287; font-weight: 600;">${totalOrders > 0 ? Math.round(revenue / totalOrders) : 0} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Процент покупателей</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0}%</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: #2a2b36; border-radius: 16px; padding: 20px; border: 1px solid #40444b;">
                    <h3 style="color: white; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar" style="color: #5865F2;"></i>
                        Последние обновления
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Последний заказ</span>
                            <span style="color: #b9bbbe;">${stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString('ru-RU') : 'Нет данных'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Последний пользователь</span>
                            <span style="color: #b9bbbe;">${stats.lastUserDate ? new Date(stats.lastUserDate).toLocaleDateString('ru-RU') : 'Нет данных'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Обновлено</span>
                            <span style="color: #b9bbbe;">${new Date().toLocaleString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация
window.AdminStats = AdminStats;
window.adminStats = new AdminStats();

// Глобальная функция
window.loadStats = async function() {
    await window.adminStats.loadStats();
};

js\admin-products.js
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

js\admin-orders.js
// admin-orders.js - Исправленная версия
class AdminOrders {
    constructor() {
        this.api = window.api; 
        this.baseUrl = 'https://bhstore.netlify.app';
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
    }

    async loadOrders() {
        try {
            const data = await this.api.getAllOrders();
            this.orders = data.orders || [];
            this.filteredOrders = [...this.orders];
            this.renderOrders();
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            this.showNotification('Ошибка загрузки заказов', 'error');
        }
    }

    renderOrders() {
        const ordersContent = document.getElementById('ordersContent');
        if (!ordersContent) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
        
        const totalRevenue = this.filteredOrders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        const completedOrders = this.filteredOrders.filter(o => o.status === 'completed').length;

        let html = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="color: #b9bbbe;">
                    <span style="margin-right: 20px;">
                        <i class="fas fa-shopping-cart"></i> Всего: <strong>${this.filteredOrders.length}</strong>
                    </span>
                    <span style="margin-right: 20px;">
                        <i class="fas fa-check-circle" style="color: #57F287;"></i> Выполнено: <strong style="color: #57F287;">${completedOrders}</strong>
                    </span>
                    <span>
                        <i class="fas fa-coins" style="color: #FEE75C;"></i> Выручка: <strong style="color: #FEE75C;">${totalRevenue} ₽</strong>
                    </span>
                </div>
                <div>
                    <input type="text" 
                           id="searchOrders" 
                           placeholder="Поиск по заказам..." 
                           style="padding: 8px 15px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white; width: 250px;">
                </div>
            </div>
            
            <div class="table-container" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #2a2b36;">
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Заказ</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Пользователь</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Товар</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Сумма</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Дата</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Статус</th>
                            <th style="padding: 12px; text-align: left; color: #b9bbbe;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (paginatedOrders.length === 0) {
            html += `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: #b9bbbe;">
                        <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>Заказы не найдены</p>
                    </td>
                </tr>
            `;
        } else {
            paginatedOrders.forEach(order => {
                const statusColors = {
                    'completed': { bg: '#57F287', color: '#1e1f29', text: '✅ Выполнен' },
                    'pending': { bg: '#FEE75C', color: '#1e1f29', text: '⏳ Ожидание' },
                    'cancelled': { bg: '#ED4245', color: 'white', text: '❌ Отменен' },
                    'processing': { bg: '#5865F2', color: 'white', text: '⚙️ В обработке' }
                };
                
                const status = statusColors[order.status] || { bg: '#40444b', color: 'white', text: order.status };
                
                html += `
                    <tr style="border-bottom: 1px solid #40444b;" onclick="window.adminOrders.viewOrderDetails('${order.id}')" style="cursor: pointer;">
                        <td style="padding: 12px;">
                            <code style="color: #5865F2;">${order.id}</code>
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${order.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                                     style="width: 30px; height: 30px; border-radius: 50%;"
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div>
                                    <div style="color: white;">${order.username || 'Неизвестно'}</div>
                                    <div style="color: #b9bbbe; font-size: 0.8rem;">${order.userDiscordId}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px; color: white;">
                            <strong>${order.productName}</strong>
                        </td>
                        <td style="padding: 12px;">
                            <span style="color: #57F287; font-weight: 600; font-size: 1.1rem;">${order.finalPrice || order.amount} ₽</span>
                        </td>
                        <td style="padding: 12px; color: #b9bbbe;">
                            <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>
                            ${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${status.bg}; color: ${status.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.9rem;">
                                ${status.text}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <button class="btn-admin small" onclick="event.stopPropagation(); window.adminOrders.viewOrderDetails('${order.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
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
        
        ordersContent.innerHTML = html;
        this.setupSearchListener();
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        
        if (totalPages <= 1) return '';
        
        let paginationHtml = `
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 30px;">
        `;
        
        paginationHtml += `
            <button class="btn-admin small" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="window.adminOrders.changePage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHtml += `
                    <button class="btn-admin ${i === this.currentPage ? 'active' : ''}" 
                            onclick="window.adminOrders.changePage(${i})"
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
                    onclick="window.adminOrders.changePage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        paginationHtml += `</div>`;
        
        return paginationHtml;
    }

    changePage(page) {
        this.currentPage = page;
        this.renderOrders();
        document.getElementById('ordersContent').scrollIntoView({ behavior: 'smooth' });
    }

    setupSearchListener() {
        const searchInput = document.getElementById('searchOrders');
        if (!searchInput) return;
        
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchOrders(e.target.value);
            }, 300);
        });
    }

    searchOrders(query) {
        if (!query.trim()) {
            this.filteredOrders = [...this.orders];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredOrders = this.orders.filter(order => 
                order.id?.toLowerCase().includes(searchTerm) ||
                order.username?.toLowerCase().includes(searchTerm) ||
                order.productName?.toLowerCase().includes(searchTerm) ||
                order.userDiscordId?.includes(searchTerm)
            );
        }
        
        this.currentPage = 1;
        this.renderOrders();
    }

    async viewOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
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
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #5865F2; margin: 0;">Детали заказа</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="background: #1e1f29; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Номер заказа</div>
                            <code style="color: #5865F2;">${order.id}</code>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Дата</div>
                            <div style="color: white;">${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}</div>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Пользователь</div>
                            <div style="color: white;">${order.username || 'Неизвестно'}</div>
                            <div style="color: #b9bbbe; font-size: 0.8rem;">${order.userDiscordId}</div>
                        </div>
                        <div>
                            <div style="color: #b9bbbe; margin-bottom: 5px;">Товар</div>
                            <div style="color: white; font-weight: 600;">${order.productName}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #40444b;">
                        <h3 style="color: white; margin-bottom: 15px;">Детали оплаты</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <div style="color: #b9bbbe;">Цена</div>
                                <div style="color: #57F287; font-weight: 600; font-size: 1.2rem;">${order.finalPrice || order.amount} ₽</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <div style="color: #b9bbbe; margin-bottom: 10px;">Статус</div>
                        <span style="background: ${order.status === 'completed' ? '#57F287' : '#FEE75C'}; 
                                   color: #1e1f29; padding: 6px 12px; border-radius: 20px;">
                            ${order.status === 'completed' ? '✅ Выполнен' : order.status}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : 'white'};
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

window.AdminOrders = AdminOrders;
window.adminOrders = new AdminOrders();

js\admin-chat.js
// admin-chat.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class AdminChat {
    constructor() {
        this.api = window.api;
        this.selectedUserId = null;
        this.users = [];
        this.messages = [];
        this.pollingInterval = null;
        this.typingUsers = new Set();
        this.baseUrl = 'https://bhstore.netlify.app';
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.loadChatUI();
        await this.loadUsers();
        this.setupEventListeners();
        this.startPolling();
        
        this.isInitialized = true;
        console.log('✅ AdminChat инициализирован');
    }

    async loadChatUI() {
        const chatContainer = document.getElementById('chatContent');
        if (!chatContainer) {
            console.error('❌ Контейнер чата не найден');
            return;
        }

        chatContainer.innerHTML = `
            <div class="chat-container">
                <!-- Левая панель с пользователями -->
                <div class="chat-users">
                    <div class="chat-users-header">
                        <h3><i class="fas fa-users"></i> Пользователи</h3>
                        <div class="chat-search">
                            <input type="text" id="searchUsers" placeholder="Поиск пользователей...">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                    <div class="users-list" id="usersList">
                        <div class="loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Загрузка пользователей...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Правая панель с чатом -->
                <div class="chat-messages" id="chatPanel">
                    <div class="chat-empty-state" id="emptyChatState">
                        <i class="fas fa-comments"></i>
                        <h3>Выберите пользователя</h3>
                        <p>Для начала общения выберите пользователя из списка слева</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        try {
            const data = await this.api.getChatUsers();
            this.users = data.users || [];
            this.renderUsersList();
            this.updateUnreadCount();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            const usersList = document.getElementById('usersList');
            if (usersList) {
                usersList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #ED4245;">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Ошибка загрузки пользователей</p>
                    </div>
                `;
            }
        }
    }

    renderUsersList(filter = '') {
        const container = document.getElementById('usersList');
        if (!container) return;

        let filteredUsers = this.users;
        
        if (filter) {
            const searchTerm = filter.toLowerCase();
            filteredUsers = this.users.filter(user =>
                user.username?.toLowerCase().includes(searchTerm) ||
                (user.discordId && user.discordId.toString().includes(searchTerm))
            );
        }

        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #b9bbbe;">
                    <i class="fas fa-user-slash"></i>
                    <p>Пользователи не найдены</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredUsers.map(user => {
            const isSelected = this.selectedUserId === user.discordId;
            const isTyping = this.typingUsers.has(user.discordId);
            const unreadCount = user.unreadMessages || 0;
            const statusClass = user.online ? 'online' : 'offline';
            
            return `
                <div class="chat-user ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" 
                     data-user-id="${user.discordId}"
                     onclick="window.adminChat.selectUser('${user.discordId}')">
                    <div class="chat-user-avatar">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        <span class="chat-user-online ${statusClass}"></span>
                    </div>
                    <div class="chat-user-info">
                        <div class="chat-user-name">${user.username || 'Без имени'}</div>
                        <div class="chat-user-status">
                            ${isTyping ? '<span style="color: #5865F2;">Печатает...</span>' : 'Нажмите для начала чата'}
                        </div>
                    </div>
                    ${unreadCount > 0 ? `<span class="chat-user-unread">${unreadCount}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    async selectUser(userId) {
        this.selectedUserId = userId;
        this.renderUsersList();
        await this.loadUserChat(userId);
        this.updateUnreadCount();
        await this.markAsRead(userId);
    }

    async loadUserChat(userId) {
        try {
            const data = await this.api.getChatMessages(userId);
            this.messages = data.messages || [];
            this.renderChatPanel();
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            this.messages = [];
            this.renderChatPanel();
        }
    }

    renderChatPanel() {
        const panel = document.getElementById('chatPanel');
        const emptyState = document.getElementById('emptyChatState');
        if (!panel) return;

        const user = this.users.find(u => u.discordId === this.selectedUserId);
        if (!user) return;

        // Скрываем empty state
        if (emptyState) emptyState.style.display = 'none';

        panel.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-header-avatar">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    </div>
                    <div class="chat-header-text">
                        <h3>${user.username || 'Без имени'}</h3>
                        <p id="userStatus">
                            ${this.typingUsers.has(user.discordId) ? 'Печатает...' : 'Онлайн'}
                        </p>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button onclick="window.adminChat.showUserInfo('${user.discordId}')" title="Информация">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
            
            <div class="chat-messages-list" id="chatMessagesList">
                ${this.renderMessages()}
            </div>
            
            <div class="chat-input">
                <div id="typingIndicator" class="typing-indicator" style="display: none;">
                    <span></span><span></span><span></span>
                </div>
                
                <textarea id="adminMessageInput" 
                          placeholder="Введите сообщение..."
                          rows="1"></textarea>
                <button class="chat-send-btn" id="sendAdminMessage">
                    <i class="fas fa-paper-plane"></i>
                </button>
                
                <div class="chat-input-actions">
                    <span class="chat-input-hint">
                        <i class="fas fa-keyboard"></i> Ctrl+Enter
                    </span>
                </div>
            </div>
        `;

        this.setupMessageInput();
        this.scrollToBottom();
    }

    renderMessages() {
        if (!this.messages || this.messages.length === 0) {
            return `
                <div class="chat-empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Напишите первое сообщение</p>
                </div>
            `;
        }

        let lastDate = null;
        let messagesHtml = '';

        this.messages.forEach(msg => {
            const msgDate = new Date(msg.timestamp).toDateString();
            
            // Добавляем разделитель даты если нужно
            if (lastDate !== msgDate) {
                messagesHtml += `
                    <div class="message-date-divider">
                        <span>${new Date(msg.timestamp).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric'
                        })}</span>
                    </div>
                `;
                lastDate = msgDate;
            }

            const isAdmin = msg.from_admin || msg.fromAdmin;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messagesHtml += `
                <div class="message-item ${isAdmin ? 'admin' : 'user'}">
                    <div class="message-text">${this.escapeHtml(msg.message)}</div>
                    <div class="message-time">
                        <i class="fas fa-clock"></i>
                        ${time}
                        ${isAdmin ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
                    </div>
                </div>
            `;
        });

        return messagesHtml;
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

    async sendAdminMessage() {
        const input = document.getElementById('adminMessageInput');
        if (!input || !this.selectedUserId) return;
        
        const message = input.value.trim();
        if (!message) return;
    
        try {
            console.log('📤 Отправка сообщения от админа...');
            
            // Отправляем сообщение с флагом fromAdmin: true
            const result = await this.api.sendChatMessage(this.selectedUserId, message, true);
            
            console.log('✅ Сообщение отправлено:', result);
            
            // Добавляем в список сообщений
            this.messages.push({
                message: message,
                from_admin: true,
                timestamp: new Date().toISOString()
            });
            
            // Обновляем отображение
            const messagesList = document.getElementById('chatMessagesList');
            if (messagesList) {
                messagesList.innerHTML = this.renderMessages();
            }
            
            // Очищаем поле
            input.value = '';
            input.focus();
            
            this.scrollToBottom();
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Не удалось отправить сообщение', 'error');
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessagesList');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }

    setupMessageInput() {
        const input = document.getElementById('adminMessageInput');
        const sendBtn = document.getElementById('sendAdminMessage');
        
        if (!input || !sendBtn) return;
        
        // Авто-высота textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendAdminMessage();
            }
        });
        
        sendBtn.addEventListener('click', () => this.sendAdminMessage());
    }

    async checkNewMessages() {
        if (!this.selectedUserId) return;
        
        try {
            const data = await this.api.checkNewMessages(this.selectedUserId, Date.now());
            
            if (data.hasNew) {
                await this.loadUserChat(this.selectedUserId);
            }
        } catch (error) {
            // Игнорируем ошибки при проверке
        }
    }

    async markAsRead(userId) {
        try {
            await this.api.markMessagesAsRead(userId);
        } catch (error) {
            console.error('Ошибка отметки как прочитано:', error);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderUsersList(e.target.value);
            });
        }
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            this.checkNewMessages();
        }, 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    updateUnreadCount() {
        const totalUnread = this.users.reduce((sum, user) => sum + (user.unreadMessages || 0), 0);
        // Можно добавить бейдж в навигацию если нужно
    }

    showUserInfo(userId) {
        const user = this.users.find(u => u.discordId === userId);
        if (!user) return;
        
        const info = `
👤 Информация о пользователе:

🆔 Discord ID: ${user.discordId}
📝 Имя: ${user.username || 'Без имени'}
📧 Email: ${user.email || 'Не указан'}
💰 Баланс: ${user.balance || 0} ₽
📦 Заказов: ${user.orderCount || 0}
💬 Непрочитанных: ${user.unreadMessages || 0}
📅 Регистрация: ${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ru-RU') : 'Неизвестно'}
        `;
        
        alert(info);
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация
window.AdminChat = AdminChat;
window.adminChat = new AdminChat();

Создай тогда admin-newsn.js