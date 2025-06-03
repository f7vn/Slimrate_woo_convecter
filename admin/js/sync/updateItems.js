import { AUTH_TOKEN, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_SITE } from '../core/config.js';
import { addLogEntry } from '../core/utils.js';

// Вспомогательная функция для логирования измененных полей
function getChangedFieldsLog(oldValues, newValues, fieldsToCompare) {
    const changes = [];
    fieldsToCompare.forEach(fieldKey => {
        const oldValue = oldValues[fieldKey];
        const newValue = newValues[fieldKey];

        // Приводим к строке для сравнения, обрабатываем undefined/null как "N/A"
        const oldStr = (oldValue === undefined || oldValue === null) ? "N/A" : String(oldValue);
        const newStr = (newValue === undefined || newValue === null) ? "N/A" : String(newValue);

        if (fieldKey === 'meta_data') {
            // Особая обработка для meta_data, интересует _wpm_gtin_code
            const oldGtinEntry = Array.isArray(oldValue) ? oldValue.find(m => m.key === '_wpm_gtin_code') : undefined;
            const newGtinEntry = Array.isArray(newValue) ? newValue.find(m => m.key === '_wpm_gtin_code') : undefined;
            const oldGtin = oldGtinEntry && oldGtinEntry.value !== undefined ? String(oldGtinEntry.value) : "N/A";
            const newGtin = newGtinEntry && newGtinEntry.value !== undefined ? String(newGtinEntry.value) : "N/A";
            if (oldGtin !== newGtin) {
                changes.push(`_wpm_gtin_code (старое: '${oldGtin}', новое: '${newGtin}')`);
            }
            // Можно добавить сравнение других meta-полей если это станет необходимо
        } else if (fieldKey === 'images') {
            // Особая обработка для изображений
            const oldImagesCount = Array.isArray(oldValue) ? oldValue.length : 0;
            const newImagesCount = Array.isArray(newValue) ? newValue.length : 0;
            
            if (oldImagesCount !== newImagesCount) {
                changes.push(`images (было: ${oldImagesCount}, стало: ${newImagesCount} изображений)`);
            } else if (Array.isArray(newValue) && newValue.length > 0) {
                // Проверяем изменения в URL изображений
                const oldUrls = Array.isArray(oldValue) ? oldValue.map(img => img.src || img).join(';') : '';
                const newUrls = newValue.map(img => img.src || img).join(';');
                if (oldUrls !== newUrls) {
                    changes.push(`images (изображения изменены)`);
                }
            }
        } else if (typeof oldValue === 'object' && oldValue !== null && typeof newValue === 'object' && newValue !== null) {
            // Для других потенциальных объектов - простое сравнение через JSON.stringify
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push(`${fieldKey} (старое: '${JSON.stringify(oldValue)}', новое: '${JSON.stringify(newValue)}')`);
            }
        } else {
            // Для примитивных типов
            if (oldStr !== newStr) {
                changes.push(`${fieldKey} (старое: '${oldStr}', новое: '${newStr}')`);
            }
        }
    });
    return changes.length > 0 ? `Изменены поля: ${changes.join('; ')}` : 'Значимых изменений для отслеживаемых полей не обнаружено.';
}

// Функция для логирования
function addUpdateLog(message, type = 'info') {
    addLogEntry(message, type, 'system');
}

// Конфигурация поиска товаров (глобально доступная)
window.SEARCH_CONFIG = {
    enableProductLinking: true,  // Включить автопривязку
    enableProductCreation: true, // Включить автосоздание товаров
    enableImageSync: true,       // Включить синхронизацию изображений
    matchingStrategy: 'auto'     // auto, sku_priority, slimrate_id_only, aggressive
};

// Функция для обновления конфигурации извне
export function updateSearchConfig(newConfig) {
    window.SEARCH_CONFIG = { ...window.SEARCH_CONFIG, ...newConfig };
    addUpdateLog(`Конфигурация поиска обновлена: ${JSON.stringify(window.SEARCH_CONFIG)}`, 'info');
}

// Улучшенная функция поиска товара с множественными критериями
async function findWooProductBySlimrateId(slimrateId) {
    const baseUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    // 1. Сначала ищем по slimrate_id (самый надежный способ)
    const searchUrl = `${baseUrl}?meta_key=slimrate_id&meta_value=${encodeURIComponent(slimrateId)}`;
    addUpdateLog(`Поиск товара по Slimrate ID: ${slimrateId}`, 'debug');
    
    const resp = await fetch(searchUrl, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const data = await resp.json();
    
    if (Array.isArray(data) && data.length > 0) {
        // Фильтруем на клиенте для точности
        const filtered = data.filter(product => {
            const meta = product.meta_data || [];
            return meta.some(m => m.key === 'slimrate_id' && String(m.value) === String(slimrateId));
        });
        
        if (filtered.length > 0) {
            const foundProduct = filtered[0];
            addUpdateLog(`✅ Найден товар по Slimrate ID: ${foundProduct.id} - "${foundProduct.name}"`, 'success');
            return foundProduct;
        }
    }
    
    addUpdateLog(`Товар с Slimrate ID ${slimrateId} не найден`, 'info');
    return null;
}

// Новая функция для поиска товаров с множественными критериями
async function findWooProductByMultipleCriteria(slimrateItem) {
    if (!window.SEARCH_CONFIG.enableProductLinking || window.SEARCH_CONFIG.matchingStrategy === 'slimrate_id_only') {
        return null;
    }
    
    const baseUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    addUpdateLog(`🔍 Начинаем расширенный поиск товара (стратегия: ${window.SEARCH_CONFIG.matchingStrategy})`, 'info');
    
    // 2. Поиск по SKU (если доступен)
    if (['sku_priority', 'auto', 'aggressive'].includes(window.SEARCH_CONFIG.matchingStrategy) && slimrateItem.skuCode) {
        addUpdateLog(`Поиск по SKU: ${slimrateItem.skuCode}`, 'debug');
        
        const skuSearchUrl = `${baseUrl}?sku=${encodeURIComponent(slimrateItem.skuCode)}`;
        const skuResp = await fetch(skuSearchUrl, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const skuData = await skuResp.json();
        
        if (Array.isArray(skuData) && skuData.length > 0) {
            // Проверяем, что товар еще не привязан к другому Slimrate ID
            const unlinkedProduct = skuData.find(product => {
                const meta = product.meta_data || [];
                return !meta.some(m => m.key === 'slimrate_id' && m.value);
            });
            
            if (unlinkedProduct) {
                addUpdateLog(`✅ Найден товар по SKU: ${unlinkedProduct.id} - "${unlinkedProduct.name}"`, 'success');
                return unlinkedProduct;
            }
        }
    }
    
    // 3. Поиск по названию (для auto и aggressive)
    if (['auto', 'aggressive'].includes(window.SEARCH_CONFIG.matchingStrategy)) {
        const productName = getSlimrateProductName(slimrateItem);
        
        if (productName && productName !== 'Товар без названия') {
            addUpdateLog(`Поиск по названию: "${productName}"`, 'debug');
            
            const nameSearchUrl = `${baseUrl}?search=${encodeURIComponent(productName)}&per_page=20`;
            const nameResp = await fetch(nameSearchUrl, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            const nameData = await nameResp.json();
            
            if (Array.isArray(nameData) && nameData.length > 0) {
                // Ищем точное совпадение названия среди непривязанных товаров
                const exactMatch = nameData.find(product => {
                    const meta = product.meta_data || [];
                    const isUnlinked = !meta.some(m => m.key === 'slimrate_id' && m.value);
                    const nameMatch = product.name.toLowerCase() === productName.toLowerCase();
                    return isUnlinked && nameMatch;
                });
                
                if (exactMatch) {
                    addUpdateLog(`✅ Найден товар по точному названию: ${exactMatch.id} - "${exactMatch.name}"`, 'success');
                    return exactMatch;
                }
            }
        }
    }
    
    // 4. Поиск по названию + категории (только для aggressive)
    if (window.SEARCH_CONFIG.matchingStrategy === 'aggressive' && slimrateItem.category?.displayName) {
        const productName = getSlimrateProductName(slimrateItem);
        const categoryName = slimrateItem.category.displayName;
        
        addUpdateLog(`Агрессивный поиск по названию + категории: "${productName}" в "${categoryName}"`, 'debug');
        
        // Сначала найдем категорию
        const category = await findWooCategoryByName(categoryName);
        if (category) {
            const categorySearchUrl = `${baseUrl}?category=${category.id}&search=${encodeURIComponent(productName)}&per_page=10`;
            const categoryResp = await fetch(categorySearchUrl, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            const categoryData = await categoryResp.json();
            
            if (Array.isArray(categoryData) && categoryData.length > 0) {
                const categoryMatch = categoryData.find(product => {
                    const meta = product.meta_data || [];
                    return !meta.some(m => m.key === 'slimrate_id' && m.value);
                });
                
                if (categoryMatch) {
                    addUpdateLog(`✅ Найден товар по названию + категории: ${categoryMatch.id} - "${categoryMatch.name}"`, 'success');
                    return categoryMatch;
                }
            }
        }
    }
    
    addUpdateLog(`❌ Товар не найден по расширенным критериям`, 'warning');
    return null;
}

// Вспомогательная функция для получения названия товара из Slimrate
function getSlimrateProductName(item) {
    if (item.rootName) return item.rootName;
    if (item.wooInfo?.name) return item.wooInfo.name;
    if (item.displayName) return item.displayName;
    return 'Товар без названия';
}

// Функция для установки slimrate_id у найденного товара
async function linkProductToSlimrate(wooProductId, slimrateId) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${wooProductId}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    const updateData = {
        meta_data: [
            {
                key: 'slimrate_id',
                value: slimrateId
            }
        ]
    };
    
    const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(updateData)
    });
    
    const result = await resp.json();
    if (result.id) {
        addUpdateLog(`🔗 Товар WooCommerce ID ${wooProductId} привязан к Slimrate ID ${slimrateId}`, 'success');
        return true;
    } else {
        addUpdateLog(`❌ Ошибка привязки товара: ${JSON.stringify(result)}`, 'error');
        return false;
    }
}

async function updateWooProduct(wooProductId, updateData) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${wooProductId}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(updateData)
    });
    return await resp.json();
}

async function getWooProductVariations(productId) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    return await resp.json();
}

async function updateWooVariation(productId, variationId, updateData) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${productId}/variations/${variationId}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(updateData)
    });
    return await resp.json();
}

// Функция для удаления товара в WooCommerce
async function deleteWooProduct(wooProductId) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${wooProductId}?force=true`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Basic ${auth}`
        }
    });
    return await resp.json();
}

// Функция для поиска категории в WooCommerce по названию
async function findWooCategoryByName(categoryName) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoryName)}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const data = await resp.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

// Функция для создания категории в WooCommerce
async function createWooCategory(categoryName) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/categories`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        })
    });
    return await resp.json();
}

// Функция обновления категории товара
async function updateProductCategory(slimrateCategory, productUpdateData, wooProductId) {
    const categoryName = slimrateCategory.displayName;
    
    // Сначала ищем категорию в WooCommerce
    addUpdateLog(`Поиск категории "${categoryName}" в WooCommerce...`, 'info');
    let wooCategory = await findWooCategoryByName(categoryName);
    
    if (!wooCategory) {
        // Если категория не найдена, создаем её
        addUpdateLog(`Категория "${categoryName}" не найдена, создаём новую...`, 'info');
        wooCategory = await createWooCategory(categoryName);
        
        if (wooCategory && wooCategory.id) {
            addUpdateLog(`Категория "${categoryName}" создана с ID: ${wooCategory.id}`, 'success');
        } else {
            addUpdateLog(`Ошибка создания категории "${categoryName}": ${JSON.stringify(wooCategory)}`, 'error');
            return;
        }
    } else {
        addUpdateLog(`Категория "${categoryName}" найдена с ID: ${wooCategory.id}`, 'success');
    }
    
    // Добавляем категорию к данным для обновления товара
    if (wooCategory && wooCategory.id) {
        productUpdateData.categories = [{ id: wooCategory.id }];
        addUpdateLog(`Товар будет обновлён с категорией: "${categoryName}" (ID: ${wooCategory.id})`, 'info');
    }
}

// Функция для очистки пустых полей из объекта перед отправкой в WooCommerce
function cleanEmptyFields(obj) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(obj)) {
        // Исключаем null, undefined, пустые строки и пустые массивы
        if (value !== null && value !== undefined && value !== '' && 
            !(Array.isArray(value) && value.length === 0)) {
            cleaned[key] = value;
        }
    }
    
    return cleaned;
}

// Функция для создания нового товара в WooCommerce
async function createWooProduct(item) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    // Определяем правильное название товара
    let productName = 'Новый товар';
    if (item.rootName) {
        productName = item.rootName;
    } else if (item.wooInfo && item.wooInfo.name) {
        productName = item.wooInfo.name;
    } else if (item.displayName) {
        productName = item.displayName;
    }
    
    // Базовые данные товара
    const productData = {
        name: productName,
        type: 'simple',
        status: 'publish',
        catalog_visibility: 'visible',
        sku: item.skuCode || '',
        meta_data: [
            {
                key: 'slimrate_id',
                value: (item.varName === "" || !item.varName) ? item.rootId : item.id
            }
        ]
    };
    
    // Управление складом: по умолчанию отключено, но учитываем если пользователь указал количество
    const itemData = item.items && item.items[0] ? item.items[0] : item; // Для совместимости с разными структурами
    const startQuantity = itemData.startQuantity;
    
    if (startQuantity !== undefined && startQuantity !== null && startQuantity !== "" && Number(startQuantity) >= 0) {
        // Пользователь указал количество в Slimrate - включаем управление складом
        const quantityNum = Number(startQuantity);
        productData.manage_stock = true;
        productData.stock_quantity = quantityNum;
        productData.stock_status = quantityNum > 0 ? 'instock' : 'outofstock';
        addUpdateLog(`Пользователь указал количество ${quantityNum} - включаем управление складом`, 'info');
    } else {
        // Количество не указано - отключаем управление складом, товар всегда доступен
        productData.manage_stock = false;
        productData.stock_status = 'instock';
        addUpdateLog(`Количество не указано - управление складом отключено, товар всегда доступен`, 'info');
    }
    
    // Устанавливаем цены - поддерживаем строковые значения с десятичными дробями
    let hasPrices = false;
    const priceValue = parseFloat(item.price);
    const strikePriceValue = parseFloat(item.strikeThroughPrice);
    
    if (item.strikeThroughPrice && strikePriceValue > 0 && item.price && priceValue > 0) {
        // Есть и обычная цена и цена распродажи
        productData.regular_price = String(item.strikeThroughPrice);
        productData.sale_price = String(item.price);
        addUpdateLog(`Устанавливаем цены: обычная=${item.strikeThroughPrice}, распродажа=${item.price}`, 'info');
        hasPrices = true;
    } else if (item.price && priceValue > 0) {
        // Только обычная цена
        productData.regular_price = String(item.price);
        // НЕ устанавливаем sale_price вообще, чтобы не ломать запрос
        addUpdateLog(`Устанавливаем обычную цену: ${item.price}`, 'info');
        hasPrices = true;
    }
    
    if (!hasPrices) {
        addUpdateLog(`Цены не указаны в Slimrate, товар будет создан без цен`, 'warning');
    }
    
    // Добавляем описания если есть
    if (item.wooInfo) {
        if (item.wooInfo.description) {
            productData.description = item.wooInfo.description;
        }
        if (item.wooInfo.shortDescription) {
            productData.short_description = item.wooInfo.shortDescription;
        }
    }
    
    // Обрабатываем изображения
    const images = processSlimrateImages(item);
    if (window.SEARCH_CONFIG.enableImageSync && images.length > 0) {
        productData.images = images;
        addUpdateLog(`Добавляем ${images.length} изображений к товару`, 'info');
    } else if (!window.SEARCH_CONFIG.enableImageSync) {
        addUpdateLog(`Синхронизация изображений отключена в настройках`, 'info');
    }
    
    // Обрабатываем категорию
    if (item.category && item.category.displayName) {
        const categoryName = item.category.displayName;
        let wooCategory = await findWooCategoryByName(categoryName);
        
        if (!wooCategory) {
            addUpdateLog(`Создаём новую категорию: "${categoryName}"`, 'info');
            wooCategory = await createWooCategory(categoryName);
        }
        
        if (wooCategory && wooCategory.id) {
            productData.categories = [{ id: wooCategory.id }];
            addUpdateLog(`Товар будет создан с категорией: "${categoryName}" (ID: ${wooCategory.id})`, 'info');
        }
    }
    
    addUpdateLog(`Создание нового товара в WooCommerce: "${productName}"`, 'info');
    addUpdateLog(`Данные для создания: ${JSON.stringify(productData, null, 2)}`, 'debug');
    
    // Очищаем пустые поля перед отправкой
    const cleanedProductData = cleanEmptyFields(productData);
    addUpdateLog(`Очищенные данные для отправки: ${JSON.stringify(cleanedProductData, null, 2)}`, 'debug');
    
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(cleanedProductData)
    });
    
    const result = await resp.json();
    
    if (result.id) {
        addUpdateLog(`✅ Товар успешно создан в WooCommerce: ID ${result.id} - "${result.name}"`, 'success');
        addUpdateLog(`🔗 Товар автоматически привязан к Slimrate ID: ${productData.meta_data[0].value}`, 'success');
        return result;
    } else {
        addUpdateLog(`❌ Ошибка создания товара: ${result.message || JSON.stringify(result)}`, 'error');
        return null;
    }
}

// Функция обработки товара
async function processProduct(item) {
    const searchId = (item.varName === "" || !item.varName) ? item.rootId : item.id;
    
    addUpdateLog(`=== ОБРАБОТКА ТОВАРА ${item.id} ===`, 'info');
    addUpdateLog(`Простой товар (varName пустое): ищем по rootId="${item.rootId}" вместо id="${item.id}"`, 'info');
    
    // Сначала ищем по slimrate_id (основной способ)
    addUpdateLog(`Ищем товар в Woo по slimrate_id: ${searchId}`);
    let wooProduct = await findWooProductBySlimrateId(searchId);
    
    if (!wooProduct) {
        // Если не найден по slimrate_id, пробуем поиск по множественным критериям
        addUpdateLog(`Товар не найден по Slimrate ID, запускаем расширенный поиск...`);
        wooProduct = await findWooProductByMultipleCriteria(item);
        
        if (wooProduct) {
            // Если нашли по альтернативным критериям, привязываем к Slimrate
            addUpdateLog(`Товар найден по альтернативным критериям, привязываем к Slimrate ID: ${searchId}`);
            const linked = await linkProductToSlimrate(wooProduct.id, searchId);
            if (!linked) {
                addUpdateLog(`Не удалось привязать товар, пропускаем обновление`, 'error');
                return;
            }
        }
    }

    if (wooProduct) {
        addUpdateLog(`WooCommerce product найден: id=${wooProduct.id}, name='${wooProduct.name}', type=${wooProduct.type}`, 'success');

        // Определяем тип товара для логирования
        if (wooProduct.type === 'simple') {
            addUpdateLog(`=== ОБРАБОТКА ПРОСТОГО ТОВАРА ===`, 'info');
        } else if (wooProduct.type === 'variable') {
            addUpdateLog(`=== ОБРАБОТКА ВАРИАТИВНОГО ТОВАРА ===`, 'info');
        }

        // Обновляем базовые данные товара
        let productUpdateData = {};
        
        // Определяем правильное название товара из разных источников
        let productName = wooProduct.name; // По умолчанию текущее название
        addUpdateLog(`Текущее название в WooCommerce: "${wooProduct.name}"`, 'debug');
        addUpdateLog(`Доступные варианты названия - rootName: "${item.rootName || 'отсутствует'}", wooInfo.name: "${(item.wooInfo && item.wooInfo.name) || 'отсутствует'}", displayName: "${item.displayName || 'отсутствует'}"`, 'debug');
        
        if (item.rootName) {
            productName = item.rootName;
            addUpdateLog(`Используем название из rootName: "${productName}"`, 'info');
        }
        else if (item.wooInfo && item.wooInfo.name) {
            productName = item.wooInfo.name;
            addUpdateLog(`Используем название из wooInfo.name: "${productName}"`, 'info');
        } else if (item.displayName) {
            productName = item.displayName;
            addUpdateLog(`Используем название из displayName: "${productName}"`, 'info');
        } else {
            addUpdateLog(`Оставляем текущее название из WooCommerce: "${productName}"`, 'info');
        }
        
        productUpdateData.name = productName;
        addUpdateLog(`Финальное название для обновления: "${productUpdateData.name}"`, 'info');
        
        // Обновляем категорию если есть данные
        if (item.category && item.category.id) {
            addUpdateLog(`Обновление категории: Slimrate category="${item.category.displayName}" (id: ${item.category.id})`, 'info');
            // Найдем соответствующую категорию в WooCommerce
            await updateProductCategory(item.category, productUpdateData, wooProduct.id);
        }
        
        if (wooProduct.type === 'simple') {
           // Для простых товаров из API /items/read/tablet данные находятся в корне объекта
           // (в отличие от товаров из /item-roots/read где данные в item.items[0])
           const simpleItem = item; // Используем корень объекта
           
           addUpdateLog(`Обновление простого товара: используем данные из корня объекта (API /items/read/tablet)`, 'info');
           
           // Улучшенная логика цен для простых товаров - поддерживаем строковые значения с десятичными дробями
           let hasPriceUpdates = false;
           const priceValue = parseFloat(simpleItem.price);
           const strikePriceValue = parseFloat(simpleItem.strikeThroughPrice);
           
           if (simpleItem.strikeThroughPrice && strikePriceValue > 0 && simpleItem.price && priceValue > 0) {
               // Если есть зачеркнутая цена, то это обычная цена, а price - цена распродажи
               productUpdateData.regular_price = String(simpleItem.strikeThroughPrice);
               productUpdateData.sale_price = String(simpleItem.price);
               addUpdateLog(`Обновляем цены: обычная=${simpleItem.strikeThroughPrice}, распродажа=${simpleItem.price}`, 'info');
               hasPriceUpdates = true;
           } else if (simpleItem.price && priceValue > 0) {
               // Если только обычная цена
               productUpdateData.regular_price = String(simpleItem.price);
               // НЕ устанавливаем sale_price вообще, чтобы не ломать запрос
               addUpdateLog(`Обновляем только обычную цену: ${simpleItem.price}`, 'info');
               hasPriceUpdates = true;
           }
           
           if (!hasPriceUpdates) {
               addUpdateLog(`Цены не указаны в Slimrate, поля цен исключены из запроса`, 'info');
           }
           
           // Обновляем SKU
           productUpdateData.sku = simpleItem.skuCode || wooProduct.sku;
           
           // Управление складом: по умолчанию отключено, но учитываем если пользователь указал количество
           const startQuantity = simpleItem.startQuantity;
           
           if (startQuantity !== undefined && startQuantity !== null && startQuantity !== "" && Number(startQuantity) >= 0) {
               // Пользователь указал количество в Slimrate - включаем управление складом
               const quantityNum = Number(startQuantity);
               productUpdateData.manage_stock = true;
               productUpdateData.stock_quantity = quantityNum;
               productUpdateData.stock_status = quantityNum > 0 ? 'instock' : 'outofstock';
               addUpdateLog(`Пользователь указал количество ${quantityNum} - включаем управление складом`, 'info');
           } else {
               // Количество не указано - отключаем управление складом, товар всегда доступен
               productUpdateData.manage_stock = false;
               productUpdateData.stock_status = 'instock';
               addUpdateLog(`Количество не указано - управление складом отключено, товар всегда доступен`, 'info');
           }
           
           // Обновляем описания из wooInfo если есть
           if (simpleItem.wooInfo) {
               if (simpleItem.wooInfo.description !== undefined) {
                   productUpdateData.description = simpleItem.wooInfo.description;
               }
               if (simpleItem.wooInfo.shortDescription !== undefined) {
                   productUpdateData.short_description = simpleItem.wooInfo.shortDescription;
               }
           }
           
           addUpdateLog(`Обновление простого товара - цены: regular=${productUpdateData.regular_price}, sale=${productUpdateData.sale_price}, управление складом: ${productUpdateData.manage_stock ? `включено (${productUpdateData.stock_quantity})` : 'отключено'}, SKU: ${productUpdateData.sku}`, 'info');
        }

        // Обрабатываем изображения для всех типов товаров
        if (window.SEARCH_CONFIG.enableImageSync) {
            const images = processSlimrateImages(item);
            if (images.length > 0) {
                productUpdateData.images = images;
                addUpdateLog(`Обновляем изображения товара: ${images.length} изображений`, 'info');
            } else {
                addUpdateLog(`Изображения в Slimrate не найдены, оставляем текущие изображения WooCommerce`, 'info');
            }
        } else {
            addUpdateLog(`Синхронизация изображений отключена в настройках`, 'info');
        }

        // Логирование и обновление товара
        const fieldsToLogForProduct = ['name', 'sku', 'categories', 'images', 'manage_stock', 'stock_status'];
        
        // Добавляем поля цен только если они присутствуют в данных для обновления
        if (productUpdateData.hasOwnProperty('regular_price')) {
            fieldsToLogForProduct.push('regular_price');
        }
        if (productUpdateData.hasOwnProperty('sale_price')) {
            fieldsToLogForProduct.push('sale_price');
        }
        
        // Добавляем поле количества только если управление складом включено
        if (productUpdateData.hasOwnProperty('stock_quantity')) {
            fieldsToLogForProduct.push('stock_quantity');
        }
        
        // Специальное логирование для названия
        addUpdateLog(`Сравнение названий: старое="${wooProduct.name}" vs новое="${productUpdateData.name}" (равны: ${wooProduct.name === productUpdateData.name})`, 'info');
        
        const changesLogProduct = getChangedFieldsLog(wooProduct, productUpdateData, fieldsToLogForProduct);
        addUpdateLog(`Подготовка к обновлению товара Woo id=${wooProduct.id} (Slimrate id=${searchId}). ${changesLogProduct}`, 'info');

        // Логирование полных данных для отправки
        addUpdateLog(`Полные данные для обновления товара: ${JSON.stringify(productUpdateData, null, 2)}`, 'debug');

        // Очищаем пустые поля перед отправкой
        const cleanedUpdateData = cleanEmptyFields(productUpdateData);
        addUpdateLog(`Очищенные данные для отправки: ${JSON.stringify(cleanedUpdateData, null, 2)}`, 'debug');

        const updateResult = await updateWooProduct(wooProduct.id, cleanedUpdateData);
        
        if (updateResult && !updateResult.code) {
            addUpdateLog(`Товар WooCommerce обновлён: id=${wooProduct.id} (Slimrate id=${searchId})`, 'success');
        } else {
            addUpdateLog(`Ошибка обновления товара Woo id=${wooProduct.id} (Slimrate id=${searchId}): ${updateResult.message || JSON.stringify(updateResult)}`, 'error');
        }

    } else {
        // Товар не найден - проверяем настройки создания
        if (window.SEARCH_CONFIG.enableProductCreation) {
            addUpdateLog(`🆕 Товар с slimrate_id=${searchId} не найден в WooCommerce - создаём новый товар`, 'info');
            
            const newProduct = await createWooProduct(item);
            
            if (newProduct) {
                addUpdateLog(`✅ Товар успешно создан и синхронизирован: WC ID ${newProduct.id} ↔ Slimrate ID ${searchId}`, 'success');
            } else {
                addUpdateLog(`❌ Не удалось создать товар для Slimrate ID ${searchId}`, 'error');
            }
        } else {
            addUpdateLog(`❌ Товар с slimrate_id=${searchId} не найден в WooCommerce`, 'warning');
            addUpdateLog(`💡 Автосоздание товаров отключено. Включите его в настройках или создайте товар вручную`, 'info');
        }
    }
}

// Функция обработки вариации
async function processVariation(item) {
    addUpdateLog(`Обработка как вариация: ${item.id} (родитель: ${item.rootId})`, 'info');
    // TODO: Реализовать обработку вариаций позже
    addUpdateLog(`Обработка вариаций пока не реализована`, 'warning');
}

// Функция обработки удаленного товара
async function processDeletedProduct(item) {
    const searchId = (item.varName === "" || !item.varName) ? item.rootId : item.id;
    
    addUpdateLog(`=== ОБРАБОТКА УДАЛЕННОГО ТОВАРА ${item.id} ===`, 'warning');
    addUpdateLog(`Товар удален в Slimrate: deletedAt="${item.deletedAt}"`, 'warning');
    addUpdateLog(`Ищем товар в WooCommerce для удаления по slimrate_id: ${searchId}`);
    
    const wooProduct = await findWooProductBySlimrateId(searchId);
    
    if (wooProduct) {
        addUpdateLog(`Найден товар в WooCommerce для удаления: id=${wooProduct.id}, name='${wooProduct.name}'`, 'info');
        
        // Удаляем товар из WooCommerce
        const deleteResult = await deleteWooProduct(wooProduct.id);
        
        if (deleteResult && !deleteResult.code) {
            addUpdateLog(`✅ Товар успешно удален из WooCommerce: id=${wooProduct.id} (Slimrate id=${searchId})`, 'success');
        } else {
            addUpdateLog(`❌ Ошибка удаления товара из WooCommerce: id=${wooProduct.id}, ошибка: ${deleteResult.message || JSON.stringify(deleteResult)}`, 'error');
        }
    } else {
        addUpdateLog(`Товар с slimrate_id=${searchId} не найден в WooCommerce - возможно уже удален`, 'info');
    }
}

// Функции для работы с updatedAt
function getLastUpdatedAt() {
    const saved = localStorage.getItem('slimrate_last_updated_at');
    if (saved) {
        addUpdateLog(`Загружен сохраненный updatedAt: ${saved}`, 'info');
        return saved;
    } else {
        // Если первый запуск, берем время 24 часа назад
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        const defaultTime = oneDayAgo.toISOString();
        addUpdateLog(`Первый запуск - используем время 24 часа назад: ${defaultTime}`, 'info');
        return defaultTime;
    }
}

function saveLastUpdatedAt(timestamp) {
    localStorage.setItem('slimrate_last_updated_at', timestamp);
    addUpdateLog(`Сохранен новый updatedAt: ${timestamp}`, 'info');
}

function resetLastUpdatedAt() {
    localStorage.removeItem('slimrate_last_updated_at');
    addUpdateLog('Сброшен сохраненный updatedAt - следующая синхронизация будет с 24 часа назад', 'warning');
}

// Основная функция обновления товаров в WooCommerce
export async function updateItemsFromSlimrate() {
    addUpdateLog('Запрос к Slimrate на обновление товаров...');
    try {
        const slimrateApiUrl = 'https://dev.slimrate.com/v1/items/read/tablet';
        
        // Получаем время последней синхронизации
        const lastUpdatedAt = getLastUpdatedAt();
        
        // Фиксируем время начала синхронизации (это будет новое значение updatedAt)
        const syncStartTime = new Date().toISOString();
        
        const slimrateRequestBody = {
            updatedAt: lastUpdatedAt
            // limit: 100, // Ограничение количества, если нужно
            // offset: 0
        };

        addUpdateLog(`Параметры запроса: updatedAt=${lastUpdatedAt}`);

        const response = await fetch(slimrateApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(slimrateRequestBody)
        });

        const data = await response.json();

        if (response.ok && data.result) {
            const items = data.result;
            addUpdateLog(`Получено товаров для обновления: ${items.length}`);

            let processedCount = 0;
            let updatedCount = 0;
            let deletedCount = 0;
            let errorCount = 0;

            for (const item of items) {
                try {
                    if (item.deletedAt) {
                        // Товар удален в Slimrate
                        await processDeletedProduct(item);
                        deletedCount++;
                    } else {
                        // Проверяем, это вариация или обычный товар
                        if (item.varName && item.varName.trim() !== "") {
                            // Это вариация
                            await processVariation(item);
                        } else {
                            // Это простой товар
                            await processProduct(item);
                        }
                        updatedCount++;
                    }
                    
                    processedCount++;
                } catch (error) {
                    addUpdateLog(`Ошибка обработки товара ${item.id}: ${error.message}`, 'error');
                    errorCount++;
                }
            }

            // Сохраняем новое время последней синхронизации только при успешной обработке
            if (errorCount === 0 || (processedCount > errorCount)) {
                saveLastUpdatedAt(syncStartTime);
                addUpdateLog(`Синхронизация завершена. Обработано: ${processedCount}, обновлено: ${updatedCount}, удалено: ${deletedCount}, ошибок: ${errorCount}`, 'success');
            } else {
                addUpdateLog(`Синхронизация завершена с ошибками. Время последней синхронизации НЕ обновлено.`, 'warning');
            }

        } else {
            throw new Error(data.message || 'Неизвестная ошибка API');
        }

    } catch (error) {
        addUpdateLog(`Критическая ошибка синхронизации: ${error.message}`, 'error');
    }
}

// Функция для обработки изображений из Slimrate
function processSlimrateImages(item) {
    const images = [];
    
    // Основное изображение товара
    if (item.image && item.image.trim()) {
        images.push({
            src: item.image.trim(),
            name: 'Основное изображение',
            alt: item.rootName || item.displayName || 'Изображение товара'
        });
    }
    
    // Изображения из wooInfo.pictures
    if (item.wooInfo && Array.isArray(item.wooInfo.pictures)) {
        item.wooInfo.pictures.forEach((pictureUrl, index) => {
            if (pictureUrl && pictureUrl.trim()) {
                images.push({
                    src: pictureUrl.trim(),
                    name: `Изображение ${index + 2}`,
                    alt: `${item.rootName || item.displayName || 'Товар'} - изображение ${index + 2}`
                });
            }
        });
    }
    
    // Убираем дубликаты по URL
    const uniqueImages = [];
    const seenUrls = new Set();
    
    images.forEach(img => {
        if (!seenUrls.has(img.src)) {
            seenUrls.add(img.src);
            uniqueImages.push(img);
        }
    });
    
    addUpdateLog(`Обработано изображений: ${uniqueImages.length} (${images.length - uniqueImages.length} дубликатов удалено)`, 'debug');
    
    return uniqueImages;
}

// Экспортируем функции для тестирования и внешнего использования
export { findWooProductBySlimrateId, findWooProductByMultipleCriteria, linkProductToSlimrate, resetLastUpdatedAt };