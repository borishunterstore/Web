document.querySelectorAll('.save-button').forEach(button => {
    button.addEventListener('click', function() {
        const settingItem = this.closest('.setting-item');
        const input = settingItem.querySelector('input, select');
        if (input && input.value) {
            alert(`Данные для ${input.previousElementSibling.innerText} успешно сохранены!`);
        } else {
            alert("Пожалуйста, заполните все поля!");
        }
    });
});

document.querySelector('.toggle-card').addEventListener('click', function() {
    const cardNumber = document.getElementById('card-number');
    if (cardNumber.innerText.startsWith("****")) {
        cardNumber.innerText = "1234 5678 9012 3456";
        this.innerText = "Скрыть";
    } else {
        cardNumber.innerText = "**** **** **** 1234";
        this.innerText = "Показать";
    }
});

document.querySelector('.delete-wallet').addEventListener('click', function() {
    if (confirm("Вы уверены, что хотите удалить карту?")) {
        alert("Карта удалена!");
    }
});

document.querySelector('.create-wallet').addEventListener('click', function() {
    alert("Кошелёк создан! Уникальный ID сгенерирован.");
});

const walletInfo = document.querySelector('.wallet-info');
const noWalletInfo = document.querySelector('.no-wallet');

const walletCreated = true;
if (walletCreated) {
    walletInfo.style.display = 'flex';
    noWalletInfo.style.display = 'none';
} else {
    walletInfo.style.display = 'none';
    noWalletInfo.style.display = 'block';
}

function updateProfile() {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    
    if (nameInput.value && emailInput.value) {
        alert(`Профиль обновлён! Имя: ${nameInput.value}, Email: ${emailInput.value}`);
    } else {
        alert("Пожалуйста, заполните все поля профиля!");
    }
}

function addProduct() {
    const productInput = document.getElementById('product');
    const productList = document.getElementById('product-list');

    if (productInput.value) {
        const newProduct = document.createElement('li');
        newProduct.textContent = productInput.value;
        newProduct.classList.add('product-item');
        productList.appendChild(newProduct);
        productInput.value = '';
        alert("Товар добавлен!");
    } else {
        alert("Пожалуйста, введите название товара!");
    }
}

function removeProduct(event) {
    const productItem = event.target.closest('li');
    if (productItem) {
        productItem.remove();
        alert("Товар удалён!");
    }
}

function editProduct(event) {
    const productItem = event.target.closest('li');
    const currentText = productItem.textContent;
    const newText = prompt("Редактировать товар:", currentText);
    if (newText && newText.trim() !== "") {
        productItem.textContent = newText;
        alert("Товар обновлён!");
    } else {
        alert("Название товара не может быть пустым!");
    }
}

document.querySelector('.update-profile-button').addEventListener('click', updateProfile);
document.querySelector('.add-product-button').addEventListener('click', addProduct);
document.getElementById('product-list').addEventListener('click', removeProduct);
document.getElementById('product-list').addEventListener('dblclick', editProduct);

function saveProductsToLocalStorage() {
    const productList = document.getElementById('product-list');
    const products = Array.from(productList.children).map(item => item.textContent);
    localStorage.setItem('products', JSON.stringify(products));
}

function loadProductsFromLocalStorage() {
    const products = JSON.parse(localStorage.getItem('products'));
    if (products) {
        const productList = document.getElementById('product-list');
        products.forEach(product => {
            const newProduct = document.createElement('li');
            newProduct.textContent = product;
            newProduct.classList.add('product-item');
            productList.appendChild(newProduct);
        });
    }
}

window.addEventListener('DOMContentLoaded', loadProductsFromLocalStorage);
document.getElementById('product-list').addEventListener('DOMNodeRemoved', saveProductsToLocalStorage);
document.getElementById('product-list').addEventListener('DOMNodeInserted', saveProductsToLocalStorage);

document.querySelector('.clear-products-button').addEventListener('click', function() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    localStorage.removeItem('products'); 
    alert("Список товаров очищен!");
});

function validateProductForm() {
    const productInput = document.getElementById('product');
    if (!productInput.value.trim()) {
        alert("Название товара не может быть пустым!");
        return false;
    }
    return true;
}

function addProduct() {
    const productInput = document.getElementById('product');
    if (validateProductForm()) {
        const productList = document.getElementById('product-list');
        const newProduct = document.createElement('li');
        newProduct.textContent = productInput.value;
        newProduct.classList.add('product-item');
        productList.appendChild(newProduct);
        productInput.value = '';
        saveProductsToLocalStorage();
        alert("Товар добавлен!");
    }
}

function removeProduct(event) {
    const productItem = event.target.closest('li');
    if (productItem) {
        productItem.remove();
        saveProductsToLocalStorage();
        alert("Товар удалён!");
    }
}

function editProduct(event) {
    const productItem = event.target.closest('li');
    const currentText = productItem.textContent;
    const newText = prompt("Редактировать товар:", currentText);
    if (newText && newText.trim() !== "") {
        productItem.textContent = newText;
        saveProductsToLocalStorage();
        alert("Товар обновлён!");
    } else {
        alert("Название товара не может быть пустым!");
    }
}

document.querySelector('.clear-products-button').addEventListener('click', function() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    localStorage.removeItem('products');
    alert("Список товаров очищен!");
});
