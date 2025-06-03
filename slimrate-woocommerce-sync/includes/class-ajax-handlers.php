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
        add_action('wp_ajax_slimrate_search_linkable_products', array($this, 'search_linkable_products'));
        add_action('wp_ajax_slimrate_link_product', array($this, 'link_product'));
        add_action('wp_ajax_slimrate_unlink_product', array($this, 'unlink_product'));
        add_action('wp_ajax_slimrate_refresh_stats', array($this, 'refresh_stats'));
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
    
    /**
     * Поиск товаров доступных для привязки
     */
    public function search_linkable_products() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            // Получаем товары из Slimrate
            $api = new Slimrate_API();
            $response = $api->get_items();
            
            if (!isset($response['result']) || !is_array($response['result'])) {
                throw new Exception('Не удалось получить товары из Slimrate');
            }
            
            $slimrate_items = $response['result'];
            $linkable_products = array();
            
            // Получаем товары WooCommerce без slimrate_id
            $woo_products = $this->get_unlinkable_woo_products();
            
            // Анализируем каждый товар Slimrate
            foreach ($slimrate_items as $item) {
                // Пропускаем удаленные товары
                if (!empty($item['deletedAt'])) {
                    continue;
                }
                
                $search_id = isset($item['rootId']) ? $item['rootId'] : $item['id'];
                
                // Проверяем, есть ли уже привязка
                $existing_link = $this->find_existing_link($search_id);
                if ($existing_link) {
                    continue;
                }
                
                // Ищем потенциальные совпадения
                $matches = $this->find_potential_matches($item, $woo_products);
                
                if (!empty($matches)) {
                    $linkable_products[] = array(
                        'slimrate_item' => array(
                            'id' => $search_id,
                            'name' => $this->get_item_name($item),
                            'sku' => $item['skuCode'] ?? '',
                            'category' => $item['category']['displayName'] ?? ''
                        ),
                        'woo_matches' => $matches
                    );
                }
            }
            
            wp_send_json_success(array(
                'linkable_products' => $linkable_products,
                'total_slimrate' => count($slimrate_items),
                'total_woo_unlinked' => count($woo_products),
                'linkable_count' => count($linkable_products)
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка поиска товаров: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Получить товары WooCommerce без привязки к Slimrate
     */
    private function get_unlinkable_woo_products() {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => 'slimrate_id',
                    'compare' => 'NOT EXISTS'
                )
            )
        );
        
        $products = get_posts($args);
        $woo_products = array();
        
        foreach ($products as $post) {
            $product = wc_get_product($post->ID);
            if ($product) {
                $woo_products[] = array(
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'sku' => $product->get_sku(),
                    'categories' => wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names'))
                );
            }
        }
        
        return $woo_products;
    }
    
    /**
     * Найти существующую привязку
     */
    private function find_existing_link($slimrate_id) {
        $args = array(
            'post_type' => 'product',
            'meta_query' => array(
                array(
                    'key' => 'slimrate_id',
                    'value' => $slimrate_id,
                    'compare' => '='
                )
            ),
            'posts_per_page' => 1
        );
        
        $products = get_posts($args);
        return !empty($products);
    }
    
    /**
     * Найти потенциальные совпадения
     */
    private function find_potential_matches($slimrate_item, $woo_products) {
        $matches = array();
        $item_name = $this->get_item_name($slimrate_item);
        $item_sku = $slimrate_item['skuCode'] ?? '';
        $item_category = $slimrate_item['category']['displayName'] ?? '';
        
        foreach ($woo_products as $woo_product) {
            $match_score = 0;
            $match_reasons = array();
            
            // Совпадение по SKU (высший приоритет)
            if (!empty($item_sku) && !empty($woo_product['sku']) && $item_sku === $woo_product['sku']) {
                $match_score += 100;
                $match_reasons[] = 'SKU совпадает';
            }
            
            // Совпадение по названию (высокий приоритет)
            if (strtolower($item_name) === strtolower($woo_product['name'])) {
                $match_score += 80;
                $match_reasons[] = 'Название совпадает точно';
            } elseif (strpos(strtolower($woo_product['name']), strtolower($item_name)) !== false) {
                $match_score += 50;
                $match_reasons[] = 'Название содержится в товаре WooCommerce';
            } elseif (strpos(strtolower($item_name), strtolower($woo_product['name'])) !== false) {
                $match_score += 40;
                $match_reasons[] = 'Название WooCommerce содержится в товаре Slimrate';
            }
            
            // Совпадение по категории
            if (!empty($item_category) && !empty($woo_product['categories'])) {
                foreach ($woo_product['categories'] as $woo_category) {
                    if (strtolower($item_category) === strtolower($woo_category)) {
                        $match_score += 30;
                        $match_reasons[] = 'Категория совпадает';
                        break;
                    }
                }
            }
            
            // Добавляем в результаты если есть хотя бы минимальное совпадение
            if ($match_score > 0) {
                $matches[] = array(
                    'woo_product' => $woo_product,
                    'match_score' => $match_score,
                    'match_reasons' => $match_reasons
                );
            }
        }
        
        // Сортируем по убыванию рейтинга
        usort($matches, function($a, $b) {
            return $b['match_score'] - $a['match_score'];
        });
        
        // Возвращаем только топ-3 совпадения
        return array_slice($matches, 0, 3);
    }
    
    /**
     * Получить название товара из Slimrate
     */
    private function get_item_name($item) {
        if (!empty($item['rootName'])) {
            return $item['rootName'];
        } elseif (!empty($item['wooInfo']['name'])) {
            return $item['wooInfo']['name'];
        } elseif (!empty($item['displayName'])) {
            return $item['displayName'];
        }
        
        return 'Товар без названия';
    }
    
    /**
     * Привязать товар WooCommerce к товару Slimrate
     */
    public function link_product() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        $woo_id = intval($_POST['woo_id']);
        $slimrate_id = sanitize_text_field($_POST['slimrate_id']);
        
        if (empty($woo_id) || empty($slimrate_id)) {
            wp_send_json_error(array(
                'message' => __('Не указаны ID товаров для привязки', 'slimrate-woo-sync')
            ));
            return;
        }
        
        try {
            // Проверяем, существует ли товар WooCommerce
            $product = wc_get_product($woo_id);
            if (!$product) {
                throw new Exception('Товар WooCommerce не найден: ID ' . $woo_id);
            }
            
            // Проверяем, нет ли уже привязки у этого товара
            $existing_slimrate_id = get_post_meta($woo_id, 'slimrate_id', true);
            if (!empty($existing_slimrate_id)) {
                throw new Exception('Товар уже привязан к Slimrate ID: ' . $existing_slimrate_id);
            }
            
            // Проверяем, не привязан ли уже этот Slimrate ID к другому товару
            $existing_link = $this->find_existing_link($slimrate_id);
            if ($existing_link) {
                throw new Exception('Slimrate ID ' . $slimrate_id . ' уже привязан к другому товару');
            }
            
            // Создаем привязку
            update_post_meta($woo_id, 'slimrate_id', $slimrate_id);
            
            // Логируем действие
            error_log('[Slimrate Sync] Ручная привязка: WooCommerce ID ' . $woo_id . ' -> Slimrate ID ' . $slimrate_id);
            
            wp_send_json_success(array(
                'message' => sprintf(
                    __('Товар "%s" (ID: %d) успешно привязан к Slimrate ID: %s', 'slimrate-woo-sync'),
                    $product->get_name(),
                    $woo_id,
                    $slimrate_id
                )
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка привязки: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Отвязать товар WooCommerce от товара Slimrate
     */
    public function unlink_product() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        $woo_id = intval($_POST['woo_id']);
        
        if (empty($woo_id)) {
            wp_send_json_error(array(
                'message' => __('Не указан ID товара для отвязки', 'slimrate-woo-sync')
            ));
            return;
        }
        
        try {
            // Проверяем, существует ли товар WooCommerce
            $product = wc_get_product($woo_id);
            if (!$product) {
                throw new Exception('Товар WooCommerce не найден: ID ' . $woo_id);
            }
            
            // Получаем текущий Slimrate ID товара
            $slimrate_id = get_post_meta($woo_id, 'slimrate_id', true);
            if (empty($slimrate_id)) {
                throw new Exception('Товар не привязан к Slimrate');
            }
            
            // Удаляем привязку
            delete_post_meta($woo_id, 'slimrate_id');
            
            // Логируем действие
            error_log('[Slimrate Sync] Ручная отвязка: WooCommerce ID ' . $woo_id . ' -> Slimrate ID ' . $slimrate_id);
            
            wp_send_json_success(array(
                'message' => sprintf(
                    __('Товар "%s" (ID: %d) успешно отвязан от Slimrate ID: %s', 'slimrate-woo-sync'),
                    $product->get_name(),
                    $woo_id,
                    $slimrate_id
                )
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка отвязки: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
    
    /**
     * Обновление статистики WooCommerce
     */
    public function refresh_stats() {
        // Проверка безопасности
        if (!current_user_can('manage_options') || !wp_verify_nonce($_POST['nonce'], 'slimrate_sync_nonce')) {
            wp_die(__('Недостаточно прав доступа', 'slimrate-woo-sync'));
        }
        
        try {
            $this->get_woo_stats();
            
        } catch (Exception $e) {
            wp_send_json_error(array(
                'message' => __('Ошибка обновления статистики: ', 'slimrate-woo-sync') . $e->getMessage()
            ));
        }
    }
} 