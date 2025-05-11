document.addEventListener('DOMContentLoaded', function() {
    const items = document.querySelectorAll('.product-item, .animation-item');

    items.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'scale(1.05)';
            item.style.boxShadow = '0 0 20px rgba(0, 255, 204, 0.5)';
        });

        item.addEventListener('mouseleave', () => {
            item.style.transform = 'scale(1)';
            item.style.boxShadow = 'none';
        });
    });
});
