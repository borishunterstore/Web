const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

navToggle.addEventListener('click', function() {
    navList.classList.toggle('show');
});

window.addEventListener('click', function(event) {
    if (!event.target.matches('.nav-toggle') && navList.classList.contains('show')) {
        navList.classList.remove('show');
    }
});