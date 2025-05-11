        const visitCountElement = document.getElementById('visitCount');
        const uniqueCountElement = document.getElementById('uniqueCount');
        const recentVisitsElement = document.getElementById('recentVisits');
        const avgDurationElement = document.getElementById('avgDuration');
        const avgPagesCountElement = document.getElementById('avgPagesCount');
        const growthPercentElement = document.getElementById('growthPercent');

        let totalVisits = localStorage.getItem('totalVisits') ? parseInt(localStorage.getItem('totalVisits')) : 0;
        let uniqueVisitors = localStorage.getItem('uniqueVisitors') ? parseInt(localStorage.getItem('uniqueVisitors')) : 0;
        let recentVisits = localStorage.getItem('recentVisits') ? parseInt(localStorage.getItem('recentVisits')) : 0;

        function updateStatistics() {
            totalVisits++;
            recentVisits++;
            visitCountElement.textContent = totalVisits;
            recentVisitsElement.textContent = recentVisits;

            const userId = localStorage.getItem('userId');
            if (!userId) {
                uniqueVisitors++;
                localStorage.setItem('userId', Date.now());
            }

            localStorage.setItem('totalVisits', totalVisits);
            localStorage.setItem('uniqueVisitors', uniqueVisitors);
            localStorage.setItem('recentVisits', recentVisits);

            uniqueCountElement.textContent = uniqueVisitors;

            avgDurationElement.textContent = (Math.random() * 10).toFixed(2);
            avgPagesCountElement.textContent = (Math.random() * 5).toFixed(2);
            growthPercentElement.textContent = ((Math.random() * 10) + 1).toFixed(2);

            const now = Date.now();
            const lastVisitTime = localStorage.getItem('lastVisitTime');
            if (!lastVisitTime || (now - lastVisitTime) > 24 * 60 * 60 * 1000) {
                recentVisits = 1;
                localStorage.setItem('recentVisits', recentVisits);
            } else {
                recentVisits++;
            }
            localStorage.setItem('lastVisitTime', now);
        }

        window.onload = function() {
            updateStatistics();
        };