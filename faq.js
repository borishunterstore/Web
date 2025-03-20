document.querySelectorAll('.faq-title').forEach(item => {
    item.addEventListener('click', () => {
        const faqItem = item.parentElement;

        // Закрываем все остальные элементы, кроме текущего
        document.querySelectorAll('.faq-item').forEach(otherItem => {
            if (otherItem !== faqItem) {
                otherItem.classList.remove('active'); // Убираем класс активного элемента
                otherItem.querySelector('.faq-content').style.display = 'none'; // Скрываем контент
                otherItem.querySelector('.toggle-icon').textContent = '+'; // Меняем иконку на "+"
            }
        });

        // Переключаем класс активного элемента для текущего
        faqItem.classList.toggle('active');
        const icon = item.querySelector('.toggle-icon');
        if (faqItem.classList.contains('active')) {
            icon.textContent = '-'; // Меняем на "-"
            faqItem.querySelector('.faq-content').style.display = 'block'; // Показываем контент
        } else {
            icon.textContent = '+'; // Меняем на "+"
            faqItem.querySelector('.faq-content').style.display = 'none'; // Скрываем контент
        }
    });
});