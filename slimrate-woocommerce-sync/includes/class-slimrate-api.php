<?php
/**
 * Класс для работы с API Slimrate
 */

if (!defined('ABSPATH')) {
    exit;
}

class Slimrate_API {
    
    private $api_url;
    private $api_token;
    
    public function __construct() {
        $this->api_url = get_option('slimrate_api_url', 'https://dev.slimrate.com');
        $this->api_token = get_option('slimrate_api_token', '');
    }
    
    /**
     * Выполнить запрос к API
     */
    private function make_request($endpoint, $body = array()) {
        $url = trailingslashit($this->api_url) . ltrim($endpoint, '/');
        
        // Логируем информацию о запросе для отладки
        if (get_option('debug_mode', false)) {
            error_log('[Slimrate API] Запрос к: ' . $url);
            error_log('[Slimrate API] Токен установлен: ' . (!empty($this->api_token) ? 'Да' : 'Нет'));
            error_log('[Slimrate API] Длина токена: ' . strlen($this->api_token));
        }
        
        // Проверяем наличие токена
        if (empty($this->api_token)) {
            throw new Exception('API токен не установлен. Перейдите в настройки и введите токен.');
        }
        
        // Сначала пробуем с Bearer токеном
        $headers = array(
            'Authorization' => 'Bearer ' . $this->api_token,
            'Content-Type' => 'application/json',
        );
        
        $args = array(
            'method' => 'POST',
            'headers' => $headers,
            'body' => json_encode($body),
            'timeout' => 60,
        );
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            throw new Exception('API Request Error: ' . $response->get_error_message());
        }
        
        $body_response = wp_remote_retrieve_body($response);
        $data = json_decode($body_response, true);
        $response_code = wp_remote_retrieve_response_code($response);
        
        // Если получили 401 с Bearer, пробуем без Bearer
        if ($response_code === 401) {
            if (get_option('debug_mode', false)) {
                error_log('[Slimrate API] Получен 401 с Bearer токеном, пробуем без Bearer...');
            }
            
            $headers['Authorization'] = $this->api_token;
            $args['headers'] = $headers;
            
            $response = wp_remote_request($url, $args);
            
            if (is_wp_error($response)) {
                throw new Exception('API Request Error: ' . $response->get_error_message());
            }
            
            $body_response = wp_remote_retrieve_body($response);
            $data = json_decode($body_response, true);
            $response_code = wp_remote_retrieve_response_code($response);
        }
        
        // Логируем ответ для отладки
        if (get_option('debug_mode', false)) {
            error_log('[Slimrate API] Код ответа: ' . $response_code);
            error_log('[Slimrate API] Ответ: ' . substr($body_response, 0, 500));
        }
        
        if ($response_code !== 200) {
            $error_message = $data['message'] ?? 'Unknown error';
            
            // Специальная обработка ошибки 401
            if ($response_code === 401) {
                $error_message = 'Ошибка аутентификации. Проверьте правильность API токена в настройках. Попробованы варианты: "Bearer токен" и "токен"';
            }
            
            throw new Exception('API Error: ' . $response_code . ' - ' . $error_message);
        }
        
        return $data;
    }
    
    /**
     * Получить товары
     */
    public function get_items($updated_at = null, $limit = null, $offset = null) {
        $body = array();
        
        if ($updated_at) {
            $body['updatedAt'] = $updated_at;
        }
        
        if ($limit) {
            $body['limit'] = $limit;
        }
        
        if ($offset) {
            $body['offset'] = $offset;
        }
        
        return $this->make_request('v1/items/read/tablet', $body);
    }
    
    /**
     * Получить категории
     */
    public function get_categories() {
        $body = array(
            'ids' => array(),
            'search' => '',
            'sortBy' => '',
            'sortAscending' => false,
            'returnCsvUrl' => false
        );
        
        return $this->make_request('v1/categories/read', $body);
    }
    
    /**
     * Получить налоги
     */
    public function get_taxes() {
        $body = array('ids' => array());
        return $this->make_request('v1/taxes/read', $body);
    }
    
    /**
     * Получить единицы измерения
     */
    public function get_units() {
        $body = array('ids' => array());
        return $this->make_request('v1/units/read', $body);
    }
    
    /**
     * Создать товар в Slimrate
     */
    public function create_item($item_data) {
        return $this->make_request('v1/items/create', $item_data);
    }
    
    /**
     * Обновить товар в Slimrate
     */
    public function update_item($item_id, $item_data) {
        $body = array_merge($item_data, array('id' => $item_id));
        return $this->make_request('v1/items/update', $body);
    }
    
    /**
     * Удалить товар в Slimrate
     */
    public function delete_item($item_id) {
        $body = array('id' => $item_id);
        return $this->make_request('v1/items/delete', $body);
    }
    
    /**
     * Проверить подключение к API
     */
    public function test_connection() {
        try {
            $response = $this->get_categories();
            return array(
                'success' => true,
                'message' => __('Подключение к Slimrate API успешно!', 'slimrate-woo-sync'),
                'data' => $response
            );
        } catch (Exception $e) {
            return array(
                'success' => false,
                'message' => __('Ошибка подключения: ', 'slimrate-woo-sync') . $e->getMessage()
            );
        }
    }
    
    /**
     * Установить API токен
     */
    public function set_api_token($token) {
        $this->api_token = $token;
        update_option('slimrate_api_token', $token);
    }
    
    /**
     * Установить API URL
     */
    public function set_api_url($url) {
        $this->api_url = $url;
        update_option('slimrate_api_url', $url);
    }
    
    /**
     * Получить статистику API
     */
    public function get_api_stats() {
        return array(
            'api_url' => $this->api_url,
            'token_set' => !empty($this->api_token),
            'token_length' => strlen($this->api_token),
            'token_preview' => !empty($this->api_token) ? substr($this->api_token, 0, 10) . '...' : 'Не установлен'
        );
    }
    
    /**
     * Получить подробную диагностику API
     */
    public function get_detailed_diagnostics() {
        $token = get_option('slimrate_api_token', '');
        $url = get_option('slimrate_api_url', '');
        
        return array(
            'settings_token_length' => strlen($token),
            'settings_token_empty' => empty($token),
            'settings_url' => $url,
            'class_token_length' => strlen($this->api_token),
            'class_token_empty' => empty($this->api_token),
            'class_url' => $this->api_url,
            'tokens_match' => ($token === $this->api_token),
            'urls_match' => ($url === $this->api_url)
        );
    }
} 