<?php
/**
 * AJAX обработчики для админ-панели
 */

if (!defined('ABSPATH')) {
    exit;
}

class Slimrate_Ajax_Handlers {
    
    public function __construct() {
        // Регистрируем AJAX хуки для авторизованных пользователей
        add_action('wp_ajax_slimrate_manual_sync', array($this, 'manual_sync'));
        add_action('wp_ajax_slimrate_test_connection', array($this, 'test_connection'));
        add_action('wp_ajax_slimrate_reset_sync_time', array($this, 'reset_sync_time'));
        add_action('wp_ajax_slimrate_get_sync_status', array($this, 'get_sync_status'));
        add_action('wp_ajax_slimrate_get_scheduler_info', array($this, 'get_scheduler_info'));
        add_action('wp_ajax_slimrate_get_api_diagnostics', array($this, 'get_api_diagnostics'));
    }
    
    /**
     * Запуск ручной синхронизации
     */
    public function manual_sync() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            // Создаем менеджер синхронизации
            $sync_manager = new Woo_Sync_Manager();
            
            // Запускаем ручную синхронизацию
            $result = $sync_manager->sync_items(true); // true = ручная синхронизация
            
            if ($result['success']) {
                wp_send_json_success(array(
                    'message' => __('Синхронизация завершена успешно!', 'slimrate-woo-sync'),
                    'stats' => $result['stats'],
                    'details' => sprintf(
                        __('Обработано: %d, создано: %d, обновлено: %d, удалено: %d', 'slimrate-woo-sync'),
                        $result['stats']['processed'],
                        $result['stats']['created'],
                        $result['stats']['updated'],
                        $result['stats']['deleted']
                    )
                ));
            } else {
                wp_send_json_error(array(
                    'message' => __('Ошибка синхронизации: ', 'slimrate-woo-sync') . $result['error'],
                    'stats' => $result['stats']
                ));
            }
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Критическая ошибка: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Проверка подключения к API
     */
    public function test_connection() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $api = new Slimrate_API();
            
            // Получаем диагностику перед тестом
            $diagnostics = $api->get_detailed_diagnostics();
            
            // Проверяем настройки токена
            if (empty(get_option('slimrate_api_token', ''))) {
                wp_send_json_error(array(
                    'message' => __('API токен не установлен. Перейдите в настройки и введите токен.', 'slimrate-woo-sync'),
                    'diagnostics' => $diagnostics
                ));
                return;
            }
            
            $test_result = $api->test_connection();
            
            if ($test_result['success']) {
                $categories_count = isset($test_result['data']['result']) ? count($test_result['data']['result']) : 0;
                
                wp_send_json_success(array(
                    'message' => $test_result['message'],
                    'details' => sprintf(
                        __('Подключение успешно! Получено категорий: %d', 'slimrate-woo-sync'),
                        $categories_count
                    ),
                    'api_info' => $api->get_api_stats(),
                    'diagnostics' => $diagnostics
                ));
            } else {
                wp_send_json_error(array(
                    'message' => $test_result['message'],
                    'api_info' => $api->get_api_stats(),
                    'diagnostics' => $diagnostics
                ));
            }
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка подключения: ', 'slimrate-woo-sync') . $e->getMessage(),
                'diagnostics' => isset($diagnostics) ? $diagnostics : null
            ));
        }
    }
    
    /**
     * Сброс времени последней синхронизации
     */
    public function reset_sync_time() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $sync_manager = new Woo_Sync_Manager();
            $sync_manager->reset_last_sync_time();
            
            wp_send_json_success(array(
                'message' => __('Время последней синхронизации сброшено. Следующая синхронизация загрузит товары за последние 24 часа.', 'slimrate-woo-sync')
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка сброса: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получение статуса синхронизации
     */
    public function get_sync_status() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $sync_manager = new Woo_Sync_Manager();
            $recent_syncs = $sync_manager->get_sync_history(1);
            
            $status = array(
                'last_sync_time' => get_option('slimrate_last_sync_time', ''),
                'auto_sync_enabled' => get_option('auto_sync_enabled', false),
                'sync_interval' => get_option('sync_interval', 'hourly'),
                'recent_sync' => !empty($recent_syncs) ? $recent_syncs[0] : null
            );
            
            wp_send_json_success($status);
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка получения статуса: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получение информации о планировщике
     */
    public function get_scheduler_info() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $scheduler = new Slimrate_Cron_Scheduler();
            $status = $scheduler->get_scheduler_status();
            $cron_info = $scheduler->get_cron_info();
            
            wp_send_json_success(array(
                'scheduler_status' => $status,
                'cron_info' => $cron_info,
                'wordpress_timezone' => wp_timezone_string(),
                'server_time' => date('Y-m-d H:i:s'),
                'wp_time' => current_time('Y-m-d H:i:s')
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка получения информации о планировщике: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получение логов синхронизации (для real-time обновления)
     */
    public function get_sync_logs() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $sync_manager = new Woo_Sync_Manager();
            $limit = isset($_POST['limit']) ? intval($_POST['limit']) : 20;
            $logs = $sync_manager->get_sync_history($limit);
            
            wp_send_json_success(array(
                'logs' => $logs,
                'count' => count($logs)
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка получения логов: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Принудительный запуск автосинхронизации
     */
    public function force_auto_sync() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $scheduler = new Slimrate_Cron_Scheduler();
            $scheduler->force_run_sync();
            
            wp_send_json_success(array(
                'message' => __('Автосинхронизация запущена принудительно. Проверьте результаты через несколько минут.', 'slimrate-woo-sync')
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка запуска автосинхронизации: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получение статистики WooCommerce
     */
    public function get_woo_stats() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            global $wpdb;
            
            // Получаем статистику WooCommerce
            $total_products = wp_count_posts('product')->publish;
            
            $synced_products = $wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->postmeta} 
                WHERE meta_key = 'slimrate_id' 
                AND meta_value != ''"
            );
            
            $categories_count = wp_count_terms('product_cat');
            
            wp_send_json_success(array(
                'total_products' => $total_products,
                'synced_products' => $synced_products,
                'categories_count' => $categories_count,
                'sync_percentage' => $total_products > 0 ? round(($synced_products / $total_products) * 100, 1) : 0
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка получения статистики: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получение диагностики API
     */
    public function get_api_diagnostics() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $api = new Slimrate_API();
            $diagnostics = $api->get_detailed_diagnostics();
            
            wp_send_json_success(array(
                'diagnostics' => $diagnostics,
                'api_stats' => $api->get_api_stats()
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка диагностики: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
} 