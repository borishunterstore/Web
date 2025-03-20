const canvas = document.getElementById('snowCanvas');
const ctx = canvas.getContext('2d');

let snowflakes = [];

// Установка размеров канваса
function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Класс для снежинки
class Snowflake {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.alpha = Math.random(); // Прозрачность
    }

    // Метод для обновления позиции снежинки
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = 0; // Возвращаем снежинку в верхнюю часть
            this.x = Math.random() * canvas.width; // Новая случайная позиция по x
        }
    }

    // Метод для рисования снежинки
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`; // Белый цвет с прозрачностью
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
}

// Функция для создания снежинок
function createSnowflakes(num) {
    for (let i = 0; i < num; i++) {
        const radius = Math.random() * 4 + 1; // Радиус от 1 до 5
        const x = Math.random() * canvas.width; // Случайная позиция по x
        const speed = Math.random() * 1 + 0.5;
        const y = Math.random() * canvas.height; // Случайная позиция по y
        snowflakes.push(new Snowflake(x, y, radius, speed));
    }
}

// Функция для анимации снежинок
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очистка канваса
    snowflakes.forEach(snowflake => {
        snowflake.update(); // Обновление позиции снежинки
        snowflake.draw(); // Рисование снежинки
    });
    requestAnimationFrame(animate); // Запрос следующего кадра анимации
}

// Инициализация
function init() {
    setCanvasSize(); // Установка размеров канваса
    createSnowflakes(100); // Создание 100 снежинок
    animate(); // Запуск анимации
}

// Обработчик изменения размера окна
window.addEventListener('resize', () => {
    setCanvasSize(); // Установка размеров канваса при изменении размера окна
});

// Запуск инициализации
init();