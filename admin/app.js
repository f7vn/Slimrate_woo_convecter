import { loadTaxesData, loadUnitsData, loadCategoriesData } from './dataView.js';
import { renderCreateItemForm } from './createItem.js';

// Добавляем обработчики событий для существующих кнопок
document.getElementById('loadTaxesBtn').addEventListener('click', loadTaxesData);
document.getElementById('loadUnitsBtn').addEventListener('click', loadUnitsData);
document.getElementById('loadCategoriesBtn').addEventListener('click', loadCategoriesData);

// === Форма создания товара ===
renderCreateItemForm();

