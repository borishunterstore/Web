(function () {
  'use strict';

  let allProducts = [];
  let currentCategory = 'all';

  const CATEGORY_FILTERS = {
    all:       () => true,
    montaz:    (p) => /монтаж|видео/i.test(p.name) || p.category === 'youtube',
    ava:       (p) => /аватар/i.test(p.name) || p.category === 'ava',
    preview:   (p) => /превью/i.test(p.name) || p.category === 'preview',
    discord:   (p) => /discord/i.test(p.name) || ['discord','discordbot'].includes(p.category),
    tgbot:     (p) => /telegram|tg/i.test(p.name) || p.category === 'telegram',
    website:   (p) => /сайт|website/i.test(p.name) || p.category === 'website',
    minecraft: (p) => /minecraft|майнкрафт/i.test(p.name) || p.category === 'minecraft',
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const isOpen = await checkShopStatus();
    if (!isOpen) return;
    await loadProducts();
    initCategories();
    initURLHandling();
    initProductModalClose();
  });

  async function checkShopStatus() {
    try {
      const res = await fetch('/api/shop-settings');
      const data = await res.json();
      if (data.success && data.settings.shop_open === false) {
        const container = document.getElementById('productsContainer');
        if (container) container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-store-slash"></i><h3>Магазин временно закрыт</h3></div>`;
        return false;
      }
      return true;
    } catch { return true; }
  }

  async function loadProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    // Skeleton
    container.innerHTML = Array(6).fill(null).map(() => `
      <div class="product-card skeleton" style="pointer-events:none;opacity:0.7;">
        <div style="height:200px;background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 50%,#1a1a1a 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
        <div style="padding:24px">
          <div style="height:20px;width:70%;margin-bottom:12px;background:#2a2a2a;border-radius:6px"></div>
          <div style="height:14px;width:100%;margin-bottom:8px;background:#1f1f1f;border-radius:6px"></div>
          <div style="height:40px;width:100%;background:#2a2a2a;border-radius:10px"></div>
        </div>
      </div>
    `).join('');

    if (!document.getElementById('skeleton-style')) {
      const style = document.createElement('style');
      style.id = 'skeleton-style';
      style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
      document.head.appendChild(style);
    }

    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (!data.success || !Array.isArray(data.products)) throw new Error('Ошибка загрузки');

      allProducts = data.products;
      const urlParams = new URLSearchParams(window.location.search);
      const categoryParam = urlParams.get('category');
      const productParam = urlParams.get('product');

      if (productParam) {
        const product = allProducts.find(p => p.id === productParam);
        renderProducts(allProducts);
        if (product) setTimeout(() => openProductModal(product), 300);
      } else if (categoryParam && CATEGORY_FILTERS[categoryParam]) {
        currentCategory = categoryParam;
        activateCategoryButton(categoryParam);
        renderProducts(filterByCategory(categoryParam));
      } else {
        renderProducts(allProducts);
      }
    } catch (error) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-exclamation-triangle"></i><h3>Ошибка загрузки</h3><p>${error.message}</p></div>`;
    }
  }

  function filterByCategory(cat) {
    return allProducts.filter(CATEGORY_FILTERS[cat] || CATEGORY_FILTERS.all);
  }

  function renderProducts(products) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-box-open"></i><h3>Товары не найдены</h3></div>`;
      return;
    }

    container.innerHTML = products.map((p, i) => {
      const d = getDiscountInfo(p.price, p.id);
      const desc = (p.description || '').replace(/<[^>]*>/g, '').slice(0, 120);

      return `
        <div class="product-card" style="animation-delay:${i * 0.05}s">
          ${d.discount > 0 ? `<div class="product-discount-badge"><i class="fas fa-tag"></i> -${d.discount}%</div>` : ''}
          <div class="product-media">
            <img src="${escapeHtml(p.image || p.icon || '/image/logo.png')}" alt="${escapeHtml(p.name)}" onerror="this.src='/image/logo.png'">
          </div>
          <div class="product-body">
            <h3 class="product-name">${escapeHtml(p.name)}</h3>
            <p style="color:var(--text-muted);font-size:.85rem;line-height:1.5;margin-bottom:12px">
              ${escapeHtml(desc)}${(p.description || '').length > 120 ? '...' : ''}
            </p>
            ${p.features && p.features.length ? `
              <div class="product-features">
                ${p.features.slice(0, 3).map(f => `
                  <div class="feature-item"><i class="fas fa-check-circle"></i><span>${escapeHtml(f)}</span></div>
                `).join('')}
              </div>
            ` : ''}
            <div class="price-section">
              ${d.discount > 0 ? `
                <div class="price-row original">
                  <span>Было:</span>
                  <span class="strikethrough">${d.originalPrice} ₽</span>
                </div>
              ` : ''}
              <div class="price-row final">
                <span class="price-label"><i class="fas fa-tag"></i> Итого:</span>
                <span class="price-value">${d.finalPrice} ₽</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn-buy" onclick="window.buyProduct('${escapeHtml(p.id)}', '${escapeHtml(p.name)}', ${p.price})">
                <i class="fas fa-shopping-cart"></i> Купить
              </button>
              <button class="btn-details" onclick="window.showProductDetails('${escapeHtml(p.id)}')" style="width:auto;padding:12px">
                <i class="fas fa-info-circle"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getDiscountInfo(originalPrice, productId) {
    if (!window.promocodeSystem?.activeDiscounts?.length) return { originalPrice, finalPrice: originalPrice, discount: 0 };
    const applied = window.promocodeSystem.activeDiscounts.filter(p => !p.product_ids?.length || p.product_ids.includes(productId));
    if (applied.length === 0) return { originalPrice, finalPrice: originalPrice, discount: 0 };
    const total = Math.min(applied.reduce((s, p) => s + (p.value || 0), 0), 90);
    return { originalPrice, finalPrice: Math.round(originalPrice * (100 - total) / 100), discount: total, appliedPromocodes: applied };
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
    document.querySelectorAll('.category-btn').forEach(b => b.classList.toggle('active', b.dataset.category === cat));
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

  function initProductModalClose() {
    const modal = document.getElementById('productModal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
      url.searchParams.delete('product');
      window.history.replaceState({}, '', url);
    }
  }

  window.showProductDetails = function(id) {
    const p = allProducts.find(x => x.id === id);
    if (p) openProductModal(p);
  };
  window.closeProductModal = closeModal;

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
          <img src="${escapeHtml(product.image || product.icon || '/image/logo.png')}" alt="${escapeHtml(product.name)}" style="max-width:100%;max-height:200px;border-radius:12px" onerror="this.src='/image/logo.png'">
        </div>
        <p style="color:var(--text-muted);line-height:1.7">${escapeHtml(product.description || '')}</p>
        ${product.features && product.features.length ? `
          <div>
            <h3 style="color:white;margin-bottom:12px"><i class="fas fa-list-check"></i> Что входит:</h3>
            <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
              ${product.features.map(f => `<li style="display:flex;gap:8px;color:var(--text-muted);padding:6px 0;border-bottom:1px solid var(--border)"><i class="fas fa-check-circle" style="color:var(--ghost-500);margin-top:3px"></i><span>${escapeHtml(f)}</span></li>`).join('')}
            </ul>
          </div>
        ` : ''}
        <div style="background:var(--bg-elevated);border-radius:12px;padding:16px;margin-top:8px">
          ${d.discount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Обычная цена:</span><span style="text-decoration:line-through;color:var(--text-dim)">${d.originalPrice} ₽</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Скидка:</span><span style="color:var(--ghost-500)">-${d.discount}%</span></div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:1.2rem;font-weight:700"><span>Итого:</span><span style="color:var(--accent-500)">${d.finalPrice} ₽</span></div>
        </div>
        <button class="btn-primary" style="width:100%;padding:14px" onclick="window.buyProduct('${escapeHtml(product.id)}','${escapeHtml(product.name)}',${product.price});window.closeProductModal()"><i class="fas fa-shopping-cart"></i> Купить сейчас</button>
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.buyProduct = async function(productId, productName, originalPrice) {
    const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    if (!auth.id) { showToast('Войдите, чтобы купить', 'warning'); setTimeout(() => location.href = '/auth.html', 1500); return; }
    if (auth.verificationCode) { showToast('Завершите регистрацию', 'warning'); setTimeout(() => location.href = '/verify.html', 1500); return; }

    try {
      const res = await fetch(`/api/user/${auth.id}/balance`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await res.json();
      const balance = data.balance || 0;
      const d = getDiscountInfo(originalPrice, productId);

      if (balance < d.finalPrice) { showInsufficientFunds(d.finalPrice, balance, productName); return; }
      showPurchaseConfirm(productId, productName, d, balance);
    } catch (err) { showToast('Ошибка: ' + err.message, 'error'); }
  };

  function showInsufficientFunds(price, balance, productName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="text-align:center">
        <div style="width:70px;height:70px;background:var(--danger-500);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><i class="fas fa-exclamation-triangle" style="color:white;font-size:2rem"></i></div>
        <h2 style="color:var(--danger-500)">Недостаточно средств</h2>
        <p style="color:var(--text-muted);margin:12px 0">Для покупки "${escapeHtml(productName)}"</p>
        <div style="background:var(--bg-elevated);padding:16px;border-radius:12px;margin:16px 0;text-align:left">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Стоимость:</span><strong style="color:var(--danger-500)">${price} ₽</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Ваш баланс:</span><strong>${balance} ₽</strong></div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border)"><span>Не хватает:</span><strong style="color:var(--danger-500)">${price - balance} ₽</strong></div>
        </div>
        <div class="modal-actions"><button class="btn-primary" onclick="location.href='/profile.html#balance'">Пополнить</button><button class="btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showPurchaseConfirm(productId, productName, d, balance) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'purchaseModal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h2><i class="fas fa-shopping-cart"></i> Подтверждение</h2><button class="modal-close" onclick="document.getElementById('purchaseModal').remove()">×</button></div>
        <div style="padding:16px 0;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between"><span>Товар:</span><strong>${escapeHtml(productName)}</strong></div>
          ${d.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Скидка:</span><span style="color:var(--ghost-500)">-${d.discount}% (-${d.originalPrice - d.finalPrice} ₽)</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border);font-size:1.1rem"><span>К оплате:</span><strong style="color:var(--accent-500)">${d.finalPrice} ₽</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Ваш баланс:</span><span>${balance} ₽</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="window.confirmPurchase('${escapeHtml(productId)}', ${d.appliedPromocodes?.map(p => `'${p.code}'`).join(',') || ''})"><i class="fas fa-check"></i> Подтвердить</button>
          <button class="btn-secondary" onclick="document.getElementById('purchaseModal').remove()">Отмена</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  window.confirmPurchase = async function(productId, ...promocodes) {
    const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    const btn = document.querySelector('#purchaseModal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...'; }

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ userId: auth.id, productId, promocodes })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Ошибка заказа');

      document.getElementById('purchaseModal')?.remove();
      showSuccess(data.orderId, data.newBalance);

      auth.balance = data.newBalance;
      localStorage.setItem('bhstore_auth', JSON.stringify(auth));

      if (promocodes.length && window.promocodeSystem) promocodes.forEach(code => window.promocodeSystem.removeDiscount(code));
      setTimeout(() => location.reload(), 3000);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Подтвердить'; }
    }
  };

  function showSuccess(orderId, newBalance) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="text-align:center">
        <div style="width:70px;height:70px;background:var(--ghost-500);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><i class="fas fa-check" style="color:black;font-size:2rem"></i></div>
        <h2 style="color:var(--ghost-500)">Покупка успешна!</h2>
        <p style="color:var(--text-muted);margin:12px 0">Заказ: <strong>${escapeHtml(orderId)}</strong></p>
        <div style="background:var(--bg-elevated);padding:16px;border-radius:12px;margin:16px 0"><p style="color:var(--text-muted);margin-bottom:6px">Остаток баланса:</p><p style="font-size:1.5rem;color:var(--ghost-500);font-weight:700">${newBalance} ₽</p></div>
        <button class="btn-primary" style="width:100%" onclick="location.reload()">ОК</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showToast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast-notification toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${escapeHtml(message)}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
})();