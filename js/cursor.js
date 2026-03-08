document.addEventListener('DOMContentLoaded', function() {
    const cursor = document.querySelector('.custom-cursor');
    
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let isOverUserMenu = false;
    
    document.addEventListener('mousemove', function(e) {
        targetX = e.clientX;
        targetY = e.clientY;
        
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) {
            const menuRect = userMenu.getBoundingClientRect();
            isOverUserMenu = (
                e.clientX >= menuRect.left &&
                e.clientX <= menuRect.right &&
                e.clientY >= menuRect.top &&
                e.clientY <= menuRect.bottom
            );
            
            if (isOverUserMenu) {
                cursor.classList.add('over-menu');
            } else {
                cursor.classList.remove('over-menu');
            }
        } else {
            cursor.classList.remove('over-menu');
        }
    });
    
    document.addEventListener('mousedown', function() {
        cursor.classList.add('active');
    });
    
    document.addEventListener('mouseup', function() {
        cursor.classList.remove('active');
    });
    
    const interactiveElements = [
        'a', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '.btn', '.nav-link', '.btn-discord',
        '.nav-logo', '.footer-section a', '.mobile-menu-btn',
        '.user-menu-item', '.user-menu-logout-btn', '.user-menu-close',
        '.menu-item', '[onclick]'
    ];
    
    function addCursorEffects(element) {
        if (!element || element._cursorEffectsAdded) return;
        
        element.addEventListener('mouseenter', () => {
            if (!isOverUserMenu) {
                cursor.classList.add('hover');
            }
        });
        
        element.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
        });
        
        element._cursorEffectsAdded = true;
    }
    
    interactiveElements.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            addCursorEffects(element);
        });
    });
    
    function updateCursor() {
        mouseX += (targetX - mouseX) * 0.15;
        mouseY += (targetY - mouseY) * 0.15;
        
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
        
        requestAnimationFrame(updateCursor);
    }
    
    updateCursor();
    
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        interactiveElements.forEach(selector => {
                            if (node.matches && node.matches(selector)) {
                                addCursorEffects(node);
                            }
                            
                            node.querySelectorAll && node.querySelectorAll(selector).forEach(child => {
                                addCursorEffects(child);
                            });
                        });
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    document.body.style.cursor = 'none';
    const style = document.createElement('style');
    style.textContent = `
        * {
            cursor: none !important;
        }
        
        .custom-cursor {
            position: fixed;
            width: 24px;
            height: 24px;
            border: 2px solid #2563eb;
            background-color: rgba(37, 99, 235, 0.1);
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483647 !important; /* Максимальный z-index */
            transform: translate(-50%, -50%);
            transition: width 0.2s, height 0.2s, background-color 0.2s, border-color 0.2s;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
            will-change: transform;
            box-shadow: 0 0 15px rgba(37, 99, 235, 0.3);
        }
        
        .custom-cursor.hover {
            width: 40px;
            height: 40px;
            background-color: rgba(37, 99, 235, 0.2);
            border-color: #7c3aed;
            border-width: 3px;
            box-shadow: 0 0 25px rgba(37, 99, 235, 0.5);
        }
        
        .custom-cursor.active {
            width: 32px;
            height: 32px;
            background-color: #2563eb;
            border-color: white;
            transform: translate(-50%, -50%) scale(0.8);
        }
        
        .custom-cursor.over-menu {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(0.7);
        }
        
        /* Canvas для паутины */
        #webCanvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2147483646 !important; /* Чуть ниже курсора */
        }
        
        /* Индикатор прокрутки */
        .scroll-indicator {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: rgba(37, 99, 235, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid #2563eb;
            border-radius: 50px;
            padding: 10px 20px;
            color: white;
            font-size: 14px;
            z-index: 2147483645 !important; /* Ниже курсора и canvas */
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
        }
        
        .scroll-indicator.visible {
            opacity: 1;
        }
        
        .scroll-value {
            color: #2563eb;
            font-weight: bold;
            margin-left: 5px;
        }
        
        /* След от курсора */
        .cursor-trail {
            position: fixed;
            width: 8px;
            height: 8px;
            background-color: #2563eb;
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483644 !important; /* Ниже всего */
            opacity: 0.3;
            transform: translate(-50%, -50%);
            transition: all 0.1s;
        }
        
        /* Убеждаемся, что user-menu ниже курсора */
        .user-menu,
        .mobile-nav,
        .modal,
        .dropdown-menu,
        .context-menu {
            z-index: 2147483643 !important; /* Ниже курсора */
        }
        
        /* Но интерактивные элементы в меню должны вызывать эффект курсора */
        .user-menu-item:hover ~ .custom-cursor,
        .user-menu-logout-btn:hover ~ .custom-cursor,
        .menu-item:hover ~ .custom-cursor {
            transform: scale(1.2);
        }
        
        /* Отключаем на мобильных */
        @media (max-width: 768px) {
            * {
                cursor: auto !important;
            }
            .custom-cursor,
            #webCanvas,
            .scroll-indicator,
            .cursor-trail {
                display: none !important;
            }
        }
        
        /* Для очень старых браузеров */
        @media (max-width: 480px) {
            .custom-cursor {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    setInterval(() => {
        const highZIndexElements = document.querySelectorAll('[style*="z-index: 2147483647"]');
        highZIndexElements.forEach(el => {
            if (el !== cursor && !el.classList.contains('custom-cursor')) {
                el.style.zIndex = '2147483643';
            }
        });
    }, 1000);
});