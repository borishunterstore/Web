// Создаем элемент стиля (если необходимо)
const style = document.createElement('style');
document.head.appendChild(style);

// Функция для проверки IP
async function checkIP() {
    try {
        // Получаем IP-адрес пользователя
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        if (!ipResponse.ok) throw new Error('Ошибка при получении IP-адреса');
        
        const ipData = await ipResponse.json();
        const userIP = ipData.ip;

        // Здесь используем сторонний API для проверки VPN
        const vpnResponse = await fetch(`https://vpnapi.io/api/${userIP}`);
        if (!vpnResponse.ok) throw new Error('Ошибка при проверке VPN');

        const vpnData = await vpnResponse.json();

        const allowedIP = '188.66.32.27'; // Замените на ваш разрешенный IP

        // Проверяем, используется ли VPN или IP не совпадает
        if (vpnData.security.vpn || userIP !== allowedIP) {
            // Если используется VPN или IP не совпадает, перенаправляем на error.html
            window.location.href = 'error.html'; // Перенаправление на error.html
        }
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = 'error.html'; // Перенаправление на error.html в случае ошибки
    }
}

// Запускаем проверку IP при загрузке страницы
checkIP();