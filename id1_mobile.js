// Создаем новый элемент <style>
const style = document.createElement('style');
style.type = 'text/css';

// Добавляем CSS стили в элемент <style>
style.innerHTML = `body {
    background: url('fon2.jpg'); /* Добавляем url для изображения фона */
    color: #ffffff; /* Цвет текста по умолчанию */
    font-family: 'Russo One', sans-serif; /* Применяем шрифт Russo One для основного текста */
    margin: 0;
    padding: 10px; /* Уменьшаем отступы для мобильных устройств */
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh; /* Уменьшаем высоту до 100vh */
}

.profile-container {
    background: rgba(155, 155, 155, 0.76);
    border-radius: 15px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); /* Уменьшаем тень для мобильных устройств */
    padding: 20px; /* Уменьшаем внутренние отступы */
    width: 90%; /* Задаем ширину 90% для мобильных устройств */
    max-width: 400px; /* Уменьшаем максимальную ширину */
    margin: auto;
    transition: transform 0.3s;
}

.profile-container:hover {
    transform: translateY(-5px);
}

.profile-header {
    display: flex;
    flex-direction: column; /* Изменяем направление на колонку для мобильных */
    align-items: center; /* Центрируем элементы по горизонтали */
}

.profile-photo {
    width: 120px; /* Уменьшаем размеры фото */
    height: 120px; /* Уменьшаем размеры фото */
    border-radius: 60px; /* Уменьшаем радиус границы */
    margin-bottom: 10px; /* Заменяем отступ справа на отступ снизу */
    border: 3px solid #ff8c49;
    box-shadow: 0 2px 10px rgba(16, 220, 247, 0.1); /* Уменьшаем тень */
    transition: transform 0.3s;
}

.profile-photo:hover {
    transform: scale(1.05); /* Увеличиваем фото при наведении */
}

.profile-info {
    text-align: center; /* Центрируем текст для лучшего отображения */
    flex-grow: 1;
}

h1 {
    color: #333;
    margin: 0;
    font-size: 24px; /* Уменьшаем размер шрифта для заголовка */
    letter-spacing: 0.5px; /* Уменьшаем межбуквенное расстояние */
}

.short-description {
    color: #666;
    font-style: italic;
    font-size: 14px; /* Уменьшаем размер шрифта для краткого описания */
}

.detailed-info {
    margin-top: 20px; /* Уменьшаем верхний отступ */
}

h2 {
    color: #ff8c49;
    margin-bottom: 10px; /* Уменьшаем нижний отступ */
    border-bottom: 2px solid #ff9c63;
    padding-bottom: 5px;
    margin-left: 0; /* Убираем отступ слева */
}

.detailed-info {
    max-width: 90%; /* Уменьшаем максимальную ширину блока */
    margin: 10px auto; /* Уменьшаем отступы для центрирования */
    padding: 15px; /* Уменьшаем внутренние отступы */
    border-radius: 10px; /* Скругленные углы */
    background: linear-gradient(135deg, #2e2e2e, #4b4b4b); /* Градиентный фон */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7); /* Уменьшаем тень */
    transition: transform 0.3s, box-shadow 0.3s; /* Плавный переход для тени и трансформации */
}

.detailed-info:hover {
    transform: translateY(-3px); /* Уменьшаем подъем блока при наведении */
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.9); /* Уменьшаем увеличенную тень при наведении */
}

.styled-title {
    text-align: center; /* Центрирование заголовка */
    font-size: 20px; /* Уменьшаем размер шрифта заголовка */
    margin-bottom: 15px; /* Уменьшаем отступ снизу */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); /* Тень для заголовка */
    transition: color 0.3s; /* Плавный переход цвета */
}

.styled-title:hover {
    color: #ff8c49; /* Изменение цвета заголовка при наведении */
}

.info-block {
    padding: 8px; /* Уменьшаем отступы внутри блока информации */
    border: 1px solid rgba(255, 255, 255, 0.2); /* Полупрозрачная граница */
    border-radius: 8px; /* Скругленные углы для блока информации */
    transition: background 0.3s; /* Плавный переход фона */
    margin: 10px 0; /* Увеличиваем отступы между блоками */
}

.info-block:hover {
    background: rgba(255, 255, 255, 0.1); /* Изменение фона при наведении */
}

.info-item {
    margin: 8px 0; /* Уменьшаем отступы между элементами */
    display: flex; /* Используем flex для выравнивания */
    justify-content: space-between; /* Распределение элементов по краям */
    align-items: center; /* Вертикальное выравнивание */
    transition: transform 0.3s; /* Плавный переход для элементов */
}

.info-item:hover {
    transform: scale(1.02); /* Увеличение элемента при наведении */
}

.info-item strong {
    font-size: 16px; /* Уменьшаем размер шрифта для заголовков информации */
    color: #ff8c49; /* Цвет заголовков информации */
    transition: color 0.3s; /* Плавный переход цвета */
}

.info-item strong:hover {
    color: #ffffff; /* Изменение цвета заголовка информации при наведении */
}

/* Стиль для текста с тенью */
.shadow-text {
    color: #ffa061; /* Цвет текста */
    text-shadow: 1px 1px 1px rgb(0, 0, 0); /* Уменьшаем тень текста для мобильных */
}

/* Стиль для текста с контуром */
.outline-text {
    color: #FF4500; /* Цвет текста */
    position: relative; /* Для позиционирования псевдоэлемента */
}

.outline-text:before {
    content: attr(data-title);
    position: absolute;
    left: 0.5px; /* Уменьшаем сдвиг для мобильных */
    top: 0.5px; /* Уменьшаем сдвиг для мобильных */
    color: #FFD700; /* Цвет контура */
    z-index: -1; /* Помещаем под оригинальным текстом */
    filter: blur(1px); /* Уменьшаем размытие для эффекта */
}

/* Стиль для 3D текста */
.three-d-text {
    color: #ffffff; /* Цвет текста */
    text-shadow: 0.5px 0.5px 0 #00BFFF, 1px 1px 0 #0056b3; /* Уменьшаем 3D эффект */
}

.info-value {
    font-size: 16px; /* Уменьшаем размер шрифта для значений */
    color: #ffffff; /* Цвет текста значений */
    margin-right: 10px; /* Уменьшаем отступ справа */
    display: block; /* Делаем элемент блочным, чтобы он занимал всю ширину */
}

.info-value1 {
    font-size: 16px; /* Уменьшаем размер шрифта для значений */
    color: #ffffff; /* Цвет текста значений */
    margin-right: 10px; /* Уменьшаем отступ справа */
    display: block; /* Делаем элемент блочным, чтобы он занимал всю ширину */
}

.info-value a {
    color: #00BFFF; /* Цвет ссылки */
    text-decoration: none; /* Убираем подчеркивание */
    transition: color 0.3s; /* Плавный переход цвета при наведении */
}

.info-value a:hover {
    color: #FFD700; /* Цвет ссылки при наведении */
    text-shadow: 0 0 3px #FFD700, 0 0 5px #FFD700; /* Уменьшаем эффект свечения при наведении */
}




.detailed-info {
    max-width: 90%; /* Устанавливаем максимальную ширину блока в процентах */
    margin: 20px auto; /* Центрирование блока */
    padding: 15px; /* Уменьшаем отступы внутри блока */
    border-radius: 8px; /* Скругленные углы */
    background: linear-gradient(135deg, #2e2e2e, #4b4b4b); /* Градиентный фон */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); /* Уменьшаем тень */
}

.styled-title {
    text-align: center; /* Центрирование заголовка */
    font-size: 20px; /* Уменьшаем размер шрифта заголовка */
    margin-bottom: 15px; /* Уменьшаем отступ снизу */
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); /* Уменьшаем тень для заголовка */
}

.info-block {
    list-style-type: none; /* Убираем маркеры списка */
    padding: 0; /* Убираем отступы */
}

.info-block li {
    margin: 10px 0; /* Уменьшаем отступы между элементами */
}

.social-link {
    display: inline-block; /* Делаем ссылки блочными для добавления отступов */
    padding: 8px 12px; /* Уменьшаем отступы для ссылок */
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
    padding: 8px 12px; /* Уменьшаем отступы для ссылок */
    color: #f8f8f8; /* Цвет текста ссылки */
    text-decoration: none; /* Убираем подчеркивание */
    border: 2px solid transparent; /* Прозрачная граница для эффекта при наведении */
    border-radius: 5px; /* Скругленные углы */
    transition: background-color 0.3s, color 0.3s, border-color 0.3s; /* Плавный переход */
    margin-bottom: 10px; /* Уменьшаем отступ снизу */
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
    margin-left: 10px; /* Уменьшаем отступ слева */
    font-size: 16px; /* Уменьшаем размер шрифта */
}

/* Стиль для текста с контуром */
.outline-text {
    color: #FF4500; /* Цвет текста */
    position: relative; /* Для позиционирования псевдоэлемента */
    font-size: 16px; /* Уменьшаем размер шрифта */
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
    font-size: 16px; /* Уменьшаем размер шрифта */
}

.social-media {
    margin-top: 20px; /* Уменьшаем отступ сверху */
}

.social-media ul {
    list-style-type: none; /* Убираем маркеры списка */
    padding: 0; /* Убираем отступы */
}

.social-media li {
    display: inline; /* Сохраняем горизонтальное отображение */
    margin-right: 10px; /* Уменьшаем отступы между элементами */
}

.social-media a {
    text-decoration: none; /* Убираем подчеркивание */
    color: #007bff; /* Цвет текста */
    font-weight: bold; /* Жирный текст */
    transition: color 0.3s, transform 0.3s; /* Плавные переходы */
    font-size: 14px; /* Уменьшаем размер шрифта */
}

.social-media a:hover {
    color: #0056b3; /* Цвет текста при наведении */
    transform: translateY(-2px); /* Эффект поднятия */
}`

// Добавляем элемент <style> в <head> документа
document.head.appendChild(style);