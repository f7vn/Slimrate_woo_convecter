<?php
/**
 * Plugin Name: Slimrate WooCommerce Sync
 * Plugin URI: https://yoursite.com
 * Description: Синхронизация товаров между Slimrate и WooCommerce с автоматическим обновлением
 * Version: 1.0.0
 * Author: Your Name
 * License: GPL v2 or later
 * Text Domain: slimrate-woo-sync
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Предотвращаем прямой доступ
if (!defined('ABSPATH')) {
    exit;
}

// Определяем константы плагина
define('SLIMRATE_WOO_SYNC_VERSION', '1.0.0');
define('SLIMRATE_WOO_SYNC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SLIMRATE_WOO_SYNC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SLIMRATE_WOO_SYNC_PLUGIN_FILE', __FILE__);

/**
 * Основной класс плагина
 */
class SlimrateWooCommerceSync {
    
    /**
     * Единственный экземпляр класса
     */
    private static $instance = null;
    
    /**
     * Получить экземпляр класса (Singleton)
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Конструктор
     */
    private function __construct() {
        add_action('init', array($this, 'init'));
        
        // Хуки активации и деактивации
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Инициализация плагина
     */
    public function init() {
        // Проверяем, установлен ли WooCommerce
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        // Загружаем текстовый домен для переводов
        load_plugin_textdomain('slimrate-woo-sync', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Инициализируем компоненты плагина
        $this->includes();
        $this->init_hooks();
    }
    
    /**
     * Подключаем файлы
     */
    private function includes() {
        require_once SLIMRATE_WOO_SYNC_PLUGIN_DIR . 'includes/class-slimrate-api.php';
        require_once SLIMRATE_WOO_SYNC_PLUGIN_DIR . 'includes/class-woo-sync-manager.php';
        require_once SLIMRATE_WOO_SYNC_PLUGIN_DIR . 'includes/class-admin-menu.php';
        require_once SLIMRATE_WOO_SYNC_PLUGIN_DIR . 'includes/class-cron-scheduler.php';
        require_once SLIMRATE_WOO_SYNC_PLUGIN_DIR . 'includes/class-ajax-handlers.php';
    }
    
    /**
     * Инициализируем хуки
     */
    private function init_hooks() {
        // Админ меню
        new Slimrate_Admin_Menu();
        
        // AJAX обработчики
        new Slimrate_Ajax_Handlers();
        
        // Планировщик задач
        new Slimrate_Cron_Scheduler();
        
        // Добавляем стили и скрипты
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
    }
    
    /**
     * Подключаем стили и скрипты для админки
     */
    public function admin_enqueue_scripts($hook) {
        // Подключаем только на страницах нашего плагина
        if (strpos($hook, 'slimrate-sync') === false) {
            return;
        }
        
        wp_enqueue_style(
            'slimrate-admin-style',
            SLIMRATE_WOO_SYNC_PLUGIN_URL . 'assets/css/admin-style.css',
            array(),
            SLIMRATE_WOO_SYNC_VERSION
        );
        
        wp_enqueue_script(
            'slimrate-admin-script',
            SLIMRATE_WOO_SYNC_PLUGIN_URL . 'assets/js/admin-script.js',
            array('jquery'),
            SLIMRATE_WOO_SYNC_VERSION,
            true
        );
        
        // Локализация для AJAX
        wp_localize_script('slimrate-admin-script', 'slimrateAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('slimrate_sync_nonce'),
            'strings' => array(
                'sync_started' => __('Синхронизация запущена...', 'slimrate-woo-sync'),
                'sync_completed' => __('Синхронизация завершена!', 'slimrate-woo-sync'),
                'sync_error' => __('Ошибка синхронизации', 'slimrate-woo-sync'),
            )
        ));
    }
    
    /**
     * Активация плагина
     */
    public function activate() {
        // Создаем таблицы в БД если нужно
        $this->create_tables();
        
        // Устанавливаем настройки по умолчанию
        $this->set_default_options();
        
        // Планируем первую задачу Cron
        if (!wp_next_scheduled('slimrate_auto_sync')) {
            wp_schedule_event(time(), 'hourly', 'slimrate_auto_sync');
        }
        
        // Обновляем правила перезаписи URL
        flush_rewrite_rules();
    }
    
    /**
     * Деактивация плагина
     */
    public function deactivate() {
        // Останавливаем задачи Cron
        wp_clear_scheduled_hook('slimrate_auto_sync');
        
        // Обновляем правила перезаписи URL
        flush_rewrite_rules();
    }
    
    /**
     * Создаем таблицы БД
     */
    private function create_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'slimrate_sync_log';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            sync_time datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            sync_type varchar(50) NOT NULL,
            items_processed int(11) DEFAULT 0 NOT NULL,
            items_created int(11) DEFAULT 0 NOT NULL,
            items_updated int(11) DEFAULT 0 NOT NULL,
            items_deleted int(11) DEFAULT 0 NOT NULL,
            status varchar(20) DEFAULT 'success' NOT NULL,
            error_message text,
            last_updated_at datetime,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    /**
     * Устанавливаем настройки по умолчанию
     */
    private function set_default_options() {
        $default_options = array(
            'slimrate_api_token' => '',
            'slimrate_api_url' => 'https://dev.slimrate.com',
            'auto_sync_enabled' => false,
            'sync_interval' => 'hourly',
            'last_sync_time' => '',
            'debug_mode' => false,
            'enable_product_linking' => true,
            'product_matching_strategy' => 'auto',
        );
        
        foreach ($default_options as $option_name => $default_value) {
            if (get_option($option_name) === false) {
                update_option($option_name, $default_value);
            }
        }
    }
    
    /**
     * Уведомление об отсутствии WooCommerce
     */
    public function woocommerce_missing_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php _e('Плагин Slimrate WooCommerce Sync требует установленный и активированный WooCommerce.', 'slimrate-woo-sync'); ?></p>
        </div>
        <?php
    }
}

/**
 * Запускаем плагин
 */
function slimrate_woo_sync() {
    return SlimrateWooCommerceSync::get_instance();
}

// Инициализируем плагин
slimrate_woo_sync(); 