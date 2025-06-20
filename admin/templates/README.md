# HTML Шаблоны админ-панели

## Структура

Все HTML шаблоны вынесены в отдельные файлы для лучшей организации кода.

### Созданные шаблоны:

1. **create-item-form.html** - Основная форма создания товара
   - Содержит структуру формы с шагами
   - Поля основной информации о товаре
   - Контейнер для динамического содержимого

2. **simple-product-form.html** - Форма простого товара
   - Поля цен и характеристик
   - Управление складом
   - Галерея изображений

### Система загрузки шаблонов

**templateLoader.js** - модуль для работы с шаблонами:
- `loadTemplate(name)` - загружает шаблон по имени
- `loadTemplates([names])` - загружает несколько шаблонов
- `renderTemplate(template, data)` - заменяет плейсхолдеры {{key}} на данные
- `loadAndRenderTemplate(name, data)` - загружает и рендерит шаблон
- Кэширование загруженных шаблонов

### Изменения в JavaScript файлах:

1. **createItem.js**:
   - `renderCreateItemForm()` теперь async функция
   - Загружает шаблон из файла вместо встроенного HTML

2. **simpleProduct.js**:
   - `renderSimpleProductForm()` теперь async функция
   - JavaScript логика вынесена в `initSimpleProductForm()`
   - Разделение HTML и JavaScript кода

3. **app.js**:
   - DOMContentLoaded handler теперь async
   - Ожидает загрузки шаблонов при инициализации

### Преимущества новой структуры:

1. **Разделение ответственности** - HTML отдельно от JavaScript
2. **Легче поддерживать** - изменения в разметке не требуют правки JS
3. **Кэширование** - шаблоны загружаются один раз
4. **Переиспользование** - шаблоны можно использовать в разных местах
5. **Чистый код** - JavaScript файлы стали компактнее

### Следующие шаги:

Нужно вынести HTML из следующих файлов:
- variableProduct.js - форма вариативного товара
- gallery.js - элементы галереи
- Inline HTML в app.js для загрузки данных

### Проверка работы:

1. Запустите локальный сервер: `python3 -m http.server 8000`
2. Откройте http://localhost:8000
3. Проверьте что формы загружаются корректно
4. Проверьте работу всех интерактивных элементов 