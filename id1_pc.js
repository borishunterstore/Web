// Создаем новый элемент <style>
const style = document.createElement('style');
style.type = 'text/css';

// Добавляем CSS стили в элемент <style>
style.innerHTML = `body {
    background: url('fon2.jpg'); /* Добавляем url для изображения фона */
    color: #ffffff; /* Цвет текста по умолчанию */
    font-family: 'Russo One', sans-serif; /* Применяем шрифт Russo One для основного текста */
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 1000vh;
}

.profile-container {
    background: rgba(155, 155, 155, 0.76);
    border-radius: 15px;
    box-shadow: 10 10px 10px rgba(0, 0, 0, 0.2);
    padding: 30px;
    max-width: 900px;
    margin: auto;
    transition: transform 0.3s;
}

.profile-container:hover {
    transform: translateY(-5px);
}

.profile-header {
    display: flex;
    align-items: center;
}

.profile-photo {
    width: 160px;
    height: 160px;
    border-radius: 80px;
    margin-right: 30px;
    border: 3px solid #ff8c49;
    box-shadow: 0 4px 20px rgba(16, 220, 247, 0.1);
    transition: transform 0.3s;
}

.profile-photo:hover {
    transform: scale(1.05);
}

.profile-info {
    flex-grow: 1;
}

h1 {
    color: #333;
    margin: 0;
    font-size: 28px;
    letter-spacing: 1px;
}

.short-description {
    color: #666;
    font-style: italic;
}

.detailed-info {
    margin-top: 30px;
}

h2 {
    color: #ff8c49;
    margin-bottom: 15px;
    border-bottom: 2px solid #ff9c63;
    padding-bottom: 5px;
    margin-left: 5
}


.detailed-info {
    max-width: 600px; /* Максимальная ширина блока */
    margin: 20px auto; /* Центрирование блока */
    padding: 20px; /* Отступы внутри блока */
    border-radius: 10px; /* Скругленные углы */
    background: linear-gradient(135deg, #2e2e2e, #4b4b4b); /* Градиентный фон */
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.7); /* Глубокая тень */
    transition: transform 0.3s, box-shadow 0.3s; /* Плавный переход для тени и трансформации */
}

.detailed-info:hover {
    transform: translateY(-5px); /* Подъем блока при наведении */
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.9); /* Увеличенная тень при наведении */
}

.styled-title {
    text-align: center; /* Центрирование заголовка */
    font-size: 24px; /* Размер шрифта заголовка */
    margin-bottom: 20px; /* Отступ снизу */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); /* Тень для заголовка */
    transition: color 0.3s; /* Плавный переход цвета */
}

.styled-title:hover {
    color: #ff8c49; /* Изменение цвета заголовка при наведении */
}

.info-block {
    padding: 10px; /* Отступы внутри блока информации */
    border: 1px solid rgba(255, 255, 255, 0.2); /* Полупрозрачная граница */
    border-radius: 8px; /* Скругленные углы для блока информации */
    transition: background 0.3s; /* Плавный переход фона */
}

.info-block:hover {
    background: rgba(255, 255, 255, 0.1); /* Изменение фона при наведении */
}

.info-item {
    margin: 12px 0; /* Отступы между элементами */
    display: flex; /* Используем flex для выравнивания */
    justify-content: space-between; /* Распределение элементов по краям */
    align-items: center; /* Вертикальное выравнивание */
    transition: transform 0.3s; /* Плавный переход для элементов */
}

.info-item:hover {
    transform: scale(1.02); /* Увеличение элемента при наведении */
}

.info-item strong {
    font-size: 18px; /* Размер шрифта для заголовков информации */
    color: #ff8c49; /* Цвет заголовков информации */
    transition: color 0.3s; /* Плавный переход цвета */
}

.info-item strong:hover {
    color: #ffffff; /* Изменение цвета заголовка информации при наведении */
}

/* Стиль для текста с тенью */
.shadow-text {
    color: #ffa061; /* Цвет текста */
    text-shadow: 2px 2px 2px rgb(0, 0, 0); /* Тень текста */
}

/* Стиль для текста с контуром */
.outline-text {
    color: #FF4500; /* Цвет текста */
    position: relative; /* Для позиционирования псевдоэлемента */
}

.outline-text:before {
    content: attr(data-title);
    position: absolute;
    left: 1px;
    top: 1px;
    color: #FFD700; /* Цвет контура */
    z-index: -1; /* Помещаем под оригинальным текстом */
    filter: blur(2px); /* Размытие для эффекта */
}

/* Стиль для 3D текста */
.three-d-text {
    color: #ffffff; /* Цвет текста */
    text-shadow: 1px 1px 0 #00BFFF, 2px 2px 0 #0056b3; /* 3D эффект */
}

.info-value {
    font-size: 18px; /* Размер шрифта для значений */
    color: #ffffff; /* Цвет текста значений */
    margin-right: 15px;
    display: block; /* Делаем элемент блочным, чтобы он занимал всю ширину */
}

.info-value1 {
    font-size: 18px; /* Размер шрифта для значений */
    color: #ffffff; /* Цвет текста значений */
    margin-right: 15px;
    display: block; /* Делаем элемент блочным, чтобы он занимал всю ширину */
}

.info-value a {
    color: #00BFFF; /* Цвет ссылки */
    text-decoration: none; /* Убираем подчеркивание */
    transition: color 0.3s; /* Плавный переход цвета при наведении */
}

.info-value a:hover {
    color: #FFD700; /* Цвет ссылки при наведении */
    text-shadow: 0 0 5px #FFD700, 0 0 10px #FFD700; /* Эффект свечения при наведении */
}




.detailed-info {
    max-width: 600px; /* Максимальная ширина блока */
    margin: 20px auto; /* Центрирование блока */
    padding: 20px; /* Отступы внутри блока */
    border-radius: 10px; /* Скругленные углы */
    background: linear-gradient(135deg, #2e2e2e, #4b4b4b); /* Градиентный фон */
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.7); /* Глубокая тень */
}

.styled-title {
    text-align: center; /* Центрирование заголовка */
    font-size: 24px; /* Размер шрифта заголовка */
    margin-bottom: 20px; /* Отступ снизу */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); /* Тень для заголовка */
}

.info-block {
    list-style-type: none; /* Убираем маркеры списка */
    padding: 0; /* Убираем отступы */
}

.info-block li {
    margin: 12px 0; /* Отступы между элементами */
}

.social-link {
    display: inline-block; /* Делаем ссылки блочными для добавления отступов */
    padding: 10px 15px; /* Отступы для ссылок */
    color: #00BFFF; /* Цвет текста ссылки */
    text-decoration: none; /* Убираем подчеркивание */
    border: 2px solid transparent; /* Прозрачная граница для эффекта при наведении */
    border-radius: 5px; /* Скругленные углы */
    transition: background-color 0.3s, color 0.3s, border-color 0.3s; /* Плавный переход */
}

.social-link:hover {
    background-color: #ffa42c; /* Цвет фона при наведении */
    color: #ffffff; /* Цвет текста при наведении */
    border-color: #ffc954; /* Цвет границы при наведении */
}

.social-link1 {
    display: inline-block; /* Делаем ссылки блочными для добавления отступов */
    padding: 10px 15px; /* Отступы для ссылок */
    color: #f8f8f8; /* Цвет текста ссылки */
    text-decoration: none; /* Убираем подчеркивание */
    border: 2px solid transparent; /* Прозрачная граница для эффекта при наведении */
    border-radius: 5px; /* Скругленные углы */
    transition: background-color 0.3s, color 0.3s, border-color 0.3s; /* Плавный переход */
    margin-bottom: 15px
}

.social-link1:hover {
    background-color: #f7955c; /* Цвет фона при наведении */
    color: #000000; /* Цвет текста при наведении */
    border-color: #ff754a; /* Цвет границы при наведении */
}

/* Стиль для текста с тенью */
.shadow-text {
    color: #FFD700; /* Цвет текста */
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); /* Тень текста */
    margin-left: 15px
}

/* Стиль для текста с контуром */
.outline-text {
    color: #FF4500; /* Цвет текста */
    position: relative; /* Для позиционирования псевдоэлемента */
}

.outline-text:before {
    content: attr(data-title);
    position: absolute;
    left: 1px;
    top: 1px;
    color: #FFD700; /* Цвет контура */
    z-index: -1; /* Помещаем под оригинальным текстом */
    filter: blur(2px); /* Размытие для эффекта */
}

/* Стиль для 3D текста */
.three-d-text {
    color: #ffffff; /* Цвет текста */
    text-shadow: 1px 1px 0 #00BFFF, 2px 2px 0 #0056b3; /* 3D эффект */
}



.social-media {
    margin-top: 30px;
}

.social-media ul {
    list-style-type: none;
    padding: 0;
}

.social-media li {
    display: inline;
    margin-right: 20px;
}

.social-media a {
    text-decoration: none;
    color: #007bff;
    font-weight: bold;
    transition: color 0.3s, transform 0.3s;
}

.social-media a:hover {
    color: #0056b3;
    transform: translateY(-2px);
}`

// Добавляем элемент <style> в <head> документа
document.head.appendChild(style);