<?php
/**
 * Менеджер синхронизации с WooCommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

class Woo_Sync_Manager {
    
    private $slimrate_api;
    private $log_table;
    
    public function __construct() {
        $this->slimrate_api = new Slimrate_API();
        global $wpdb;
        $this->log_table = $wpdb->prefix . 'slimrate_sync_log';
    }
    
    /**
     * Выполнить полную синхронизацию
     */
    public function sync_items($manual = false) {
        $sync_start_time = current_time('mysql');
        $sync_type = $manual ? 'manual' : 'auto';
        
        $stats = array(
            'processed' => 0,
            'created' => 0,
            'updated' => 0,
            'deleted' => 0,
            'errors' => array()
        );
        
        try {
            // Получаем время последней синхронизации
            $last_sync_time = get_option('slimrate_last_sync_time', '');
            
            if (empty($last_sync_time)) {
                // Первая синхронизация - берем товары за последние 24 часа
                $last_sync_time = date('c', strtotime('-24 hours'));
            }
            
            $this->log_message('Начало синхронизации. Последняя синхронизация: ' . $last_sync_time);
            
            // Получаем товары из Slimrate
            $response = $this->slimrate_api->get_items($last_sync_time);
            
            if (isset($response['result']) && is_array($response['result'])) {
                $items = $response['result'];
                $stats['processed'] = count($items);
                
                $this->log_message('Получено товаров для обработки: ' . $stats['processed']);
                
                foreach ($items as $item) {
                    try {
                        if (isset($item['deletedAt']) && !empty($item['deletedAt'])) {
                            // Товар удален в Slimrate
                            if ($this->delete_woo_product($item)) {
                                $stats['deleted']++;
                            }
                        } else {
                            // Товар создан или обновлен
                            $result = $this->process_item($item);
                            if ($result === 'created') {
                                $stats['created']++;
                            } elseif ($result === 'updated') {
                                $stats['updated']++;
                            }
                        }
                    } catch (Exception $e) {
                        $stats['errors'][] = 'Ошибка обработки товара ' . $item['id'] . ': ' . $e->getMessage();
                        $this->log_message('Ошибка обработки товара ' . $item['id'] . ': ' . $e->getMessage(), 'error');
                    }
                }
                
                // Обновляем время последней синхронизации
                update_option('slimrate_last_sync_time', date('c'));
                
            } else {
                throw new Exception('Некорректный ответ от API Slimrate');
            }
            
            // Записываем лог синхронизации
            $this->log_sync_result($sync_start_time, $sync_type, $stats, 'success');
            
            $this->log_message('Синхронизация завершена. Обработано: ' . $stats['processed'] . ', создано: ' . $stats['created'] . ', обновлено: ' . $stats['updated'] . ', удалено: ' . $stats['deleted']);
            
            return array(
                'success' => true,
                'stats' => $stats,
                'message' => 'Синхронизация завершена успешно'
            );
            
        } catch (Exception $e) {
            $error_message = $e->getMessage();
            $this->log_sync_result($sync_start_time, $sync_type, $stats, 'error', $error_message);
            $this->log_message('Критическая ошибка синхронизации: ' . $error_message, 'error');
            
            return array(
                'success' => false,
                'error' => $error_message,
                'stats' => $stats
            );
        }
    }
    
    /**
     * Обработать отдельный товар
     */
    private function process_item($item) {
        // Определяем тип товара
        $is_variation = isset($item['varName']) && !empty(trim($item['varName']));
        
        if ($is_variation) {
            return $this->process_variation($item);
        } else {
            return $this->process_simple_product($item);
        }
    }
    
    /**
     * Обработать простой товар
     */
    private function process_simple_product($item) {
        $search_id = isset($item['rootId']) ? $item['rootId'] : $item['id'];
        
        // Ищем существующий товар в WooCommerce по разным критериям
        $existing_product = $this->find_existing_woo_product($item, $search_id);
        
        if ($existing_product) {
            // Обновляем существующий товар
            $this->update_woo_product($existing_product, $item);
            
            // Убеждаемся, что у товара есть правильный slimrate_id
            $this->ensure_slimrate_id($existing_product, $search_id);
            
            return 'updated';
        } else {
            // Создаем новый товар
            $this->create_woo_product($item);
            return 'created';
        }
    }
    
    /**
     * Найти существующий товар WooCommerce по множественным критериям
     */
    private function find_existing_woo_product($item, $search_id) {
        $strategy = get_option('product_matching_strategy', 'auto');
        $enable_linking = get_option('enable_product_linking', true);
        
        // 1. Всегда сначала ищем по slimrate_id (самый надежный способ)
        $product = $this->find_woo_product_by_slimrate_id($search_id);
        if ($product) {
            $this->log_message('Найден товар по Slimrate ID: ' . $search_id . ' -> WooCommerce ID: ' . $product->get_id());
            return $product;
        }
        
        // Если автопривязка отключена или стратегия только по ID - выходим
        if (!$enable_linking || $strategy === 'slimrate_id_only') {
            return null;
        }
        
        // 2. Ищем по SKU (если стратегия это поддерживает)
        if (in_array($strategy, ['sku_priority', 'auto', 'aggressive']) && !empty($item['skuCode'])) {
            $product = $this->find_woo_product_by_sku($item['skuCode']);
            if ($product) {
                $this->log_message('Найден товар по SKU: ' . $item['skuCode'] . ' -> WooCommerce ID: ' . $product->get_id() . ' (будет привязан к Slimrate ID: ' . $search_id . ')');
                return $product;
            }
        }
        
        // 3. Ищем по точному названию товара (для auto и aggressive)
        if (in_array($strategy, ['auto', 'aggressive'])) {
            $product_name = $this->get_product_name($item);
            if (!empty($product_name) && $product_name !== 'Товар без названия') {
                $product = $this->find_woo_product_by_name($product_name);
                if ($product) {
                    $this->log_message('Найден товар по названию: "' . $product_name . '" -> WooCommerce ID: ' . $product->get_id() . ' (будет привязан к Slimrate ID: ' . $search_id . ')');
                    return $product;
                }
            }
        }
        
        // 4. Ищем по комбинации названия и категории (только для aggressive)
        if ($strategy === 'aggressive' && !empty($item['category']['displayName'])) {
            $product_name = $this->get_product_name($item);
            $product = $this->find_woo_product_by_name_and_category($product_name, $item['category']['displayName']);
            if ($product) {
                $this->log_message('Найден товар по названию и категории: "' . $product_name . '" в "' . $item['category']['displayName'] . '" -> WooCommerce ID: ' . $product->get_id() . ' (будет привязан к Slimrate ID: ' . $search_id . ')');
                return $product;
            }
        }
        
        // Товар не найден
        $this->log_message('Товар не найден по критериям стратегии "' . $strategy . '" для Slimrate ID: ' . $search_id);
        return null;
    }
    
    /**
     * Найти товар WooCommerce по Slimrate ID
     */
    private function find_woo_product_by_slimrate_id($slimrate_id) {
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
        
        if (!empty($products)) {
            return wc_get_product($products[0]->ID);
        }
        
        return null;
    }
    
    /**
     * Найти товар WooCommerce по SKU
     */
    private function find_woo_product_by_sku($sku) {
        if (empty($sku)) {
            return null;
        }
        
        $product_id = wc_get_product_id_by_sku($sku);
        
        if ($product_id) {
            $product = wc_get_product($product_id);
            // Проверяем, что у товара еще нет slimrate_id (чтобы не перезаписать существующую связь)
            if ($product && empty(get_post_meta($product_id, 'slimrate_id', true))) {
                return $product;
            }
        }
        
        return null;
    }
    
    /**
     * Найти товар WooCommerce по точному названию
     */
    private function find_woo_product_by_name($name) {
        if (empty($name)) {
            return null;
        }
        
        global $wpdb;
        
        // Ищем товары по точному названию через SQL запрос
        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT p.ID FROM {$wpdb->posts} p 
            LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = 'slimrate_id'
            WHERE p.post_type = 'product' 
            AND p.post_status = 'publish' 
            AND p.post_title = %s 
            AND pm.meta_id IS NULL
            LIMIT 1",
            $name
        ));
        
        if ($product_id) {
            return wc_get_product($product_id);
        }
        
        return null;
    }
    
    /**
     * Найти товар WooCommerce по названию и категории
     */
    private function find_woo_product_by_name_and_category($name, $category_name) {
        if (empty($name) || empty($category_name)) {
            return null;
        }
        
        // Сначала найдем категорию
        $category = get_term_by('name', $category_name, 'product_cat');
        
        if (!$category) {
            return null;
        }
        
        global $wpdb;
        
        // Ищем товары по названию и категории через SQL
        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT p.ID FROM {$wpdb->posts} p 
            LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = 'slimrate_id'
            LEFT JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            LEFT JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'product_cat'
            WHERE p.post_type = 'product' 
            AND p.post_status = 'publish' 
            AND p.post_title = %s 
            AND tt.term_id = %d
            AND pm.meta_id IS NULL
            LIMIT 1",
            $name,
            $category->term_id
        ));
        
        if ($product_id) {
            return wc_get_product($product_id);
        }
        
        return null;
    }
    
    /**
     * Убедиться, что у товара есть правильный slimrate_id
     */
    private function ensure_slimrate_id($product, $slimrate_id) {
        $current_slimrate_id = get_post_meta($product->get_id(), 'slimrate_id', true);
        
        if (empty($current_slimrate_id) || $current_slimrate_id !== $slimrate_id) {
            update_post_meta($product->get_id(), 'slimrate_id', $slimrate_id);
            $this->log_message('Обновлен slimrate_id для товара WooCommerce ID: ' . $product->get_id() . ' -> ' . $slimrate_id);
        }
    }
    
    /**
     * Обработать вариацию товара
     */
    private function process_variation($item) {
        // TODO: Реализовать обработку вариаций
        $this->log_message('Обработка вариаций пока не реализована для товара: ' . $item['id'], 'warning');
        return false;
    }
    
    /**
     * Создать новый товар в WooCommerce
     */
    private function create_woo_product($item) {
        $product = new WC_Product_Simple();
        
        // Основные данные товара
        $product->set_name($this->get_product_name($item));
        $product->set_description($item['description'] ?? '');
        $product->set_short_description($item['wooInfo']['shortDescription'] ?? '');
        $product->set_sku($item['skuCode'] ?? '');
        
        // Цены
        if (isset($item['strikeThroughPrice']) && isset($item['price'])) {
            $product->set_regular_price($item['strikeThroughPrice']);
            $product->set_sale_price($item['price']);
        } elseif (isset($item['price'])) {
            $product->set_regular_price($item['price']);
        }
        
        // Управление складом
        if (isset($item['quantity'])) {
            $product->set_manage_stock(true);
            $product->set_stock_quantity($item['quantity']);
            $product->set_stock_status($item['quantity'] > 0 ? 'instock' : 'outofstock');
        }
        
        // Категория
        if (isset($item['category'])) {
            $category_id = $this->get_or_create_category($item['category']);
            if ($category_id) {
                $product->set_category_ids(array($category_id));
            }
        }
        
        // Изображения
        if (isset($item['wooInfo']['pictures']) && is_array($item['wooInfo']['pictures'])) {
            $this->set_product_images($product, $item['wooInfo']['pictures']);
        } elseif (isset($item['image'])) {
            $this->set_product_images($product, array($item['image']));
        }
        
        // Сохраняем товар
        $product_id = $product->save();
        
        // Добавляем meta-поле с ID из Slimrate
        $search_id = isset($item['rootId']) ? $item['rootId'] : $item['id'];
        update_post_meta($product_id, 'slimrate_id', $search_id);
        
        $this->log_message('Создан новый товар WooCommerce ID: ' . $product_id . ' (Slimrate ID: ' . $search_id . ')');
        
        return $product_id;
    }
    
    /**
     * Обновить существующий товар WooCommerce
     */
    private function update_woo_product($product, $item) {
        // Обновляем основные данные
        $product->set_name($this->get_product_name($item));
        $product->set_description($item['description'] ?? '');
        $product->set_short_description($item['wooInfo']['shortDescription'] ?? '');
        $product->set_sku($item['skuCode'] ?? '');
        
        // Обновляем цены
        if (isset($item['strikeThroughPrice']) && isset($item['price'])) {
            $product->set_regular_price($item['strikeThroughPrice']);
            $product->set_sale_price($item['price']);
        } elseif (isset($item['price'])) {
            $product->set_regular_price($item['price']);
            $product->set_sale_price('');
        }
        
        // Обновляем складские данные
        if (isset($item['quantity'])) {
            $product->set_manage_stock(true);
            $product->set_stock_quantity($item['quantity']);
            $product->set_stock_status($item['quantity'] > 0 ? 'instock' : 'outofstock');
        }
        
        // Обновляем категорию
        if (isset($item['category'])) {
            $category_id = $this->get_or_create_category($item['category']);
            if ($category_id) {
                $product->set_category_ids(array($category_id));
            }
        }
        
        $product->save();
        
        $this->log_message('Обновлен товар WooCommerce ID: ' . $product->get_id() . ' (Slimrate ID: ' . $item['id'] . ')');
    }
    
    /**
     * Удалить товар из WooCommerce
     */
    private function delete_woo_product($item) {
        $search_id = isset($item['rootId']) ? $item['rootId'] : $item['id'];
        $product = $this->find_woo_product_by_slimrate_id($search_id);
        
        if ($product) {
            $product_id = $product->get_id();
            wp_delete_post($product_id, true);
            $this->log_message('Удален товар WooCommerce ID: ' . $product_id . ' (Slimrate ID: ' . $search_id . ')');
            return true;
        }
        
        return false;
    }
    
    /**
     * Получить название товара
     */
    private function get_product_name($item) {
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
     * Получить или создать категорию
     */
    private function get_or_create_category($category_data) {
        $category_name = $category_data['displayName'] ?? '';
        
        if (empty($category_name)) {
            return null;
        }
        
        // Ищем существующую категорию
        $existing_category = get_term_by('name', $category_name, 'product_cat');
        
        if ($existing_category) {
            return $existing_category->term_id;
        }
        
        // Создаем новую категорию
        $result = wp_insert_term($category_name, 'product_cat');
        
        if (is_wp_error($result)) {
            $this->log_message('Ошибка создания категории: ' . $result->get_error_message(), 'error');
            return null;
        }
        
        $this->log_message('Создана новая категория: ' . $category_name . ' (ID: ' . $result['term_id'] . ')');
        
        return $result['term_id'];
    }
    
    /**
     * Установить изображения товара
     */
    private function set_product_images($product, $image_urls) {
        $image_ids = array();
        
        foreach ($image_urls as $url) {
            $image_id = $this->upload_image_from_url($url);
            if ($image_id) {
                $image_ids[] = $image_id;
            }
        }
        
        if (!empty($image_ids)) {
            $product->set_image_id($image_ids[0]); // Главное изображение
            if (count($image_ids) > 1) {
                $product->set_gallery_image_ids(array_slice($image_ids, 1)); // Галерея
            }
        }
    }
    
    /**
     * Загрузить изображение по URL
     */
    private function upload_image_from_url($url) {
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        
        $temp_file = download_url($url);
        
        if (is_wp_error($temp_file)) {
            return false;
        }
        
        $file = array(
            'name' => basename($url),
            'tmp_name' => $temp_file
        );
        
        $attachment_id = media_handle_sideload($file, 0);
        
        if (is_wp_error($attachment_id)) {
            @unlink($temp_file);
            return false;
        }
        
        return $attachment_id;
    }
    
    /**
     * Записать результат синхронизации в лог
     */
    private function log_sync_result($sync_time, $sync_type, $stats, $status, $error_message = '') {
        global $wpdb;
        
        $wpdb->insert(
            $this->log_table,
            array(
                'sync_time' => $sync_time,
                'sync_type' => $sync_type,
                'items_processed' => $stats['processed'],
                'items_created' => $stats['created'],
                'items_updated' => $stats['updated'],
                'items_deleted' => $stats['deleted'],
                'status' => $status,
                'error_message' => $error_message,
                'last_updated_at' => get_option('slimrate_last_sync_time', '')
            ),
            array('%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s')
        );
    }
    
    /**
     * Записать сообщение в лог
     */
    private function log_message($message, $level = 'info') {
        if (get_option('debug_mode', false)) {
            error_log('[Slimrate Sync] ' . $level . ': ' . $message);
        }
        
        // Можно также записывать в отдельный файл лога
        // file_put_contents(WP_CONTENT_DIR . '/slimrate-sync.log', date('Y-m-d H:i:s') . ' [' . $level . '] ' . $message . PHP_EOL, FILE_APPEND);
    }
    
    /**
     * Получить историю синхронизации
     */
    public function get_sync_history($limit = 50) {
        global $wpdb;
        
        $results = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->log_table} ORDER BY sync_time DESC LIMIT %d",
                $limit
            )
        );
        
        return $results;
    }
    
    /**
     * Сбросить время последней синхронизации
     */
    public function reset_last_sync_time() {
        delete_option('slimrate_last_sync_time');
        $this->log_message('Время последней синхронизации сброшено');
    }
} 