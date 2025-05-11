document.addEventListener("DOMContentLoaded", function() {
    const toggleBtn = document.querySelector('.toggle-btn');
    const navigation = document.querySelector('.navigation');

    toggleBtn.addEventListener('click', function() {
        navigation.classList.toggle('active');
        toggleBtn.classList.toggle('active');
    });
});
