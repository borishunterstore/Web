        // Получаем элементы для обновления
        const visitCountElement = document.getElementById('visitCount');
        const uniqueCountElement = document.getElementById('uniqueCount');
        const recentVisitsElement = document.getElementById('recentVisits');
        const avgDurationElement = document.getElementById('avgDuration');
        const avgPagesCountElement = document.getElementById('avgPagesCount');
        const growthPercentElement = document.getElementById('growthPercent');

        // Инициализация переменных
        let totalVisits = localStorage.getItem('totalVisits') ? parseInt(localStorage.getItem('totalVisits')) : 0;
        let uniqueVisitors = localStorage.getItem('uniqueVisitors') ? parseInt(localStorage.getItem('uniqueVisitors')) : 0;
        let recentVisits = localStorage.getItem('recentVisits') ? parseInt(localStorage.getItem('recentVisits')) : 0;

        // Функция для обновления статистики
        function updateStatistics() {
            totalVisits++;
            recentVisits++;
            visitCountElement.textContent = totalVisits;
            recentVisitsElement.textContent = recentVisits;

            // Уникальные посетители
            const userId = localStorage.getItem('userId');
            if (!userId) {
                uniqueVisitors++;
                localStorage.setItem('userId', Date.now()); // Сохраняем уникальный идентификатор пользователя
            }

            // Сохраняем данные в localStorage
            localStorage.setItem('totalVisits', totalVisits);
            localStorage.setItem('uniqueVisitors', uniqueVisitors);
            localStorage.setItem('recentVisits', recentVisits);

            uniqueCountElement.textContent = uniqueVisitors;

            // Генерация случайных значений для статистики
            avgDurationElement.textContent = (Math.random() * 10).toFixed(2); // Случайное среднее время на сайте (от 0 до 10 минут)
            avgPagesCountElement.textContent = (Math.random() * 5).toFixed(2); // Случайное среднее количество страниц (от 0 до 5)
            growthPercentElement.textContent = ((Math.random() * 10) + 1).toFixed(2); // Случайный рост процента (от 1 до 10)

            // Сброс количества посещений за последние 24 часа
            const now = Date.now();
            const lastVisitTime = localStorage.getItem('lastVisitTime');
            if (!lastVisitTime || (now - lastVisitTime) > 24 * 60 * 60 * 1000) {
                recentVisits = 1; // Сбросим на 1, так как это первое посещение за последние 24 часа
                localStorage.setItem('recentVisits', recentVisits);
            } else {
                recentVisits++;
            }
            localStorage.setItem('lastVisitTime', now);
        }

        // Обновляем статистику при загрузке страницы
        window.onload = function() {
            updateStatistics();
        };