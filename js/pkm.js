// Оптимизированное кастомное контекстное меню (ПКМ)
(function() {
    'use strict';
    
    // Конфигурации меню для разных страниц
    const MENU_CONFIGS = {
        'index.html': {
            items: ['back', 'forward', 'reload', 'divider', 'telegram', 'discord', 'divider', 'copy', 'divider', 'selectAll']
        },
        'review.html': {
            items: ['back', 'forward', 'reload', 'divider', 'telegram', 'discord', 'divider', 'copy', 'cut', 'paste', 'divider', 'selectAll']
        },
        'default': {
            items: ['back', 'forward', 'reload', 'divider', 'telegram', 'discord', 'divider', 'copy', 'cut', 'paste', 'divider', 'selectAll']
        }
    };
    
    // Шаблоны пунктов меню
    const MENU_ITEMS = {
        back: { icon: 'fa-arrow-left', label: 'Назад', shortcut: 'Alt+←', action: 'back' },
        forward: { icon: 'fa-arrow-right', label: 'Вперед', shortcut: 'Alt+→', action: 'forward' },
        reload: { icon: 'fa-redo-alt', label: 'Перезагрузить', shortcut: 'Ctrl+R', action: 'reload' },
        telegram: { icon: 'fa-telegram-plane', label: 'Перейти в Telegram', badge: 'NEW', class: 'telegram-item', action: 'telegram' },
        discord: { icon: 'fa-discord', label: 'Перейти в Discord', badge: 'NEW', class: 'discord-item', action: 'discord' },
        copy: { icon: 'fa-copy', label: 'Скопировать', shortcut: 'Ctrl+C', action: 'copy' },
        cut: { icon: 'fa-cut', label: 'Вырезать', shortcut: 'Ctrl+X', action: 'cut' },
        paste: { icon: 'fa-paste', label: 'Вставить', shortcut: 'Ctrl+V', action: 'paste' },
        selectAll: { icon: 'fa-check-double', label: 'Выделить все', shortcut: 'Ctrl+A', action: 'selectAll' }
    };
    
    class CustomContextMenu {
        constructor() {
            this.menu = null;
            this.toast = null;
            this.toastMessage = null;
            this.isVisible = false;
            this.toastTimeout = null;
            this.menuItems = [];
            
            // Определяем текущую страницу
            this.currentPage = this.getCurrentPage();
            
            this.init();
        }
        
        getCurrentPage() {
            const path = window.location.pathname;
            const page = path.split('/').pop() || 'index.html';
            return page;
        }
        
        init() {
            // Принудительно отключаем стандартное ПКМ меню
            this.disableDefaultContextMenu();
            
            // Создаем структуру меню
            this.createMenuStructure();
            
            // Инициализируем события
            this.initEvents();
        }
        
        disableDefaultContextMenu() {
            // Блокируем стандартное меню на всех уровнях
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true); // Используем capturing phase для гарантированного перехвата
            
            // Дополнительная защита для всех элементов
            const style = document.createElement('style');
            style.textContent = `
                * {
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    -khtml-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                input, textarea {
                    -webkit-user-select: auto;
                    -khtml-user-select: auto;
                    -moz-user-select: auto;
                    -ms-user-select: auto;
                    user-select: auto;
                }
            `;
            document.head.appendChild(style);
        }
        
        createMenuStructure() {
            // Получаем конфигурацию для текущей страницы
            const config = MENU_CONFIGS[this.currentPage] || MENU_CONFIGS.default;
            
            // Создаем основное меню
            this.menu = document.createElement('div');
            this.menu.className = 'custom-context-menu';
            this.menu.id = 'customContextMenu';
            
            // Создаем заголовок
            const header = document.createElement('div');
            header.className = 'context-menu-header';
            header.innerHTML = `
                <span class="context-menu-title">Действия</span>
                <span class="context-menu-close">✕</span>
            `;
            this.menu.appendChild(header);
            
            // Создаем список пунктов
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'context-menu-items';
            
            // Генерируем пункты меню согласно конфигурации
            config.items.forEach(itemKey => {
                if (itemKey === 'divider') {
                    const divider = document.createElement('div');
                    divider.className = 'context-menu-divider';
                    itemsContainer.appendChild(divider);
                } else {
                    const item = MENU_ITEMS[itemKey];
                    if (item) {
                        itemsContainer.appendChild(this.createMenuItem(item));
                    }
                }
            });
            
            this.menu.appendChild(itemsContainer);
            document.body.appendChild(this.menu);
            
            // Создаем уведомление
            this.createToast();
        }
        
        createMenuItem(item) {
            const div = document.createElement('div');
            div.className = `context-menu-item ${item.class || ''}`;
            div.setAttribute('data-action', item.action);
            
            // Иконка
            const icon = document.createElement('i');
            icon.className = `fas ${item.icon}`;
            div.appendChild(icon);
            
            // Текст
            const span = document.createElement('span');
            span.textContent = item.label;
            div.appendChild(span);
            
            // Бейдж или шорткат
            if (item.badge) {
                const badge = document.createElement('span');
                badge.className = 'context-badge';
                badge.textContent = item.badge;
                div.appendChild(badge);
            } else if (item.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'context-shortcut';
                shortcut.textContent = item.shortcut;
                div.appendChild(shortcut);
            }
            
            return div;
        }
        
        createToast() {
            this.toast = document.createElement('div');
            this.toast.className = 'context-toast';
            this.toast.id = 'contextToast';
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-check-circle';
            this.toast.appendChild(icon);
            
            this.toastMessage = document.createElement('span');
            this.toastMessage.id = 'toastMessage';
            this.toastMessage.textContent = 'Скопировано!';
            this.toast.appendChild(this.toastMessage);
            
            document.body.appendChild(this.toast);
        }
        
        initEvents() {
            // Используем делегирование событий для производительности
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showMenu(e);
            }, { capture: true, passive: false });
            
            // Закрытие по клику вне меню
            document.addEventListener('click', (e) => {
                if (this.menu && !this.menu.contains(e.target) && this.isVisible) {
                    this.hideMenu();
                }
            });
            
            // Закрытие по ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hideMenu();
                }
            });
            
            // Закрытие при скролле
            window.addEventListener('scroll', () => {
                if (this.isVisible) {
                    this.hideMenu();
                }
            }, { passive: true });
            
            // Закрытие при ресайзе
            window.addEventListener('resize', () => {
                if (this.isVisible) {
                    this.hideMenu();
                }
            });
            
            // Обработка кликов по пунктам меню (делегирование)
            this.menu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (item) {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    this.handleAction(action);
                    this.hideMenu();
                }
            });
            
            // Закрытие по клику на крестик
            this.menu.querySelector('.context-menu-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideMenu();
            });
        }
        
        showMenu(e) {
            if (!this.menu) return;
            
            const x = Math.min(e.clientX, window.innerWidth - this.menu.offsetWidth - 10);
            const y = Math.min(e.clientY, window.innerHeight - this.menu.offsetHeight - 10);
            
            // Оптимизированное позиционирование с использованием transform
            this.menu.style.left = '0';
            this.menu.style.top = '0';
            this.menu.style.transform = `translate(${x}px, ${y}px)`;
            
            // Показываем меню
            this.menu.classList.add('active');
            this.isVisible = true;
            
            // Добавляем эффект свечения (с задержкой для производительности)
            requestAnimationFrame(() => {
                this.addGlowEffect(e);
            });
        }
        
        hideMenu() {
            if (this.menu) {
                this.menu.classList.remove('active');
                this.isVisible = false;
            }
        }
        
        handleAction(action) {
            const actions = {
                telegram: () => {
                    window.open('https://t.me/your_channel', '_blank', 'noopener,noreferrer');
                    this.showToast('Открываем Telegram...');
                },
                discord: () => {
                    window.open('https://discord.gg/your_server', '_blank', 'noopener,noreferrer');
                    this.showToast('Открываем Discord...');
                },
                copy: () => this.copyToClipboard(),
                cut: () => this.cutText(),
                paste: () => this.pasteText(),
                selectAll: () => this.selectAll(),
                back: () => window.history.back(),
                forward: () => window.history.forward(),
                reload: () => window.location.reload()
            };
            
            if (actions[action]) {
                actions[action]();
            }
        }
        
        async copyToClipboard() {
            try {
                const selection = window.getSelection().toString();
                if (selection) {
                    await navigator.clipboard.writeText(selection);
                    this.showToast('Скопировано!');
                } else {
                    this.showToast('Нет выделенного текста', 'warning');
                }
            } catch {
                this.showToast('Ошибка при копировании', 'error');
            }
        }
        
        async cutText() {
            try {
                const selection = window.getSelection();
                const text = selection.toString();
                if (text) {
                    await navigator.clipboard.writeText(text);
                    document.execCommand('delete');
                    this.showToast('Вырезано!');
                } else {
                    this.showToast('Нет текста для вырезания', 'warning');
                }
            } catch {
                this.showToast('Ошибка при вырезании', 'error');
            }
        }
        
        async pasteText() {
            try {
                const text = await navigator.clipboard.readText();
                const activeElement = document.activeElement;
                
                if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                    const start = activeElement.selectionStart;
                    const end = activeElement.selectionEnd;
                    activeElement.value = activeElement.value.substring(0, start) + text + activeElement.value.substring(end);
                    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
                } else {
                    document.execCommand('insertText', false, text);
                }
                
                this.showToast('Вставлено!');
            } catch {
                this.showToast('Ошибка при вставке', 'error');
            }
        }
        
        selectAll() {
            const activeElement = document.activeElement;
            
            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                activeElement.select();
            } else {
                const range = document.createRange();
                range.selectNodeContents(document.body);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            this.showToast('Выделено всё');
        }
        
        showToast(message, type = 'success') {
            if (!this.toast || !this.toastMessage) return;
            
            this.toastMessage.textContent = message;
            
            // Цвета для разных типов уведомлений
            const colors = {
                success: 'rgba(16, 185, 129, 0.9)',
                error: 'rgba(239, 68, 68, 0.9)',
                warning: 'rgba(245, 158, 11, 0.9)'
            };
            
            this.toast.style.background = colors[type] || colors.success;
            this.toast.classList.add('show');
            
            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                this.toast.classList.remove('show');
            }, 2000);
        }
        
        addGlowEffect(e) {
            const glow = document.createElement('div');
            glow.style.cssText = `
                position: fixed;
                left: ${e.clientX}px;
                top: ${e.clientY}px;
                width: 100px;
                height: 100px;
                background: radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, transparent 70%);
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 9999;
                border-radius: 50%;
                animation: glowFade 0.5s ease-out forwards;
                will-change: transform, opacity;
            `;
            
            document.body.appendChild(glow);
            
            requestAnimationFrame(() => {
                setTimeout(() => glow.remove(), 500);
            });
        }
    }
    
    // Добавляем стили для анимации свечения (один раз)
    if (!document.getElementById('glow-styles')) {
        const style = document.createElement('style');
        style.id = 'glow-styles';
        style.textContent = `
            @keyframes glowFade {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(0.5);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(2);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Инициализация с оптимизацией
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new CustomContextMenu();
        });
    } else {
        new CustomContextMenu();
    }
})();