import { AUTH_TOKEN } from './config.js';

// Функции для работы с данными Slimrate

// Загрузка и отображение налогов
function loadTaxesData() {
    fetch('https://dev.slimrate.com/v1/taxes/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [] })
    })
    .then(response => response.json())
    .then(data => showTaxesData(data))
    .catch(error => {
        document.getElementById('companyInfo').innerHTML = 'Ошибка загрузки налогов: ' + error;
    });
}

function showTaxesData(data) {
    const infoDiv = document.getElementById('companyInfo');
    if (!data || !data.result || !Array.isArray(data.result) || data.result.length === 0) {
        infoDiv.innerHTML = 'Нет данных о налогах.';
        return;
    }
    let html = '<h2>Доступные налоги</h2><ul>';
    data.result.forEach(tax => {
        const percent = (typeof tax.percent === 'string' || typeof tax.percent === 'number')
            ? Number(tax.percent).toFixed(2)
            : '0.00';
        html += `<li class="tax-row${tax.isDefault ? ' default-tax' : ''}">
            <span class="tax-name">${tax.name}</span>
            <span class="tax-id">${tax.id}</span>
            <span class="tax-percent">${percent}%</span>
        </li>`;
    });
    html += '</ul>';
    infoDiv.innerHTML = html;
}

// Загрузка и отображение единиц измерения
function loadUnitsData() {
    fetch('https://dev.slimrate.com/v1/units/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [] })
    })
    .then(response => response.json())
    .then(data => showUnitsData(data))
    .catch(error => {
        document.getElementById('companyInfo').innerHTML = 'Ошибка загрузки единиц: ' + error;
    });
}

function showUnitsData(data) {
    const infoDiv = document.getElementById('companyInfo');
    if (!data || !data.result || !Array.isArray(data.result) || data.result.length === 0) {
        infoDiv.innerHTML = 'Нет данных об единицах измерения.';
        return;
    }
    let html = '<h2>Единицы измерения</h2><ul>';
    data.result.forEach(unit => {
        html += `<li class="unit-row">
            <span class="unit-abbr">${unit.abbreviation}</span>
            <span class="unit-id">${unit.id}</span>
            <span class="unit-name">${unit.name}</span>
        </li>`;
    });
    html += '</ul>';
    infoDiv.innerHTML = html;
}

// Загрузка и отображение категорий
function loadCategoriesData() {
    fetch('https://dev.slimrate.com/v1/categories/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ids: [],
            search: "",
            sortBy: "",
            sortAscending: false,
            returnCsvUrl: false
        })
    })
    .then(response => response.json())
    .then(data => showCategoriesData(data))
    .catch(error => {
        document.getElementById('categoriesBlock').innerHTML = 'Ошибка загрузки категорий: ' + error;
    });
}

function showCategoriesData(data) {
    const infoDiv = document.getElementById('categoriesBlock');
    if (!data || !data.result || !Array.isArray(data.result) || data.result.length === 0) {
        infoDiv.innerHTML = 'Нет данных о категориях.';
        return;
    }
    let html = '<h2>Категории</h2><ul>';
    data.result.forEach(category => {
        html += `<li class="category-row">
            <span class="category-name">${category.displayName}</span>
            <span class="category-id">${category.id}</span>
        </li>`;
        if (category.subcategories && Array.isArray(category.subcategories) && category.subcategories.length > 0) {
            html += '<ul class="subcategory-list">';
            category.subcategories.forEach(subcat => {
                html += `<li class="subcategory-row">
                    <span class="subcategory-name">${subcat.displayName}</span>
                    <span class="subcategory-id">${subcat.id}</span>
                </li>`;
            });
            html += '</ul>';
        }
    });
    html += '</ul>';
    infoDiv.innerHTML = html;
}

// Экспортируем функции
export {
    loadTaxesData,
    loadUnitsData,
    loadCategoriesData,
    showTaxesData,
    showUnitsData,
    showCategoriesData
}; 