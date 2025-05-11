document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('carousel');
    const prevBtn = document.getElementById('prevButton');
    const nextBtn = document.getElementById('nextButton');

    let currentIndex = 0;
    const visibleCardsCount = 3; // Количество видимых карточек

    function updateCarousel() {
        const cardWidth = document.querySelector('.profile-card').offsetWidth + parseInt(getComputedStyle(document.querySelector('.profile-card')).marginRight);
        
        // Сдвигаем контейнер влево или вправо в зависимости от текущего индекса
        mainContainer.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    }

    // Обработчик события для кнопки "вперед"
    nextBtn.addEventListener('click', () => {
       const totalCards = document.querySelectorAll('.profile-card').length;

       if (currentIndex < Math.floor(totalCards / visibleCardsCount)) {
           currentIndex++;
           updateCarousel();
       }
    });

    // Обработчик события для кнопки "назад"
    prevBtn.addEventListener('click', () => {
       if (currentIndex > 0) {
           currentIndex--;
           updateCarousel();
       }
    });
});