// JavaScript для админ-панели Slimrate Sync
jQuery(document).ready(function($) {
    
    // Инициализация
    initSlimrateAdmin();
    
    function initSlimrateAdmin() {
        // Привязываем обработчики событий
        bindEventHandlers();
        
        // Запускаем автообновление статуса
        startStatusAutoUpdate();
    }
    
    function bindEventHandlers() {
        // Кнопка ручной синхронизации
        $('#manual-sync-btn').on('click', handleManualSync);
        
        // Кнопка проверки подключения
        $('#test-connection-btn').on('click', handleTestConnection);
        
        // Кнопка сброса времени синхронизации
        $('#reset-sync-btn').on('click', handleResetSyncTime);
        
        // Кнопка диагностики API
        $('#api-diagnostics-btn').on('click', handleApiDiagnostics);
        
        // Кнопка поиска товаров для привязки
        $('#search-linkable-btn').on('click', handleSearchLinkable);
        
        // Кнопка обновления статистики
        $('#refresh-stats-btn').on('click', handleRefreshStats);
        
        // Кнопки отвязки товаров
        $(document).on('click', '.unlink-product', handleUnlinkProduct);
        
        // Обработка отправки форм настроек
        $('.slimrate-settings form').on('submit', handleSettingsSubmit);
    }
    
    // Ручная синхронизация
    function handleManualSync() {
        const $btn = $('#manual-sync-btn');
        const $log = $('#sync-log');
        
        // Блокируем кнопку и показываем загрузку
        setButtonLoading($btn, true);
        showSyncLog('Запуск синхронизации...', 'info');
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_manual_sync',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showSyncLog('✅ ' + response.data.message, 'success');
                    showSyncLog(response.data.details, 'info');
                    
                    // Показываем уведомление
                    showNotice(response.data.message, 'success');
                    
                    // Обновляем статистику
                    updateStats(response.data.stats);
                } else {
                    showSyncLog('❌ ' + response.data.message, 'error');
                    showNotice(response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                const errorMsg = 'Ошибка AJAX: ' + error;
                showSyncLog('❌ ' + errorMsg, 'error');
                showNotice(errorMsg, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
                
                // Обновляем страницу через 2 секунды для свежей статистики
                setTimeout(function() {
                    location.reload();
                }, 2000);
            }
        });
    }
    
    // Проверка подключения
    function handleTestConnection() {
        const $btn = $('#test-connection-btn');
        
        setButtonLoading($btn, true);
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_test_connection',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data.message + '<br>' + response.data.details, 'success');
                    
                    // Если есть диагностика, показываем её в консоли
                    if (response.data.diagnostics) {
                        console.log('Диагностика API:', response.data.diagnostics);
                    }
                } else {
                    let errorMessage = response.data.message;
                    
                    // Если есть диагностика, добавляем кнопку для её показа
                    if (response.data.diagnostics) {
                        errorMessage += '<br><br><button onclick="showDiagnosticsFromError()" class="button button-small">🔍 Показать диагностику</button>';
                        
                        // Сохраняем диагностику для показа
                        window.lastDiagnosticsData = {
                            diagnostics: response.data.diagnostics,
                            api_stats: response.data.api_info || {}
                        };
                    }
                    
                    showNotice(errorMessage, 'error');
                }
            },
            error: function(xhr, status, error) {
                showNotice('Ошибка проверки подключения: ' + error, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Глобальная функция для показа диагностики из ошибки
    window.showDiagnosticsFromError = function() {
        if (window.lastDiagnosticsData) {
            showDiagnosticsModal(window.lastDiagnosticsData);
        }
    };
    
    // Сброс времени синхронизации
    function handleResetSyncTime() {
        if (!confirm('Вы уверены, что хотите сбросить время последней синхронизации?\n\nСледующая синхронизация загрузит товары за последние 24 часа.')) {
            return;
        }
        
        const $btn = $('#reset-sync-btn');
        
        setButtonLoading($btn, true);
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_reset_sync_time',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data.message, 'success');
                    
                    // Обновляем страницу для свежих данных
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    showNotice(response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                showNotice('Ошибка сброса: ' + error, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Диагностика API
    function handleApiDiagnostics() {
        const $btn = $('#api-diagnostics-btn');
        
        setButtonLoading($btn, true);
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_get_api_diagnostics',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showDiagnosticsModal(response.data);
                } else {
                    showNotice('Ошибка диагностики: ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                showNotice('Ошибка диагностики: ' + error, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Поиск товаров для привязки
    function handleSearchLinkable() {
        const $btn = $('#search-linkable-btn');
        
        setButtonLoading($btn, true);
        showSyncLog('Поиск товаров для привязки...', 'info');
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_search_linkable_products',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showLinkableProductsModal(response.data);
                    showSyncLog('Найдено товаров для привязки: ' + response.data.linkable_count, 'success');
                } else {
                    showNotice('Ошибка поиска: ' + response.data.message, 'error');
                    showSyncLog('Ошибка поиска: ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                const errorMsg = 'Ошибка поиска: ' + error;
                showNotice(errorMsg, 'error');
                showSyncLog(errorMsg, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Обновление статистики
    function handleRefreshStats() {
        const $btn = $('#refresh-stats-btn');
        
        setButtonLoading($btn, true);
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_refresh_stats',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Статистика обновлена!', 'success');
                    
                    // Обновляем страницу для свежих данных
                    setTimeout(function() {
                        location.reload();
                    }, 1000);
                } else {
                    showNotice('Ошибка обновления статистики: ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                showNotice('Ошибка обновления статистики: ' + error, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Отвязка товара
    function handleUnlinkProduct() {
        const $btn = $(this);
        const productId = $btn.data('product-id');
        const productName = $btn.data('product-name');
        
        if (!confirm('Вы уверены, что хотите отвязать товар "' + productName + '" от Slimrate?\n\nЭто действие можно будет отменить только повторной привязкой.')) {
            return;
        }
        
        setButtonLoading($btn, true);
        
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_unlink_product',
                woo_id: productId,
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data.message, 'success');
                    
                    // Удаляем строку из таблицы
                    $btn.closest('tr').fadeOut(function() {
                        $(this).remove();
                    });
                    
                    // Обновляем статистику через 2 секунды
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    showNotice('Ошибка отвязки: ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                showNotice('Ошибка отвязки товара: ' + error, 'error');
            },
            complete: function() {
                setButtonLoading($btn, false);
            }
        });
    }
    
    // Обработка отправки настроек
    function handleSettingsSubmit() {
        // Добавляем индикатор загрузки для кнопки сохранения
        const $submitBtn = $(this).find('input[type="submit"]');
        setButtonLoading($submitBtn, true);
        
        // WordPress обрабатывает сохранение автоматически,
        // просто показываем загрузку и снимаем её через таймаут
        setTimeout(function() {
            setButtonLoading($submitBtn, false);
        }, 2000);
    }
    
    // Автообновление статуса
    function startStatusAutoUpdate() {
        // Обновляем статус каждые 30 секунд
        setInterval(updateSyncStatus, 30000);
        
        // Первое обновление через 5 секунд после загрузки
        setTimeout(updateSyncStatus, 5000);
    }
    
    // Обновление статуса синхронизации
    function updateSyncStatus() {
        $.ajax({
            url: slimrateAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'slimrate_get_sync_status',
                nonce: slimrateAjax.nonce
            },
            success: function(response) {
                if (response.success) {
                    // Обновляем время последней синхронизации
                    updateLastSyncTime(response.data.last_sync_time);
                    
                    // Обновляем статус автосинхронизации
                    updateAutoSyncStatus(response.data.auto_sync_enabled);
                }
            },
            error: function() {
                // Тихо игнорируем ошибки автообновления
            }
        });
    }
    
    // Вспомогательные функции
    
    function setButtonLoading($button, loading) {
        if (loading) {
            $button.addClass('loading');
            $button.prop('disabled', true);
            
            // Сохраняем оригинальный текст
            if (!$button.data('original-text')) {
                $button.data('original-text', $button.text());
            }
            
            $button.text('Загрузка...');
        } else {
            $button.removeClass('loading');
            $button.prop('disabled', false);
            
            // Восстанавливаем оригинальный текст
            if ($button.data('original-text')) {
                $button.text($button.data('original-text'));
            }
        }
    }
    
    function showSyncLog(message, type) {
        const $log = $('#sync-log');
        const timestamp = new Date().toLocaleTimeString();
        const logClass = 'log-' + type;
        
        // Добавляем запись в лог
        const logEntry = `<div class="log-entry ${logClass}">[${timestamp}] ${message}</div>`;
        $log.append(logEntry);
        
        // Показываем лог если он скрыт
        $log.addClass('active');
        
        // Прокручиваем вниз
        $log.scrollTop($log[0].scrollHeight);
        
        // Ограничиваем количество записей (последние 50)
        const $entries = $log.find('.log-entry');
        if ($entries.length > 50) {
            $entries.first().remove();
        }
    }
    
    function showNotice(message, type) {
        // Удаляем существующие уведомления
        $('.slimrate-notice').remove();
        
        // Создаем новое уведомление
        const $notice = $(`
            <div class="slimrate-notice ${type}">
                <p>${message}</p>
            </div>
        `);
        
        // Добавляем в начало контейнера
        $('.wrap').prepend($notice);
        
        // Автоматически скрываем через 5 секунд
        setTimeout(function() {
            $notice.fadeOut(function() {
                $notice.remove();
            });
        }, 5000);
    }
    
    function updateStats(stats) {
        // Обновляем статистику на странице
        if (stats && $('.stats-grid').length) {
            $('.stats-grid').find('.stat-item').each(function(index) {
                const $statNumber = $(this).find('.stat-number');
                const $statLabel = $(this).find('.stat-label');
                
                switch(index) {
                    case 0:
                        $statNumber.text(stats.processed);
                        $statLabel.text('Обработано товаров');
                        break;
                    case 1:
                        $statNumber.text(stats.created);
                        $statLabel.text('Создано товаров');
                        break;
                    case 2:
                        $statNumber.text(stats.updated);
                        $statLabel.text('Обновлено товаров');
                        break;
                    case 3:
                        $statNumber.text(stats.deleted);
                        $statLabel.text('Удалено товаров');
                        break;
                }
            });
        }
    }
    
    function updateLastSyncTime(syncTime) {
        if (syncTime) {
            const formatted = new Date(syncTime).toLocaleString('ru-RU');
            $('.sync-status p:first-child strong:contains("Последняя синхронизация")')
                .parent()
                .html('<strong>Последняя синхронизация:</strong> ' + formatted);
        }
    }
    
    function updateAutoSyncStatus(enabled) {
        const $statusSpan = $('.sync-status .status-enabled, .sync-status .status-disabled');
        
        if (enabled) {
            $statusSpan.removeClass('status-disabled').addClass('status-enabled');
            $statusSpan.text('🟢 Включена');
        } else {
            $statusSpan.removeClass('status-enabled').addClass('status-disabled');
            $statusSpan.text('🔴 Отключена');
        }
    }
    
    // Прогресс-бар для длительных операций
    function showProgressBar(show) {
        if (show) {
            if ($('.sync-progress').length === 0) {
                const progressHtml = `
                    <div class="sync-progress">
                        <div class="sync-progress-bar"></div>
                    </div>
                `;
                $('.sync-controls').after(progressHtml);
            }
            $('.sync-progress').addClass('active');
            
            // Анимируем прогресс
            let progress = 0;
            const interval = setInterval(function() {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                
                $('.sync-progress-bar').css('width', progress + '%');
                
                if (!$('.sync-progress').hasClass('active')) {
                    clearInterval(interval);
                }
            }, 500);
        } else {
            $('.sync-progress-bar').css('width', '100%');
            setTimeout(function() {
                $('.sync-progress').removeClass('active');
            }, 500);
        }
    }
    
    // Обработка ошибок tooltip
    $('.error-message').on('mouseenter', function() {
        const errorText = $(this).attr('title');
        if (errorText) {
            $(this).after(`<div class="error-tooltip">${errorText}</div>`);
            
            const $tooltip = $('.error-tooltip');
            const offset = $(this).offset();
            
            $tooltip.css({
                position: 'absolute',
                top: offset.top + 25,
                left: offset.left,
                background: '#2c3338',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                maxWidth: '300px',
                zIndex: 1000,
                wordWrap: 'break-word'
            });
        }
    });
    
    $('.error-message').on('mouseleave', function() {
        $('.error-tooltip').remove();
    });
    
    // Валидация формы настроек
    $('.slimrate-settings input[name="slimrate_api_token"]').on('blur', function() {
        const token = $(this).val().trim();
        if (token.length > 0 && token.length < 10) {
            showNotice('API токен кажется слишком коротким. Проверьте правильность.', 'warning');
        }
    });
    
    $('.slimrate-settings input[name="slimrate_api_url"]').on('blur', function() {
        const url = $(this).val().trim();
        if (url && !url.match(/^https?:\/\/.+/)) {
            showNotice('URL API должен начинаться с http:// или https://', 'warning');
        }
    });
    
    // Keyboard shortcuts
    $(document).on('keydown', function(e) {
        // Ctrl/Cmd + R для ручной синхронизации
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && e.shiftKey) {
            e.preventDefault();
            if ($('#manual-sync-btn').length && !$('#manual-sync-btn').prop('disabled')) {
                $('#manual-sync-btn').click();
            }
        }
    });
    
    // Показываем подсказку о горячих клавишах
    if ($('#manual-sync-btn').length) {
        $('#manual-sync-btn').attr('title', 'Горячие клавиши: Ctrl+Shift+R');
    }
    
    // Функция отображения диагностики API
    function showDiagnosticsModal(data) {
        // Удаляем существующее модальное окно
        $('.diagnostics-modal').remove();
        
        const diagnostics = data.diagnostics;
        const apiStats = data.api_stats;
        
        const modalHtml = `
            <div class="diagnostics-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 20px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10001;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">🔍 Диагностика API Slimrate</h2>
                    <button class="close-diagnostics" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    ">&times;</button>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h3>📊 Общая информация</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>API URL:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${apiStats.api_url}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Токен установлен:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <span style="color: ${apiStats.token_set ? 'green' : 'red'};">
                                    ${apiStats.token_set ? '✅ Да' : '❌ Нет'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Длина токена:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${apiStats.token_length} символов</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Предпросмотр токена:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><code>${apiStats.token_preview}</code></td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h3>🔧 Техническая диагностика</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Токены совпадают:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <span style="color: ${diagnostics.tokens_match ? 'green' : 'red'};">
                                    ${diagnostics.tokens_match ? '✅ Да' : '❌ Нет'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>URL совпадают:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <span style="color: ${diagnostics.urls_match ? 'green' : 'red'};">
                                    ${diagnostics.urls_match ? '✅ Да' : '❌ Нет'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Токен в настройках пуст:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <span style="color: ${diagnostics.settings_token_empty ? 'red' : 'green'};">
                                    ${diagnostics.settings_token_empty ? '❌ Да' : '✅ Нет'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Токен в классе пуст:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <span style="color: ${diagnostics.class_token_empty ? 'red' : 'green'};">
                                    ${diagnostics.class_token_empty ? '❌ Да' : '✅ Нет'}
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center;">
                    <button class="button button-primary close-diagnostics">Закрыть</button>
                </div>
            </div>
            <div class="diagnostics-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
            "></div>
        `;
        
        $('body').append(modalHtml);
        
        // Обработчики закрытия модального окна
        $('.close-diagnostics, .diagnostics-overlay').on('click', function() {
            $('.diagnostics-modal, .diagnostics-overlay').remove();
        });
        
        // Закрытие по ESC
        $(document).on('keydown.diagnostics', function(e) {
            if (e.key === 'Escape') {
                $('.diagnostics-modal, .diagnostics-overlay').remove();
                $(document).off('keydown.diagnostics');
            }
        });
    }
    
    // Функция отображения товаров для привязки
    function showLinkableProductsModal(data) {
        // Удаляем существующее модальное окно
        $('.linkable-modal').remove();
        
        const linkableProducts = data.linkable_products;
        
        let productsHtml = '';
        
        if (linkableProducts.length === 0) {
            productsHtml = '<p style="text-align: center; color: #666;">Товары для привязки не найдены</p>';
        } else {
            linkableProducts.forEach(function(item, index) {
                const slimrate = item.slimrate_item;
                const matches = item.woo_matches;
                
                productsHtml += `
                    <div style="border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #2271b1;">
                            🔍 ${slimrate.name}
                            ${slimrate.sku ? '<small style="color: #666;"> (SKU: ' + slimrate.sku + ')</small>' : ''}
                        </h4>
                        ${slimrate.category ? '<p style="margin: 5px 0; color: #666;"><strong>Категория:</strong> ' + slimrate.category + '</p>' : ''}
                        
                        <div style="margin-top: 10px;">
                            <strong>Найденные совпадения:</strong>
                `;
                
                matches.forEach(function(match, matchIndex) {
                    const woo = match.woo_product;
                    const score = match.match_score;
                    const reasons = match.match_reasons.join(', ');
                    
                    const scoreColor = score >= 100 ? 'green' : score >= 50 ? 'orange' : '#666';
                    
                    productsHtml += `
                        <div style="margin: 8px 0; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${woo.name}</strong>
                                    ${woo.sku ? '<small style="color: #666;"> (SKU: ' + woo.sku + ')</small>' : ''}
                                    <br><small style="color: #666;">${reasons}</small>
                                </div>
                                <div style="text-align: right;">
                                    <span style="color: ${scoreColor}; font-weight: bold;">Рейтинг: ${score}</span>
                                    <br><button class="button button-small link-product" 
                                        data-slimrate-id="${slimrate.id}" 
                                        data-woo-id="${woo.id}"
                                        style="margin-top: 5px;">
                                        🔗 Привязать
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                productsHtml += `
                        </div>
                    </div>
                `;
            });
        }
        
        const modalHtml = `
            <div class="linkable-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 20px;
                max-width: 800px;
                width: 95%;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10001;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">🔗 Товары для привязки</h2>
                    <button class="close-linkable" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    ">&times;</button>
                </div>
                
                <div style="margin-bottom: 15px; padding: 10px; background: #f0f6fc; border-radius: 4px;">
                    <p style="margin: 0;"><strong>Статистика:</strong></p>
                    <ul style="margin: 5px 0;">
                        <li>Товаров в Slimrate: ${data.total_slimrate}</li>
                        <li>Не привязанных товаров WooCommerce: ${data.total_woo_unlinked}</li>
                        <li>Найдено для привязки: ${data.linkable_count}</li>
                    </ul>
                </div>
                
                <div style="max-height: 500px; overflow-y: auto;">
                    ${productsHtml}
                </div>
                
                <div style="text-align: center; margin-top: 15px;">
                    <button class="button button-primary close-linkable">Закрыть</button>
                </div>
            </div>
            <div class="linkable-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
            "></div>
        `;
        
        $('body').append(modalHtml);
        
        // Обработчики закрытия модального окна
        $('.close-linkable, .linkable-overlay').on('click', function() {
            $('.linkable-modal, .linkable-overlay').remove();
        });
        
        // Закрытие по ESC
        $(document).on('keydown.linkable', function(e) {
            if (e.key === 'Escape') {
                $('.linkable-modal, .linkable-overlay').remove();
                $(document).off('keydown.linkable');
            }
        });
        
        // Обработчик привязки товара
        $('.link-product').on('click', function() {
            const slimrateId = $(this).data('slimrate-id');
            const wooId = $(this).data('woo-id');
            const $btn = $(this);
            
            if (confirm('Привязать товар WooCommerce ID: ' + wooId + ' к Slimrate ID: ' + slimrateId + '?')) {
                setButtonLoading($btn, true);
                
                // Здесь можно добавить AJAX запрос для привязки
                // Пока просто обновляем meta поле
                $.ajax({
                    url: slimrateAjax.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'slimrate_link_product',
                        woo_id: wooId,
                        slimrate_id: slimrateId,
                        nonce: slimrateAjax.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            $btn.text('✅ Привязан').prop('disabled', true);
                            showNotice('Товар успешно привязан!', 'success');
                        } else {
                            showNotice('Ошибка привязки: ' + response.data.message, 'error');
                        }
                    },
                    error: function() {
                        showNotice('Ошибка привязки товара', 'error');
                    },
                    complete: function() {
                        setButtonLoading($btn, false);
                    }
                });
            }
        });
    }
}); 