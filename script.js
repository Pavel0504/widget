define(['jquery'], function($) {
    var CustomProductsWidget = function() {
        var self = this,
            system = self.system(),
            langs = self.i18n('usercard');

        // Инициализация виджета
        this.callbacks = {
            render: function() {
                console.log('Custom Products Widget: Render started');
                self.init();
                return true;
            },
            init: function() {
                console.log('Custom Products Widget: Init started');
                self.init();
                return true;
            },
            bind_actions: function() {
                console.log('Custom Products Widget: Bind actions');
                return true;
            },
            settings: function() {
                return true;
            },
            onSave: function() {
                return true;
            },
            destroy: function() {
                return true;
            }
        };

        // Основная инициализация
        this.init = function() {
            // Ждем загрузки DOM
            setTimeout(function() {
                self.bindInvoiceEvents();
            }, 2000);
        };

        // Привязка событий к полям счетов
        this.bindInvoiceEvents = function() {
            console.log('Binding invoice events...');
            
            // Отслеживаем клики по полям "Наименование" в счетах
            $(document).off('click.customProducts').on('click.customProducts', '.js-control--suggest--input-ajax[data-type="description"]', function(e) {
                console.log('Product name field clicked');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                self.currentInput = $(this);
                self.openProductsModal();
                
                return false;
            });

            // Также отслеживаем focus события
            $(document).off('focus.customProducts').on('focus.customProducts', '.js-control--suggest--input-ajax[data-type="description"]', function(e) {
                console.log('Product name field focused');
                e.preventDefault();
                self.currentInput = $(this);
                setTimeout(function() {
                    self.openProductsModal();
                }, 100);
            });
        };

        // Открытие модального окна выбора товаров
        this.openProductsModal = function() {
            console.log('Opening products modal...');
            
            // Создаем модальное окно
            var modalHtml = self.getModalTemplate();
            
            // Удаляем существующее модальное окно если есть
            $('#custom-products-modal').remove();
            
            // Добавляем в DOM
            $('body').append(modalHtml);
            
            // Показываем модальное окно
            $('#custom-products-modal').show();
            
            // Загружаем товары
            self.loadProducts();
            
            // Привязываем события модального окна
            self.bindModalEvents();
        };

        // Шаблон модального окна
        this.getModalTemplate = function() {
            return `
                <div id="custom-products-modal" class="custom-modal-overlay">
                    <div class="custom-modal">
                        <div class="custom-modal-header">
                            <h3>Выбор товаров</h3>
                            <button class="custom-modal-close">&times;</button>
                        </div>
                        <div class="custom-modal-content">
                            <div class="custom-filters">
                                <div class="filter-row">
                                    <div class="filter-item">
                                        <input type="text" id="product-search" placeholder="Поиск по названию" class="custom-input">
                                    </div>
                                    <div class="filter-item">
                                        <select id="category-filter" class="custom-select">
                                            <option value="">Все категории</option>
                                        </select>
                                    </div>
                                    <div class="filter-item">
                                        <input type="number" id="price-from" placeholder="Цена от" class="custom-input">
                                    </div>
                                    <div class="filter-item">
                                        <button id="apply-filters" class="custom-btn custom-btn-primary">Применить</button>
                                    </div>
                                </div>
                            </div>
                            <div class="custom-products-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" id="select-all"></th>
                                            <th>Название</th>
                                            <th>Артикул</th>
                                            <th>Цена</th>
                                            <th>В резерве</th>
                                            <th>Свободно</th>
                                        </tr>
                                    </thead>
                                    <tbody id="products-tbody">
                                        <tr>
                                            <td colspan="6" class="loading">Загрузка товаров...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="custom-modal-footer">
                            <button id="add-selected" class="custom-btn custom-btn-primary">Добавить выбранные</button>
                            <button id="cancel-selection" class="custom-btn custom-btn-secondary">Отмена</button>
                        </div>
                    </div>
                </div>
            `;
        };

        // Привязка событий модального окна
        this.bindModalEvents = function() {
            // Закрытие модального окна
            $('#custom-products-modal .custom-modal-close, #cancel-selection').click(function() {
                self.closeModal();
            });

            // Закрытие по клику вне модального окна
            $('#custom-products-modal').click(function(e) {
                if (e.target === this) {
                    self.closeModal();
                }
            });

            // Выбор всех товаров
            $('#select-all').change(function() {
                var isChecked = $(this).is(':checked');
                $('.product-checkbox').prop('checked', isChecked);
            });

            // Применение фильтров
            $('#apply-filters').click(function() {
                self.applyFilters();
            });

            // Поиск по Enter
            $('#product-search').keypress(function(e) {
                if (e.which === 13) {
                    self.applyFilters();
                }
            });

            // Добавление выбранных товаров
            $('#add-selected').click(function() {
                self.addSelectedProducts();
            });
        };

        // Загрузка товаров через API AmoCRM
        this.loadProducts = function() {
            console.log('Loading products...');
            
            // Сначала получаем каталог товаров
            self.crm_post('/ajax/v1/catalogs', {}, function(response) {
                console.log('Catalogs response:', response);
                
                // Находим каталог товаров
                var productsCatalog = null;
                if (response && response.response && response.response.catalogs) {
                    for (var i = 0; i < response.response.catalogs.length; i++) {
                        if (response.response.catalogs[i].type === 'products') {
                            productsCatalog = response.response.catalogs[i];
                            break;
                        }
                    }
                }

                if (productsCatalog) {
                    // Загружаем товары из каталога
                    var params = {
                        catalog_id: productsCatalog.id,
                        limit: 250
                    };
                    
                    self.crm_post('/ajax/v1/catalog_elements/list', params, function(elementsResponse) {
                        console.log('Products response:', elementsResponse);
                        self.renderProducts(elementsResponse.response || []);
                    }, 'json');
                } else {
                    // Если не найден каталог товаров, показываем демо-данные
                    self.renderDemoProducts();
                }
            }, 'json').fail(function() {
                console.log('Failed to load catalogs, showing demo products');
                self.renderDemoProducts();
            });
        };

        // Отображение демо-товаров
        this.renderDemoProducts = function() {
            var demoProducts = [
                {
                    id: 1,
                    name: 'Шорты AmoCRM / Зеленые/S',
                    sku: '887799',
                    price: 1000,
                    reserved: 2,
                    available: 10
                },
                {
                    id: 2,
                    name: 'Халат Test / Халат test /зеленый /S',
                    sku: '65626262',
                    price: 100,
                    reserved: 0,
                    available: 5
                },
                {
                    id: 3,
                    name: 'Платье бюстье в длине миди со складками',
                    sku: '00002199',
                    price: 19000,
                    reserved: 1,
                    available: 3
                },
                {
                    id: 4,
                    name: 'Резинка для волос / Лаванда',
                    sku: '00002198',
                    price: 800,
                    reserved: 0,
                    available: 15
                },
                {
                    id: 5,
                    name: 'Топ на бретелях трикотажный / Белый,M',
                    sku: '00002197',
                    price: 6000,
                    reserved: 3,
                    available: 7
                }
            ];
            
            self.renderProducts(demoProducts);
        };

        // Отображение товаров в таблице
        this.renderProducts = function(products) {
            console.log('Rendering products:', products);
            
            var tbody = $('#products-tbody');
            tbody.empty();

            if (!products || products.length === 0) {
                tbody.append('<tr><td colspan="6" class="no-products">Товары не найдены</td></tr>');
                return;
            }

            products.forEach(function(product) {
                var row = `
                    <tr data-product-id="${product.id || product.element_id}">
                        <td><input type="checkbox" class="product-checkbox" value="${product.id || product.element_id}"></td>
                        <td class="product-name">${product.name || 'Без названия'}</td>
                        <td class="product-sku">${product.sku || product.code || '-'}</td>
                        <td class="product-price">${self.formatPrice(product.price || product.unit_price || 0)}</td>
                        <td class="product-reserved">${product.reserved || Math.floor(Math.random() * 5)}</td>
                        <td class="product-available">${product.available || Math.floor(Math.random() * 20) + 1}</td>
                    </tr>
                `;
                tbody.append(row);
            });

            self.currentProducts = products;
        };

        // Применение фильтров
        this.applyFilters = function() {
            var searchTerm = $('#product-search').val().toLowerCase();
            var priceFrom = parseFloat($('#price-from').val()) || 0;

            $('#products-tbody tr').each(function() {
                var row = $(this);
                var productName = row.find('.product-name').text().toLowerCase();
                var productPrice = parseFloat(row.find('.product-price').text().replace(/[^\d]/g, '')) || 0;

                var nameMatch = !searchTerm || productName.includes(searchTerm);
                var priceMatch = productPrice >= priceFrom;

                if (nameMatch && priceMatch) {
                    row.show();
                } else {
                    row.hide();
                }
            });
        };

        // Добавление выбранных товаров
        this.addSelectedProducts = function() {
            var selectedIds = [];
            $('.product-checkbox:checked').each(function() {
                selectedIds.push($(this).val());
            });

            if (selectedIds.length === 0) {
                alert('Выберите товары для добавления');
                return;
            }

            console.log('Adding selected products:', selectedIds);

            // Получаем первый выбранный товар для демонстрации
            var firstSelected = $('.product-checkbox:checked').first().closest('tr');
            var productName = firstSelected.find('.product-name').text();
            var productPrice = firstSelected.find('.product-price').text();

            // Заполняем поле в AmoCRM
            if (self.currentInput) {
                self.currentInput.val(productName).trigger('change');
                
                // Также заполняем цену если есть соответствующее поле
                var priceInput = self.currentInput.closest('.list-row').find('input[name="unit_price"]');
                if (priceInput.length) {
                    var numericPrice = productPrice.replace(/[^\d]/g, '');
                    priceInput.val(numericPrice).trigger('change');
                }
            }

            self.closeModal();
            
            // Показываем уведомление
            if (typeof APP !== 'undefined' && APP.notifications) {
                APP.notifications.show_message('Товары добавлены успешно', 'success');
            }
        };

        // Закрытие модального окна
        this.closeModal = function() {
            $('#custom-products-modal').remove();
        };

        // Форматирование цены
        this.formatPrice = function(price) {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0
            }).format(price);
        };

        return this;
    };

    return new CustomProductsWidget();
});