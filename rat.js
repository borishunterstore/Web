function toggleDetails(arrow) {
    const product = arrow.closest('.product');
    const details = product.querySelector('.product-details');
    
    details.classList.toggle('visible');
    arrow.classList.toggle('rotated');
}