// Функция для переключения состояния бокового меню
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// Закрытие бокового меню при клике вне его
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.toggle-btn');

    // Проверяем, если клик был вне бокового меню и кнопки
    if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
        sidebar.classList.remove('active');
    }
});

// Изменение содержимого в зависимости от выбранного пункта навигации
function changeContent(section) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => {
        sec.classList.remove('active');
    });

    const activeSection = document.getElementById(section);
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

// Инициализация кнопки и навигации
const toggleBtn = document.querySelector('.toggle-btn');
const sidebar = document.getElementById('sidebar');

// Слушатель событий для кнопки навигации
toggleBtn.addEventListener('click', () => {
    toggleSidebar();
});

// Дополнительная логика для ПК: открываем боковое меню при загрузке страницы
if (window.innerWidth >= 768) { // Предположим, что 768px - это ширина для ПК
    sidebar.classList.add('active'); // Открываем боковое меню на ПК
}

// Обновляем состояние бокового меню при изменении размера окна
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.add('active'); // Открываем боковое меню на ПК
    } else {
        sidebar.classList.remove('active'); // Закрываем боковое меню на мобильных устройствах
    }
});
