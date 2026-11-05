class DiscordAuth {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    init() {
        this.checkUrlForToken();
        this.updateAuthButton();
        this.refreshUserBalance();
    }

    updateAuthButton() {
        const authData = this.getAuthData();
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        
        if (authData?.id) {
            let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
            if (authData.avatar) {
                const ext = authData.avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.${ext}?size=32`;
            }
            authBtn.innerHTML = `<img src="${avatarUrl}" style="width:24px;height:24px;border-radius:50%;margin-right:8px">${authData.username || 'Профиль'}`;
            authBtn.onclick = () => window.location.href = '/profile.html';
            authBtn.classList.add('auth-authenticated');
        } else {
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
            authBtn.onclick = () => window.location.href = '/auth.html';
            authBtn.classList.remove('auth-authenticated');
        }
    }
    
    checkUrlForToken() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) return;
        
        try {
            const userData = JSON.parse(atob(token));
            const authData = { id: userData.id, username: userData.username, email: userData.email, avatar: userData.avatar, token: token, requiresVerification: false };
            this.saveAuthData(authData);
            window.history.replaceState({}, '', window.location.pathname);
            window.location.href = '/';
        } catch (error) {}
    }

    async refreshUserBalance() {
        const authData = this.getAuthData();
        if (!authData?.id) return;
        try {
            const response = await fetch(`${this.apiBase}/user/${authData.id}/balance`);
            if (response.ok) {
                const data = await response.json();
                if (data.balance !== undefined) {
                    authData.balance = data.balance;
                    this.saveAuthData(authData);
                    window.updateBalanceDisplay?.(data.balance);
                }
            }
        } catch (error) {}
    }

    getAuthData() {
        try { return JSON.parse(localStorage.getItem('bhstore_auth') || '{}'); } catch { return null; }
    }

    saveAuthData(data) {
        localStorage.setItem('bhstore_auth', JSON.stringify(data));
        this.updateAuthButton();
    }

    logout() {
        localStorage.removeItem('bhstore_auth');
        window.location.href = '/';
    }
}

const auth = new DiscordAuth();
window.DiscordAuth = DiscordAuth;
window.auth = auth;

window.logout = () => auth.logout();
window.updateUserBalance = (balance) => {
    const authData = auth.getAuthData();
    if (authData) {
        authData.balance = balance;
        auth.saveAuthData(authData);
    }
};