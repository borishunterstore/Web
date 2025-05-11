document.querySelectorAll('.faq-title').forEach(item => {
    item.addEventListener('click', () => {
        const faqItem = item.parentElement;

        document.querySelectorAll('.faq-item').forEach(otherItem => {
            if (otherItem !== faqItem) {
                otherItem.classList.remove('active');
                otherItem.querySelector('.faq-content').style.display = 'none';
                otherItem.querySelector('.toggle-icon').textContent = '+';
            }
        });

        faqItem.classList.toggle('active');
        const icon = item.querySelector('.toggle-icon');
        if (faqItem.classList.contains('active')) {
            icon.textContent = '-';
            faqItem.querySelector('.faq-content').style.display = 'block';
        } else {
            icon.textContent = '+';
            faqItem.querySelector('.faq-content').style.display = 'none';
        }
    });
});