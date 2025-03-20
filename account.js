// Пример функциональности для кнопки "Сохранить изменения"
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

// Пример функциональности для показа/скрытия номера карты
document.querySelector('.toggle-card').addEventListener('click', function() {
    const cardNumber = document.getElementById('card-number');
    if (cardNumber.innerText.startsWith("****")) {
        cardNumber.innerText = "1234 5678 9012 3456"; // Показать полный номер
        this.innerText = "Скрыть";
    } else {
        cardNumber.innerText = "**** **** **** 1234"; // Скрыть номер
        this.innerText = "Показать";
    }
});

// Пример функциональности для удаления кошелька
document.querySelector('.delete-wallet').addEventListener('click', function() {
    if (confirm("Вы уверены, что хотите удалить карту?")) {
        alert("Карта удалена!");
    }
});

// Пример функциональности для создания кошелька
document.querySelector('.create-wallet').addEventListener('click', function() {
    alert("Кошелёк создан! Уникальный ID сгенерирован.");
    // Здесь можно добавить логику для генерации уникального ID
});

// Логика для отображения/скрытия блока кошелька
const walletInfo = document.querySelector('.wallet-info');
const noWalletInfo = document.querySelector('.no-wallet');

// Пример: Если кошелек создан, показываем информацию о кошельке
const walletCreated = true; // Здесь можно заменить на реальную проверку
if (walletCreated) {
    walletInfo.style.display = 'flex';
    noWalletInfo.style.display = 'none';
} else {
    walletInfo.style.display = 'none';
    noWalletInfo.style.display = 'block';
}

// Функция для изменения информации о пользователе
function updateProfile() {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    
    if (nameInput.value && emailInput.value) {
        alert(`Профиль обновлён! Имя: ${nameInput.value}, Email: ${emailInput.value}`);
    } else {
        alert("Пожалуйста, заполните все поля профиля!");
    }
}

// Пример добавления товара в список
function addProduct() {
    const productInput = document.getElementById('product');
    const productList = document.getElementById('product-list');

    if (productInput.value) {
        const newProduct = document.createElement('li');
        newProduct.textContent = productInput.value;
        newProduct.classList.add('product-item'); // Добавляем класс для дальнейшего использования
        productList.appendChild(newProduct);
        productInput.value = ''; // Очистить поле ввода
        alert("Товар добавлен!");
    } else {
        alert("Пожалуйста, введите название товара!");
    }
}

// Пример удаления товара из списка
function removeProduct(event) {
    const productItem = event.target.closest('li');
    if (productItem) {
        productItem.remove();
        alert("Товар удалён!");
    }
}

// Функция для редактирования товара
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

// Обработка события для кнопки "Обновить профиль"
document.querySelector('.update-profile-button').addEventListener('click', updateProfile);

// Обработка события для кнопки "Добавить товар"
document.querySelector('.add-product-button').addEventListener('click', addProduct);

// Добавление обработчика события для удаления товара при клике на него
document.getElementById('product-list').addEventListener('click', removeProduct);

// Добавление обработчика события для редактирования товара при двойном клике
document.getElementById('product-list').addEventListener('dblclick', editProduct);

// Функция для сохранения списка товаров в локальное хранилище
function saveProductsToLocalStorage() {
    const productList = document.getElementById('product-list');
    const products = Array.from(productList.children).map(item => item.textContent);
    localStorage.setItem('products', JSON.stringify(products));
}

// Функция для загрузки списка товаров из локального хранилища
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

// Загрузка товаров при загрузке страницы
window.addEventListener('DOMContentLoaded', loadProductsFromLocalStorage);

// Обновление списка товаров в локальном хранилище при добавлении или удалении товара
document.getElementById('product-list').addEventListener('DOMNodeRemoved', saveProductsToLocalStorage);
document.getElementById('product-list').addEventListener('DOMNodeInserted', saveProductsToLocalStorage);

// Добавление обработчика события для кнопки "Очистить список"
document.querySelector('.clear-products-button').addEventListener('click', function() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Очищаем список
    localStorage.removeItem('products'); // Удаляем товары из локального хранилища
    alert("Список товаров очищен!");
});

// Пример валидации формы для создания нового товара
function validateProductForm() {
    const productInput = document.getElementById('product');
    if (!productInput.value.trim()) {
        alert("Название товара не может быть пустым!");
        return false;
    }
    return true;
}

// Обновление функции добавления товара с валидацией
function addProduct() {
    const productInput = document.getElementById('product');
    if (validateProductForm()) {
        const productList = document.getElementById('product-list');
        const newProduct = document.createElement('li');
        newProduct.textContent = productInput.value;
        newProduct.classList.add('product-item');
        productList.appendChild(newProduct);
        productInput.value = ''; // Очистить поле ввода
        saveProductsToLocalStorage(); // Сохраняем в локальное хранилище
        alert("Товар добавлен!");
    }
}

// Обновление функции удаления товара с сохранением в локальном хранилище
function removeProduct(event) {
    const productItem = event.target.closest('li');
    if (productItem) {
        productItem.remove();
        saveProductsToLocalStorage(); // Сохраняем изменения в локальное хранилище
        alert("Товар удалён!");
    }
}

// Обновление функции редактирования товара с сохранением в локальном хранилище
function editProduct(event) {
    const productItem = event.target.closest('li');
    const currentText = productItem.textContent;
    const newText = prompt("Редактировать товар:", currentText);
    if (newText && newText.trim() !== "") {
        productItem.textContent = newText;
        saveProductsToLocalStorage(); // Сохраняем изменения в локальное хранилище
        alert("Товар обновлён!");
    } else {
        alert("Название товара не может быть пустым!");
    }
}

// Добавление обработчика события для кнопки "Очистить список"
document.querySelector('.clear-products-button').addEventListener('click', function() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Очищаем список
    localStorage.removeItem('products'); // Удаляем товары из локального хранилища
    alert("Список товаров очищен!");
});
