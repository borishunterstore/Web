(function() {
  'use strict';

  const BADGE_IMAGES = {
      verified: '/image/BADGE/verified.gif',
      partner: '/image/BADGE/partner.gif',
      buyer: '/image/BADGE/buy.gif',
      admin: '/image/BADGE/admin.gif',
      vip: '/image/BADGE/vip.png',
      early: '/image/BADGE/early.png'
  };

  document.addEventListener('DOMContentLoaded', async () => {
      const auth = getAuthData();
      if (!auth.id) return (location.href = '/auth.html');

      const urlId = new URLSearchParams(location.search).get('id');
      const viewingId = urlId || auth.id;
      const isOwn = viewingId === auth.id;

      await loadProfile(viewingId, isOwn);
      if (isOwn) initOwnFeatures();
  });

  async function loadProfile(userId, isOwn) {
      try {
          const url = isOwn ? '/api/user/me' : `/api/user/${userId}`;
          const res = await fetch(url, {
              headers: isOwn ? { 'Authorization': `Bearer ${getAuthData().token}` } : {}
          });
          const data = await res.json();
          const user = data?.user;
          
          if (!user) return showError('Пользователь не найден');
          if (user.hidden || user.frozen) return showError('Профиль скрыт');

          renderHeader(user, isOwn);
          renderStats(user, isOwn);

          const ordersRes = await fetch(`/api/user/${userId}/orders`, {
              headers: isOwn ? { 'Authorization': `Bearer ${getAuthData().token}` } : {}
          });
          const ordersData = await ordersRes.json();
          
          if (isOwn) {
              renderBalance(user.balance || 0);
              renderOrders(ordersData.orders || [], true);
              loadPromocodes(userId);
          } else {
              document.getElementById('balanceSection')?.classList.add('hidden');
              document.getElementById('promocodeSection')?.classList.add('hidden');
              document.querySelector('#supportChat')?.parentElement?.classList.add('hidden');
              renderOrders(ordersData.orders || [], false);
          }
      } catch (err) {
          showError(err.message);
      }
  }

  function renderHeader(user, isOwn) {
      const el = document.getElementById('profileHeader');
      if (!el) return;

      const avatar = user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
          : 'https://cdn.discordapp.com/embed/avatars/0.png';

      const badges = user.badges || {};
      const mainBadge = getMainBadge(badges);
      const allBadges = getAllBadges(badges);

      el.innerHTML = `
          <div class="profile-avatar-wrapper">
              <img src="${avatar}" class="profile-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
              ${mainBadge}
          </div>
          <div class="profile-info">
              <h2>
                  <i class="fas fa-user-circle"></i>
                  ${escapeHtml(user.username || 'Пользователь')}
                  ${isOwn ? `<button id="settingsBtn" class="btn-settings" onclick="window.openSettings()"><i class="fas fa-cog"></i> Настройки</button>` : ''}
              </h2>
              <div class="badges-container">${allBadges}</div>
              <p><i class="fas fa-hashtag"></i> ID: ${escapeHtml(user.discordId || '—')}</p>
              <p><i class="fas fa-calendar-alt"></i> С нами с ${new Date(user.registeredAt).toLocaleDateString('ru-RU')}</p>
              ${isOwn && user.email ? `<p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>` : ''}
          </div>`;
  }

  function renderStats(user, isOwn) {
      const orders = user.orders || [];
      const spent = orders.reduce((s, o) => s + (o.price || 0), 0);
      const days = Math.floor((Date.now() - new Date(user.registeredAt)) / 86400000);

      setText('totalOrdersStat', isOwn ? orders.length : '—');
      setText('totalSpentStat', isOwn ? `${spent}₽` : '—');
      setText('memberSinceStat', days < 30 ? `${days} дн.` : days < 365 ? `${Math.floor(days / 30)} мес.` : `${Math.floor(days / 365)} г.`);
  }

  function renderBalance(balance) {
      setText('balanceAmount', `${balance}₽`);
  }

  function renderOrders(orders, isOwn) {
      const el = document.getElementById('ordersList');
      if (!el) return;

      if (!orders.length) {
          el.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>Заказов пока нет</p>${isOwn ? '<a href="/shop.html" class="btn-primary" style="margin-top:16px;display:inline-block">В магазин</a>' : ''}</div>`;
          return;
      }

      orders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

      el.innerHTML = orders.map(o => `
          <div class="order-item">
              <div class="order-id"><i class="fas fa-hashtag"></i> ${escapeHtml(o.id)}</div>
              <div class="order-product"><strong>${escapeHtml(o.productName)}</strong></div>
              <div class="order-price"><i class="fas fa-tag"></i> ${o.price || 0}₽</div>
              <div class="order-date">
                  <span><i class="fas fa-calendar"></i> ${new Date(o.date || o.createdAt).toLocaleString('ru-RU')}</span>
                  <span class="status-badge status-${o.status || 'pending'}">${statusLabel(o.status)}</span>
              </div>
              ${isOwn && o.status === 'pending' ? `
                  <button class="btn-secondary" style="margin-top:10px" onclick="window.cancelOrder('${escapeHtml(o.id)}')"><i class="fas fa-times"></i> Отменить</button>
              ` : ''}
          </div>
      `).join('');
  }

  function statusLabel(s) {
      return { pending: 'Ожидание', processing: 'В обработке', completed: 'Выполнено', cancelled: 'Отменено' }[s] || s;
  }

  window.cancelOrder = async (orderId) => {
      if (!confirm('Отменить заказ? Средства вернутся на баланс.')) return;
      try {
          const res = await fetch(`/api/orders/${orderId}/cancel`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${getAuthData().token}` }
          });
          const data = await res.json();
          if (data.success) {
              alert(`Заказ отменён. Возврат: ${data.refundAmount}₽`);
              location.reload();
          } else throw new Error(data.error);
      } catch (err) { alert(err.message); }
  };

  async function loadPromocodes(userId) {
      try {
          const res = await fetch(`/api/promocodes/user/${userId}`);
          const data = await res.json();
          const list = document.getElementById('userPromocodesList');
          if (!list || !data.promocodes?.length) {
              if (list) list.innerHTML = '';
              return;
          }
          list.innerHTML = data.promocodes.map(p => `
              <div style="display:flex;justify-content:space-between;padding:12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:6px">
                  <div>
                      <strong style="color:var(--accent-400)">${escapeHtml(p.code)}</strong>
                      <span style="color:var(--text-muted);font-size:.85rem"> · ${p.type === 'discount' ? `${p.value}%` : `${p.value}₽`}</span>
                  </div>
                  <span style="color:var(--text-dim);font-size:.75rem">${new Date(p.usedAt).toLocaleDateString('ru-RU')}</span>
              </div>
          `).join('');
      } catch (err) { console.warn('Promocodes:', err); }
  }

  function initOwnFeatures() {
      document.getElementById('applyPromocodeBtn')?.addEventListener('click', () => {
          const code = document.getElementById('promocodeInput')?.value.trim();
          if (code) window.promocodeSystem?.applyPromocodeByCode(code);
      });
      document.getElementById('promocodeInput')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              const code = e.target.value.trim();
              if (code) window.promocodeSystem?.applyPromocodeByCode(code);
          }
      });
  }

  window.showAddBalanceModal = () => {
      document.getElementById('addBalanceModal')?.style.setProperty('display', 'flex');
  };
  window.closeModal = (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
  };
  window.logout = () => {
      localStorage.removeItem('bhstore_auth');
      location.href = '/';
  };

  function showError(msg) {
      const c = document.querySelector('.profile-container');
      if (c) c.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${escapeHtml(msg)}</h3><a href="/" class="btn-primary" style="margin-top:20px;display:inline-block">На главную</a></div>`;
  }

  function setText(id, v) {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
  }

  function getMainBadge(b) {
      const order = ['admin', 'verified', 'partner', 'buyer', 'vip', 'early'];
      const key = order.find(k => b[k]);
      return key ? `<div class="avatar-badge"><img src="${BADGE_IMAGES[key]}" alt=""></div>` : '';
  }

  function getAllBadges(b) {
      const labels = { admin: 'Админ', verified: 'Проверен', partner: 'Партнёр', buyer: 'Покупатель', vip: 'VIP', early: 'Ранний' };
      return Object.entries(labels).filter(([k]) => b[k]).map(([k, l]) =>
          `<div class="badge badge-${k}"><img src="${BADGE_IMAGES[k]}" alt=""> <span>${l}</span></div>`
      ).join('');
  }

  function getAuthData() {
      try { return JSON.parse(localStorage.getItem('bhstore_auth') || '{}'); } catch { return {}; }
  }

  function escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
})();