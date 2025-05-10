// Добавим кнопку для налогов
const taxesBtn = document.createElement('button');
taxesBtn.textContent = 'Загрузить налоги';
taxesBtn.id = 'loadTaxesBtn';
document.body.appendChild(taxesBtn);

taxesBtn.addEventListener('click', loadTaxesData);

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

// Кнопка для единиц измерения
const unitsBtn = document.createElement('button');
unitsBtn.textContent = 'Загрузить единицы измерения';
unitsBtn.id = 'loadUnitsBtn';
document.body.appendChild(unitsBtn);

unitsBtn.addEventListener('click', loadUnitsData);

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

// Кнопка для категорий
const categoriesBtn = document.createElement('button');
categoriesBtn.textContent = 'Загрузить категории';
categoriesBtn.id = 'loadCategoriesBtn';
document.body.appendChild(categoriesBtn);

categoriesBtn.addEventListener('click', loadCategoriesData);

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
            // limit: 0.0,
            // offset: 0.0,
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

// === Форма создания товара ===
renderCreateItemForm();

function renderCreateItemForm() {
    const block = document.getElementById('createItemBlock');
    block.innerHTML = `
        <h2>Создать новый товар</h2>
        <form id="createItemForm">
            <div class="form-row">
                <label>Название товара:<br><input type="text" name="displayName" required></label>
            </div>
            <div class="form-row">
                <label>Категория:<br><select name="categoryId" id="itemCategorySelect" required><option value="">Загрузка...</option></select></label>
            </div>
            <div class="form-row">
                <label>Налог:<br><select name="taxId" id="itemTaxSelect" required><option value="">Загрузка...</option></select></label>
            </div>
            <div class="form-row">
                <label>Единица измерения:<br><select name="quantityUnitId" id="itemUnitSelect" required><option value="">Загрузка...</option></select></label>
            </div>
            <div class="form-row">
                <label>Описание:<br><textarea name="description" rows="2"></textarea></label>
            </div>
            <div class="form-row">
                <label>URL картинки:<br><input type="text" name="image"></label>
            </div>
            <div class="form-row">
                <label>Вариации:<br>
                    <button type="button" id="addVariationBtn">Добавить вариацию</button>
                </label>
                <div id="variationsList"></div>
            </div>
            <button type="submit">Создать товар</button>
            <div id="createItemResult"></div>
        </form>
    `;
    loadFormSelects();
    setupVariationsLogic();
    document.getElementById('createItemForm').addEventListener('submit', handleCreateItemSubmit);
}

// Загружаем значения для select-ов
function loadFormSelects() {
    // Категории
    fetch('https://dev.slimrate.com/v1/categories/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [], search: '', sortBy: '', sortAscending: false, returnCsvUrl: false })
    })
    .then(r => r.json())
    .then(data => {
        const sel = document.getElementById('itemCategorySelect');
        sel.innerHTML = '<option value="">Выберите категорию</option>' +
            (data.result||[]).map(c => `<option value="${c.id}">${c.displayName}</option>`).join('');
    });
    // Налоги
    fetch('https://dev.slimrate.com/v1/taxes/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [] })
    })
    .then(r => r.json())
    .then(data => {
        const sel = document.getElementById('itemTaxSelect');
        sel.innerHTML = '<option value="">Выберите налог</option>' +
            (data.result||[]).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    });
    // Единицы
    fetch('https://dev.slimrate.com/v1/units/read', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [] })
    })
    .then(r => r.json())
    .then(data => {
        const sel = document.getElementById('itemUnitSelect');
        sel.innerHTML = '<option value="">Выберите единицу</option>' +
            (data.result||[]).map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    });
}

// Логика для вариаций
function setupVariationsLogic() {
    const list = document.getElementById('variationsList');
    const addBtn = document.getElementById('addVariationBtn');
    let count = 0;
    addBtn.onclick = function() {
        count++;
        const div = document.createElement('div');
        div.className = 'variation-row';
        div.innerHTML = `
            <label>Название вариации: <input type="text" name="varName${count}"></label>
            <label>Цена: <input type="number" name="price${count}" step="0.01"></label>
            <label>URL картинки: <input type="text" name="image${count}"></label>
            <label>Штрихкод: <input type="text" name="barcode${count}"></label>
            <label>SKU: <input type="text" name="skuCode${count}"></label>
            <label>Количество: <input type="number" name="startQuantity${count}"></label>
            <button type="button" class="removeVariationBtn">Удалить</button>
        `;
        list.appendChild(div);
        div.querySelector('.removeVariationBtn').onclick = () => div.remove();
    };
}

function handleCreateItemSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    // Собираем вариации
    const variations = [];
    let i = 1;
    while (formData.has(`varName${i}`) || formData.has(`price${i}`)) {
        if (formData.get(`varName${i}`) || formData.get(`price${i}`)) {
            variations.push({
                varName: formData.get(`varName${i}`) || '',
                price: formData.get(`price${i}`) || '',
                image: formData.get(`image${i}`) || '',
                barcode: formData.get(`barcode${i}`) || '',
                skuCode: formData.get(`skuCode${i}`) || '',
                startQuantity: formData.get(`startQuantity${i}`) || '',
                toDelete: false,
                wooInfo: {
                    name: '',
                    description: '',
                    shortDescription: '',
                    pictures: []
                }
            });
        }
        i++;
    }
    const body = {
        displayName: formData.get('displayName'),
        categoryId: formData.get('categoryId'),
        taxId: formData.get('taxId'),
        quantityUnitId: formData.get('quantityUnitId'),
        description: formData.get('description'),
        image: formData.get('image'),
        items: variations
    };
    const resultDiv = document.getElementById('createItemResult');
    fetch('https://dev.slimrate.com/v1/item-roots/create', {
        method: 'POST',
        headers: {
            'Authorization': AUTH_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    .then(r => r.json())
    .then(data => {
        resultDiv.innerHTML = '<span style="color:green;">Товар создан успешно!</span>';
        form.reset();
        document.getElementById('variationsList').innerHTML = '';
    })
    .catch(err => {
        resultDiv.innerHTML = '<span style="color:red;">Ошибка создания товара: ' + err + '</span>';
    });
} 