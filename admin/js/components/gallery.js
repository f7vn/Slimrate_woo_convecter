// Функции для управления галереей изображений

// Счетчики для уникальных ID
let simpleGalleryCount = 1;
let variationGalleryCounters = {};

// Инициализация галереи для простого товара
export function initSimpleGallery() {
    const addBtn = document.getElementById('addSimpleGalleryBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addSimpleGalleryItem);
    }
}

// Добавление изображения в галерею простого товара
function addSimpleGalleryItem() {
    simpleGalleryCount++;
    const container = document.getElementById('simpleGalleryContainer');
    
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
        <input type="url" name="simpleGalleryImage${simpleGalleryCount}" placeholder="https://example.com/gallery-image-${simpleGalleryCount}.jpg">
        <button type="button" class="btn-remove-gallery" onclick="removeGalleryItem(this)">×</button>
    `;
    
    container.appendChild(div);
    
    // Показываем кнопки удаления если больше одного элемента
    updateGalleryRemoveButtons('simpleGalleryContainer');
}

// Удаление элемента галереи
window.removeGalleryItem = function(button) {
    const galleryItem = button.closest('.gallery-item');
    const container = galleryItem.closest('#simpleGalleryContainer, .variation-gallery-container');
    
    galleryItem.remove();
    updateGalleryRemoveButtons(container.id);
}

// Добавление изображения в галерею вариации
window.addVariationGalleryItem = function(variationIndex) {
    if (!variationGalleryCounters[variationIndex]) {
        variationGalleryCounters[variationIndex] = 1;
    }
    variationGalleryCounters[variationIndex]++;
    
    const container = document.getElementById(`variationGallery${variationIndex}`);
    const count = variationGalleryCounters[variationIndex];
    
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
        <input type="url" name="variationGallery${variationIndex}_${count}" placeholder="https://example.com/variation-gallery-${count}.jpg">
        <button type="button" class="btn-remove-gallery" onclick="removeVariationGalleryItem(this)">×</button>
    `;
    
    container.appendChild(div);
    updateGalleryRemoveButtons(`variationGallery${variationIndex}`);
}

// Удаление элемента галереи вариации
window.removeVariationGalleryItem = function(button) {
    const galleryItem = button.closest('.gallery-item');
    const container = galleryItem.closest('.variation-gallery-container');
    
    galleryItem.remove();
    updateGalleryRemoveButtons(container.id);
}

// Обновление видимости кнопок удаления
function updateGalleryRemoveButtons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const items = container.querySelectorAll('.gallery-item');
    const removeButtons = container.querySelectorAll('.btn-remove-gallery');
    
    // Показываем кнопки удаления только если больше одного элемента
    removeButtons.forEach(btn => {
        btn.style.display = items.length > 1 ? 'inline-block' : 'none';
    });
}

// Сброс счетчиков при создании новой формы
export function resetGalleryCounters() {
    simpleGalleryCount = 1;
    variationGalleryCounters = {};
} 