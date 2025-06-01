# Структура JavaScript файлов

## Организация папок

JavaScript файлы организованы в логические группы для лучшей поддержки и масштабирования проекта.

### 📁 core/
Основные системные файлы и утилиты:
- **config.js** - конфигурация (токены, URL)
- **utils.js** - общие утилитные функции (логирование, API запросы)
- **templateLoader.js** - система загрузки HTML шаблонов

### 📁 components/
Переиспользуемые UI компоненты:
- **tabs.js** - система вкладок
- **gallery.js** - управление галереей изображений

### 📁 products/
Логика работы с товарами:
- **createItem.js** - основная логика создания товаров
- **simpleProduct.js** - работа с простыми товарами
- **variableProduct.js** - работа с вариативными товарами

### 📁 sync/
Синхронизация и обновление данных:
- **updateItems.js** - обновление товаров из Slimrate

### 📁 test/
Тестовые файлы:
- **test.js** - тестовые функции

## Правила импортов

### Относительные импорты
```javascript
// Из products/ в core/
import { config } from '../core/config.js';

// Из products/ в components/
import { gallery } from '../components/gallery.js';

// Внутри одной папки
import { simpleProduct } from './simpleProduct.js';
```

### Абсолютные импорты от корня admin/
```javascript
// В app.js
import { createItem } from './js/products/createItem.js';
```

## Зависимости между модулями

```
app.js
├── js/core/config.js
├── js/core/utils.js
├── js/products/createItem.js
│   ├── js/core/config.js
│   ├── js/core/utils.js
│   ├── js/core/templateLoader.js
│   ├── js/products/simpleProduct.js
│   ├── js/products/variableProduct.js
│   └── js/components/gallery.js
├── js/components/tabs.js
└── js/sync/updateItems.js
    ├── js/core/config.js
    └── js/core/utils.js
```

## Преимущества структуры

1. **Модульность** - каждая папка отвечает за свою область
2. **Масштабируемость** - легко добавлять новые модули
3. **Переиспользование** - компоненты можно использовать в разных местах
4. **Понятная структура** - легко найти нужный файл
5. **Изоляция** - изменения в одном модуле не влияют на другие

## Добавление новых файлов

При добавлении нового JavaScript файла:
1. Определите к какой логической группе он относится
2. Поместите в соответствующую папку
3. Используйте правильные относительные импорты
4. Обновите эту документацию 