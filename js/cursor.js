document.addEventListener('DOMContentLoaded', function() {
    // Инициализация элементов
    const cursor = document.querySelector('.custom-cursor');
    
    // Переменные для курсора
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    
    // Обновление позиции курсора
    document.addEventListener('mousemove', function(e) {
        targetX = e.clientX;
        targetY = e.clientY;
    });
    
    // Обработка нажатия ЛКМ
    document.addEventListener('mousedown', function() {
        cursor.classList.add('active');
    });
    
    document.addEventListener('mouseup', function() {
        cursor.classList.remove('active');
    });
    
    // Эффекты для интерактивных элементов
    const interactiveElements = [
        'a', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '.btn', '.nav-link', '.btn-discord',
        '.nav-logo', '.footer-section a', '.mobile-menu-btn'
    ];
    
    interactiveElements.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener('mouseenter', () => {
                cursor.classList.add('hover');
            });
            
            element.addEventListener('mouseleave', () => {
                cursor.classList.remove('hover');
            });
        });
    });
    
    // Плавное движение курсора
    function updateCursor() {
        // Плавное движение к целевой позиции
        mouseX += (targetX - mouseX) * 0.1;
        mouseY += (targetY - mouseY) * 0.1;
        
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
        
        requestAnimationFrame(updateCursor);
    }
    
    // Запуск анимации курсора
    updateCursor();
    
    // MutationObserver для новых элементов
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        interactiveElements.forEach(selector => {
                            if (node.matches && node.matches(selector)) {
                                node.addEventListener('mouseenter', () => {
                                    cursor.classList.add('hover');
                                });
                                node.addEventListener('mouseleave', () => {
                                    cursor.classList.remove('hover');
                                });
                            }
                            
                            node.querySelectorAll && node.querySelectorAll(selector).forEach(child => {
                                child.addEventListener('mouseenter', () => {
                                    cursor.classList.add('hover');
                                });
                                child.addEventListener('mouseleave', () => {
                                    cursor.classList.remove('hover');
                                });
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
    
    // Скрываем стандартный курсор
    document.body.style.cursor = 'none';
    
    // Добавляем стиль для скрытия стандартного курсора
    const style = document.createElement('style');
    style.textContent = `
        * {
            cursor: none !important;
        }
        
        @media (max-width: 768px) {
            * {
                cursor: auto !important;
            }
            .custom-cursor {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
});