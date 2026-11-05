/**
 * js/api.js — Универсальный API-клиент
 * Работает и локально, и на сервере
 */
class BHStoreAPI {
    constructor() {
      // Если мы на localhost — используем относительные пути (работает через netlify dev)
      // Если на сервере — тоже относительные пути
      this.baseUrl = ''; 
      this.timeout = 15000;
    }
  
    getAuthData() {
      try {
        return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
      } catch { return {}; }
    }
  
    getAuthToken() {
      return this.getAuthData().token || null;
    }
  
    setAuthToken(token) {
      const d = this.getAuthData();
      d.token = token;
      localStorage.setItem('bhstore_auth', JSON.stringify(d));
    }
  
    clearAuth() {
      localStorage.removeItem('bhstore_auth');
      localStorage.removeItem('bhstore_active_promocodes');
    }
  
    async request(path, options = {}) {
      // Теперь запросы идут на /api/... относительно текущего домена
      const url = `/api${path}`;
      const token = this.getAuthToken();
  
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {}),
      };
  
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
  
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
  
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : {}; }
        catch { throw new Error(`Invalid JSON from ${path}`); }
  
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error('Таймаут запроса');
        throw err;
      }
    }
  
    // ═══ АДМИН ═══
    async isAdmin() {
      try {
        const data = await this.request('/admin/check');
        return data.isAdmin === true;
      } catch { return false; }
    }
  
    // ═══ ПОЛЬЗОВАТЕЛИ ═══
    getAllUsers() { return this.request('/admin/users'); }
    getUser(userId) { return this.request(`/user/${userId}`); }
    getUserBalance(userId) { return this.request(`/user/${userId}/balance`); }
    getUserOrders(userId) { return this.request(`/user/${userId}/orders`); }
    getMe() { return this.request('/user/me'); }
  
    addUserBalance(userId, amount, reason) {
      return this.request('/admin/balance/add', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
    }
  
    removeUserBalance(userId, amount, reason) {
      return this.request('/admin/balance/remove', {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason }),
      });
    }
  
    getUserBalanceHistory(userId) {
      return this.request(`/admin/balance-history/${userId}`);
    }
  
    // ═══ ЗАКАЗЫ ═══
    getAllOrders() { return this.request('/admin/orders'); }
    updateOrder(orderId, data) {
      return this.request(`/admin/orders/${orderId}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
    }
    deleteOrder(orderId) {
      return this.request(`/admin/orders/${orderId}`, { method: 'DELETE' });
    }
    createOrder(data) {
      return this.request('/create-order', { method: 'POST', body: JSON.stringify(data) });
    }
  
    // ═══ ТОВАРЫ ═══
    getProducts() { return this.request('/products'); }
    createProduct(data) {
      return this.request('/admin/products', { method: 'POST', body: JSON.stringify(data) });
    }
    updateProduct(id, data) {
      return this.request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    }
    deleteProduct(id) {
      return this.request(`/admin/products/${id}`, { method: 'DELETE' });
    }
  
    // ═══ ЧАТ ═══
    getChatUsers() { return this.request('/admin/chat/users'); }
    getChatMessages(userId) { return this.request(`/chat/messages/${userId}`); }
    sendChatMessage(userId, message, fromAdmin = false) {
      return this.request('/chat/send', {
        method: 'POST',
        body: JSON.stringify({ userId, message, fromAdmin }),
      });
    }
    checkNewMessages(userId, since) {
      return this.request(`/chat/check?userId=${userId}&since=${since}`);
    }
    markMessagesAsRead(userId) {
      return this.request(`/chat/mark-read/${userId}`, { method: 'POST' });
    }
  
    // ═══ ПРОМОКОДЫ ═══
    checkPromocode(userId, code) {
      return this.request('/promocodes/check', {
        method: 'POST', body: JSON.stringify({ userId, code }),
      });
    }
    activatePromocode(userId, code) {
      return this.request('/promocodes/activate', {
        method: 'POST', body: JSON.stringify({ userId, code }),
      });
    }
  
    // ═══ УТИЛИТЫ ═══
    formatError(err) { return err?.message || 'Неизвестная ошибка'; }
    logout() { this.clearAuth(); window.location.href = '/'; }
  }
  
  const api = new BHStoreAPI();
  window.BHStoreAPI = BHStoreAPI;
  window.api = api;