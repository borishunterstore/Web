// profile.js - Полноценный профиль с просмотром чужих профилей и настройками
(function() {
    'use strict';

    // Конфигурация бейджей
    const BADGE_IMAGES = {
        verified: 'image/BADGE/verified.gif',
        partner: 'image/BADGE/partner.png',
        buyer: 'image/BADGE/buy.gif',
        admin: 'image/BADGE/admin.png',
        vip: 'image/BADGE/vip.png',
        early: 'image/BADGE/early.png'
    };

    // Текущий просматриваемый пользователь
    let currentViewingUserId = null;
    let isOwnProfile = true;

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        await checkAuthAndLoadProfile();
        setupEventListeners();
    });

    // Проверка авторизации и загрузка профиля
    async function checkAuthAndLoadProfile() {
        const authData = getAuthData();
        
        if (!authData.id) {
            window.location.href = '/auth.html';
            return;
        }

        // Проверяем URL на наличие ID пользователя
        const pathParts = window.location.pathname.split('/');
        const userIdFromUrl = pathParts[pathParts.length - 1];
        
        if (userIdFromUrl && userIdFromUrl !== 'profile.html' && userIdFromUrl !== 'profile') {
            // Просмотр чужого профиля
            currentViewingUserId = userIdFromUrl;
            isOwnProfile = false;
            await loadForeignProfile(userIdFromUrl);
        } else {
            // Свой профиль
            currentViewingUserId = authData.id;
            isOwnProfile = true;
            await loadOwnProfile();
        }
    }

    // Загрузка своего профиля
    async function loadOwnProfile() {
        const authData = getAuthData();
        
        try {
            const response = await fetch(`/api/user/${authData.id}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                const user = data.user;
                
                // Обновляем auth данные
                authData.balance = user.balance;
                authData.badges = user.badges || {};
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                
                renderProfile(user, true);
                renderBalance(user.balance || 0);
                
                // Загружаем заказы
                const ordersResponse = await fetch(`/api/user/${authData.id}/orders`);
                const ordersData = await ordersResponse.json();
                
                if (ordersData.success) {
                    renderOrders(ordersData.orders || [], true);
                    updateStats(ordersData.orders || [], user);
                } else {
                    renderOrders([], true);
                    updateStats([], user);
                }
                
                // Загружаем промокоды
                await loadUserPromocodes();
                await loadActivePromocodes();
                
                // Инициализируем чат для своего профиля
                if (window.ChatSystem) {
                    window.chatSystem = new ChatSystem();
                    await window.chatSystem.init();
                }
            } else {
                await registerNewUser(authData);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            renderProfile(authData, true);
            renderBalance(0);
            renderOrders([], true);
            updateStats([], authData);
        }
    }

    // Загрузка чужого профиля
    async function loadForeignProfile(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                const user = data.user;
                
                // Скрываем секции, которые не должны быть видны в чужом профиле
                document.getElementById('balanceSection')?.classList.add('hidden');
                document.getElementById('promocodeSection')?.classList.add('hidden');
                document.getElementById('supportChat')?.parentElement?.classList.add('hidden');
                
                // Скрываем кнопку настроек
                const settingsBtn = document.getElementById('settingsBtn');
                if (settingsBtn) settingsBtn.style.display = 'none';
                
                renderProfile(user, false);
                
                // Загружаем заказы (только выполненные, без sensitive данных)
                const ordersResponse = await fetch(`/api/user/${userId}/orders`);
                const ordersData = await ordersResponse.json();
                
                if (ordersData.success) {
                    // Показываем только выполненные заказы для чужих профилей
                    const completedOrders = (ordersData.orders || []).filter(o => o.status === 'completed');
                    renderOrders(completedOrders, false);
                    updateStats(completedOrders, user);
                } else {
                    renderOrders([], false);
                    updateStats([], user);
                }
                
                // Меняем заголовок страницы
                document.title = `${user.username || 'Пользователь'} | BHStore`;
                
                // Добавляем кнопку "Написать в чат"
                addChatButton(userId, user.username);
            } else {
                showNotFoundError();
            }
        } catch (error) {
            console.error('Error loading foreign profile:', error);
            showNotFoundError();
        }
    }

    // Добавление кнопки чата для чужого профиля
    function addChatButton(userId, username) {
        const profileHeader = document.getElementById('profileHeader');
        if (profileHeader && !document.getElementById('foreignChatBtn')) {
            const chatBtn = document.createElement('button');
            chatBtn.id = 'foreignChatBtn';
            chatBtn.className = 'btn-primary';
            chatBtn.style.marginTop = '20px';
            chatBtn.innerHTML = '<i class="fas fa-comment"></i> Написать в поддержку о пользователе';
            chatBtn.onclick = () => {
                const authData = getAuthData();
                if (authData.id) {
                    window.location.href = '/profile.html#supportChat';
                } else {
                    window.location.href = '/auth.html';
                }
            };
            profileHeader.appendChild(chatBtn);
        }
    }

    // Регистрация нового пользователя
    async function registerNewUser(authData) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discordId: authData.id,
                    username: authData.username,
                    email: authData.email,
                    avatar: authData.avatar
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadOwnProfile();
            } else {
                renderProfile(authData, true);
                renderBalance(0);
                renderOrders([], true);
                updateStats([], authData);
            }
        } catch (error) {
            console.error('Registration error:', error);
            renderProfile(authData, true);
            renderBalance(0);
            renderOrders([], true);
            updateStats([], authData);
        }
    }

    // Рендер профиля
    function renderProfile(user, isOwn) {
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        if (user.avatar) {
            if (user.avatar.startsWith('a_')) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${user.discordId || user.id}/${user.avatar}.gif?size=256`;
            } else {
                avatarUrl = `https://cdn.discordapp.com/avatars/${user.discordId || user.id}/${user.avatar}.png?size=256`;
            }
        }
        
        const badges = normalizeBadges(user.badges);
        const mainBadge = getMainBadge(badges);
        const badgesHTML = generateBadgesHTML(badges);
        
        const settingsButton = isOwn ? `
            <button id="settingsBtn" class="btn-settings" onclick="window.showSettingsModal()">
                <i class="fas fa-cog"></i> Настройки
            </button>
        ` : '';
        
        document.getElementById('profileHeader').innerHTML = `
            <div class="profile-avatar-wrapper">
                <img src="${avatarUrl}" 
                     class="profile-avatar"
                     alt="Avatar"
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                ${mainBadge}
            </div>
            <div class="profile-info">
                <h2>
                    <i class="fas fa-user-circle"></i>
                    ${escapeHtml(user.username || 'Пользователь')}
                    ${settingsButton}
                </h2>
                <div class="badges-container">
                    ${badgesHTML}
                </div>
                <p><i class="fas fa-hashtag"></i> Discord ID: ${escapeHtml(user.discordId || user.id || 'Не указан')}</p>
                <p><i class="fas fa-calendar-alt"></i> Зарегистрирован: ${new Date(user.registeredAt || Date.now()).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })}</p>
                ${isOwn ? `<p><i class="fas fa-envelope"></i> Gmail: ${escapeHtml(user.email || 'Не указан')}</p>` : ''}
            </div>
        `;
    }

    // Рендер баланса
    function renderBalance(balance) {
        const balanceElement = document.getElementById('balanceAmount');
        if (balanceElement) {
            balanceElement.textContent = `${balance}₽`;
        }
    }

    // Рендер заказов
    function renderOrders(orders, showCancelButton = true) {
        const ordersList = document.getElementById('ordersList');
        
        if (!ordersList) return;
        
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>У пользователя пока нет заказов</p>
                    ${showCancelButton ? '<a href="/shop.html" class="btn-primary"><i class="fas fa-store"></i> Перейти в магазин</a>' : ''}
                </div>
            `;
            return;
        }
        
        orders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        
        ordersList.innerHTML = orders.map(order => {
            const statusClass = {
                'pending': 'status-pending',
                'completed': 'status-completed',
                'cancelled': 'status-cancelled'
            }[order.status] || 'status-pending';
            
            const statusText = {
                'pending': 'Ожидание',
                'completed': 'Выполнено',
                'cancelled': 'Отменено'
            }[order.status] || order.status;
            
            const statusIcon = {
                'pending': 'fa-clock',
                'completed': 'fa-check-circle',
                'cancelled': 'fa-times-circle'
            }[order.status] || 'fa-clock';
            
            // Кнопка подробнее (только для своих заказов)
            const detailsButton = showCancelButton ? `
                <button class="btn-order-details" onclick="window.showOrderDetails('${escapeHtml(order.id)}')">
                    <i class="fas fa-info-circle"></i> Подробнее
                </button>
            ` : '';
            
            // Кнопка отмены (только для ожидающих заказов и своих)
            const cancelButton = (showCancelButton && order.status === 'pending') ? `
                <button class="btn-order-cancel" onclick="window.cancelOrder('${escapeHtml(order.id)}')">
                    <i class="fas fa-times"></i> Отменить
                </button>
            ` : '';
            
            return `
                <div class="order-item" data-order-id="${escapeHtml(order.id)}">
                    <div class="order-id">
                        <i class="fas fa-hashtag"></i>
                        ${escapeHtml(order.id)}
                    </div>
                    <div class="order-product">
                        <strong>${escapeHtml(order.productName)}</strong>
                        <div class="order-price">
                            <i class="fas fa-tag"></i>
                            ${order.price || 0}₽
                        </div>
                    </div>
                    <div class="order-date">
                        <span>
                            <i class="fas fa-calendar-alt"></i>
                            ${new Date(order.date || order.createdAt).toLocaleString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                        <span class="status-badge ${statusClass}">
                            <i class="fas ${statusIcon}"></i>
                            ${statusText}
                        </span>
                    </div>
                    <div class="order-actions">
                        ${detailsButton}
                        ${cancelButton}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Обновление статистики
    function updateStats(orders, user) {
        const totalOrdersElem = document.getElementById('totalOrdersStat');
        const totalSpentElem = document.getElementById('totalSpentStat');
        const memberSinceElem = document.getElementById('memberSinceStat');
        
        if (totalOrdersElem) totalOrdersElem.textContent = orders.length;
        
        const totalSpent = orders.reduce((sum, order) => sum + (order.price || 0), 0);
        if (totalSpentElem) totalSpentElem.textContent = `${totalSpent}₽`;
        
        const registeredDate = new Date(user.registeredAt || Date.now());
        const now = new Date();
        const diffTime = Math.abs(now - registeredDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (memberSinceElem) {
            if (diffDays < 30) {
                memberSinceElem.textContent = `${diffDays} дн.`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                memberSinceElem.textContent = `${months} мес.`;
            } else {
                const years = Math.floor(diffDays / 365);
                memberSinceElem.textContent = `${years} г.`;
            }
        }
    }

    // Показ ошибки "пользователь не найден"
    function showNotFoundError() {
        const container = document.querySelector('.profile-container');
        if (container) {
            container.innerHTML = `
                <div class="error-page" style="text-align: center; padding: 100px 20px;">
                    <i class="fas fa-user-slash" style="font-size: 5rem; color: #ED4245; margin-bottom: 20px;"></i>
                    <h2>Пользователь не найден</h2>
                    <p>Пользователь с таким ID не существует или удалил аккаунт.</p>
                    <a href="/profile.html" class="btn-primary" style="margin-top: 20px; display: inline-block;">
                        <i class="fas fa-arrow-left"></i> Вернуться в свой профиль
                    </a>
                </div>
            `;
        }
    }

    // ========== МОДАЛЬНОЕ ОКНО НАСТРОЕК ==========
    window.showSettingsModal = function() {
        const authData = getAuthData();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'settingsModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(8px);';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; width: 90%; background: #2a2b36; border-radius: 20px; padding: 0; overflow: hidden;">
                <div style="padding: 20px; background: #1e1f29; border-bottom: 1px solid #40444b; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; color: white;"><i class="fas fa-cog"></i> Настройки профиля</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="padding: 20px;">
                    <!-- Изменение email -->
                    <div class="settings-section" style="margin-bottom: 25px;">
                        <h3 style="color: #5865F2; margin-bottom: 15px;"><i class="fas fa-envelope"></i> Электронная почта</h3>
                        <div class="form-group">
                            <label style="color: #b9bbbe;">Текущий email</label>
                            <input type="email" id="currentEmail" value="${escapeHtml(authData.email || '')}" readonly style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: #72767d;">
                        </div>
                        <div class="form-group">
                            <label style="color: #b9bbbe;">Новый email</label>
                            <input type="email" id="newEmail" placeholder="Введите новый email" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                        <button class="btn-save-email" onclick="window.updateEmail()" style="background: #5865F2; border: none; padding: 10px 20px; border-radius: 8px; color: white; cursor: pointer; width: 100%; margin-top: 10px;">
                            <i class="fas fa-save"></i> Обновить email
                        </button>
                    </div>
                    
                    <!-- Обновление аватарки -->
                    <div class="settings-section" style="margin-bottom: 25px;">
                        <h3 style="color: #5865F2; margin-bottom: 15px;"><i class="fas fa-image"></i> Аватарка</h3>
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <img src="${authData.avatar ? `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                                 style="width: 64px; height: 64px; border-radius: 50%;" 
                                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            <span style="color: #b9bbbe;">Текущая аватарка из Discord</span>
                        </div>
                        <button class="btn-refresh-avatar" onclick="window.refreshAvatar()" style="background: #57F287; border: none; padding: 10px 20px; border-radius: 8px; color: #1e1f29; cursor: pointer; width: 100%;">
                            <i class="fas fa-sync-alt"></i> Обновить аватарку из Discord
                        </button>
                    </div>
                    
                    <!-- Запрос бейджа -->
                    <div class="settings-section">
                        <h3 style="color: #5865F2; margin-bottom: 15px;"><i class="fas fa-medal"></i> Бейджи</h3>
                        <p style="color: #b9bbbe; margin-bottom: 15px;">Хотите получить особый бейдж? Свяжитесь с администрацией через чат поддержки.</p>
                        <button class="btn-request-badge" onclick="window.requestBadge()" style="background: #FEE75C; border: none; padding: 10px 20px; border-radius: 8px; color: #1e1f29; cursor: pointer; width: 100%;">
                            <i class="fas fa-ticket-alt"></i> Запросить бейдж
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    };

    // Обновление email
    window.updateEmail = async function() {
        const newEmail = document.getElementById('newEmail')?.value.trim();
        if (!newEmail) {
            alert('Введите новый email');
            return;
        }
        
        if (!newEmail.includes('@')) {
            alert('Введите корректный email');
            return;
        }
        
        const authData = getAuthData();
        
        try {
            const response = await fetch(`/api/admin/users/${authData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({ email: newEmail })
            });
            
            const data = await response.json();
            
            if (data.success) {
                authData.email = newEmail;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                alert('Email успешно обновлён!');
                document.querySelector('.modal')?.remove();
                await loadOwnProfile();
            } else {
                alert('Ошибка обновления email: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error updating email:', error);
            alert('Ошибка при обновлении email');
        }
    };

    // Обновление аватарки
    window.refreshAvatar = async function() {
        const authData = getAuthData();
        
        try {
            // Получаем свежие данные из Discord через API
            const response = await fetch('/api/auth/discord/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.user) {
                await fetch(`/api/admin/users/${authData.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authData.token}`
                    },
                    body: JSON.stringify({ avatar: data.user.avatar })
                });
                
                authData.avatar = data.user.avatar;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                alert('Аватарка обновлена!');
                document.querySelector('.modal')?.remove();
                await loadOwnProfile();
            } else {
                alert('Не удалось обновить аватарку');
            }
        } catch (error) {
            console.error('Error refreshing avatar:', error);
            alert('Ошибка при обновлении аватарки');
        }
    };

    // Запрос бейджа
    window.requestBadge = function() {
        document.querySelector('.modal')?.remove();
        const chatSection = document.getElementById('supportChat');
        if (chatSection) {
            chatSection.scrollIntoView({ behavior: 'smooth' });
            alert('Напишите в чат поддержки, какой бейдж вы хотите получить, и причину');
        } else {
            window.location.href = '/profile.html#supportChat';
        }
    };

    // ========== ДЕТАЛИ ЗАКАЗА ==========
    window.showOrderDetails = function(orderId) {
        const authData = getAuthData();
        
        fetch(`/api/user/${authData.id}/orders`)
            .then(res => res.json())
            .then(data => {
                const order = (data.orders || []).find(o => o.id === orderId);
                if (!order) {
                    alert('Заказ не найден');
                    return;
                }
                
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(8px);';
                
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px; width: 90%; background: #2a2b36; border-radius: 20px; padding: 0; overflow: hidden;">
                        <div style="padding: 20px; background: #1e1f29; border-bottom: 1px solid #40444b; display: flex; justify-content: space-between; align-items: center;">
                            <h2 style="margin: 0; color: white;"><i class="fas fa-info-circle"></i> Детали заказа</h2>
                            <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                        </div>
                        <div style="padding: 20px;">
                            <div style="margin-bottom: 15px;">
                                <label style="color: #5865F2; font-weight: 600;">Номер заказа:</label>
                                <p style="color: white; font-family: monospace;">${escapeHtml(order.id)}</p>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="color: #5865F2; font-weight: 600;">Товар:</label>
                                <p style="color: white;">${escapeHtml(order.productName)}</p>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="color: #5865F2; font-weight: 600;">Сумма:</label>
                                <p style="color: #57F287; font-weight: 700;">${order.price || 0}₽</p>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="color: #5865F2; font-weight: 600;">Дата:</label>
                                <p style="color: #b9bbbe;">${new Date(order.date || order.createdAt).toLocaleString('ru-RU')}</p>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="color: #5865F2; font-weight: 600;">Статус:</label>
                                <p><span class="status-badge ${order.status === 'completed' ? 'status-completed' : order.status === 'pending' ? 'status-pending' : 'status-cancelled'}">${order.status === 'completed' ? 'Выполнен' : order.status === 'pending' ? 'Ожидание' : 'Отменён'}</span></p>
                            </div>
                            ${order.discount ? `
                                <div style="margin-bottom: 15px;">
                                    <label style="color: #5865F2; font-weight: 600;">Скидка:</label>
                                    <p style="color: #FEE75C;">${order.discount}% (${order.discountAmount || 0}₽)</p>
                                </div>
                            ` : ''}
                            ${order.promocodes && order.promocodes.length ? `
                                <div style="margin-bottom: 15px;">
                                    <label style="color: #5865F2; font-weight: 600;">Применённые промокоды:</label>
                                    <p style="color: #FEE75C;">${order.promocodes.join(', ')}</p>
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding: 20px; border-top: 1px solid #40444b; display: flex; justify-content: flex-end;">
                            <button onclick="this.closest('.modal').remove()" class="btn-primary">Закрыть</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
            })
            .catch(error => {
                console.error('Error loading order details:', error);
                alert('Ошибка загрузки деталей заказа');
            });
    };

    // ========== ОТМЕНА ЗАКАЗА ==========
    window.cancelOrder = async function(orderId) {
        if (!confirm('⚠️ ВНИМАНИЕ!\n\nВы действительно хотите отменить заказ?\n\nОтмена возможна только для заказов в статусе "Ожидание".\n\nСредства будут возвращены на ваш баланс.')) {
            return;
        }
        
        const authData = getAuthData();
        
        try {
            // Получаем заказ
            const ordersRes = await fetch(`/api/user/${authData.id}/orders`);
            const ordersData = await ordersRes.json();
            const order = (ordersData.orders || []).find(o => o.id === orderId);
            
            if (!order) {
                alert('Заказ не найден');
                return;
            }
            
            if (order.status !== 'pending') {
                alert('Отменить можно только заказы в статусе "Ожидание"');
                return;
            }
            
            // Обновляем статус заказа
            const response = await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({ status: 'cancelled' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Возвращаем средства на баланс
                const balanceRes = await fetch('/api/update-balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: authData.id,
                        amount: order.price,
                        reason: `Возврат средств за отменённый заказ ${orderId}`
                    })
                });
                
                await balanceRes.json();
                
                alert(`Заказ ${orderId} отменён. Средства возвращены на баланс.`);
                await loadOwnProfile();
            } else {
                alert('Ошибка отмены заказа: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Ошибка при отмене заказа');
        }
    };

    // ========== ПРОМОКОДЫ ==========
    async function loadUserPromocodes() {
        const authData = getAuthData();
        if (!authData.id) return;
        
        try {
            const response = await fetch(`/api/promocodes/user/${authData.id}`);
            const data = await response.json();
            
            if (data.success && data.promocodes) {
                renderUserPromocodes(data.promocodes);
            } else {
                renderUserPromocodes([]);
            }
        } catch (error) {
            console.error('Ошибка загрузки промокодов:', error);
            renderUserPromocodes([]);
        }
    }

    async function loadActivePromocodes() {
        const authData = getAuthData();
        if (!authData.id) return;
        
        try {
            const response = await fetch(`/api/promocodes/active/${authData.id}`);
            const data = await response.json();
            
            if (data.success && data.promocodes) {
                renderActivePromocodes(data.promocodes);
            } else {
                renderActivePromocodes([]);
            }
        } catch (error) {
            console.error('Ошибка загрузки активных промокодов:', error);
            renderActivePromocodes([]);
        }
    }

    function renderUserPromocodes(promocodes) {
        const container = document.getElementById('userPromocodesList');
        if (!container) return;
        
        if (!promocodes || promocodes.length === 0) {
            container.innerHTML = `
                <div class="empty-promocodes" style="text-align: center; padding: 30px; background: #1e1f29; border-radius: 16px;">
                    <i class="fas fa-ticket-alt" style="font-size: 3rem; color: #4a4b5e; margin-bottom: 15px; display: block;"></i>
                    <p style="color: #b9bbbe; margin: 0;">У вас пока нет использованных промокодов</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="promocodes-history-header" style="margin-bottom: 20px;">
                <h3 style="font-size: 1.2rem; color: #fff; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-history" style="color: #5865F2;"></i> 
                    История использованных промокодов
                    <span style="font-size: 0.8rem; background: #2a2b36; padding: 2px 10px; border-radius: 20px; color: #b9bbbe;">${promocodes.length} шт.</span>
                </h3>
            </div>
            <div class="promocodes-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${promocodes.map(promo => `
                    <div class="promocode-history-item" style="background: #1e1f29; border-radius: 16px; padding: 16px 20px; border: 1px solid #2a2b36;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, ${promo.type === 'discount' ? '#FEE75C' : '#57F287'}, ${promo.type === 'discount' ? '#e6d048' : '#43b581'}); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-${promo.type === 'discount' ? 'percent' : 'coins'}" style="color: #1e1f29; font-size: 1.4rem;"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 700; color: ${promo.type === 'discount' ? '#FEE75C' : '#57F287'}; font-family: monospace; font-size: 1.1rem;">
                                        ${escapeHtml(promo.code)}
                                    </div>
                                    <div style="display: flex; gap: 15px; margin-top: 6px; font-size: 0.85rem; color: #b9bbbe;">
                                        <span><i class="fas fa-${promo.type === 'discount' ? 'percent' : 'coins'}"></i> ${promo.type === 'discount' ? `${promo.value}% скидка` : `${promo.value}₽`}</span>
                                        <span><i class="fas fa-calendar-alt"></i> ${promo.usedAtFormatted || new Date(promo.usedAt).toLocaleString('ru-RU')}</span>
                                    </div>
                                </div>
                            </div>
                            <div style="padding: 6px 16px; border-radius: 30px; font-size: 0.8rem; background: rgba(87, 242, 135, 0.15); color: #57F287;">
                                <i class="fas fa-check-circle"></i> Использован
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderActivePromocodes(promocodes) {
        const container = document.getElementById('userActivePromocodes');
        if (!container) return;
        
        if (!promocodes || promocodes.length === 0) {
            container.innerHTML = `
                <div class="empty-promocodes" style="text-align: center; padding: 20px; background: #1e1f29; border-radius: 16px;">
                    <i class="fas fa-ticket-alt" style="font-size: 2rem; color: #4a4b5e; margin-bottom: 10px; display: block;"></i>
                    <p style="color: #b9bbbe; margin: 0;">Нет активных промокодов</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="active-promocodes-header" style="margin-bottom: 15px;">
                <h3 style="font-size: 1.1rem; color: #fff; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-fire" style="color: #FEE75C;"></i> 
                    Активные промокоды (скидки)
                    <span style="font-size: 0.8rem; background: #2a2b36; padding: 2px 10px; border-radius: 20px; color: #FEE75C;">${promocodes.length} шт.</span>
                </h3>
            </div>
            <div class="active-promocodes-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${promocodes.map(promo => `
                    <div class="active-promocode-item" style="background: linear-gradient(135deg, rgba(254, 231, 92, 0.1), rgba(254, 231, 92, 0.05)); border-radius: 16px; padding: 12px 16px; border: 1px solid rgba(254, 231, 92, 0.3); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #FEE75C, #e6d048); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-percent" style="color: #1e1f29; font-size: 1.2rem;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #FEE75C; font-family: monospace; font-size: 1rem;">${escapeHtml(promo.code)}</div>
                                <div style="font-size: 0.8rem; color: #b9bbbe;">Скидка ${promo.value}%</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${promo.expires_at ? `<div style="font-size: 0.7rem; color: #FEE75C;"><i class="fas fa-clock"></i> до ${new Date(promo.expires_at).toLocaleDateString('ru-RU')}</div>` : ''}
                            <button class="btn-remove-promo" onclick="window.promocodeSystem?.removeDiscount('${escapeHtml(promo.code)}')" style="background: none; border: none; color: #ED4245; cursor: pointer; padding: 5px 10px; border-radius: 8px;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch {
            return {};
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeBadges(badgesData) {
        if (!badgesData) {
            return { verified: false, partner: false, buyer: false, early: false, vip: false, admin: false };
        }
        if (typeof badgesData === 'string') {
            return { verified: badgesData === 'verified', partner: false, buyer: false, early: false, vip: false, admin: false };
        }
        if (typeof badgesData === 'object') {
            return {
                admin: !!badgesData.admin,
                verified: !!badgesData.verified,
                partner: !!badgesData.partner,
                buyer: !!badgesData.buyer,
                early: !!badgesData.early,
                vip: !!badgesData.vip
            };
        }
        return { verified: false, partner: false, buyer: false, early: false, vip: false, admin: false };
    }

    function getMainBadge(badges) {
        if (badges.admin) {
            return `<div class="avatar-badge" title="Администратор"><img src="${BADGE_IMAGES.admin}" alt="Admin"></div>`;
        } else if (badges.verified) {
            return `<div class="avatar-badge" title="Верифицированный аккаунт"><img src="${BADGE_IMAGES.verified}" alt="Verified"></div>`;
        } else if (badges.partner) {
            return `<div class="avatar-badge" title="Партнёр"><img src="${BADGE_IMAGES.partner}" alt="Partner"></div>`;
        } else if (badges.buyer) {
            return `<div class="avatar-badge" title="Покупатель"><img src="${BADGE_IMAGES.buyer}" alt="Buyer"></div>`;
        } else if (badges.vip) {
            return `<div class="avatar-badge" title="VIP пользователь"><img src="${BADGE_IMAGES.vip}" alt="VIP"></div>`;
        } else if (badges.early) {
            return `<div class="avatar-badge" title="Ранний сторонник"><img src="${BADGE_IMAGES.early}" alt="Early Supporter"></div>`;
        }
        return '';
    }

    function generateBadgesHTML(badges) {
        let badgesHtml = '';
        const badgeConfigs = [
            { condition: badges.admin, class: 'admin', image: BADGE_IMAGES.admin, text: 'Администратор', priority: 1 },
            { condition: badges.verified, class: 'verified', image: BADGE_IMAGES.verified, text: 'Верифицирован', priority: 2 },
            { condition: badges.partner, class: 'partner', image: BADGE_IMAGES.partner, text: 'Партнёр', priority: 3 },
            { condition: badges.buyer, class: 'buyer', image: BADGE_IMAGES.buyer, text: 'Покупатель', priority: 4 },
            { condition: badges.vip, class: 'vip', image: BADGE_IMAGES.vip, text: 'VIP', priority: 5 },
            { condition: badges.early, class: 'early', image: BADGE_IMAGES.early, text: 'Ранний сторонник', priority: 6 }
        ];
        badgeConfigs.sort((a, b) => a.priority - b.priority).forEach(config => {
            if (config.condition) {
                badgesHtml += `<div class="badge badge-${config.class}" title="${config.text}"><img src="${config.image}" alt="${config.text}" loading="lazy"><span>${config.text}</span></div>`;
            }
        });
        return badgesHtml;
    }

    function setupEventListeners() {
        // Кнопка промокода
        const applyBtn = document.getElementById('applyPromocodeBtn');
        const promocodeInput = document.getElementById('promocodeInput');
        
        if (applyBtn && window.promocodeSystem) {
            const newBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newBtn, applyBtn);
            newBtn.addEventListener('click', () => {
                const code = promocodeInput?.value.trim().toUpperCase();
                if (code && window.promocodeSystem) {
                    window.promocodeSystem.applyPromocodeByCode(code);
                } else if (!code) {
                    alert('Введите промокод');
                }
            });
            if (promocodeInput) {
                promocodeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const code = promocodeInput.value.trim().toUpperCase();
                        if (code && window.promocodeSystem) {
                            window.promocodeSystem.applyPromocodeByCode(code);
                        }
                    }
                });
            }
        }
    }

    // Экспорт глобальных функций
    window.showAddBalanceModal = function() {
        document.getElementById('addBalanceModal').style.display = 'flex';
    };
    
    window.closeModal = function(modalId) {
        document.getElementById(modalId).style.display = 'none';
    };
    
    window.logout = function() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_active_promocodes');
        window.location.href = '/';
    };
})();

// Добавляем метод в promocodeSystem
if (window.promocodeSystem && !window.promocodeSystem.applyPromocodeByCode) {
    window.promocodeSystem.applyPromocodeByCode = async function(code) {
        if (this.isProcessing) return;
        
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) {
            alert('Авторизуйтесь');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const checkData = await window.api.request('/promocodes/check', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code })
            });
            
            if (!checkData.success) {
                this.showMessage(checkData.error || 'Промокод недействителен', 'error');
                this.setLoading(false);
                return;
            }
            
            const activateData = await window.api.request('/promocodes/activate', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code })
            });
            
            if (activateData.success) {
                const promo = checkData.promocode;
                
                if (promo.type === 'discount') {
                    this.activeDiscounts.push({
                        code: promo.code,
                        value: promo.value,
                        type: 'discount',
                        appliedAt: new Date().toISOString()
                    });
                    await this.saveToAPI();
                    this.showMessage(`✓ Промокод активирован! Скидка ${promo.value}%`, 'success');
                    
                    if (typeof window.updateProductsDisplay === 'function') {
                        window.updateProductsDisplay();
                    }
                    
                } else if (promo.type === 'balance') {
                    this.showMessage(`💰 Баланс пополнен на ${promo.value} ₽`, 'success');
                    
                    if (activateData.newBalance !== undefined) {
                        if (typeof window.renderBalance === 'function') {
                            window.renderBalance(activateData.newBalance);
                        }
                        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
                        authData.balance = activateData.newBalance;
                        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                    }
                }
                
                const input = document.getElementById('promocodeInput');
                if (input) input.value = '';
                
                await this.loadFromAPI();
                this.renderUI();
                
                if (typeof loadUserPromocodes === 'function') {
                    await loadUserPromocodes();
                }
                if (typeof loadActivePromocodes === 'function') {
                    await loadActivePromocodes();
                }
                
            } else {
                this.showMessage(activateData.error || 'Ошибка активации', 'error');
            }
        } catch (e) {
            console.error('Ошибка применения промокода:', e);
            this.showMessage('Ошибка сервера: ' + (e.message || 'неизвестная ошибка'), 'error');
        } finally {
            this.setLoading(false);
        }
    };
}