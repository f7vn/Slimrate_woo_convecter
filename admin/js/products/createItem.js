import { AUTH_TOKEN } from '../core/config.js';
import { addLogEntry, uploadImageToSlimrate, loadFormSelects } from '../core/utils.js';
import { renderSimpleProductForm, collectSimpleProductData, createSimpleWooProduct, initSimpleProductForm } from './simpleProduct.js';
import { renderVariableProductForm, setupVariationsLogic, collectVariableProductData, createVariableWooProduct } from './variableProduct.js';
import { initSimpleGallery, resetGalleryCounters } from '../components/gallery.js';
import { loadTemplate } from '../core/templateLoader.js';

export async function renderCreateItemForm() {
    const block = document.getElementById('createItemBlock');
    
    try {
        // Загружаем шаблон из файла
        const template = await loadTemplate('create-item-form');
        block.innerHTML = template;
        
        // Инициализация формы
        initializeForm();
    } catch (error) {
        addLogEntry(`Ошибка загрузки шаблона формы: ${error.message}`, 'error');
        console.error('Template loading error:', error);
    }
}

function initializeForm() {
    loadFormSelects();
    setupFormNavigation();
    
    // Убеждаемся что контейнер формы товара изначально скрыт
    const container = document.getElementById('productFormContainer');
    container.style.display = 'none';
    
    // Обработчик отправки формы
    document.getElementById('createItemForm').addEventListener('submit', handleCreateItemSubmit);
    
    addLogEntry('Форма создания простого товара инициализирована', 'info');
}

function setupFormNavigation() {
    const nextBtn = document.getElementById('nextStepBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    const submitBtn = document.getElementById('submitBtn');
    let currentStep = 1;

    nextBtn.addEventListener('click', () => {
        if (currentStep === 1) {
            // Валидация основной информации
            const form = document.getElementById('createItemForm');
            const basicInputs = form.querySelectorAll('#basicInfoSection input[required], #basicInfoSection select[required]');
            let isValid = true;
            
            basicInputs.forEach(input => {
                if (!input.value.trim()) {
                    input.classList.add('error');
                    isValid = false;
                } else {
                    input.classList.remove('error');
                }
            });

            if (!isValid) {
                addLogEntry('Заполните все обязательные поля основной информации', 'warning');
                return;
            }

            currentStep = 2;
            updateFormStep();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep === 2) {
            currentStep = 1;
            updateFormStep();
        }
    });

    function updateFormStep() {
        const steps = document.querySelectorAll('.progress-step');
        const basicSection = document.getElementById('basicInfoSection');
        const container = document.getElementById('productFormContainer');

        steps.forEach((step, index) => {
            step.classList.toggle('active', index < currentStep);
            step.classList.toggle('completed', index < currentStep - 1);
        });

        if (currentStep === 1) {
            basicSection.style.display = 'block';
            container.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        } else if (currentStep === 2) {
            basicSection.style.display = 'none';
            container.style.display = 'block';
            prevBtn.style.display = 'inline-block';
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
            
            // Показываем форму простого товара
            showSimpleProductForm();
        }
    }
}

async function showSimpleProductForm() {
    const container = document.getElementById('productFormContainer');
    
    // Очищаем контейнер перед добавлением формы
    container.innerHTML = '';
    
    // Сбрасываем счетчики галереи
    resetGalleryCounters();
    
    // Показываем форму простого товара
    const formHtml = await renderSimpleProductForm();
    container.innerHTML = formHtml;
    
    // Инициализируем JavaScript для формы простого товара
    initSimpleProductForm();
    
    // Инициализируем галерею для простого товара
    setTimeout(() => initSimpleGallery(), 100);
    
    addLogEntry('Форма простого товара загружена', 'info');
}

async function handleCreateItemSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const productType = 'simple'; // Всегда простой товар
    const imageUrl = formData.get('image');
    
    addLogEntry('=== НАЧАЛО СОЗДАНИЯ ПРОСТОГО ТОВАРА ===', 'info');
    addLogEntry(`Название: ${formData.get('displayName')}`, 'info');
    
    try {
        // Загрузка основного изображения
        let slimrateMainImage = '';
        if (imageUrl) {
            addLogEntry('Загрузка основного изображения товара...', 'info');
            slimrateMainImage = await uploadImageToSlimrate(imageUrl);
            if (slimrateMainImage) {
                addLogEntry('Основное изображение загружено в Slimrate', 'success');
            }
        }

        // Сбор данных простого товара
        const simpleData = collectSimpleProductData(formData);
        
        // Загружаем изображения галереи в Slimrate
        const uploadedGalleryImages = [];
        if (simpleData.wooInfo.pictures && simpleData.wooInfo.pictures.length > 0) {
            addLogEntry(`Загрузка ${simpleData.wooInfo.pictures.length} изображений галереи в Slimrate...`, 'info');
            
            for (const [index, imageUrl] of simpleData.wooInfo.pictures.entries()) {
                if (imageUrl && imageUrl.trim()) {
                    addLogEntry(`Загрузка изображения галереи ${index + 1}/${simpleData.wooInfo.pictures.length}...`, 'info');
                    const uploadedUrl = await uploadImageToSlimrate(imageUrl);
                    if (uploadedUrl) {
                        uploadedGalleryImages.push(uploadedUrl);
                        addLogEntry(`Изображение галереи ${index + 1} загружено в Slimrate`, 'success');
                    } else {
                        addLogEntry(`Ошибка загрузки изображения галереи ${index + 1}`, 'error');
                        // Оставляем оригинальный URL если загрузка не удалась
                        uploadedGalleryImages.push(imageUrl);
                    }
                }
            }
        }
        
        // Объединяем основное изображение с галереей для WooCommerce
        const allImages = [];
        if (slimrateMainImage) {
            allImages.push(slimrateMainImage);
        }
        allImages.push(...uploadedGalleryImages);
        
        simpleData.wooInfo.pictures = allImages;
        
        // Сохраняем исходные данные для fallback
        const originalFormData = {
            startQuantity: formData.get('simpleStartQuantity') || '',
            price: formData.get('simplePrice') || '',
            strikeThroughPrice: formData.get('simpleStrikeThroughPrice') || ''
        };
        
        // Для простого товара создаём структуру с массивом items (как требует Slimrate API)
        const slimrateBody = {
            displayName: formData.get('displayName'),
            categoryId: formData.get('categoryId'),
            taxId: formData.get('taxId'),
            quantityUnitId: formData.get('quantityUnitId'),
            description: formData.get('description') || '',
            image: slimrateMainImage,
            // Для простого товара создаём массив с одним элементом
            items: [{
                // toDelete: false,
                varName: '', // Для простого товара имя вариации пустое
                image: slimrateMainImage,
                barcode: simpleData.barcode,
                price: simpleData.price,
                color: "ffebba3d",
                strikeThroughPrice: simpleData.strikeThroughPrice,
                startQuantity: simpleData.manageStock ? simpleData.startQuantity : '0', // Всегда включаем поле
                wooInfo: {
                    name: formData.get('displayName'),
                    description: simpleData.wooInfo.description || formData.get('description') || '',
                    shortDescription: simpleData.wooInfo.shortDescription || '',
                    pictures: allImages
                },
                cost: simpleData.cost || '', // Добавляем поле cost
                admin_notes: '', // Добавляем поле admin_notes
                skuCode: simpleData.skuCode
            }]
        };

        // Подготовка данных для Slimrate API
        addLogEntry('Отправка данных в Slimrate...', 'info');
        
        // Логирование тела запроса к Slimrate для отладки
        addLogEntry('=== ОТПРАВЛЯЕМЫЕ ДАННЫЕ В SLIMRATE ===', 'info');
        addLogEntry(`Основные поля: displayName="${slimrateBody.displayName}"`, 'info');
        addLogEntry(`Управление складом: ${slimrateBody.items[0].manageStock ? 'включено' : 'отключено'}`, 'info');
        if (slimrateBody.items[0].manageStock) {
            addLogEntry(`Простой товар: startQuantity="${slimrateBody.items[0].startQuantity}" (тип: ${typeof slimrateBody.items[0].startQuantity})`, 'info');
        } else {
            addLogEntry(`Простой товар: startQuantity не передается (управление складом отключено)`, 'info');
        }
        addLogEntry(`Цена: "${slimrateBody.items[0].price}", зачеркнутая: "${slimrateBody.items[0].strikeThroughPrice}"`, 'info');

        // Создание товара в Slimrate
        const response = await fetch('https://dev.slimrate.com/v1/item-roots/create', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(slimrateBody)
        });
        
        const data = await response.json();
        
        if (response.ok && data.result) {
            addLogEntry(`Товар создан в Slimrate! ID: ${data.result.id}`, 'success');
            
            // Логирование ответа от Slimrate для отладки
            addLogEntry('=== ОТВЕТ ОТ SLIMRATE ===', 'info');
            if (data.result.items[0].hasOwnProperty('startQuantity')) {
                addLogEntry(`Простой товар из Slimrate: startQuantity="${data.result.items[0].startQuantity}" (тип: ${typeof data.result.items[0].startQuantity})`, 'info');
            } else {
                addLogEntry(`Slimrate не вернул startQuantity (поле отсутствует)`, 'info');
            }
            
            // Восстанавливаем цены если нужно
            data.result.items[0].price = data.result.items[0].price || originalFormData.price;
            data.result.items[0].strikeThroughPrice = data.result.items[0].strikeThroughPrice || originalFormData.strikeThroughPrice;
            
            // Создание товара в WooCommerce
            await createSimpleWooProduct(data.result, formData);
            
            // Успешное завершение
            document.getElementById('createItemResult').innerHTML = 
                '<div class="success-message">✅ Товар успешно создан в Slimrate и WooCommerce!</div>';
            
            addLogEntry('=== ТОВАР УСПЕШНО СОЗДАН ===', 'success');
            
            // Сброс формы
            form.reset();
            document.getElementById('productFormContainer').innerHTML = '';
            resetGalleryCounters();
            
        } else {
            throw new Error(data.message || 'Неизвестная ошибка при создании товара в Slimrate');
        }
        
    } catch (error) {
        addLogEntry(`ОШИБКА: ${error.message}`, 'error');
        document.getElementById('createItemResult').innerHTML = 
            `<div class="error-message">❌ Ошибка создания товара: ${error.message}</div>`;
    }
} 