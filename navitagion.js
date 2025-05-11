        const navToggle = document.getElementById('nav-toggle');
        const navList = document.getElementById('nav-list');

        navToggle.addEventListener('click', () => {
            if (navList.style.display === 'none' ||
            navList.style.display === '') {
                navList.style.display = 'block';
            } else {
                navList.style.display = 'none';
            }
        });

        document.addEventListener('click', (event) => {
            if (!navToggle.contains(event.target) && !navList.contains(event.target)) {
                navList.style.display = 'none';
            }
        });

        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-item a');

        navLinks.forEach(link => {
            if (link.href === window.location.href) {
                link.classList.add('active');
            }
        });