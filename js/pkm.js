(function() {
    'use strict';
    
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
    
    const MENU_ITEMS = {
        back: { icon: 'fa-arrow-left', label: 'Назад', shortcut: 'Alt+←', action: 'back' },
        forward: { icon: 'fa-arrow-right', label: 'Вперед', shortcut: 'Alt+→', action: 'forward' },
        reload: { icon: 'fa-redo-alt', label: 'Перезагрузить', shortcut: 'Ctrl+R', action: 'reload' },
        telegram: { icon: 'fab fa-telegram', label: 'Перейти в Telegram', badge: 'NEW', class: 'telegram-item', action: 'telegram' },
        discord: { icon: 'fab fa-discord', label: 'Перейти в Discord', badge: 'NEW', class: 'discord-item', action: 'discord' },
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
            
            this.currentPage = this.getCurrentPage();
            
            this.init();
        }
        
        getCurrentPage() {
            const path = window.location.pathname;
            const page = path.split('/').pop() || 'index.html';
            return page;
        }
        
        init() {
            this.loadFontAwesome();
            this.disableDefaultContextMenu();
            this.createMenuStructure();
            this.initEvents();
        }
        
        loadFontAwesome() {
            if (!document.querySelector('link[href*="font-awesome"]') && 
                !document.querySelector('link[href*="fontawesome"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
                link.integrity = 'sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==';
                link.crossOrigin = 'anonymous';
                link.referrerPolicy = 'no-referrer';
                document.head.appendChild(link);
            }
        }
        
        disableDefaultContextMenu() {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, { capture: true, passive: false });
        }
        
        createMenuStructure() {
            const config = MENU_CONFIGS[this.currentPage] || MENU_CONFIGS.default;
            
            this.menu = document.createElement('div');
            this.menu.className = 'custom-context-menu';
            this.menu.id = 'customContextMenu';
            
            const header = document.createElement('div');
            header.className = 'context-menu-header';
            header.innerHTML = `
                <span class="context-menu-title">Действия</span>
                <span class="context-menu-close">✕</span>
            `;
            this.menu.appendChild(header);
            
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'context-menu-items';
            
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
            
            this.createToast();
            this.addStyles();
        }
        
        createMenuItem(item) {
            const div = document.createElement('div');
            div.className = `context-menu-item ${item.class || ''}`;
            div.setAttribute('data-action', item.action);
            
            const icon = document.createElement('i');
            icon.className = `fas ${item.icon}`;
            div.appendChild(icon);
            
            const span = document.createElement('span');
            span.textContent = item.label;
            div.appendChild(span);
            
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
        
        addStyles() {
            if (document.getElementById('context-menu-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'context-menu-styles';
            style.textContent = `
                .custom-context-menu {
                    position: fixed;
                    background: rgba(30, 30, 35, 0.98);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
                    min-width: 220px;
                    z-index: 10000;
                    opacity: 0;
                    visibility: hidden;
                    transform-origin: top left;
                    transition: opacity 0.15s ease, visibility 0.15s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .custom-context-menu.active {
                    opacity: 1;
                    visibility: visible;
                }
                
                .context-menu-header {
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .context-menu-title {
                    font-size: 12px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .context-menu-close {
                    cursor: pointer;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 14px;
                    transition: color 0.2s;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                
                .context-menu-close:hover {
                    color: #fff;
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .context-menu-items {
                    padding: 6px 0;
                }
                
                .context-menu-item {
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: background 0.2s;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 14px;
                }
                
                .context-menu-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .context-menu-item i {
                    width: 20px;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .context-menu-item span:first-of-type {
                    flex: 1;
                }
                
                .context-badge {
                    background: #5865F2;
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    color: white;
                }
                
                .context-shortcut {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 11px;
                }
                
                .context-menu-divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 6px 0;
                }
                
                .telegram-item i {
                    color: #26A5E4 !important;
                }
                
                .discord-item i {
                    color: #5865F2 !important;
                }
                
                .context-toast {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    z-index: 10001;
                    transition: transform 0.3s ease;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
                
                .context-toast.show {
                    transform: translateX(-50%) translateY(0);
                }
                
                .context-toast i {
                    font-size: 16px;
                }
                
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
        
        initEvents() {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showMenu(e);
            }, { capture: true, passive: false });
            
            document.addEventListener('click', (e) => {
                if (this.menu && !this.menu.contains(e.target) && this.isVisible) {
                    this.hideMenu();
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hideMenu();
                }
            });
            
            window.addEventListener('scroll', () => {
                if (this.isVisible) {
                    this.hideMenu();
                }
            }, { passive: true });
            
            window.addEventListener('resize', () => {
                if (this.isVisible) {
                    this.hideMenu();
                }
            });
            
            this.menu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (item) {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    this.handleAction(action);
                    this.hideMenu();
                }
            });
            
            const closeBtn = this.menu.querySelector('.context-menu-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideMenu();
                });
            }
        }
        
        showMenu(e) {
            if (!this.menu) return;
            
            const menuRect = this.menu.getBoundingClientRect();
            let x = e.clientX;
            let y = e.clientY;
            
            if (x + menuRect.width > window.innerWidth) {
                x = window.innerWidth - menuRect.width - 10;
            }
            if (y + menuRect.height > window.innerHeight) {
                y = window.innerHeight - menuRect.height - 10;
            }
            
            this.menu.style.left = x + 'px';
            this.menu.style.top = y + 'px';
            this.menu.style.transform = 'none';
            
            this.menu.classList.add('active');
            this.isVisible = true;
            
            this.addGlowEffect(e);
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
                    window.open('https://t.me/borishunterstore', '_blank', 'noopener,noreferrer');
                    this.showToast('Открываем Telegram...');
                },
                discord: () => {
                    window.open('https://discord.gg/YfZxXXeW6D', '_blank', 'noopener,noreferrer');
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
            } else {
                this.showToast('Функция в разработке', 'warning');
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
            } catch (err) {
                this.showToast('Ошибка при копировании', 'error');
            }
        }
        
        async cutText() {
            try {
                const selection = window.getSelection();
                const text = selection.toString();
                if (text && selection.rangeCount > 0) {
                    await navigator.clipboard.writeText(text);
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
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
                
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    const start = activeElement.selectionStart;
                    const end = activeElement.selectionEnd;
                    const currentValue = activeElement.value;
                    activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
                    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
                    this.showToast('Вставлено!');
                } else {
                    document.execCommand('insertText', false, text);
                    this.showToast('Вставлено!');
                }
            } catch {
                this.showToast('Ошибка при вставке', 'error');
            }
        }
        
        selectAll() {
            const activeElement = document.activeElement;
            
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.select();
            } else {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(document.body);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            this.showToast('Выделено всё');
        }
        
        showToast(message, type = 'success') {
            if (!this.toast || !this.toastMessage) return;
            
            this.toastMessage.textContent = message;
            
            const colors = {
                success: 'rgba(16, 185, 129, 0.95)',
                error: 'rgba(239, 68, 68, 0.95)',
                warning: 'rgba(245, 158, 11, 0.95)'
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
            `;
            
            document.body.appendChild(glow);
            
            setTimeout(() => {
                if (glow.parentNode) glow.remove();
            }, 500);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new CustomContextMenu();
        });
    } else {
        new CustomContextMenu();
    }
})();