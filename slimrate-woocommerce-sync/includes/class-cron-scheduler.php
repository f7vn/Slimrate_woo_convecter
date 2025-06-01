<?php
/**
 * Планировщик Cron задач для автоматической синхронизации
 */

if (!defined('ABSPATH')) {
    exit;
}

class Slimrate_Cron_Scheduler {
    
    public function __construct() {
        // Регистрируем наш хук для выполнения синхронизации
        add_action('slimrate_auto_sync', array($this, 'run_auto_sync'));
        
        // Хуки для управления расписанием
        add_action('init', array($this, 'schedule_events'));
        add_action('wp', array($this, 'schedule_events'));
        
        // Хук для обновления расписания при изменении настроек
        add_action('update_option_auto_sync_enabled', array($this, 'update_schedule'), 10, 2);
        add_action('update_option_sync_interval', array($this, 'update_schedule'), 10, 2);
    }
    
    /**
     * Запланировать события Cron
     */
    public function schedule_events() {
        $auto_sync_enabled = get_option('auto_sync_enabled', false);
        $sync_interval = get_option('sync_interval', 'hourly');
        
        // Проверяем, запланирована ли уже задача
        $scheduled = wp_next_scheduled('slimrate_auto_sync');
        
        if ($auto_sync_enabled) {
            if (!$scheduled) {
                // Планируем новую задачу
                wp_schedule_event(time(), $sync_interval, 'slimrate_auto_sync');
                error_log('[Slimrate Sync] Автосинхронизация запланирована: ' . $sync_interval);
            } else {
                // Проверяем, нужно ли обновить интервал
                $current_schedule = wp_get_schedule('slimrate_auto_sync');
                if ($current_schedule !== $sync_interval) {
                    // Удаляем старое расписание и создаем новое
                    wp_clear_scheduled_hook('slimrate_auto_sync');
                    wp_schedule_event(time(), $sync_interval, 'slimrate_auto_sync');
                    error_log('[Slimrate Sync] Расписание автосинхронизации обновлено: ' . $sync_interval);
                }
            }
        } else {
            if ($scheduled) {
                // Отключаем автосинхронизацию
                wp_clear_scheduled_hook('slimrate_auto_sync');
                error_log('[Slimrate Sync] Автосинхронизация отключена');
            }
        }
    }
    
    /**
     * Обновить расписание при изменении настроек
     */
    public function update_schedule($old_value, $new_value) {
        // Удаляем текущее расписание
        wp_clear_scheduled_hook('slimrate_auto_sync');
        
        // Перепланируем события
        $this->schedule_events();
    }
    
    /**
     * Выполнить автоматическую синхронизацию
     */
    public function run_auto_sync() {
        try {
            error_log('[Slimrate Sync] Запуск автоматической синхронизации...');
            
            // Проверяем, включена ли автосинхронизация
            if (!get_option('auto_sync_enabled', false)) {
                error_log('[Slimrate Sync] Автосинхронизация отключена в настройках');
                return;
            }
            
            // Создаем менеджер синхронизации и запускаем процесс
            $sync_manager = new Woo_Sync_Manager();
            $result = $sync_manager->sync_items(false); // false = автоматическая синхронизация
            
            if ($result['success']) {
                error_log('[Slimrate Sync] Автосинхронизация завершена успешно. Статистика: ' . json_encode($result['stats']));
            } else {
                error_log('[Slimrate Sync] Ошибка автосинхронизации: ' . $result['error']);
            }
            
        } catch (Exception $e) {
            error_log('[Slimrate Sync] Критическая ошибка автосинхронизации: ' . $e->getMessage());
        }
    }
    
    /**
     * Получить статус планировщика
     */
    public function get_scheduler_status() {
        $auto_sync_enabled = get_option('auto_sync_enabled', false);
        $sync_interval = get_option('sync_interval', 'hourly');
        $next_scheduled = wp_next_scheduled('slimrate_auto_sync');
        
        return array(
            'enabled' => $auto_sync_enabled,
            'interval' => $sync_interval,
            'next_run' => $next_scheduled ? date('Y-m-d H:i:s', $next_scheduled) : null,
            'next_run_formatted' => $next_scheduled ? $this->time_until($next_scheduled) : null,
            'is_scheduled' => (bool) $next_scheduled
        );
    }
    
    /**
     * Получить человекочитаемое время до следующего запуска
     */
    private function time_until($timestamp) {
        $time_diff = $timestamp - time();
        
        if ($time_diff <= 0) {
            return 'Скоро';
        }
        
        $hours = floor($time_diff / 3600);
        $minutes = floor(($time_diff % 3600) / 60);
        
        if ($hours > 0) {
            return sprintf('%d ч. %d мин.', $hours, $minutes);
        } else {
            return sprintf('%d мин.', $minutes);
        }
    }
    
    /**
     * Принудительно запустить синхронизацию
     */
    public function force_run_sync() {
        // Запускаем синхронизацию немедленно
        wp_schedule_single_event(time(), 'slimrate_auto_sync');
        
        // Запускаем Cron для немедленного выполнения
        if (function_exists('wp_cron')) {
            wp_cron();
        }
    }
    
    /**
     * Очистить все запланированные задачи
     */
    public function clear_all_schedules() {
        wp_clear_scheduled_hook('slimrate_auto_sync');
        error_log('[Slimrate Sync] Все запланированные задачи очищены');
    }
    
    /**
     * Получить информацию о WordPress Cron
     */
    public function get_cron_info() {
        $cron_jobs = _get_cron_array();
        $slimrate_jobs = array();
        
        foreach ($cron_jobs as $timestamp => $cron) {
            if (isset($cron['slimrate_auto_sync'])) {
                $slimrate_jobs[] = array(
                    'timestamp' => $timestamp,
                    'time' => date('Y-m-d H:i:s', $timestamp),
                    'interval' => $cron['slimrate_auto_sync'][array_key_first($cron['slimrate_auto_sync'])]['schedule'] ?? 'single'
                );
            }
        }
        
        return array(
            'wp_cron_disabled' => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON,
            'total_cron_jobs' => count($cron_jobs),
            'slimrate_jobs' => $slimrate_jobs,
            'next_cron_run' => wp_next_scheduled('wp_cron') ? date('Y-m-d H:i:s', wp_next_scheduled('wp_cron')) : 'Не запланировано'
        );
    }
} 