        // Получаем элементы
        const navToggle = document.getElementById('nav-toggle');
        const navList = document.getElementById('nav-list');

        // Обработчик события клика на иконку навигации
        navToggle.addEventListener('click', () => {
            // Переключаем видимость списка навигации
            if (navList.style.display === 'none' ||
            navList.style.display === '') {
                navList.style.display = 'block'; // Показываем меню
            } else {
                navList.style.display = 'none'; // Скрываем меню
            }
        });

        // Закрытие меню при клике вне его
        document.addEventListener('click', (event) => {
            if (!navToggle.contains(event.target) && !navList.contains(event.target)) {
                navList.style.display = 'none'; // Скрываем меню, если кликнули вне его
            }
        });

        // Установка активного пункта меню
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-item a');

        navLinks.forEach(link => {
            if (link.href === window.location.href) {
                link.classList.add('active'); // Добавляем класс активного пункта
            }
        });