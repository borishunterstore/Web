(function() {
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
    });

    function initMobileMenu() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navMenu = document.querySelector('.nav-menu');
        const navAuth = document.querySelector('.nav-auth');
        
        if (!mobileMenuBtn || !navMenu) return;
        
        let mobileNav = document.querySelector('.mobile-nav');
        
        if (!mobileNav) {
            mobileNav = document.createElement('div');
            mobileNav.className = 'mobile-nav';
            
            const activeLink = document.querySelector('.nav-link.active');
            const activeHref = activeLink ? activeLink.getAttribute('href') : '/';
            
            const menuItems = Array.from(navMenu.querySelectorAll('.nav-link')).map(link => {
                const href = link.getAttribute('href');
                const icon = link.querySelector('i') ? link.querySelector('i').outerHTML : '';
                const text = link.textContent.trim();
                const isActive = link.classList.contains('active') ? 'active' : '';
                
                return { href, icon, text, isActive };
            });
            
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
        function openMobileMenu() {
            mobileNav.classList.add('active');
            document.body.classList.add('no-scroll');
        }
        function closeMobileMenu() {
            mobileNav.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
        mobileMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openMobileMenu();
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMobileMenu);
        }
        mobileNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        mobileNav.addEventListener('click', function(e) {
            if (e.target === mobileNav) {
                closeMobileMenu();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                closeMobileMenu();
            }
        });
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