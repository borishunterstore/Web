/**
 * js/shop.js — Магазин
 */
(function () {
    'use strict';
  
    let allProducts = [];
    let currentCategory = 'all';
    let productsLoaded = false;
  
    document.addEventListener('DOMContentLoaded', async () => {
      await checkShopOpen();
      await loadProducts();
      initCategories();
      initURLHandling();
      initPromoRefresh();
      initCloseButtons();
    });
  
    async function checkShopOpen() {
      try {
        const res = await fetch('/api/shop-settings');
        const data = await res.json();
        if (data.success && data.settings.shop_open === false) {
          const container = document.getElementById('productsContainer');
          if (container) {
            container.innerHTML = `
              <div class="empty-state" style="grid-column: 1/-1">
                <i class="fas fa-store-slash"></i>
                <h3>Магазин временно закрыт</h3>
                <p>Администрация проводит технические работы. Зайдите позже.</p>
              </div>`;
          }
          return false;
        }
        return true;
      } catch { return true; }
    }
  
    async function loadProducts() {
      const container = document.getElementById('productsContainer');
      if (!container) return;
  
      container.innerHTML = `
        <div class="loading-spinner" style="grid-column: 1/-1">
          <div class="spinner"></div>
          <p>Загрузка товаров...</p>
        </div>`;
  
      try {
        const data = await api.getProducts();
        if (!data.success) throw new Error(data.error || 'Ошибка загрузки');
        if (!Array.isArray(data.products) || data.products.length === 0) {
          renderEmptyState('Товары не найдены', 'В магазине пока нет товаров');
          return;
        }
        allProducts = data.products;
        productsLoaded = true;
  
        const url = new URL(window.location.href);
        const productParam = url.searchParams.get('product');
        const categoryParam = url.searchParams.get('category');
  
        if (productParam) {
          const product = allProducts.find(p => p.id === productParam);
          if (product) {
            renderProducts(allProducts);
            openProductModal(product);
          } else {
            renderProducts(allProducts);
          }
        } else if (categoryParam && CATEGORY_FILTERS[categoryParam]) {
          currentCategory = categoryParam;
          renderProducts(filterByCategory(categoryParam));
          activateCategoryButton(categoryParam);
        } else {
          renderProducts(allProducts);
        }
      } catch (err) {
        renderEmptyState('Ошибка загрузки', err.message);
      }
    }
  
    const CATEGORY_FILTERS = {
      all:      () => true,
      montaz:   (p) => /монтаж|видео/i.test(p.name) || p.category === 'youtube',
      ava:      (p) => /аватар/i.test(p.name) || p.category === 'ava',
      preview:  (p) => /превью/i.test(p.name) || p.category === 'preview',
      discord:  (p) => /discord/i.test(p.name) || ['discord','discordbot'].includes(p.category),
      tgbot:    (p) => /telegram|tg/i.test(p.name) || p.category === 'telegram',
      website:  (p) => /сайт|website/i.test(p.name) || p.category === 'website',
      minecraft:(p) => /minecraft|майнкрафт/i.test(p.name) || p.category === 'minecraft',
    };
  
    function filterByCategory(cat) {
      const fn = CATEGORY_FILTERS[cat] || CATEGORY_FILTERS.all;
      return allProducts.filter(fn);
    }
  
    function renderProducts(products) {
      const container = document.getElementById('productsContainer');
      if (!container) return;
  
      container.innerHTML = products.map((p, i) => {
        const discount = getDiscountInfo(p.price, p.id);
        const hasDisc = discount.discount > 0;
        const desc = (p.description || '').replace(/<[^>]*>/g, '').slice(0, 120);
  
        return `
          <div class="product-card" style="animation-delay:${i * 0.05}s">
            ${hasDisc ? `<div class="product-discount-badge"><i class="fas fa-tag"></i> -${discount.discount}%</div>` : ''}
            <div class="product-media">
              <img src="${escapeHtml(p.image || p.icon || '/image/logo.png')}"
                   alt="${escapeHtml(p.name)}"
                   onerror="this.src='/image/logo.png'">
            </div>
            <div class="product-body">
              <h3 class="product-name">${escapeHtml(p.name)}</h3>
              <p style="color:var(--text-muted);font-size:.85rem;line-height:1.5;margin-bottom:12px">
                ${escapeHtml(desc)}${(p.description || '').length > 120 ? '...' : ''}
              </p>
              ${p.features?.length ? `
                <div class="product-features">
                  ${p.features.slice(0, 3).map(f =>
                    `<div class="feature-item"><i class="fas fa-check-circle"></i><span>${escapeHtml(f)}</span></div>`
                  ).join('')}
                </div>
              ` : ''}
              <div class="price-section">
                ${hasDisc ? `
                  <div class="price-row original">
                    <span>Было:</span><span>${discount.originalPrice} ₽</span>
                  </div>` : ''}
                <div class="price-row final">
                  <span>Итого:</span>
                  <span class="price-value">${discount.finalPrice} ₽</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn-buy" onclick="window.buyProduct('${escapeHtml(p.id)}', '${escapeHtml(p.name)}', ${p.price})">
                  <i class="fas fa-shopping-cart"></i> Купить
                </button>
                <button class="btn-details" onclick="window.showProductDetails('${escapeHtml(p.id)}')">
                  <i class="fas fa-info-circle"></i>
                </button>
              </div>
            </div>
          </div>`;
      }).join('');
    }
  
    function getDiscountInfo(price, productId) {
      if (!window.promocodeSystem?.activeDiscounts?.length) {
        return { originalPrice: price, finalPrice: price, discount: 0, appliedPromocodes: [] };
      }
      const applied = window.promocodeSystem.activeDiscounts.filter(p =>
        !p.product_ids?.length || p.product_ids.includes(productId)
      );
      const total = Math.min(applied.reduce((s, p) => s + (p.value || 0), 0), 90);
      return {
        originalPrice: price,
        finalPrice: Math.round(price * (100 - total) / 100),
        discount: total,
        appliedPromocodes: applied,
      };
    }
  
    function initCategories() {
      document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.category;
          currentCategory = cat;
          activateCategoryButton(cat);
          renderProducts(filterByCategory(cat));
          updateURL();
          document.getElementById('productsContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  
    function activateCategoryButton(cat) {
      document.querySelectorAll('.category-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.category === cat)
      );
    }
  
    function updateURL() {
      const url = new URL(window.location.href);
      if (currentCategory !== 'all') url.searchParams.set('category', currentCategory);
      else url.searchParams.delete('category');
      window.history.replaceState({}, '', url);
    }
  
    function initURLHandling() {
      window.addEventListener('popstate', () => {
        const url = new URL(window.location.href);
        const cat = url.searchParams.get('category') || 'all';
        currentCategory = cat;
        activateCategoryButton(cat);
        renderProducts(filterByCategory(cat));
      });
    }
  
    function initPromoRefresh() {
      // Обновлять скидки при изменении
      window.updateProductsDisplay = () => renderProducts(filterByCategory(currentCategory));
    }
  
    function initCloseButtons() {
      document.getElementById('productModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'productModal') closeModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
      });
    }
  
    // ═══ МОДАЛКА ═══
    function openProductModal(product) {
      const modal = document.getElementById('productModal');
      const title = document.getElementById('modalProductTitle');
      const content = document.getElementById('modalProductContent');
      if (!modal || !content) return;
  
      const d = getDiscountInfo(product.price, product.id);
      title.textContent = product.name;
  
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="background:linear-gradient(135deg,#1a1525,#252030);border-radius:16px;padding:24px;text-align:center">
            <img src="${escapeHtml(product.image || product.icon || '/image/logo.png')}"
                 alt="${escapeHtml(product.name)}"
                 style="max-width:100%;max-height:200px;border-radius:12px"
                 onerror="this.src='/image/logo.png'">
          </div>
          <p style="color:var(--text-muted);line-height:1.7">${escapeHtml(product.description || '')}</p>
          ${product.features?.length ? `
            <div>
              <h3 style="color:var(--text);margin-bottom:12px"><i class="fas fa-list-check"></i> Что входит:</h3>
              <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
                ${product.features.map(f => `
                  <li style="display:flex;gap:8px;color:var(--text-muted);padding:6px 0;border-bottom:1px solid var(--border)">
                    <i class="fas fa-check-circle" style="color:var(--ghost-500);margin-top:3px"></i>
                    <span>${escapeHtml(f)}</span>
                  </li>`).join('')}
              </ul>
            </div>` : ''}
          <div style="background:var(--bg-elevated);border-radius:12px;padding:16px;margin-top:8px">
            ${d.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span>Обычная цена:</span>
                <span style="text-decoration:line-through;color:var(--text-dim)">${d.originalPrice} ₽</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span>Скидка:</span>
                <span style="color:var(--ghost-500)">-${d.discount}%</span>
              </div>` : ''}
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:1.2rem;font-weight:700">
              <span>Итого:</span>
              <span style="color:var(--accent-500)">${d.finalPrice} ₽</span>
            </div>
          </div>
          <button class="btn-primary" style="width:100%;padding:14px"
                  onclick="window.buyProduct('${escapeHtml(product.id)}','${escapeHtml(product.name)}',${product.price});window.closeProductModal()">
            <i class="fas fa-shopping-cart"></i> Купить сейчас
          </button>
        </div>`;
  
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  
    window.showProductDetails = (id) => {
      const p = allProducts.find(x => x.id === id);
      if (p) openProductModal(p);
    };
  
    window.closeProductModal = () => closeModal();
  
    function closeModal() {
      const modal = document.getElementById('productModal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  
    // ═══ ПОКУПКА ═══
    window.buyProduct = async (productId, productName, originalPrice) => {
      const auth = api.getAuthData();
      if (!auth.id) {
        showToast('Войдите, чтобы купить', 'warning');
        setTimeout(() => location.href = '/auth.html', 1500);
        return;
      }
  
      try {
        const userData = await api.getUser(auth.id);
        const balance = userData?.user?.balance || 0;
        const d = getDiscountInfo(originalPrice, productId);
  
        if (balance < d.finalPrice) {
          showToast(`Не хватает ${d.finalPrice - balance} ₽. Пополните баланс.`, 'error');
          return;
        }
  
        showPurchaseConfirm(productName, d, balance, productId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  
    function showPurchaseConfirm(productName, d, balance, productId) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'purchaseModal';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-shopping-cart"></i> Подтверждение</h2>
            <button class="modal-close" onclick="document.getElementById('purchaseModal').remove()">×</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;padding:16px 0">
            <div style="display:flex;justify-content:space-between"><span>Товар:</span><strong>${escapeHtml(productName)}</strong></div>
            ${d.discount > 0 ? `
              <div style="display:flex;justify-content:space-between"><span>Скидка:</span><span style="color:var(--ghost-500)">-${d.discount}% (-${d.originalPrice - d.finalPrice} ₽)</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);font-size:1.1rem"><span>К оплате:</span><strong style="color:var(--accent-500)">${d.finalPrice} ₽</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Ваш баланс:</span><span>${balance} ₽</span></div>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" onclick="window.confirmPurchase('${escapeHtml(productId)}', ${d.finalPrice}, ${d.originalPrice}, ${d.discount})">
              <i class="fas fa-check"></i> Подтвердить
            </button>
            <button class="btn-secondary" onclick="document.getElementById('purchaseModal').remove()">Отмена</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
  
    window.confirmPurchase = async (productId, finalPrice, originalPrice, discount) => {
      const auth = api.getAuthData();
      const btn = document.querySelector('#purchaseModal .btn-primary');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...'; }
  
      try {
        const appliedPromos = (window.promocodeSystem?.activeDiscounts || [])
          .filter(p => !p.product_ids?.length || p.product_ids.includes(productId))
          .map(p => p.code);
  
        const res = await api.createOrder({
          userId: auth.id,
          productId,
          productName: 'Заказ',
          price: finalPrice,
          originalPrice,
          promocodes: appliedPromos,
          discount,
        });
  
        if (!res.success) throw new Error(res.error || 'Ошибка заказа');
  
        document.getElementById('purchaseModal')?.remove();
        showSuccessModal(res.orderId, res.newBalance);
  
        if (appliedPromos.length) {
          appliedPromos.forEach(code => window.promocodeSystem?.removeDiscount?.(code));
        }
  
        auth.balance = res.newBalance;
        localStorage.setItem('bhstore_auth', JSON.stringify(auth));
        setTimeout(() => location.reload(), 3000);
      } catch (err) {
        showToast(err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Подтвердить'; }
      }
    };
  
    function showSuccessModal(orderId, newBalance) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="text-align:center">
          <div style="width:70px;height:70px;background:var(--ghost-500);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
            <i class="fas fa-check" style="color:#000;font-size:2rem"></i>
          </div>
          <h2 style="color:var(--ghost-500)">Покупка успешна!</h2>
          <p style="margin:12px 0">Заказ: <strong>${escapeHtml(orderId)}</strong></p>
          <div style="background:var(--bg-elevated);padding:14px;border-radius:12px;margin:16px 0">
            <p style="color:var(--text-muted);margin-bottom:6px">Остаток баланса:</p>
            <p style="font-size:1.5rem;color:var(--ghost-500);font-weight:700">${newBalance} ₽</p>
          </div>
          <button class="btn-primary" style="width:100%" onclick="location.reload()">ОК</button>
        </div>`;
      document.body.appendChild(modal);
    }
  
    function renderEmptyState(title, msg) {
      const c = document.getElementById('productsContainer');
      if (c) c.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fas fa-box-open"></i>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(msg)}</p>
        </div>`;
    }
  
    function escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
  
    function showToast(msg, type = 'info') {
      const t = document.createElement('div');
      t.className = `toast-notification toast-${type}`;
      t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${escapeHtml(msg)}`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    }
  })();