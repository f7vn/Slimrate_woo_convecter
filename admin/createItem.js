function renderCreateItemForm() {
    const block = document.getElementById('createItemBlock');
    block.innerHTML = `
        <h2>Create New Product</h2>
        <form id="createItemForm">
            <div class="form-row">
                <label>Product Name:<br><input type="text" name="displayName" required></label>
            </div>
            <div class="form-row">
                <label>Category:<br><select name="categoryId" id="itemCategorySelect" required><option value="">Loading...</option></select></label>
            </div>
            <div class="form-row">
                <label>Tax:<br><select name="taxId" id="itemTaxSelect" required><option value="">Loading...</option></select></label>
            </div>
            <div class="form-row">
                <label>Unit:<br><select name="quantityUnitId" id="itemUnitSelect" required><option value="">Loading...</option></select></label>
            </div>
            <div class="form-row">
                <label>Description:<br><textarea name="description" rows="2"></textarea></label>
            </div>
            <div class="form-row">
                <label>Image URL:<br><input type="text" name="image"></label>
            </div>
            <div class="form-row">
                <label>Variations:<br>
                    <button type="button" id="addVariationBtn">Add Variation</button>
                </label>
                <div id="variationsList"></div>
            </div>
            <button type="submit">Create Product</button>
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
        sel.innerHTML = 
            (data.result||[]).map(c => `<option value="${c.id}" ${c.displayName === 'Default category' ? 'selected' : ''}>${c.displayName}</option>`).join('');
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
        sel.innerHTML = 
            (data.result||[]).map(t => `<option value="${t.id}" ${t.name === 'No tax' ? 'selected' : ''}>${t.name}</option>`).join('');
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
        sel.innerHTML = 
            (data.result||[]).map(u => `<option value="${u.id}" ${u.abbreviation === 'pcs' ? 'selected' : ''}>${u.name}</option>`).join('');
    });
}

// Логика для вариаций
function setupVariationsLogic() {
    const list = document.getElementById('variationsList');
    const addBtn = document.getElementById('addVariationBtn');
    let count = 0;

    // Функция добавления новой модификации
    function addVariation() {
        count++;
        const div = document.createElement('div');
        div.className = 'variation-row';
        div.innerHTML = `
            <label>Variation Name: <input type="text" name="varName${count}"></label>
            <label>Price: <input type="number" name="price${count}" step="0.01" required></label>
            <label>Cost: <input type="number" name="cost${count}" step="0.01"></label>
            <label>Strike-through Price: <input type="number" name="strikeThroughPrice${count}" step="0.01"></label>
            <label>Image URL: <input type="text" name="image${count}"></label>
            <label>Barcode: <input type="text" name="barcode${count}"></label>
            <label>SKU: <input type="text" name="skuCode${count}"></label>
            <label>Quantity: <input type="number" name="startQuantity${count}" value="0"></label>
            <button type="button" class="removeVariationBtn">Remove</button>
        `;
        list.appendChild(div);
        div.querySelector('.removeVariationBtn').onclick = () => div.remove();
    }

    // Добавляем первую модификацию сразу при открытии формы
    addVariation();

    // Обработчик для кнопки добавления новой модификации
    addBtn.onclick = addVariation;
}

// Функция для добавления записи в лог
function addLogEntry(message, type = 'info') {
    const logContent = document.getElementById('itemLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
}

// Обновляем функцию handleCreateItemSubmit для использования логов
async function handleCreateItemSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const imageUrl = formData.get('image');
    
    addLogEntry('Product creation started', 'info');
    addLogEntry(`Product name: ${formData.get('displayName')}`, 'info');
    
    if (imageUrl) {
        addLogEntry('Uploading main image...', 'info');
        const slimrateImageUrl = await uploadImageToSlimrate(imageUrl);
        if (slimrateImageUrl) {
            addLogEntry('Main image uploaded successfully', 'success');
        } else {
            addLogEntry('Error uploading main image', 'error');
        }
    }
    
    // Собираем вариации
    const variations = [];
    let i = 1;
    while (formData.has(`varName${i}`) || formData.has(`price${i}`)) {
        if (formData.get(`varName${i}`) || formData.get(`price${i}`)) {
            addLogEntry(`Processing variation ${i}...`, 'info');
            const varImageUrl = formData.get(`image${i}`);
            
            if (varImageUrl) {
                addLogEntry(`Uploading image for variation ${i}...`, 'info');
                const slimrateVarImageUrl = await uploadImageToSlimrate(varImageUrl);
                if (slimrateVarImageUrl) {
                    addLogEntry(`Variation ${i} image uploaded successfully`, 'success');
                } else {
                    addLogEntry(`Error uploading image for variation ${i}`, 'error');
                }
            }
            
            variations.push({
                varName: formData.get(`varName${i}`) || '',
                price: formData.get(`price${i}`) || '',
                cost: formData.get(`cost${i}`) || '',
                strikeThroughPrice: formData.get(`strikeThroughPrice${i}`) || '',
                image: varImageUrl ? await uploadImageToSlimrate(varImageUrl) : '',
                barcode: formData.get(`barcode${i}`) || '',
                skuCode: formData.get(`skuCode${i}`) || '',
                startQuantity: formData.get(`startQuantity${i}`) || '0',
                toDelete: false,
                wooInfo: {
                    name: formData.get(`varName${i}`) || '',
                    description: formData.get('description') || '',
                    shortDescription: '',
                    pictures: varImageUrl ? [await uploadImageToSlimrate(varImageUrl)] : []
                }
            });
            addLogEntry(`Variation ${i} added`, 'success');
        }
        i++;
    }

    const body = {
        displayName: formData.get('displayName'),
        categoryId: formData.get('categoryId'),
        taxId: formData.get('taxId'),
        quantityUnitId: formData.get('quantityUnitId'),
        description: formData.get('description'),
        image: imageUrl ? await uploadImageToSlimrate(imageUrl) : '',
        items: variations
    };
    
    addLogEntry('Sending product data to server...', 'info');

    const resultDiv = document.getElementById('createItemResult');
    try {
        const response = await fetch('https://dev.slimrate.com/v1/item-roots/create', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            addLogEntry('Product created successfully!', 'success');
            resultDiv.innerHTML = '<span style="color:green;">Product created successfully!</span>';
            form.reset();
            document.getElementById('variationsList').innerHTML = '';
            setupVariationsLogic();
        } else {
            addLogEntry(`Error creating product: ${data.message || 'Unknown error'}`, 'error');
            resultDiv.innerHTML = `<span style="color:red;">Error creating product: ${data.message || 'Unknown error'}</span>`;
        }
    } catch (err) {
        addLogEntry(`Request error: ${err.message}`, 'error');
        resultDiv.innerHTML = `<span style="color:red;">Error creating product: ${err.message}</span>`;
    }
}

// Обновляем функцию uploadImageToSlimrate для использования логов
async function uploadImageToSlimrate(imageUrl) {
    if (!imageUrl) {
        addLogEntry('Image URL not specified', 'warning');
        return '';
    }
    try {
        addLogEntry(`Uploading image: ${imageUrl}`, 'info');
        const response = await fetch(imageUrl);
        if (!response.ok) {
            addLogEntry(`Error fetching image: ${response.status} ${response.statusText}`, 'error');
            return '';
        }
        const blob = await response.blob();
        addLogEntry(`Image fetched, size: ${blob.size} bytes, type: ${blob.type}`, 'info');
        
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        
        addLogEntry('Uploading image to Slimrate server...', 'info');
        const uploadResponse = await fetch('https://dev.slimrate.com/v1/media/upload', {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_TOKEN
            },
            body: formData
        });
        
        if (!uploadResponse.ok) {
            addLogEntry(`Error uploading to Slimrate: ${uploadResponse.status} ${uploadResponse.statusText}`, 'error');
            return '';
        }
        
        const data = await uploadResponse.json();
        if (!data.url) {
            addLogEntry('Image URL missing in server response', 'error');
            return '';
        }
        
        addLogEntry(`Image uploaded successfully, URL: ${data.url}`, 'success');
        return data.url;
    } catch (error) {
        addLogEntry(`Image upload error: ${error.message}`, 'error');
        return '';
    }
} 

export {
    renderCreateItemForm
}; 