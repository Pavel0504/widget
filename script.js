define(["amocrm.loader", "jquery"], function(Loader, $) {
  const CustomProductsWidget = function() {
    this.callbacks = {
      render: this.init.bind(this)
    };

    this.init = function() {
      // Ждём полной загрузки раздела счетов
      const check = setInterval(() => {
        const section = $(".js-invoice-items");
        if (section.length) {
          clearInterval(check);
          this.bindInvoiceEvents();
        }
      }, 500);
      return true;
    };

    this.bindInvoiceEvents = function() {
      $(document)
        .off("click.customProducts focus.customProducts", ".js-control--suggest--input-ajax[data-type=\"description\"]")
        .on("click.customProducts focus.customProducts", ".js-control--suggest--input-ajax[data-type=\"description\"]", e => {
          e.preventDefault();
          e.stopPropagation();
          this.currentInput = $(e.currentTarget);
          this.openProductsModal();
          return false;
        });
    };

    this.openProductsModal = function() {
      // Удаляем старое окно и вставляем новое
      $("#custom-products-modal").remove();
      $("body").append(this.getModalTemplate());
      this.loadCatalogAndProducts();
      this.bindModalEvents();
    };

    this.getModalTemplate = function() {
      return `
<div id="custom-products-modal" class="custom-modal-overlay">
  <div class="custom-modal">
    <div class="custom-modal-header">
      <h3>Выбор товаров</h3>
      <button class="custom-modal-close">×</button>
    </div>
    <div class="custom-modal-content">
      <div class="custom-filters">
        <input type="text" id="product-search" placeholder="Поиск по названию или SKU" class="custom-input">
        <select id="category-filter" class="custom-select">
          <option value="">Все категории</option>
        </select>
        <input type="number" id="price-from" placeholder="Цена от" class="custom-input">
        <button id="apply-filters" class="custom-btn custom-btn-primary">Применить</button>
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
          <tbody id="products-tbody"><tr><td colspan="6" class="loading">Загрузка...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="custom-modal-footer">
      <button id="add-selected" class="custom-btn custom-btn-primary">Добавить выбранные</button>
      <button id="cancel-selection" class="custom-btn custom-btn-secondary">Отмена</button>
    </div>
  </div>
</div>`;
    };

    this.bindModalEvents = function() {
      // Закрытие
      $("#custom-products-modal .custom-modal-close, #cancel-selection").on("click", () => this.closeModal());
      // Выбор всех
      $("#select-all").on("change", e => {
        $(".product-checkbox").prop("checked", e.target.checked);
      });
      // Фильтры
      $("#apply-filters").on("click", () => this.applyFilters());
      $("#product-search").on("keypress", e => { if (e.which === 13) this.applyFilters(); });
      // Добавить
      $("#add-selected").on("click", () => this.addSelectedProducts());
    };

    this.loadCatalogAndProducts = function() {
      // GET /api/v4/catalogs
      this.request("GET", "/api/v4/catalogs", null)
        .done(data => {
          const catalog = data._embedded.catalogs.find(c => c.type === "products");
          if (!catalog) return this.renderEmpty();
          this.productsCatalogId = catalog.id;
          // Загрузка категорий
          this.request("GET", `/api/v4/catalogs/${catalog.id}/metadata`)  // metadata содержит поля и возможные опции
            .done(md => this.populateCategories(md));
          // Загрузка товаров
          this.request("GET", `/api/v4/catalogs/${catalog.id}/elements?limit=250`)  
            .done(res => this.renderProducts(res._embedded.elements));
        });
    };

    this.populateCategories = function(metadata) {
      const field = metadata._embedded.custom_fields.find(f => f.code === "category");
      if (!field) return;
      field.enums.forEach(e => {
        $("#category-filter").append(`<option value="${e.id}">${e.value}</option>`);
      });
    };

    this.renderProducts = function(items) {
      const tbody = $("#products-tbody"); tbody.empty();
      if (!items.length) return tbody.append('<tr><td colspan="6" class="no-products">Нет товаров</td></tr>');
      items.forEach(p => {
        const reserved = this.getFieldValue(p, "reserved") || 0;
        const total = this.getFieldValue(p, "total_stock") || 0;
        const available = total - reserved;
        const sku = this.getFieldValue(p, "sku") || "-";
        tbody.append(`
<tr data-id="${p.id}">
  <td><input type="checkbox" class="product-checkbox" value="${p.id}"></td>
  <td>${p.name}</td><td>${sku}</td>
  <td>${this.formatPrice(this.getFieldValue(p, "price") || 0)}</td>
  <td>${reserved}</td>
  <td>${available}</td>
</tr>`);
      });
      this.currentProducts = items;
    };

    this.getFieldValue = function(item, code) {
      const field = item.custom_fields_values.find(f => f.field_code === code);
      return field && field.values[0].value;
    };

    this.applyFilters = function() {
      const term = $("#product-search").val().toLowerCase();
      const cat = +$("#category-filter").val();
      const from = +$("#price-from").val() || 0;
      $("#products-tbody tr").each((_, row) => {
        const $r = $(row);
        const name = $r.find('td:eq(1)').text().toLowerCase();
        const price = +$r.find('td:eq(3)').text().replace(/\D/g, '');
        const matches = (!term || name.includes(term))
          && (price >= from)
          && (!cat || (this.getFieldValue(this.currentProducts.find(i=>i.id===$r.data('id')), 'category') == cat));
        matches ? $r.show() : $r.hide();
      });
    };

    this.addSelectedProducts = function() {
      const ids = $(".product-checkbox:checked").map((_,c)=>c.value).get();
      if (!ids.length) return alert('Выберите товары');
      // Заполнение первой строки
      const first = $(".product-checkbox:checked").first().closest('tr');
      const name = first.find('td:eq(1)').text();
      const price = first.find('td:eq(3)').text().replace(/\D/g, '');
      this.currentInput.val(name).trigger('change');
      this.currentInput.closest('.list-row').find('input[name="unit_price"]').val(price).trigger('change');
      this.closeModal();
    };

    this.closeModal = function() {
      $("#custom-products-modal").remove();
    };

    this.formatPrice = function(amount) {
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);
    };

    this.request = function(method, url, data) {
      return Loader.request({ method, url, data });
    };

    return this;
  };

  return new CustomProductsWidget();
});
