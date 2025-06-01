import { AUTH_TOKEN, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_SITE } from '../core/config.js';
import { uploadImageToSlimrate, addLogEntry, getOrCreateWooCategory } from '../core/utils.js';
import { loadTemplate } from '../core/templateLoader.js';

export async function renderSimpleProductForm() {
    try {
        const template = await loadTemplate('simple-product-form');
        return template;
    } catch (error) {
        addLogEntry(`Ошибка загрузки шаблона простого товара: ${error.message}`, 'error');
        return '<div class="error-message">Ошибка загрузки формы простого товара</div>';
    }
}

export function initSimpleProductForm() {
    // Обработчик для checkbox управления складом
    const manageStockCheckbox = document.getElementById('simpleManageStock');
    if (manageStockCheckbox) {
        manageStockCheckbox.addEventListener('change', function() {
            const quantityGroup = document.getElementById('simpleStockQuantityGroup');
            const quantityInput = document.querySelector('input[name="simpleStartQuantity"]');
            
            if (this.checked) {
                quantityGroup.style.display = 'block';
                quantityInput.required = true;
                // Устанавливаем базовое значение 0 если поле пустое
                if (!quantityInput.value || quantityInput.value.trim() === '') {
                    quantityInput.value = '';
                }
            } else {
                quantityGroup.style.display = 'none';
                quantityInput.required = false;
                quantityInput.value = '';
            }
        });
    }
    
    // Дополнительная валидация при отправке формы
    const form = document.getElementById('createItemForm');
    if (form) {
        const submitHandler = function(e) {
            const manageStockCheckbox = document.getElementById('simpleManageStock');
            const quantityInput = document.querySelector('input[name="simpleStartQuantity"]');
            
            if (manageStockCheckbox && manageStockCheckbox.checked) {
                // Проверяем что значение корректное (число >= 0)
                const value = parseInt(quantityInput.value);
                if (isNaN(value) || value < 0) {
                    e.preventDefault();
                    alert('Количество товара должно быть числом больше или равно 0!');
                    quantityInput.focus();
                    return false;
                }
            }
        };
        
        // Удаляем старый обработчик если есть
        form.removeEventListener('submit', submitHandler);
        // Добавляем новый
        form.addEventListener('submit', submitHandler);
    }
}

export function collectSimpleProductData(formData) {
    addLogEntry('Обработка данных простого товара...', 'info');
  
    const simpleWooDescription = formData.get('simpleWooDescription') || '';
    const simpleWooShortDescription = formData.get('simpleWooShortDescription') || '';
    const price = formData.get('simplePrice') || '';
    const cost = formData.get('simpleCost') || '';
    const strikeThroughPrice = formData.get('simpleStrikeThroughPrice') || '';
    const skuCode = formData.get('simpleSkuCode') || '';
    const barcode = formData.get('simpleBarcode') || '';
    
    // Обработка управления складом
    const manageStock = formData.get('simpleManageStock') === 'on';
    let startQuantity = null;
    
    // Получаем startQuantity только если управление складом включено
    if (manageStock) {
        startQuantity = formData.get('simpleStartQuantity') || '';
    }

    // Сбор галереи изображений
    const galleryImages = [];
    let i = 1;
    while (formData.has(`simpleGalleryImage${i}`)) {
        const imageUrl = formData.get(`simpleGalleryImage${i}`);
        if (imageUrl && imageUrl.trim()) {
            galleryImages.push(imageUrl.trim());
        }
        i++;
    }

    // Логирование исходных данных
    addLogEntry(`Исходные данные: цена="${price}", зачеркнутая="${strikeThroughPrice}"`, 'info');
    addLogEntry(`Управление складом: ${manageStock ? 'включено' : 'отключено'}`, 'info');
    if (manageStock) {
        addLogEntry(`Количество на складе: "${startQuantity}"`, 'info');
    }
    addLogEntry(`Галерея изображений: ${galleryImages.length} шт.`, 'info');

    // Для Slimrate API: конвертируем пустые строки в null для числовых полей
    const processNumericField = (value) => {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        return value;
    };

    const result = {
        varName: '', // Для простого товара имя вариации пустое
        price: processNumericField(price), // null или строка для Slimrate API
        cost: processNumericField(cost), // null или строка для Slimrate API
        strikeThroughPrice: processNumericField(strikeThroughPrice), // null или строка для Slimrate API
        color: "ffebba3d",
        image: '', // Будет заполнено основным изображением
        barcode: barcode,
        skuCode: skuCode,
        toDelete: false,
        wooInfo: {
            name: '', // Будет заполнено основным названием
            description: simpleWooDescription,
            shortDescription: simpleWooShortDescription,
            pictures: galleryImages // Галерея изображений для WooCommerce
        }
    };
   

    // Добавляем startQuantity только если управление складом включено
    if (manageStock) {
        result.startQuantity = startQuantity; // Передаем как есть (строку)
        addLogEntry(`startQuantity будет передан: "${result.startQuantity}"`, 'info');
    } else {
        addLogEntry(`Управление складом отключено - startQuantity не передается`, 'info');
    }
    console.debug(result);
    return result;
}

export async function createSimpleWooProduct(slimrateProduct, formData) {
    addLogEntry('Создание простого товара в WooCommerce...', 'info');
    
    // Для простого товара данные находятся в items[0]
    const mainItem = slimrateProduct.items[0];

    const images = mainItem.image ? [{ src: mainItem.image }] : [];
    
    // Добавляем изображения из галереи (уже загруженные в Slimrate)
    if (mainItem.wooInfo && mainItem.wooInfo.pictures && mainItem.wooInfo.pictures.length > 0) {
        addLogEntry(`Добавление ${mainItem.wooInfo.pictures.length} изображений из галереи`, 'info');
        mainItem.wooInfo.pictures.forEach((imageUrl, index) => {
            if (imageUrl && imageUrl.trim() && imageUrl !== mainItem.image) {
                images.push({ src: imageUrl.trim() });
                addLogEntry(`Галерея ${index + 1}: ${imageUrl}`, 'info');
            }
        });
    }
    
    addLogEntry(`Всего изображений для WooCommerce: ${images.length}`, 'info');

    // Получение/создание категории
    let wooCategoryId = null;
    if (slimrateProduct.category && slimrateProduct.category.displayName) {
        wooCategoryId = await getOrCreateWooCategory(slimrateProduct.category.displayName);
    }

    // Получаем данные о складе из формы
    const manageStock = formData.get('simpleManageStock') === 'on';
    let stockQuantity = null;
    let stockStatus = 'instock';
    
    if (manageStock) {
        const startQuantityStr = formData.get('simpleStartQuantity') || '';
        addLogEntry(`Получено количество из формы: "${startQuantityStr}"`, 'info');
        
        // Проверяем, что значение является корректным числом
        const startQuantity = parseInt(startQuantityStr);
        const hasValidQuantity = !isNaN(startQuantity) && startQuantity >= 0;
        
        if (hasValidQuantity) {
            stockQuantity = startQuantity;
            stockStatus = stockQuantity > 0 ? 'instock' : 'outofstock';
            addLogEntry(`Управление складом включено: количество ${stockQuantity} шт., статус: ${stockStatus}`, 'info');
        } else {
            addLogEntry(`Ошибка: управление складом включено, но указано некорректное количество`, 'error');
            stockQuantity = 0;
            stockStatus = 'outofstock';
        }
    } else {
        addLogEntry('Управление складом отключено', 'info');
    }

    // Логика цен в WooCommerce:
    // Если есть зачеркнутая цена - она становится regular_price, а обычная цена - sale_price
    // Если нет зачеркнутой цены - обычная цена становится regular_price
    let regularPrice = '';
    let salePrice = '';
    
    if (mainItem.strikeThroughPrice && Number(mainItem.strikeThroughPrice) > 0) {
        regularPrice = String(mainItem.strikeThroughPrice);
        salePrice = mainItem.price ? String(mainItem.price) : '';
        addLogEntry(`Настройка цен: обычная цена ${regularPrice}, цена со скидкой ${salePrice}`, 'info');
    } else {
        regularPrice = mainItem.price ? String(mainItem.price) : '';
        addLogEntry(`Настройка цен: обычная цена ${regularPrice}`, 'info');
    }

    const body = {
        name: slimrateProduct.displayName,
        type: 'simple',
        description: (mainItem.wooInfo && mainItem.wooInfo.description) || slimrateProduct.description || '',
        short_description: (mainItem.wooInfo && mainItem.wooInfo.shortDescription) || '',
        images,
        regular_price: regularPrice,
        sale_price: salePrice,
        sku: mainItem.skuCode || '',
        manage_stock: manageStock,
        stock_quantity: stockQuantity,
        stock_status: stockStatus,
        meta_data: [
            { key: 'slimrate_id', value: slimrateProduct.id },
            ...(mainItem.barcode ? [{ key: '_wpm_gtin_code', value: mainItem.barcode }] : [])
        ],
        ...(wooCategoryId ? { categories: [{ id: wooCategoryId }] } : {})
    };

    if (manageStock) {
        addLogEntry(`Управление складом включено: количество ${stockQuantity} шт., статус: ${stockStatus}`, 'info');
    } else {
        addLogEntry(`Управление складом отключено`, 'warning');
    }

    // Логирование тела запроса для отладки
    addLogEntry(`Отправляемые данные в WooCommerce:`, 'info');
    addLogEntry(`manage_stock: ${body.manage_stock}`, 'info');
    addLogEntry(`stock_quantity: ${body.stock_quantity}`, 'info');
    addLogEntry(`stock_status: ${body.stock_status}`, 'info');

    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (response.ok) {
            addLogEntry(`Простой товар создан в WooCommerce! ID: ${data.id}`, 'success');
            addLogEntry(`Цены: обычная ${data.regular_price}, со скидкой ${data.sale_price}`, 'info');
            addLogEntry(`Управление складом в ответе: manage_stock=${data.manage_stock}, stock_quantity=${data.stock_quantity}, stock_status=${data.stock_status}`, 'info');
        } else {
            addLogEntry(`Ошибка создания товара в WooCommerce: ${data.message || 'Неизвестная ошибка'}`, 'error');
            console.log('WooCommerce error details:', data);
        }
    } catch (err) {
        addLogEntry(`Ошибка запроса к WooCommerce: ${err.message}`, 'error');
    }
} 