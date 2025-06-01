import { updateItemsFromSlimrate } from '../sync/updateItems.js';
import { addLogEntry } from './utils.js';

// Конфигурация автосинхронизации
let autoSyncConfig = {
    enabled: false,
    intervalMinutes: 30, // Интервал в минутах
    lastSync: null,
    isRunning: false
};

// Сохранение конфигурации в localStorage
function saveAutoSyncConfig() {
    localStorage.setItem('slimrate_autosync_config', JSON.stringify(autoSyncConfig));
}

// Загрузка конфигурации из localStorage
function loadAutoSyncConfig() {
    const saved = localStorage.getItem('slimrate_autosync_config');
    if (saved) {
        autoSyncConfig = { ...autoSyncConfig, ...JSON.parse(saved) };
    }
}

// Переменная для хранения интервала
let syncInterval = null;

// Функция автоматической синхронизации
async function performAutoSync() {
    if (autoSyncConfig.isRunning) {
        addLogEntry('Синхронизация уже запущена, пропускаем...', 'warning', 'scheduler');
        return;
    }

    try {
        autoSyncConfig.isRunning = true;
        autoSyncConfig.lastSync = new Date().toISOString();
        saveAutoSyncConfig();
        
        addLogEntry(`🔄 Автоматическая синхронизация запущена (интервал: ${autoSyncConfig.intervalMinutes} мин)`, 'info', 'scheduler');
        
        // Запускаем синхронизацию
        await updateItemsFromSlimrate();
        
        addLogEntry('✅ Автоматическая синхронизация завершена успешно', 'success', 'scheduler');
        
        // Обновляем UI если есть
        updateAutoSyncStatus();
        
    } catch (error) {
        addLogEntry(`❌ Ошибка автоматической синхронизации: ${error.message}`, 'error', 'scheduler');
    } finally {
        autoSyncConfig.isRunning = false;
        saveAutoSyncConfig();
    }
}

// Запуск автосинхронизации
function startAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    if (!autoSyncConfig.enabled) {
        addLogEntry('Автосинхронизация отключена', 'info', 'scheduler');
        return;
    }
    
    const intervalMs = autoSyncConfig.intervalMinutes * 60 * 1000;
    
    addLogEntry(`🟢 Автосинхронизация включена (каждые ${autoSyncConfig.intervalMinutes} минут)`, 'success', 'scheduler');
    
    // Запускаем первую синхронизацию через 10 секунд
    setTimeout(performAutoSync, 10000);
    
    // Настраиваем периодическую синхронизацию
    syncInterval = setInterval(performAutoSync, intervalMs);
}

// Остановка автосинхронизации
function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    
    autoSyncConfig.enabled = false;
    saveAutoSyncConfig();
    
    addLogEntry('🔴 Автосинхронизация остановлена', 'warning', 'scheduler');
    updateAutoSyncStatus();
}

// Обновление статуса в UI
function updateAutoSyncStatus() {
    const statusElement = document.getElementById('autosync-status');
    const enableButton = document.getElementById('enable-autosync');
    const disableButton = document.getElementById('disable-autosync');
    const intervalInput = document.getElementById('autosync-interval');
    
    if (statusElement) {
        const status = autoSyncConfig.enabled ? 
            `🟢 Включена (каждые ${autoSyncConfig.intervalMinutes} мин)` : 
            '🔴 Отключена';
        
        const lastSync = autoSyncConfig.lastSync ? 
            `Последняя: ${new Date(autoSyncConfig.lastSync).toLocaleString()}` : 
            'Никогда';
            
        statusElement.innerHTML = `
            <strong>Статус:</strong> ${status}<br>
            <strong>Последняя синхронизация:</strong> ${lastSync}
        `;
    }
    
    if (enableButton && disableButton) {
        enableButton.style.display = autoSyncConfig.enabled ? 'none' : 'inline-block';
        disableButton.style.display = autoSyncConfig.enabled ? 'inline-block' : 'none';
    }
    
    if (intervalInput) {
        intervalInput.value = autoSyncConfig.intervalMinutes;
        intervalInput.disabled = autoSyncConfig.enabled;
    }
}

// Настройка интервала
function setAutoSyncInterval(minutes) {
    if (minutes < 5) {
        addLogEntry('Минимальный интервал: 5 минут', 'error', 'scheduler');
        return false;
    }
    
    autoSyncConfig.intervalMinutes = minutes;
    saveAutoSyncConfig();
    
    addLogEntry(`Интервал автосинхронизации изменен на ${minutes} минут`, 'info', 'scheduler');
    
    // Если синхронизация включена, перезапускаем с новым интервалом
    if (autoSyncConfig.enabled) {
        startAutoSync();
    }
    
    return true;
}

// Инициализация при загрузке страницы
function initAutoSync() {
    loadAutoSyncConfig();
    updateAutoSyncStatus();
    
    // Если автосинхронизация была включена, запускаем её
    if (autoSyncConfig.enabled) {
        startAutoSync();
    }
    
    // Настройка обработчиков событий
    const enableButton = document.getElementById('enable-autosync');
    const disableButton = document.getElementById('disable-autosync');
    const intervalInput = document.getElementById('autosync-interval');
    const setIntervalButton = document.getElementById('set-interval');
    
    if (enableButton) {
        enableButton.addEventListener('click', () => {
            autoSyncConfig.enabled = true;
            saveAutoSyncConfig();
            startAutoSync();
        });
    }
    
    if (disableButton) {
        disableButton.addEventListener('click', stopAutoSync);
    }
    
    if (setIntervalButton && intervalInput) {
        setIntervalButton.addEventListener('click', () => {
            const minutes = parseInt(intervalInput.value);
            if (setAutoSyncInterval(minutes)) {
                updateAutoSyncStatus();
            }
        });
    }
}

// Экспорт функций
export { 
    initAutoSync, 
    startAutoSync, 
    stopAutoSync, 
    setAutoSyncInterval,
    updateAutoSyncStatus,
    performAutoSync 
}; 