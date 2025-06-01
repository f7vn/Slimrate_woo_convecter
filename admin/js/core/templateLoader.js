// Кэш для загруженных шаблонов
const templateCache = new Map();

/**
 * Загружает HTML шаблон из файла
 * @param {string} templateName - Имя файла шаблона без расширения
 * @returns {Promise<string>} - HTML содержимое шаблона
 */
export async function loadTemplate(templateName) {
    // Проверяем кэш
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }
    
    try {
        const response = await fetch(`templates/${templateName}.html`);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить шаблон ${templateName}: ${response.status}`);
        }
        
        const template = await response.text();
        templateCache.set(templateName, template);
        return template;
    } catch (error) {
        console.error(`Ошибка загрузки шаблона ${templateName}:`, error);
        throw error;
    }
}

/**
 * Загружает несколько шаблонов одновременно
 * @param {string[]} templateNames - Массив имен шаблонов
 * @returns {Promise<Object>} - Объект с загруженными шаблонами
 */
export async function loadTemplates(templateNames) {
    const templates = {};
    const promises = templateNames.map(async (name) => {
        templates[name] = await loadTemplate(name);
    });
    
    await Promise.all(promises);
    return templates;
}

/**
 * Заменяет плейсхолдеры в шаблоне на значения
 * @param {string} template - HTML шаблон
 * @param {Object} data - Данные для замены
 * @returns {string} - Обработанный HTML
 */
export function renderTemplate(template, data = {}) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data.hasOwnProperty(key) ? data[key] : match;
    });
}

/**
 * Загружает и рендерит шаблон с данными
 * @param {string} templateName - Имя шаблона
 * @param {Object} data - Данные для замены
 * @returns {Promise<string>} - Обработанный HTML
 */
export async function loadAndRenderTemplate(templateName, data = {}) {
    const template = await loadTemplate(templateName);
    return renderTemplate(template, data);
}

/**
 * Очищает кэш шаблонов
 */
export function clearTemplateCache() {
    templateCache.clear();
}

/**
 * Предзагружает шаблоны при инициализации
 * @param {string[]} templateNames - Массив имен шаблонов для предзагрузки
 */
export async function preloadTemplates(templateNames) {
    try {
        await loadTemplates(templateNames);
        console.log(`Предзагружено ${templateNames.length} шаблонов`);
    } catch (error) {
        console.error('Ошибка предзагрузки шаблонов:', error);
    }
} 