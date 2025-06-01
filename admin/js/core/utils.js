import { AUTH_TOKEN, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_SITE } from './config.js';

// Функция для добавления записи в лог
export function addLogEntry(message, type = 'info', logTarget = 'item') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Определяем целевой лог
    const logElement = logTarget === 'system' ? 
        document.getElementById('systemLog') : 
        document.getElementById('itemLog');
    
    if (logElement) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = logEntry;
        
        logElement.appendChild(div);
        logElement.scrollTop = logElement.scrollHeight;
    }
    
    // Также выводим в консоль для отладки
    console.log(`[${type.toUpperCase()}] ${logEntry}`);
}

// Функция загрузки изображения в Slimrate
export async function uploadImageToSlimrate(imageUrl) {
    if (!imageUrl) {
        addLogEntry('URL изображения не указан', 'warning');
        return '';
    }
    
    try {
        addLogEntry(`Загрузка изображения: ${imageUrl}`, 'info');
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
            addLogEntry(`Ошибка получения изображения: ${response.status} ${response.statusText}`, 'error');
            return '';
        }
        
        const blob = await response.blob();
        addLogEntry(`Изображение получено, размер: ${blob.size} байт, тип: ${blob.type}`, 'info');
        
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        
        addLogEntry('Загрузка изображения на сервер Slimrate...', 'info');
        const uploadResponse = await fetch('https://dev.slimrate.com/v1/media/upload', {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_TOKEN
            },
            body: formData
        });
        
        if (!uploadResponse.ok) {
            addLogEntry(`Ошибка загрузки в Slimrate: ${uploadResponse.status} ${uploadResponse.statusText}`, 'error');
            return '';
        }
        
        const data = await uploadResponse.json();
        if (!data.url) {
            addLogEntry('URL изображения отсутствует в ответе сервера', 'error');
            return '';
        }
        
        addLogEntry(`Изображение успешно загружено, URL: ${data.url}`, 'success');
        return data.url;
        
    } catch (error) {
        addLogEntry(`Ошибка загрузки изображения: ${error.message}`, 'error');
        return '';
    }
}

// Функция получения или создания категории в WooCommerce
export async function getOrCreateWooCategory(categoryName) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoryName)}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    
    try {
        // 1. Поиск существующей категории
        const resp = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
            addLogEntry(`Категория WooCommerce '${categoryName}' найдена, ID: ${data[0].id}`, 'info');
            return data[0].id;
        }
        
        // 2. Создание новой категории
        addLogEntry(`Категория WooCommerce '${categoryName}' не найдена, создаём...`, 'info');
        const createUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/categories`;
        
        const createResp = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify({ name: categoryName })
        });
        
        const createData = await createResp.json();
        if (createResp.ok && createData.id) {
            addLogEntry(`Категория WooCommerce '${categoryName}' создана, ID: ${createData.id}`, 'success');
            return createData.id;
        } else {
            addLogEntry(`Ошибка создания категории WooCommerce: ${createData.message || 'Неизвестная ошибка'}`, 'error');
            return null;
        }
        
    } catch (err) {
        addLogEntry(`Ошибка при работе с категорией WooCommerce: ${err.message}`, 'error');
        return null;
    }
}

// Функция загрузки изображения в WordPress Media Library
export async function uploadImageToWoo(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            addLogEntry(`Ошибка получения изображения для WP Media: ${response.status} ${response.statusText}`, 'error');
            return null;
        }
        
        const blob = await response.blob();
        const fileName = imageUrl.split('/').pop() || 'image.jpg';
        const formData = new FormData();
        formData.append('file', blob, fileName);
        
        const url = WOOCOMMERCE_SITE.replace(/\/$/, '') + '/wp-json/wp/v2/media';
        const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
        
        addLogEntry('Загрузка изображения в медиабиблиотеку WordPress...', 'info');
        
        const uploadResp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`
            },
            body: formData
        });
        
        const data = await uploadResp.json();
        if (uploadResp.ok && data.id) {
            addLogEntry(`Изображение загружено в WP Media, ID: ${data.id}`, 'success');
            return data.id;
        } else {
            addLogEntry(`Ошибка загрузки изображения в WP Media: ${data.message || 'Неизвестная ошибка'}`, 'error');
            return null;
        }
        
    } catch (err) {
        addLogEntry(`Ошибка загрузки изображения в WP Media: ${err.message}`, 'error');
        return null;
    }
}

// Функция загрузки данных для select-ов формы
export async function loadFormSelects() {
    try {
        // Загрузка категорий
        const categoriesResp = await fetch('https://dev.slimrate.com/v1/categories/read', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                ids: [], 
                search: '', 
                sortBy: '', 
                sortAscending: false, 
                returnCsvUrl: false 
            })
        });
        
        const categoriesData = await categoriesResp.json();
        const categorySelect = document.getElementById('itemCategorySelect');
        if (categorySelect) {
            categorySelect.innerHTML = (categoriesData.result || [])
                .map(c => `<option value="${c.id}" ${c.displayName === 'Default category' ? 'selected' : ''}>${c.displayName}</option>`)
                .join('');
        }

        // Загрузка налогов
        const taxesResp = await fetch('https://dev.slimrate.com/v1/taxes/read', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [] })
        });
        
        const taxesData = await taxesResp.json();
        const taxSelect = document.getElementById('itemTaxSelect');
        if (taxSelect) {
            taxSelect.innerHTML = (taxesData.result || [])
                .map(t => `<option value="${t.id}" ${t.name === 'No tax' ? 'selected' : ''}>${t.name}</option>`)
                .join('');
        }

        // Загрузка единиц измерения
        const unitsResp = await fetch('https://dev.slimrate.com/v1/units/read', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [] })
        });
        
        const unitsData = await unitsResp.json();
        const unitSelect = document.getElementById('itemUnitSelect');
        if (unitSelect) {
            unitSelect.innerHTML = (unitsData.result || [])
                .map(u => `<option value="${u.id}" ${u.abbreviation === 'pcs' ? 'selected' : ''}>${u.name}</option>`)
                .join('');
        }

        addLogEntry('Справочники загружены успешно', 'success');
        
    } catch (error) {
        addLogEntry(`Ошибка загрузки справочников: ${error.message}`, 'error');
    }
} 