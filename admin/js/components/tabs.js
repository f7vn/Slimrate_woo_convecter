// Система управления вкладками

export function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Убираем активный класс со всех кнопок и контента
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Добавляем активный класс к выбранной кнопке и контенту
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Логируем переключение вкладки
            console.log(`Переключено на вкладку: ${targetTab}`);
        });
    });
}

// Функция для программного переключения вкладок
export function switchToTab(tabId) {
    const button = document.querySelector(`[data-tab="${tabId}"]`);
    if (button) {
        button.click();
    }
} 