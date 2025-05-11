function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.toggle-btn');
    if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
        sidebar.classList.remove('active');
    }
});

function changeContent(section) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => {
        sec.classList.remove('active');
    });

    const activeSection = document.getElementById(section);
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

const toggleBtn = document.querySelector('.toggle-btn');
const sidebar = document.getElementById('sidebar');

toggleBtn.addEventListener('click', () => {
    toggleSidebar();
});

if (window.innerWidth >= 768) {
    sidebar.classList.add('active');
}

window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
});
