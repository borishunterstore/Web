window.addEventListener('scroll', function() {
    const banner = document.querySelector('.banner2');
    const sticky = banner.offsetTop; // Позиция баннера относительно верхней части страницы

    if (window.pageYOffset > sticky) {
        banner.classList.add('sticky'); // Добавляем класс при прокрутке
    } else {
        banner.classList.remove('sticky'); // Убираем класс, когда прокрутка выше
    }
});