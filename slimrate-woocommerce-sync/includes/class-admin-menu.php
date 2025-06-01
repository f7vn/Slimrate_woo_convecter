<?php
/**
 * Класс для создания админ-меню плагина
 */

if (!defined('ABSPATH')) {
    exit;
}

class Slimrate_Admin_Menu {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }
    
    /**
     * Добавить меню в админку
     */
    public function add_admin_menu() {
        // Главная страница плагина
        add_menu_page(
            'Slimrate Sync',
            'Slimrate Sync',
            'manage_options',
            'slimrate-sync',
            array($this, 'main_page'),
            'dashicons-update',
            30
        );
        
        // Подстраницы
        add_submenu_page(
            'slimrate-sync',
            'Синхронизация',
            'Синхронизация',
            'manage_options',
            'slimrate-sync',
            array($this, 'main_page')
        );
        
        add_submenu_page(
            'slimrate-sync',
            'Настройки',
            'Настройки',
            'manage_options',
            'slimrate-sync-settings',
            array($this, 'settings_page')
        );
        
        add_submenu_page(
            'slimrate-sync',
            'История синхронизации',
            'История',
            'manage_options',
            'slimrate-sync-history',
            array($this, 'history_page')
        );
        
        add_submenu_page(
            'slimrate-sync',
            'Создание товаров',
            'Создание товаров',
            'manage_options',
            'slimrate-sync-create',
            array($this, 'create_page')
        );
    }
    
    /**
     * Регистрация настроек
     */
    public function register_settings() {
        // Основная группа настроек - объединяем все в одну группу для корректного сохранения
        register_setting('slimrate_settings', 'slimrate_api_token', array(
            'sanitize_callback' => 'sanitize_text_field'
        ));
        register_setting('slimrate_settings', 'slimrate_api_url', array(
            'sanitize_callback' => 'esc_url_raw'
        ));
        register_setting('slimrate_settings', 'auto_sync_enabled', array(
            'sanitize_callback' => array($this, 'sanitize_checkbox')
        ));
        register_setting('slimrate_settings', 'sync_interval', array(
            'sanitize_callback' => 'sanitize_text_field'
        ));
        register_setting('slimrate_settings', 'debug_mode', array(
            'sanitize_callback' => array($this, 'sanitize_checkbox')
        ));
        
        // Секция API настроек
        add_settings_section(
            'slimrate_api_section',
            'Настройки API Slimrate',
            array($this, 'api_section_callback'),
            'slimrate_settings'
        );
        
        add_settings_field(
            'slimrate_api_url',
            'URL API',
            array($this, 'api_url_callback'),
            'slimrate_settings',
            'slimrate_api_section'
        );
        
        add_settings_field(
            'slimrate_api_token',
            'API Token',
            array($this, 'api_token_callback'),
            'slimrate_settings',
            'slimrate_api_section'
        );
        
        // Секция настроек синхронизации
        add_settings_section(
            'slimrate_sync_section',
            'Настройки синхронизации',
            array($this, 'sync_section_callback'),
            'slimrate_settings'
        );
        
        add_settings_field(
            'auto_sync_enabled',
            'Автоматическая синхронизация',
            array($this, 'auto_sync_callback'),
            'slimrate_settings',
            'slimrate_sync_section'
        );
        
        add_settings_field(
            'sync_interval',
            'Интервал синхронизации',
            array($this, 'sync_interval_callback'),
            'slimrate_settings',
            'slimrate_sync_section'
        );
        
        add_settings_field(
            'debug_mode',
            'Режим отладки',
            array($this, 'debug_mode_callback'),
            'slimrate_settings',
            'slimrate_sync_section'
        );
    }
    
    /**
     * Санитизация checkbox полей
     */
    public function sanitize_checkbox($value) {
        return !empty($value) ? 1 : 0;
    }
    
    /**
     * Главная страница синхронизации
     */
    public function main_page() {
        ?>
        <div class="wrap">
            <h1>Slimrate WooCommerce Sync</h1>
            
            <div class="slimrate-dashboard">
                <div class="slimrate-sync-panel">
                    <h2>Синхронизация товаров</h2>
                    
                    <div class="sync-status">
                        <?php
                        $last_sync = get_option('slimrate_last_sync_time', '');
                        $auto_sync = get_option('auto_sync_enabled', false);
                        ?>
                        <p><strong>Последняя синхронизация:</strong> 
                            <?php echo $last_sync ? date('d.m.Y H:i:s', strtotime($last_sync)) : 'Никогда'; ?>
                        </p>
                        <p><strong>Автоматическая синхронизация:</strong> 
                            <span class="status-<?php echo $auto_sync ? 'enabled' : 'disabled'; ?>">
                                <?php echo $auto_sync ? '🟢 Включена' : '🔴 Отключена'; ?>
                            </span>
                        </p>
                    </div>
                    
                    <div class="sync-controls">
                        <button type="button" id="manual-sync-btn" class="button button-primary button-large">
                            🔄 Запустить синхронизацию
                        </button>
                        
                        <button type="button" id="test-connection-btn" class="button button-secondary">
                            🔗 Проверить подключение
                        </button>
                        
                        <button type="button" id="reset-sync-btn" class="button button-secondary">
                            ↻ Сброс времени синхронизации
                        </button>
                        
                        <button type="button" id="api-diagnostics-btn" class="button button-secondary">
                            🔍 Диагностика API
                        </button>
                    </div>
                    
                    <div id="sync-log" class="sync-log"></div>
                </div>
                
                <div class="slimrate-stats-panel">
                    <h2>Статистика</h2>
                    
                    <?php
                    $sync_manager = new Woo_Sync_Manager();
                    $recent_syncs = $sync_manager->get_sync_history(5);
                    ?>
                    
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number"><?php echo count($recent_syncs); ?></div>
                            <div class="stat-label">Последних синхронизаций</div>
                        </div>
                        
                        <?php if (!empty($recent_syncs)): ?>
                            <?php $last_sync_data = $recent_syncs[0]; ?>
                            <div class="stat-item">
                                <div class="stat-number"><?php echo $last_sync_data->items_processed; ?></div>
                                <div class="stat-label">Обработано товаров</div>
                            </div>
                            
                            <div class="stat-item">
                                <div class="stat-number"><?php echo $last_sync_data->items_created; ?></div>
                                <div class="stat-label">Создано товаров</div>
                            </div>
                            
                            <div class="stat-item">
                                <div class="stat-number"><?php echo $last_sync_data->items_updated; ?></div>
                                <div class="stat-label">Обновлено товаров</div>
                            </div>
                        <?php endif; ?>
                    </div>
                    
                    <?php if (!empty($recent_syncs)): ?>
                        <div class="recent-syncs">
                            <h3>Последние синхронизации</h3>
                            <table class="wp-list-table widefat fixed striped">
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Тип</th>
                                        <th>Результат</th>
                                        <th>Товары</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($recent_syncs as $sync): ?>
                                        <tr>
                                            <td><?php echo date('d.m.Y H:i', strtotime($sync->sync_time)); ?></td>
                                            <td><?php echo $sync->sync_type === 'manual' ? 'Ручная' : 'Авто'; ?></td>
                                            <td>
                                                <span class="status-<?php echo $sync->status; ?>">
                                                    <?php echo $sync->status === 'success' ? '✅ Успешно' : '❌ Ошибка'; ?>
                                                </span>
                                            </td>
                                            <td>
                                                <?php echo $sync->items_processed; ?> 
                                                (<?php echo $sync->items_created; ?>/<?php echo $sync->items_updated; ?>/<?php echo $sync->items_deleted; ?>)
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
    }
    
    /**
     * Страница настроек
     */
    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Настройки Slimrate Sync</h1>
            
            <?php if (isset($_GET['settings-updated'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>Настройки сохранены!</p>
                </div>
            <?php endif; ?>
            
            <!-- Диагностическая информация для проверки токена -->
            <?php if (get_option('debug_mode', false)): ?>
                <div class="notice notice-info">
                    <p><strong>Диагностика токена:</strong></p>
                    <ul>
                        <li>Токен установлен: <?php echo !empty(get_option('slimrate_api_token')) ? 'Да' : 'Нет'; ?></li>
                        <li>Длина токена: <?php echo strlen(get_option('slimrate_api_token', '')); ?> символов</li>
                        <li>API URL: <?php echo esc_html(get_option('slimrate_api_url', '')); ?></li>
                    </ul>
                </div>
            <?php endif; ?>
            
            <div class="slimrate-settings">
                <form method="post" action="options.php">
                    <?php
                    settings_fields('slimrate_settings');
                    do_settings_sections('slimrate_settings');
                    ?>
                    
                    <?php submit_button('Сохранить настройки'); ?>
                </form>
            </div>
        </div>
        <?php
    }
    
    /**
     * Страница истории синхронизации
     */
    public function history_page() {
        $sync_manager = new Woo_Sync_Manager();
        $history = $sync_manager->get_sync_history(100);
        
        ?>
        <div class="wrap">
            <h1>История синхронизации</h1>
            
            <?php if (!empty($history)): ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>Дата и время</th>
                            <th>Тип</th>
                            <th>Статус</th>
                            <th>Обработано</th>
                            <th>Создано</th>
                            <th>Обновлено</th>
                            <th>Удалено</th>
                            <th>Ошибка</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($history as $record): ?>
                            <tr>
                                <td><?php echo date('d.m.Y H:i:s', strtotime($record->sync_time)); ?></td>
                                <td><?php echo $record->sync_type === 'manual' ? 'Ручная' : 'Автоматическая'; ?></td>
                                <td>
                                    <span class="status-<?php echo $record->status; ?>">
                                        <?php echo $record->status === 'success' ? '✅ Успешно' : '❌ Ошибка'; ?>
                                    </span>
                                </td>
                                <td><?php echo $record->items_processed; ?></td>
                                <td><?php echo $record->items_created; ?></td>
                                <td><?php echo $record->items_updated; ?></td>
                                <td><?php echo $record->items_deleted; ?></td>
                                <td>
                                    <?php if ($record->error_message): ?>
                                        <span class="error-message" title="<?php echo esc_attr($record->error_message); ?>">
                                            📋 Показать
                                        </span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p>История синхронизации пуста. Запустите первую синхронизацию.</p>
            <?php endif; ?>
        </div>
        <?php
    }
    
    /**
     * Страница создания товаров
     */
    public function create_page() {
        ?>
        <div class="wrap">
            <h1>Создание товаров</h1>
            <p>Здесь будет форма для создания товаров в Slimrate из WooCommerce</p>
            <!-- TODO: Добавить форму создания товаров -->
        </div>
        <?php
    }
    
    // Callback функции для настроек
    
    public function api_section_callback() {
        echo '<p>Настройте подключение к API Slimrate</p>';
    }
    
    public function sync_section_callback() {
        echo '<p>Настройте параметры автоматической синхронизации</p>';
    }
    
    public function api_url_callback() {
        $value = get_option('slimrate_api_url', 'https://dev.slimrate.com');
        echo '<input type="url" name="slimrate_api_url" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">URL API Slimrate (например: https://dev.slimrate.com)</p>';
    }
    
    public function api_token_callback() {
        $value = get_option('slimrate_api_token', '');
        echo '<input type="password" name="slimrate_api_token" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">API токен для доступа к Slimrate</p>';
    }
    
    public function auto_sync_callback() {
        $value = get_option('auto_sync_enabled', false);
        echo '<input type="checkbox" name="auto_sync_enabled" value="1" ' . checked(1, $value, false) . ' />';
        echo '<label for="auto_sync_enabled">Включить автоматическую синхронизацию</label>';
    }
    
    public function sync_interval_callback() {
        $value = get_option('sync_interval', 'hourly');
        $intervals = array(
            'hourly' => 'Каждый час',
            'twicedaily' => 'Два раза в день',
            'daily' => 'Ежедневно'
        );
        
        echo '<select name="sync_interval">';
        foreach ($intervals as $key => $label) {
            echo '<option value="' . esc_attr($key) . '" ' . selected($key, $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select>';
    }
    
    public function debug_mode_callback() {
        $value = get_option('debug_mode', false);
        echo '<input type="checkbox" name="debug_mode" value="1" ' . checked(1, $value, false) . ' />';
        echo '<label for="debug_mode">Включить режим отладки (логирование в error_log)</label>';
    }
} 