import { AUTH_TOKEN, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_SITE } from '../core/config.js';
import { uploadImageToSlimrate, addLogEntry, getOrCreateWooCategory } from '../core/utils.js';

const TEST_IMAGE_ID = 13262;

export function renderVariableProductForm() {
    return `
        <div class="product-form-section">
            <h3>Вариативный товар</h3>
            <div class="variations-header">
                <button type="button" id="addVariationBtn" class="btn-add-variation">
                    <span>+</span> Добавить вариацию
                </button>
                <div class="variations-info">
                    <small>Добавьте минимум одну вариацию товара</small>
                </div>
            </div>
            <div id="variationsList" class="variations-list"></div>
        </div>
    `;
}

export function setupVariationsLogic() {
    const list = document.getElementById('variationsList');
    const addBtn = document.getElementById('addVariationBtn');
    
    // Проверяем, есть ли уже вариации в списке
    const existingVariations = list.querySelectorAll('.variation-item');
    let count = existingVariations.length;

    function addVariation() {
        count++;
        const div = document.createElement('div');
        div.className = 'variation-item';
        div.setAttribute('data-variation-id', count);
        
        div.innerHTML = `
            <div class="variation-header">
                <h4>Вариация ${count}</h4>
                <button type="button" class="btn-remove-variation" title="Удалить вариацию">×</button>
            </div>
            <div class="variation-content">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Название вариации: <span class="required">*</span></label>
                        <input type="text" name="varName${count}" required placeholder="Например: Красный, Размер M">
                    </div>
                    <div class="form-group">
                        <label>Цена продажи: <span class="required">*</span></label>
                        <input type="number" name="price${count}" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Себестоимость:</label>
                        <input type="number" name="cost${count}" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Зачеркнутая цена:</label>
                        <input type="number" name="strikeThroughPrice${count}" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>SKU:</label>
                        <input type="text" name="skuCode${count}" placeholder="Артикул вариации">
                    </div>
                    <div class="form-group">
                        <label>Штрихкод:</label>
                        <input type="text" name="barcode${count}" placeholder="Штрихкод">
                    </div>
                    <div class="form-group">
                        <label>Количество:</label>
                        <input type="number" name="startQuantity${count}" min="0" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>URL изображения:</label>
                        <input type="url" name="image${count}" placeholder="https://example.com/image.jpg">
                    </div>
                </div>
                <div class="form-group full-width">
                    <label>Описание для WooCommerce:</label>
                    <textarea name="description${count}" rows="2" placeholder="Описание конкретно этой вариации"></textarea>
                </div>
                <div class="form-group full-width">
                    <label>Краткое описание для WooCommerce:</label>
                    <textarea name="shortDescription${count}" rows="1" placeholder="Краткое описание вариации"></textarea>
                </div>
                <div class="form-group full-width">
                    <label>Галерея изображений вариации:</label>
                    <div class="variation-gallery-container" id="variationGallery${count}">
                        <div class="gallery-item">
                            <input type="url" name="variationGallery${count}_1" placeholder="https://example.com/variation-gallery-1.jpg">
                            <button type="button" class="btn-remove-gallery" onclick="removeVariationGalleryItem(this)" style="display: none;">×</button>
                        </div>
                    </div>
                    <button type="button" class="btn-add-variation-gallery" onclick="addVariationGalleryItem(${count})">+ Добавить изображение</button>
                    <small class="gallery-help">Дополнительные изображения для этой вариации</small>
                </div>
            </div>
        `;
        
        list.appendChild(div);
        
        // Обработчик удаления вариации
        div.querySelector('.btn-remove-variation').onclick = () => {
            if (list.children.length > 1) {
                div.remove();
                updateVariationNumbers();
            } else {
                addLogEntry('Нельзя удалить последнюю вариацию. Для вариативного товара нужна минимум одна вариация.', 'warning');
            }
        };
        
        // Фокус на первое поле новой вариации
        div.querySelector(`input[name="varName${count}"]`).focus();
    }

    function updateVariationNumbers() {
        const variations = list.querySelectorAll('.variation-item');
        variations.forEach((variation, index) => {
            const header = variation.querySelector('.variation-header h4');
            header.textContent = `Вариация ${index + 1}`;
        });
    }

    if (addBtn) {
        addBtn.onclick = addVariation;
    }

    // Добавляем первую вариацию только если список пустой
    if (count === 0) {
        addVariation();
        addLogEntry('Добавлена первая вариация по умолчанию', 'info');
    } else {
        addLogEntry(`Найдено ${count} существующих вариаций`, 'info');
    }

    return { addVariation, updateVariationNumbers };
}

export async function collectVariableProductData(formData) {
    addLogEntry('Обработка данных вариативного товара...', 'info');
    
    const variations = [];
    let i = 1;
    
    while (formData.has(`varName${i}`)) {
        const varName = formData.get(`varName${i}`);
        if (varName) {
            addLogEntry(`Обработка вариации ${i}: ${varName}`, 'info');
            
            const price = formData.get(`price${i}`) || '';
            const cost = formData.get(`cost${i}`) || '';
            const strikeThroughPrice = formData.get(`strikeThroughPrice${i}`) || '';
            const startQuantity = formData.get(`startQuantity${i}`) || '';
            
            addLogEntry(`Данные вариации ${i}: цена="${price}", количество="${startQuantity}", типы: ${typeof price}, ${typeof startQuantity}`, 'info');
            
            // Сбор галереи изображений для вариации
            const variationGallery = [];
            let galleryIndex = 1;
            while (formData.has(`variationGallery${i}_${galleryIndex}`)) {
                const galleryImageUrl = formData.get(`variationGallery${i}_${galleryIndex}`);
                if (galleryImageUrl && galleryImageUrl.trim()) {
                    variationGallery.push(galleryImageUrl.trim());
                }
                galleryIndex++;
            }
            
            addLogEntry(`Галерея вариации ${i}: ${variationGallery.length} изображений`, 'info');
            
            // Загружаем изображения галереи вариации в Slimrate
            const uploadedVariationGallery = [];
            if (variationGallery.length > 0) {
                addLogEntry(`Загрузка ${variationGallery.length} изображений галереи вариации ${i} в Slimrate...`, 'info');
                
                for (const [galleryIdx, imageUrl] of variationGallery.entries()) {
                    addLogEntry(`Загрузка изображения галереи ${galleryIdx + 1}/${variationGallery.length} для вариации ${i}...`, 'info');
                    const uploadedUrl = await uploadImageToSlimrate(imageUrl);
                    if (uploadedUrl) {
                        uploadedVariationGallery.push(uploadedUrl);
                        addLogEntry(`Изображение галереи ${galleryIdx + 1} вариации ${i} загружено в Slimrate`, 'success');
                    } else {
                        addLogEntry(`Ошибка загрузки изображения галереи ${galleryIdx + 1} вариации ${i}`, 'error');
                        // Оставляем оригинальный URL если загрузка не удалась
                        uploadedVariationGallery.push(imageUrl);
                    }
                }
            }
            
            const varImageUrl = formData.get(`image${i}`);
            let slimrateVarImage = '';

            if (varImageUrl) {
                addLogEntry(`Загрузка изображения для вариации ${i}...`, 'info');
                slimrateVarImage = await uploadImageToSlimrate(varImageUrl);
                if (slimrateVarImage) {
                    addLogEntry(`Изображение вариации ${i} загружено в Slimrate`, 'success');
                } else {
                    addLogEntry(`Ошибка загрузки изображения вариации ${i}`, 'error');
                }
            }
            
            // Объединяем основное изображение вариации с загруженной галереей
            const allVariationImages = [];
            if (slimrateVarImage) {
                allVariationImages.push(slimrateVarImage);
            }
            allVariationImages.push(...uploadedVariationGallery);
            
            variations.push({
                varName: varName,
                price: price,
                cost: cost,
                strikeThroughPrice: strikeThroughPrice,
                color: "ffebba3d",
                image: slimrateVarImage,
                barcode: formData.get(`barcode${i}`) || '',
                skuCode: formData.get(`skuCode${i}`) || '',
                startQuantity: startQuantity,
                toDelete: false,
                wooInfo: {
                    name: varName,
                    description: formData.get(`description${i}`) || '',
                    shortDescription: formData.get(`shortDescription${i}`) || '',
                    pictures: allVariationImages // Основное изображение + галерея
                }
            });
            
            addLogEntry(`Вариация ${i} подготовлена. Название: ${varName}, Цена: ${price}`, 'success');
        }
        i++;
    }
    
    if (variations.length === 0) {
        addLogEntry('Не найдено ни одной вариации для вариативного товара!', 'error');
        throw new Error('Для вариативного товара необходимо добавить минимум одну вариацию');
    }
    
    addLogEntry(`Всего обработано вариаций: ${variations.length}`, 'info');
    return variations;
}

export async function createVariableWooProduct(slimrateProduct) {
    addLogEntry('Создание вариативного товара в WooCommerce...', 'info');
    
    if (!slimrateProduct.items || slimrateProduct.items.length === 0) {
        addLogEntry('Ошибка: нет вариаций для создания в WooCommerce', 'error');
        return;
    }

    const mainItem = slimrateProduct.items[0];
    const images = mainItem.image ? [{ src: mainItem.image }] : [];
    
    // Добавляем изображения из галереи основного товара (уже загруженные в Slimrate)
    if (mainItem.wooInfo && mainItem.wooInfo.pictures && mainItem.wooInfo.pictures.length > 0) {
        addLogEntry(`Добавление ${mainItem.wooInfo.pictures.length} изображений из галереи основного товара`, 'info');
        mainItem.wooInfo.pictures.forEach((imageUrl, index) => {
            if (imageUrl && imageUrl.trim() && imageUrl !== mainItem.image) {
                images.push({ src: imageUrl.trim() });
                addLogEntry(`Галерея основного товара ${index + 1}: ${imageUrl}`, 'info');
            }
        });
    }
    
    addLogEntry(`Всего изображений для основного вариативного товара: ${images.length}`, 'info');
    
    // Собираем уникальные названия вариаций для атрибутов
    const varNames = slimrateProduct.items.map(item => item.varName || '').filter(Boolean);
    const uniqueVarNames = Array.from(new Set(varNames));
    
    const attributes = [{
        name: 'Variation Name',
        visible: true,
        variation: true,
        options: uniqueVarNames
    }];

    // Получение/создание категории
    let wooCategoryId = null;
    if (slimrateProduct.category && slimrateProduct.category.displayName) {
        wooCategoryId = await getOrCreateWooCategory(slimrateProduct.category.displayName);
    }

    const body = {
        name: slimrateProduct.displayName,
        type: 'variable',
        description: slimrateProduct.description || '',
        images,
        attributes,
        meta_data: [
            { key: 'slimrate_id', value: slimrateProduct.id }
        ],
        ...(wooCategoryId ? { categories: [{ id: wooCategoryId }] } : {})
    };

    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);

    try {
        // 1. Создаём основной вариативный товар
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            addLogEntry(`Ошибка создания вариативного товара в WooCommerce: ${data.message || 'Неизвестная ошибка'}`, 'error');
            return;
        }

        addLogEntry(`Вариативный товар создан в WooCommerce! ID: ${data.id}`, 'success');
        const productId = data.id;

        // 2. Создаём вариации
        addLogEntry(`Создание ${slimrateProduct.items.length} вариаций...`, 'info');
        
        for (const [index, item] of slimrateProduct.items.entries()) {
            addLogEntry(`Отладка количества вариации ${index + 1}: значение="${item.startQuantity}", тип=${typeof item.startQuantity}`, 'info');
            
            const hasQuantityField = item.startQuantity !== null && 
                                   item.startQuantity !== undefined &&
                                   item.startQuantity !== '' && 
                                   item.startQuantity.toString().trim() !== '' &&
                                   !isNaN(Number(item.startQuantity));

            const quantityValue = hasQuantityField ? Number(item.startQuantity) : null;
            
            if (!hasQuantityField) {
                addLogEntry(`Причина отклонения количества вариации ${index + 1}: null=${item.startQuantity === null}, undefined=${item.startQuantity === undefined}, empty="${item.startQuantity === ''}", isNaN=${isNaN(Number(item.startQuantity))}`, 'warning');
            }

            // Логика цен для вариации
            let regularPrice = '';
            let salePrice = '';
            
            if (item.strikeThroughPrice && Number(item.strikeThroughPrice) > 0) {
                regularPrice = String(item.strikeThroughPrice);
                salePrice = item.price ? String(item.price) : '';
            } else {
                regularPrice = item.price ? String(item.price) : '';
            }

            // Подготовка изображений для вариации
            const variationImages = [];
            if (item.image) {
                variationImages.push({ src: item.image });
            }
            
            // Добавляем изображения из галереи вариации (уже загруженные в Slimrate)
            if (item.wooInfo && item.wooInfo.pictures && item.wooInfo.pictures.length > 0) {
                addLogEntry(`Добавление ${item.wooInfo.pictures.length} изображений из галереи вариации '${item.varName}'`, 'info');
                item.wooInfo.pictures.forEach((imageUrl, imgIndex) => {
                    if (imageUrl && imageUrl.trim() && imageUrl !== item.image) {
                        variationImages.push({ src: imageUrl.trim() });
                        addLogEntry(`Галерея вариации '${item.varName}' ${imgIndex + 1}: ${imageUrl}`, 'info');
                    }
                });
            }

            const variationBody = {
                regular_price: regularPrice,
                sale_price: salePrice,
                sku: item.skuCode || '',
                manage_stock: hasQuantityField,
                stock_quantity: quantityValue,
                stock_status: hasQuantityField ? (quantityValue > 0 ? 'instock' : 'outofstock') : 'instock',
                description: (item.wooInfo && item.wooInfo.description) || '',
                short_description: (item.wooInfo && item.wooInfo.shortDescription) || '',
                images: variationImages, // Изображения вариации включая галерею
                meta_data: [
                    { key: 'slimrate_id', value: item.id },
                    ...(item.barcode ? [{ key: '_wpm_gtin_code', value: item.barcode }] : [])
                ],
                attributes: [{ name: 'Variation Name', option: item.varName || '' }]
            };

            addLogEntry(`Создание вариации '${item.varName}' (${index + 1}/${slimrateProduct.items.length})...`, 'info');
            addLogEntry(`Изображений для вариации '${item.varName}': ${variationImages.length}`, 'info');
            if (regularPrice && salePrice) {
                addLogEntry(`Цены вариации: обычная ${regularPrice}, со скидкой ${salePrice}`, 'info');
            } else if (regularPrice) {
                addLogEntry(`Цена вариации: ${regularPrice}`, 'info');
            }
            if (hasQuantityField) {
                addLogEntry(`Количество вариации: ${quantityValue}`, 'info');
            }
            
            const varUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${productId}/variations`;
            
            const varResp = await fetch(varUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify(variationBody)
            });

            const varData = await varResp.json();
            
            if (varResp.ok) {
                addLogEntry(`Вариация '${item.varName}' создана! ID: ${varData.id}`, 'success');
            } else {
                addLogEntry(`Ошибка создания вариации '${item.varName}': ${varData.message || 'Неизвестная ошибка'}`, 'error');
            }
        }
        
        addLogEntry('Создание вариативного товара завершено!', 'success');
        
    } catch (err) {
        addLogEntry(`Ошибка запроса к WooCommerce: ${err.message}`, 'error');
    }
} 