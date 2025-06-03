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
            'Управление привязками',
            'Привязки товаров',
            'manage_options',
            'slimrate-sync-linking',
            array($this, 'linking_page')
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
        register_setting('slimrate_settings', 'product_matching_strategy', array(
            'sanitize_callback' => 'sanitize_text_field'
        ));
        register_setting('slimrate_settings', 'enable_product_linking', array(
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
        
        add_settings_field(
            'enable_product_linking',
            'Автопривязка товаров',
            array($this, 'enable_product_linking_callback'),
            'slimrate_settings',
            'slimrate_sync_section'
        );
        
        add_settings_field(
            'product_matching_strategy',
            'Стратегия поиска товаров',
            array($this, 'product_matching_strategy_callback'),
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
                        $enable_linking = get_option('enable_product_linking', true);
                        $matching_strategy = get_option('product_matching_strategy', 'auto');
                        ?>
                        <p><strong>Последняя синхронизация:</strong> 
                            <?php echo $last_sync ? date('d.m.Y H:i:s', strtotime($last_sync)) : 'Никогда'; ?>
                        </p>
                        <p><strong>Автоматическая синхронизация:</strong> 
                            <span class="status-<?php echo $auto_sync ? 'enabled' : 'disabled'; ?>">
                                <?php echo $auto_sync ? '🟢 Включена' : '🔴 Отключена'; ?>
                            </span>
                        </p>
                        <p><strong>Автопривязка товаров:</strong> 
                            <span class="status-<?php echo $enable_linking ? 'enabled' : 'disabled'; ?>">
                                <?php echo $enable_linking ? '🟢 Включена' : '🔴 Отключена'; ?>
                            </span>
                            <?php if ($enable_linking): ?>
                                <small style="color: #666;">(Стратегия: <?php 
                                    $strategies = array(
                                        'slimrate_id_only' => 'Только ID',
                                        'sku_priority' => 'Приоритет SKU',
                                        'auto' => 'Умная',
                                        'aggressive' => 'Агрессивная'
                                    );
                                    echo $strategies[$matching_strategy] ?? $matching_strategy;
                                ?>)</small>
                            <?php endif; ?>
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
                        
                        <button type="button" id="search-linkable-btn" class="button button-secondary">
                            🔗 Найти товары для привязки
                        </button>
                    </div>
                    
                    <div id="sync-log" class="sync-log"></div>
                </div>
                
                <div class="slimrate-stats-panel">
                    <h2>Статистика</h2>
                    
                    <?php
                    $sync_manager = new Woo_Sync_Manager();
                    $recent_syncs = $sync_manager->get_sync_history(5);
                    
                    // Получаем статистику товаров
                    global $wpdb;
                    $total_products = wp_count_posts('product')->publish;
                    $synced_products = $wpdb->get_var(
                        "SELECT COUNT(*) FROM {$wpdb->postmeta} 
                        WHERE meta_key = 'slimrate_id' 
                        AND meta_value != ''"
                    );
                    $unsynced_products = $total_products - $synced_products;
                    $sync_percentage = $total_products > 0 ? round(($synced_products / $total_products) * 100, 1) : 0;
                    ?>
                    
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number"><?php echo $total_products; ?></div>
                            <div class="stat-label">Всего товаров WooCommerce</div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-number" style="color: #00a32a;"><?php echo $synced_products; ?></div>
                            <div class="stat-label">Привязано к Slimrate</div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-number" style="color: #d63638;"><?php echo $unsynced_products; ?></div>
                            <div class="stat-label">Не привязано</div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-number" style="color: #2271b1;"><?php echo $sync_percentage; ?>%</div>
                            <div class="stat-label">Процент синхронизации</div>
                        </div>
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
                    
                    <?php if ($unsynced_products > 0 && $enable_linking): ?>
                        <div class="linking-suggestion" style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #856404;">💡 Рекомендация</h4>
                            <p style="margin: 0;">
                                У вас есть <strong><?php echo $unsynced_products; ?></strong> товаров WooCommerce, не привязанных к Slimrate. 
                                Используйте кнопку <strong>"🔗 Найти товары для привязки"</strong> для автоматического поиска совпадений.
                            </p>
                        </div>
                    <?php endif; ?>
                    
                    <?php if (!$enable_linking): ?>
                        <div class="linking-disabled" style="margin-top: 20px; padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #721c24;">⚠️ Автопривязка отключена</h4>
                            <p style="margin: 0;">
                                Автоматическая привязка товаров отключена в настройках. 
                                <a href="<?php echo admin_url('admin.php?page=slimrate-sync-settings'); ?>">Включите её</a> 
                                для автоматического поиска и привязки существующих товаров.
                            </p>
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
     * Страница управления привязками товаров
     */
    public function linking_page() {
        global $wpdb;
        
        // Получаем статистику
        $total_products = wp_count_posts('product')->publish;
        $synced_products = $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->postmeta} 
            WHERE meta_key = 'slimrate_id' 
            AND meta_value != ''"
        );
        $unsynced_products = $total_products - $synced_products;
        
        // Получаем привязанные товары
        $linked_products = $wpdb->get_results(
            "SELECT p.ID, p.post_title, pm.meta_value as slimrate_id, p.post_date
            FROM {$wpdb->posts} p 
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id 
            WHERE p.post_type = 'product' 
            AND p.post_status = 'publish'
            AND pm.meta_key = 'slimrate_id' 
            AND pm.meta_value != ''
            ORDER BY p.post_date DESC
            LIMIT 50"
        );
        
        ?>
        <div class="wrap">
            <h1>Управление привязками товаров</h1>
            
            <div class="linking-dashboard">
                <div class="linking-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div class="stat-card" style="background: white; padding: 20px; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #1d2327;">Всего товаров</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #2271b1;"><?php echo $total_products; ?></div>
                    </div>
                    
                    <div class="stat-card" style="background: white; padding: 20px; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #1d2327;">Привязано</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #00a32a;"><?php echo $synced_products; ?></div>
                    </div>
                    
                    <div class="stat-card" style="background: white; padding: 20px; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #1d2327;">Не привязано</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #d63638;"><?php echo $unsynced_products; ?></div>
                    </div>
                    
                    <div class="stat-card" style="background: white; padding: 20px; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #1d2327;">Процент</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #2271b1;">
                            <?php echo $total_products > 0 ? round(($synced_products / $total_products) * 100, 1) : 0; ?>%
                        </div>
                    </div>
                </div>
                
                <div class="linking-actions" style="margin-bottom: 30px; padding: 20px; background: white; border: 1px solid #ccd0d4; border-radius: 4px;">
                    <h2>Действия с привязками</h2>
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" id="search-linkable-btn" class="button button-primary">
                            🔍 Найти товары для привязки
                        </button>
                        
                        <button type="button" id="refresh-stats-btn" class="button button-secondary">
                            🔄 Обновить статистику
                        </button>
                        
                        <button type="button" id="export-links-btn" class="button button-secondary">
                            📊 Экспорт привязок
                        </button>
                        
                        <a href="<?php echo admin_url('admin.php?page=slimrate-sync-settings'); ?>" class="button button-secondary">
                            ⚙️ Настройки привязки
                        </a>
                    </div>
                    
                    <div style="margin-top: 15px;">
                        <p><strong>Текущие настройки:</strong></p>
                        <ul style="margin: 5px 0;">
                            <li>Автопривязка: 
                                <span style="color: <?php echo get_option('enable_product_linking', true) ? '#00a32a' : '#d63638'; ?>;">
                                    <?php echo get_option('enable_product_linking', true) ? '✅ Включена' : '❌ Отключена'; ?>
                                </span>
                            </li>
                            <li>Стратегия поиска: 
                                <strong><?php 
                                    $strategies = array(
                                        'slimrate_id_only' => 'Только по Slimrate ID',
                                        'sku_priority' => 'Приоритет SKU + Slimrate ID',
                                        'auto' => 'Умная привязка (SKU + название + категория)',
                                        'aggressive' => 'Агрессивная привязка (все критерии)'
                                    );
                                    echo $strategies[get_option('product_matching_strategy', 'auto')] ?? 'Неизвестная';
                                ?></strong>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <?php if (!empty($linked_products)): ?>
                    <div class="linked-products" style="background: white; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h2 style="margin: 0; padding: 20px 20px 0 20px;">Привязанные товары (последние 50)</h2>
                        
                        <table class="wp-list-table widefat fixed striped" style="margin: 20px;">
                            <thead>
                                <tr>
                                    <th style="width: 60px;">ID WC</th>
                                    <th>Название товара</th>
                                    <th style="width: 120px;">Slimrate ID</th>
                                    <th style="width: 100px;">Дата создания</th>
                                    <th style="width: 100px;">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($linked_products as $product): ?>
                                    <tr>
                                        <td><?php echo $product->ID; ?></td>
                                        <td>
                                            <strong><?php echo esc_html($product->post_title); ?></strong>
                                            <div style="margin-top: 5px;">
                                                <a href="<?php echo get_edit_post_link($product->ID); ?>" target="_blank" style="text-decoration: none;">
                                                    📝 Редактировать
                                                </a>
                                                |
                                                <a href="<?php echo get_permalink($product->ID); ?>" target="_blank" style="text-decoration: none;">
                                                    👁️ Просмотр
                                                </a>
                                            </div>
                                        </td>
                                        <td>
                                            <code><?php echo esc_html($product->slimrate_id); ?></code>
                                        </td>
                                        <td><?php echo date('d.m.Y', strtotime($product->post_date)); ?></td>
                                        <td>
                                            <button class="button button-small unlink-product" 
                                                    data-product-id="<?php echo $product->ID; ?>"
                                                    data-product-name="<?php echo esc_attr($product->post_title); ?>"
                                                    style="color: #d63638;">
                                                🔗❌ Отвязать
                                            </button>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                        
                        <?php if (count($linked_products) >= 50): ?>
                            <div style="padding: 20px; text-align: center; color: #666;">
                                Показаны последние 50 привязанных товаров. Всего привязано: <?php echo $synced_products; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php else: ?>
                    <div style="background: white; padding: 40px; text-align: center; border: 1px solid #ccd0d4; border-radius: 4px;">
                        <h3>Привязанные товары не найдены</h3>
                        <p>Запустите синхронизацию или используйте поиск товаров для привязки.</p>
                        <button type="button" id="search-linkable-btn" class="button button-primary">
                            🔍 Найти товары для привязки
                        </button>
                    </div>
                <?php endif; ?>
            </div>
            
            <div id="linking-log" class="sync-log" style="margin-top: 20px;"></div>
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
    
    public function enable_product_linking_callback() {
        $value = get_option('enable_product_linking', true);
        echo '<input type="checkbox" name="enable_product_linking" value="1" ' . checked(1, $value, false) . ' />';
        echo '<label for="enable_product_linking">Включить автоматическую привязку существующих товаров</label>';
        echo '<p class="description">Если включено, плагин будет пытаться найти и привязать существующие товары WooCommerce к товарам Slimrate по SKU, названию или категории</p>';
    }
    
    public function product_matching_strategy_callback() {
        $value = get_option('product_matching_strategy', 'auto');
        $strategies = array(
            'slimrate_id_only' => 'Только по Slimrate ID (безопасно)',
            'sku_priority' => 'Приоритет SKU + Slimrate ID',
            'auto' => 'Умная привязка (SKU + название + категория)',
            'aggressive' => 'Агрессивная привязка (все критерии)'
        );
        
        echo '<select name="product_matching_strategy">';
        foreach ($strategies as $key => $label) {
            echo '<option value="' . esc_attr($key) . '" ' . selected($key, $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select>';
        echo '<p class="description">Выберите стратегию поиска товаров:<br>';
        echo '• <strong>Только по Slimrate ID</strong> - ищет только товары, уже привязанные к Slimrate<br>';
        echo '• <strong>Приоритет SKU</strong> - ищет по SKU, затем по Slimrate ID<br>';
        echo '• <strong>Умная привязка</strong> - ищет по SKU, названию и категории<br>';
        echo '• <strong>Агрессивная</strong> - использует все доступные критерии поиска</p>';
    }
} 