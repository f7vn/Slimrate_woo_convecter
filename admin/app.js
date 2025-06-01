import { AUTH_TOKEN } from './js/core/config.js';
import { addLogEntry } from './js/core/utils.js';
import { renderCreateItemForm } from './js/products/createItem.js';
import { initTabs } from './js/components/tabs.js';
import { updateItemsFromSlimrate, resetLastUpdatedAt } from './js/sync/updateItems.js';
import { initAutoSync, performAutoSync } from './js/core/scheduler.js';

document.addEventListener('DOMContentLoaded', async function() {
    // Инициализируем систему вкладок
    initTabs();
    
    // Инициализируем форму создания товара
    await renderCreateItemForm();
    
    // Инициализируем автосинхронизацию
    initAutoSync();
    
    // Инициализируем отображение времени
    initTimeDisplay();
    
    // Обработчики для кнопок загрузки данных (системная вкладка)
    document.getElementById('loadTaxesBtn').addEventListener('click', loadTaxes);
    document.getElementById('loadUnitsBtn').addEventListener('click', loadUnits);
    document.getElementById('loadCategoriesBtn').addEventListener('click', loadCategories);
    
    // Добавляем кнопку для обновления товаров
    document.getElementById('updateItemsBtn').addEventListener('click', updateItemsFromSlimrate);
    
    // Добавляем обработчик для сброса времени последней синхронизации
    document.getElementById('resetLastSyncBtn').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить время последней синхронизации?\n\nЭто приведет к тому, что следующая синхронизация загрузит все товары за последние 24 часа.')) {
            resetLastUpdatedAt();
            addLogEntry('🔄 Время последней синхронизации сброшено', 'warning', 'system');
        }
    });
    
    // Добавляем обработчик для тестовой синхронизации
    document.getElementById('test-sync').addEventListener('click', async () => {
        addLogEntry('🔄 Запуск тестовой синхронизации...', 'info', 'system');
        await performAutoSync();
    });
    
    // Обработчик для кнопки копирования ISO времени
    document.getElementById('copyISOBtn').addEventListener('click', copyISOTime);
    
    // Обработчики для кнопок очистки логов
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        document.getElementById('itemLog').innerHTML = '';
        addLogEntry('Лог создания товара очищен', 'info');
    });
    
    document.getElementById('clearSystemLogBtn').addEventListener('click', () => {
        document.getElementById('systemLog').innerHTML = '';
        addLogEntry('Системный лог очищен', 'info', 'system');
    });
    
   
});

// Функции для работы с отображением времени
function initTimeDisplay() {
    updateTimeDisplay();
    // Обновляем время каждую секунду
    setInterval(updateTimeDisplay, 1000);
}

function updateTimeDisplay() {
    const now = new Date();
    
    // GMT время
    const gmtTime = now.toUTCString().split(' ')[4]; // Извлекаем только время HH:MM:SS
    document.getElementById('currentGMTTime').textContent = gmtTime;
    
    // ISO формат для API
    const isoTime = now.toISOString();
    document.getElementById('currentISOTime').textContent = isoTime;
    
    // Локальное время
    const localTime = now.toLocaleTimeString('ru-RU', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentLocalTime').textContent = localTime;
}

function copyISOTime() {
    const isoTime = document.getElementById('currentISOTime').textContent;
    const copyBtn = document.getElementById('copyISOBtn');
    
    navigator.clipboard.writeText(isoTime).then(() => {
        // Показываем успешное копирование
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Скопировано!';
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('copied');
        }, 2000);
        
        addLogEntry(`ISO время скопировано в буфер обмена: ${isoTime}`, 'info', 'system');
    }).catch(err => {
        addLogEntry(`Ошибка копирования: ${err.message}`, 'error', 'system');
    });
}

async function loadTaxes() {
    try {
        addLogEntry('Загрузка налогов...', 'info', 'system');
        
        const response = await fetch('https://dev.slimrate.com/v1/taxes/read', {
            method: 'POST',
            headers: { 
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [] })
        });
        
        const data = await response.json();
        
        if (response.ok && data.result) {
            const taxes = data.result;
            let taxesHtml = '<h2>Налоги</h2>';
            
            taxes.forEach(tax => {
                const isDefault = tax.isDefault ? ' default-tax' : '';
                taxesHtml += `
                    <div class="tax-row${isDefault}">
                        <span class="tax-name">${tax.name || tax.displayName}</span>
                        <span class="tax-id">ID: ${tax.id}</span>
                        <span class="tax-percent">${tax.percent}%</span>
                    </div>
                `;
            });
            
            document.getElementById('dataDisplay').innerHTML = taxesHtml;
            addLogEntry(`Загружено ${taxes.length} налогов`, 'success', 'system');
        } else {
            throw new Error(data.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        addLogEntry(`Ошибка загрузки налогов: ${error.message}`, 'error', 'system');
    }
}

async function loadUnits() {
    try {
        addLogEntry('Загрузка единиц измерения...', 'info', 'system');
        
        const response = await fetch('https://dev.slimrate.com/v1/units/read', {
            method: 'POST',
            headers: { 
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [] })
        });
        
        const data = await response.json();
        
        if (response.ok && data.result) {
            const units = data.result;
            let unitsHtml = '<h2>Единицы измерения</h2>';
            
            units.forEach(unit => {
                unitsHtml += `
                    <div class="unit-row">
                        <span class="unit-abbr">${unit.abbreviation}</span>
                        <span class="unit-id">ID: ${unit.id}</span>
                        <span class="unit-name">${unit.name || unit.displayName}</span>
                    </div>
                `;
            });
            
            document.getElementById('dataDisplay').innerHTML = unitsHtml;
            addLogEntry(`Загружено ${units.length} единиц измерения`, 'success', 'system');
        } else {
            throw new Error(data.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        addLogEntry(`Ошибка загрузки единиц измерения: ${error.message}`, 'error', 'system');
    }
}

async function loadCategories() {
    try {
        addLogEntry('Загрузка категорий...', 'info', 'system');
        
        const response = await fetch('https://dev.slimrate.com/v1/categories/read', {
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
        
        const data = await response.json();
        
        if (response.ok && data.result) {
            const categories = data.result;
            let categoriesHtml = '<h2>Категории</h2>';
            
            categories.forEach(category => {
                categoriesHtml += `
                    <div class="category-row">
                        <span class="category-name">${category.displayName}</span>
                        <span class="category-id">ID: ${category.id}</span>
                    </div>
                `;
                
                if (category.subcategories && category.subcategories.length > 0) {
                    categoriesHtml += '<div class="subcategory-list">';
                    category.subcategories.forEach(sub => {
                        categoriesHtml += `
                            <div class="subcategory-row">
                                <span class="subcategory-name">${sub.displayName}</span>
                                <span class="subcategory-id">ID: ${sub.id}</span>
                            </div>
                        `;
                    });
                    categoriesHtml += '</div>';
                }
            });
            
            document.getElementById('dataDisplay').innerHTML = categoriesHtml;
            addLogEntry(`Загружено ${categories.length} категорий`, 'success', 'system');
        } else {
            throw new Error(data.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        addLogEntry(`Ошибка загрузки категорий: ${error.message}`, 'error', 'system');
    }
}

 