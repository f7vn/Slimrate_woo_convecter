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

async function findWooProductBySlimrateId(slimrateId) {
    const baseUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const searchUrl = `${baseUrl}?meta_key=slimrate_id&meta_value=${encodeURIComponent(slimrateId)}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    addUpdateLog(`Поиск товара по URL: ${searchUrl}`, 'debug');
    
    const resp = await fetch(searchUrl, {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const data = await resp.json();
    
    addUpdateLog(`Ответ WooCommerce API: найдено ${Array.isArray(data) ? data.length : 0} товаров`, 'debug');
    
    if (Array.isArray(data) && data.length > 0) {
        // WooCommerce API часто игнорирует meta_key/meta_value, поэтому ВСЕГДА фильтруем на клиенте
        addUpdateLog(`Фильтруем товары на клиенте по slimrate_id='${slimrateId}'...`, 'info');
        
        const filtered = data.filter(product => {
            const meta = product.meta_data || [];
            const hasSlimrateId = meta.some(m => m.key === 'slimrate_id' && String(m.value) === String(slimrateId));
            
            // Логируем для первых нескольких товаров для отладки
            if (data.indexOf(product) < 3) {
                const slimrateMetaValue = meta.find(m => m.key === 'slimrate_id')?.value || 'отсутствует';
                addUpdateLog(`Товар ${product.id}: slimrate_id='${slimrateMetaValue}', совпадает: ${hasSlimrateId}`, 'debug');
            }
            
            return hasSlimrateId;
        });
        
        addUpdateLog(`После фильтрации на клиенте найдено: ${filtered.length} товаров`, filtered.length > 0 ? 'success' : 'warning');
        
        if (filtered.length > 0) {
            const foundProduct = filtered[0];
            addUpdateLog(`Используем товар: id=${foundProduct.id}, name='${foundProduct.name}', type=${foundProduct.type}`, 'success');
            return foundProduct;
        } else {
            addUpdateLog(`Товар с slimrate_id='${slimrateId}' не найден среди ${data.length} товаров`, 'error');
            
            // АЛЬТЕРНАТИВНЫЙ МЕТОД: если ничего не найдено, можно попробовать получить все товары
            // и искать среди них (раскомментируйте при необходимости):
            // addUpdateLog(`Пробуем альтернативный поиск - получение всех товаров...`, 'info');
            // const allProductsResp = await fetch(`${baseUrl}?per_page=100`, { headers: { 'Authorization': `Basic ${auth}` } });
            // const allProducts = await allProductsResp.json();
            // return searchInProducts(allProducts, slimrateId);
        }
    } else {
        addUpdateLog(`WooCommerce API вернул пустой ответ или ошибку: ${JSON.stringify(data)}`, 'error');
    }
    
    return null;
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

// Функция обработки товара  
async function processProduct(item) {
    // Для простых товаров (varName пустое) ищем по rootId, для остальных по id
    const searchId = (item.varName === "" || !item.varName) ? item.rootId : item.id;
    
    addUpdateLog(`=== ОБРАБОТКА ТОВАРА ${item.id} ===`, 'info');
    addUpdateLog(`Простой товар (varName пустое): ищем по rootId="${item.rootId}" вместо id="${item.id}"`, 'info');
    addUpdateLog(`Ищем товар в Woo по slimrate_id: ${searchId}`);
    const wooProduct = await findWooProductBySlimrateId(searchId);

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
           
           // Исправляем логику цен для простых товаров
           if (simpleItem.strikeThroughPrice && simpleItem.price) {
               // Если есть зачеркнутая цена, то это обычная цена, а price - цена распродажи
               productUpdateData.regular_price = String(simpleItem.strikeThroughPrice);
               productUpdateData.sale_price = String(simpleItem.price);
           } else if (simpleItem.price) {
               // Если только обычная цена
               productUpdateData.regular_price = String(simpleItem.price);
               productUpdateData.sale_price = '';
           } else {
               // Сохраняем текущие цены
               productUpdateData.regular_price = wooProduct.regular_price;
               productUpdateData.sale_price = wooProduct.sale_price;
           }
           
           // Обновляем SKU
           productUpdateData.sku = simpleItem.skuCode || wooProduct.sku;
           
           // Обновляем количество на складе  
           const newQuantity = simpleItem.quantity !== undefined && simpleItem.quantity !== null ? 
               Number(simpleItem.quantity) : wooProduct.stock_quantity;
           
           productUpdateData.stock_quantity = newQuantity;
           
           // Управление складом
           if (productUpdateData.stock_quantity !== null && productUpdateData.stock_quantity !== undefined) {
               productUpdateData.manage_stock = true;
               productUpdateData.stock_status = productUpdateData.stock_quantity > 0 ? 'instock' : 'outofstock';
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
           
           addUpdateLog(`Обновление простого товара - цены: regular=${productUpdateData.regular_price}, sale=${productUpdateData.sale_price}, количество: ${productUpdateData.stock_quantity}, SKU: ${productUpdateData.sku}`, 'info');
        }

        // Логирование и обновление товара
        const fieldsToLogForProduct = ['name', 'regular_price', 'sale_price', 'sku', 'stock_quantity', 'categories'];
        
        // Специальное логирование для названия
        addUpdateLog(`Сравнение названий: старое="${wooProduct.name}" vs новое="${productUpdateData.name}" (равны: ${wooProduct.name === productUpdateData.name})`, 'info');
        
        const changesLogProduct = getChangedFieldsLog(wooProduct, productUpdateData, fieldsToLogForProduct);
        addUpdateLog(`Подготовка к обновлению товара Woo id=${wooProduct.id} (Slimrate id=${searchId}). ${changesLogProduct}`, 'info');

        // Логирование полных данных для отправки
        addUpdateLog(`Полные данные для обновления товара: ${JSON.stringify(productUpdateData, null, 2)}`, 'debug');

        const updateResult = await updateWooProduct(wooProduct.id, productUpdateData);
        
        if (updateResult && !updateResult.code) {
            addUpdateLog(`Товар WooCommerce обновлён: id=${wooProduct.id} (Slimrate id=${searchId})`, 'success');
        } else {
            addUpdateLog(`Ошибка обновления товара Woo id=${wooProduct.id} (Slimrate id=${searchId}): ${updateResult.message || JSON.stringify(updateResult)}`, 'error');
        }

    } else {
        addUpdateLog(`Товар с slimrate_id=${searchId} не найден в WooCommerce`, 'error');
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

        addUpdateLog(`Запрос товаров, обновленных после: ${lastUpdatedAt}`);
        addUpdateLog(`Отправка запроса на ${slimrateApiUrl} с телом: ${JSON.stringify(slimrateRequestBody)}`);

        const response = await fetch(slimrateApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(slimrateRequestBody)
        });

        const data = await response.json();
        addUpdateLog(`Ответ от Slimrate получен. Статус: ${response.status}`);

        if (!response.ok) {
             addUpdateLog(`Ошибка запроса к Slimrate: ${response.status} ${response.statusText}. Ответ: ${JSON.stringify(data)}`, 'error');
             return;
        }

        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
            addUpdateLog(`Получено записей для обработки: ${data.result.length}`, 'success');

            // Логирование структуры первого элемента для диагностики
            const firstItem = data.result[0];
            addUpdateLog(`Диагностика первого элемента: hasRootId=${firstItem.hasOwnProperty('rootId')}, rootId="${firstItem.rootId || 'отсутствует'}", hasVariations=${firstItem.hasOwnProperty('variations')}, displayName="${firstItem.displayName || 'отсутствует'}"`, 'debug');

            // НОВАЯ ЛОГИКА: Обрабатываем каждый элемент индивидуально
            // Вместо определения формата массива, определяем тип каждого элемента отдельно
            addUpdateLog("Новая логика: обработка каждого элемента индивидуально как товар или вариация", 'info');
            
            for (const item of data.result) {
                // СНАЧАЛА проверяем, удален ли товар в Slimrate
                if (item.deletedAt) {
                    // Обработка удаленного товара
                    await processDeletedProduct(item);
                    continue; // Переходим к следующему элементу
                }
                
                // Определяем тип текущего элемента (только для НЕ удаленных товаров)
                // ПРАВИЛЬНАЯ ЛОГИКА: varName пустое = простой товар, varName заполнено = вариация
                const isVariation = item.hasOwnProperty('varName') && 
                                   item.varName && 
                                   item.varName.trim() !== '';
                
                const isProduct = !isVariation; // Все остальное считаем товаром
                
                addUpdateLog(`Элемент ${item.id}: ${isVariation ? 'ВАРИАЦИЯ' : 'ТОВАР'} (varName="${item.varName || 'пустое'}", rootId="${item.rootId || 'отсутствует'}")`, 'info');
                
                if (isVariation) {
                    // Обработка как вариация
                    await processVariation(item);
                } else {
                    // Обработка как товар
                    await processProduct(item);
                }
            }

            addUpdateLog("Обработка завершена.", 'success');
            
            // ✅ ОБНОВЛЯЕМ updatedAt после успешной обработки
            saveLastUpdatedAt(syncStartTime);
            addUpdateLog(`Время последней синхронизации обновлено на: ${syncStartTime}`, 'success');

        } else if (data.result && Array.isArray(data.result) && data.result.length === 0) {
             addUpdateLog('Получен пустой массив данных от Slimrate. Новых изменений нет.', 'info');
             
             // Даже если нет изменений, обновляем время последней синхронизации
             saveLastUpdatedAt(syncStartTime);
             addUpdateLog(`Время последней синхронизации обновлено (без изменений): ${syncStartTime}`, 'info');
        } else {
            addUpdateLog(`Неожиданный формат ответа от Slimrate или пустой результат: ${JSON.stringify(data)}`, 'error');
        }
    } catch (err) {
        addUpdateLog(`Критическая ошибка выполнения скрипта: ${err.message}`, 'error');
        console.error("Update script error:", err);
    }
} 

// Экспорт дополнительных функций
export { resetLastUpdatedAt }; 
