// Получаем элементы
const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

// Разворачиваем/скрываем меню по нажатию на кнопку
navToggle.addEventListener('click', function() {
    navList.classList.toggle('show'); // Переключаем класс show
});

// Закрываем меню при клике вне области меню
window.addEventListener('click', function(event) {
    if (!event.target.matches('.nav-toggle') && navList.classList.contains('show')) {
        navList.classList.remove('show'); // Убираем класс show
    }
});