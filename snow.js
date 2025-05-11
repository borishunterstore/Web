const canvas = document.getElementById('snowCanvas');
const ctx = canvas.getContext('2d');

let snowflakes = [];

function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Snowflake {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.alpha = Math.random();
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
}

function createSnowflakes(num) {
    for (let i = 0; i < num; i++) {
        const radius = Math.random() * 4 + 1;
        const x = Math.random() * canvas.width;
        const speed = Math.random() * 1 + 0.5;
        const y = Math.random() * canvas.height;
        snowflakes.push(new Snowflake(x, y, radius, speed));
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    snowflakes.forEach(snowflake => {
        snowflake.update();
        snowflake.draw();
    });
    requestAnimationFrame(animate);
}

function init() {
    setCanvasSize();
    createSnowflakes(100);
    animate();
}

window.addEventListener('resize', () => {
    setCanvasSize();
});

init();