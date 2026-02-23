// mobile-nav.js - Управление мобильной навигацией

(function() {
    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
    });

    function initMobileMenu() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navMenu = document.querySelector('.nav-menu');
        const navAuth = document.querySelector('.nav-auth');
        
        if (!mobileMenuBtn || !navMenu) return;
        
        // Проверяем, существует ли уже мобильное меню
        let mobileNav = document.querySelector('.mobile-nav');
        
        if (!mobileNav) {
            // Создаем мобильное меню
            mobileNav = document.createElement('div');
            mobileNav.className = 'mobile-nav';
            
            // Получаем текущий активный пункт меню
            const activeLink = document.querySelector('.nav-link.active');
            const activeHref = activeLink ? activeLink.getAttribute('href') : '/';
            
            // Собираем пункты меню из навигации
            const menuItems = Array.from(navMenu.querySelectorAll('.nav-link')).map(link => {
                const href = link.getAttribute('href');
                const icon = link.querySelector('i') ? link.querySelector('i').outerHTML : '';
                const text = link.textContent.trim();
                const isActive = link.classList.contains('active') ? 'active' : '';
                
                return { href, icon, text, isActive };
            });
            
            // Формируем HTML мобильного меню
            mobileNav.innerHTML = `
                <div class="mobile-nav-header">
                    <div class="mobile-nav-logo">
                        <img src="image/logo.png" alt="BHStore">
                        <span>BHStore</span>
                    </div>
                    <button class="mobile-nav-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mobile-nav-menu">
                    ${menuItems.map(item => `
                        <a href="${item.href}" class="nav-link ${item.isActive}">
                            ${item.icon} ${item.text}
                        </a>
                    `).join('')}
                </div>
                <div class="mobile-nav-auth">
                    ${navAuth ? navAuth.innerHTML : ''}
                </div>
            `;
            
            document.body.appendChild(mobileNav);
        }
        
        const closeBtn = mobileNav.querySelector('.mobile-nav-close');
        
        // Функция открытия меню
        function openMobileMenu() {
            mobileNav.classList.add('active');
            document.body.classList.add('no-scroll');
        }
        
        // Функция закрытия меню
        function closeMobileMenu() {
            mobileNav.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
        
        // Открытие меню при клике на кнопку
        mobileMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openMobileMenu();
        });
        
        // Закрытие меню при клике на крестик
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMobileMenu);
        }
        
        // Закрытие меню при клике на ссылку
        mobileNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        
        // Закрытие при клике вне меню
        mobileNav.addEventListener('click', function(e) {
            if (e.target === mobileNav) {
                closeMobileMenu();
            }
        });
        
        // Закрытие при нажатии ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                closeMobileMenu();
            }
        });
        
        // Обновление содержимого мобильного меню при изменении кнопки авторизации
        const observer = new MutationObserver(function() {
            const mobileAuth = mobileNav.querySelector('.mobile-nav-auth');
            if (mobileAuth && navAuth) {
                mobileAuth.innerHTML = navAuth.innerHTML;
            }
        });
        
        if (navAuth) {
            observer.observe(navAuth, { 
                childList: true, 
                subtree: true, 
                characterData: true 
            });
        }
        
        // Обновление активной ссылки при изменении URL
        window.addEventListener('popstate', function() {
            const currentPath = window.location.pathname;
            mobileNav.querySelectorAll('.nav-link').forEach(link => {
                const href = link.getAttribute('href');
                if (href === currentPath) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        });
    }
})();