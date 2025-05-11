const style = document.createElement('style');
document.head.appendChild(style);

async function checkIP() {
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        if (!ipResponse.ok) throw new Error('Ошибка при получении IP-адреса');
        
        const ipData = await ipResponse.json();
        const userIP = ipData.ip;

        const vpnResponse = await fetch(`https://vpnapi.io/api/${userIP}`);
        if (!vpnResponse.ok) throw new Error('Ошибка при проверке VPN');

        const vpnData = await vpnResponse.json();

        const allowedIP = '188.66.32.27';

        if (vpnData.security.vpn || userIP !== allowedIP) {
            window.location.href = 'error.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = 'error.html';
    }
}

checkIP();