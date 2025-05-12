import { AUTH_TOKEN, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_SITE } from './config.js';

const TEST_IMAGE_ID = 13262; // ID изображения из медиабиблиотеки WP для теста

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
            <label>Price: <input type="number" name="price${count}" step="1" required></label>
            <label>Cost: <input type="number" name="cost${count}" step="1"></label>
            <label>Strike-through Price: <input type="number" name="strikeThroughPrice${count}" step="1"></label>
            <label>Image URL: <input type="text" name="image${count}"></label>
            <label>Barcode: <input type="text" name="barcode${count}"></label>
            <label>SKU: <input type="text" name="skuCode${count}"></label>
            <label>Quantity: <input type="number" name="startQuantity${count}" value="0"></label>
            <label>Description: <textarea name="description${count}" rows="2"></textarea></label>
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
                    description: formData.get(`description${i}`) || '',
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
            // Создаём товар в WooCommerce
            if (data && data.result) {
                addLogEntry('Creating product in WooCommerce...', 'info');
                await createWooProductFromSlimrate(data.result);
            }
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

async function getOrCreateWooCategory(categoryName) {
    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoryName)}`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    try {
        // 1. Поиск категории
        const resp = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
            addLogEntry(`Woo category '${categoryName}' found, id: ${data[0].id}`, 'info');
            return data[0].id;
        }
        // 2. Если не нашли — создаём
        addLogEntry(`Woo category '${categoryName}' not found, creating...`, 'info');
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
            addLogEntry(`Woo category '${categoryName}' created, id: ${createData.id}`, 'success');
            return createData.id;
        } else {
            addLogEntry(`Error creating Woo category: ${createData.message || 'Unknown error'}`, 'error');
            return null;
        }
    } catch (err) {
        addLogEntry(`Error checking/creating Woo category: ${err.message}`, 'error');
        return null;
    }
}

async function createWooProductFromSlimrate(slimrateProduct) {
    const mainItem = slimrateProduct.items && slimrateProduct.items[0];
    const images = (mainItem && mainItem.image) ? [{ src: mainItem.image }] : [];
    const varNames = (slimrateProduct.items || []).map(item => item.varName || '').filter(Boolean);
    const uniqueVarNames = Array.from(new Set(varNames));
    const attributes = uniqueVarNames.length > 0 ? [{
        name: 'Variation Name',
        visible: true,
        variation: true,
        options: uniqueVarNames
    }] : [];
    const isVariable = (slimrateProduct.items || []).length > 1;

    // === Новый блок: получение/создание категории ===
    let wooCategoryId = null;
    if (slimrateProduct.category && slimrateProduct.category.displayName) {
        wooCategoryId = await getOrCreateWooCategory(slimrateProduct.category.displayName);
    }

    const body = {
        name: slimrateProduct.displayName,
        type: isVariable ? 'variable' : 'simple',
        description: slimrateProduct.description || '',
        images,
        meta_data: [
            { key: 'slimrate_id', value: slimrateProduct.id },
            { key: 'barcode', value: mainItem && mainItem.barcode || '' }
        ],
        ...(wooCategoryId ? { categories: [{ id: wooCategoryId }] } : {}),
        ...(isVariable ? { attributes } : {
            regular_price: mainItem && mainItem.price ? String(mainItem.price) : '',
            sale_price: mainItem && mainItem.strikeThroughPrice ? String(mainItem.strikeThroughPrice) : '',
            sku: mainItem && mainItem.skuCode || ''
        })
    };

    const url = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);

    try {
        // 1. Создаём основной товар
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
            addLogEntry(`WooCommerce error: ${data.message || 'Unknown error'}`, 'error');
            return;
        }
        addLogEntry('Product created in WooCommerce!', 'success');

        // 2. Если variable product — создаём вариации отдельно
        if (isVariable && data && data.id) {
            const productId = data.id;
            for (const item of slimrateProduct.items) {
                const variationBody = {
                    regular_price: item.price ? String(item.price) : '',
                    sale_price: item.strikeThroughPrice ? String(item.strikeThroughPrice) : '',
                    sku: item.skuCode || '',
                    description: (item.wooInfo && item.wooInfo.description) || '',
                    meta_data: [
                        { key: 'slimrate_id', value: item.id },
                        { key: 'barcode', value: item.barcode || '' }
                    ],
                    attributes: [{ name: 'Variation Name', option: item.varName || '' }],
                    image: { id: TEST_IMAGE_ID }
                };
                addLogEntry(`Using test WP Media ID for variation image: ${TEST_IMAGE_ID}`, 'info');
                const varUrl = `${WOOCOMMERCE_SITE.replace(/\/$/, '')}/wp-json/wc/v3/products/${productId}/variations`;
                addLogEntry(`Creating variation '${item.varName || ''}' in WooCommerce...`, 'info');
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
                    addLogEntry(`Variation '${item.varName || ''}' created in WooCommerce!`, 'success');
                } else {
                    addLogEntry(`Error creating variation '${item.varName || ''}': ${varData.message || 'Unknown error'}`, 'error');
                }
            }
        }
    } catch (err) {
        addLogEntry(`WooCommerce request error: ${err.message}`, 'error');
    }
}

async function uploadImageToWoo(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            addLogEntry(`Error fetching image for WP Media: ${response.status} ${response.statusText}`, 'error');
            return null;
        }
        const blob = await response.blob();
        const fileName = imageUrl.split('/').pop() || 'variation.jpg';
        const formData = new FormData();
        formData.append('file', blob, fileName);
        const url = WOOCOMMERCE_SITE.replace(/\/$/, '') + '/wp-json/wp/v2/media';
        const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
        addLogEntry('Uploading image to WP Media Library...', 'info');
        const uploadResp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`
            },
            body: formData
        });
        const data = await uploadResp.json();
        if (uploadResp.ok && data.id) {
            addLogEntry(`Image uploaded to WP Media, id: ${data.id}`, 'success');
            return data.id;
        } else {
            addLogEntry(`Error uploading image to WP Media: ${data.message || 'Unknown error'}`, 'error');
            return null;
        }
    } catch (err) {
        addLogEntry(`Error uploading image to WP Media: ${err.message}`, 'error');
        return null;
    }
}

export {
    renderCreateItemForm
}; 