'use strict';
/*
 * admin.js — پنل مدیریت: سفارش‌ها | محصولات | رزروها
 */
(function () {
  var J = window.Jalali;
  var FA = J.faDigits;

  function el(id) { return document.getElementById(id); }
  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return FA(String(n)); }
  }
  function timeToFarsi(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return String(t || '');
    return FA(m[1]) + ':' + FA(m[2]);
  }
  function createdAtFarsi(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return String(iso || '');
    var date = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return J.format(date) + ' — ' +
      FA(String(d.getHours()).padStart(2, '0')) + ':' +
      FA(String(d.getMinutes()).padStart(2, '0'));
  }

  /* ================= تب‌ها ================= */
  function bindTabs() {
    var tabs = [
      { btn: 'tab-orders', panel: 'panel-orders' },
      { btn: 'tab-products', panel: 'panel-products' },
      { btn: 'tab-reservations', panel: 'panel-reservations' },
    ];
    tabs.forEach(function (t) {
      el(t.btn).addEventListener('click', function () {
        tabs.forEach(function (x) {
          el(x.btn).setAttribute('aria-selected', String(x.btn === t.btn));
          el(x.panel).hidden = x.btn !== t.btn;
        });
      });
    });
  }

  /* ================= سفارش‌ها ================= */
  var ORDER_STATUSES = ['در انتظار تأیید', 'در حال آماده‌سازی', 'تحویل شد', 'لغو شد'];
  var PAY_STATUSES = ['پرداخت در محل', 'پرداخت شده'];

  function loadOrders() {
    var wrap = el('orders-wrap');
    fetch('/api/orders')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var orders = json.orders || [];
        el('orders-count').innerHTML = '';
        var b = document.createElement('b');
        b.textContent = FA(String(orders.length));
        el('orders-count').appendChild(b);
        el('orders-count').appendChild(document.createTextNode(' سفارش ثبت‌شده'));
        wrap.innerHTML = '';

        if (!orders.length) {
          wrap.innerHTML = '<div class="admin-empty"><p class="big">هنوز سفارشی ثبت نشده است.</p><p>اولین سفارش از فروشگاه همین‌جا ظاهر می‌شود.</p></div>';
          return;
        }

        orders.forEach(function (o) {
          var card = document.createElement('div');
          card.className = 'order-card';

          var head = document.createElement('div');
          head.className = 'oc-head';
          var idEl = document.createElement('span');
          idEl.className = 'oc-id';
          idEl.textContent = o.id;
          var meta = document.createElement('span');
          meta.className = 'oc-meta';
          meta.textContent = o.customer_name + ' · ' + o.phone + ' · ' + createdAtFarsi(o.created_at);
          head.appendChild(idEl);
          head.appendChild(meta);
          card.appendChild(head);

          var ul = document.createElement('ul');
          ul.className = 'oc-items';
          (o.items || []).forEach(function (it) {
            var li = document.createElement('li');
            var right = document.createElement('span');
            right.textContent = it.product_name + (it.options ? ' (' + it.options + ')' : '') + ' × ' + FA(String(it.quantity));
            var left = document.createElement('span');
            left.textContent = faPrice(it.subtotal) + ' تومان';
            li.appendChild(right);
            li.appendChild(left);
            ul.appendChild(li);
          });
          card.appendChild(ul);

          var totalRow = document.createElement('div');
          totalRow.className = 'oc-meta';
          totalRow.innerHTML =
            'اقلام: <b class="oc-total">' + faPrice(o.subtotal) + '</b> · ارسال: ' +
            (Number(o.delivery_fee) > 0 ? faPrice(o.delivery_fee) : 'رایگان') +
            ' · نهایی: <b class="oc-total">' + faPrice(o.total) + ' تومان</b>' +
            (o.address ? '<br>آدرس: ' + o.address : '') +
            (o.notes ? '<br>یادداشت: ' + o.notes : '');
          card.appendChild(totalRow);

          var controls = document.createElement('div');
          controls.className = 'oc-controls';

          var statusSel = document.createElement('select');
          statusSel.setAttribute('aria-label', 'وضعیت سفارش ' + o.id);
          ORDER_STATUSES.forEach(function (s) {
            var op = document.createElement('option');
            op.value = s;
            op.textContent = s;
            if (s === o.status) op.selected = true;
            statusSel.appendChild(op);
          });
          statusSel.addEventListener('change', function () {
            patchOrder(o.id, { status: statusSel.value });
          });
          controls.appendChild(statusSel);

          var paySel = document.createElement('select');
          paySel.setAttribute('aria-label', 'وضعیت پرداخت سفارش ' + o.id);
          PAY_STATUSES.forEach(function (s) {
            var op = document.createElement('option');
            op.value = s;
            op.textContent = s;
            if (s === o.payment_status) op.selected = true;
            paySel.appendChild(op);
          });
          paySel.addEventListener('change', function () {
            patchOrder(o.id, { payment_status: paySel.value });
          });
          controls.appendChild(paySel);

          card.appendChild(controls);
          wrap.appendChild(card);
        });
      })
      .catch(function () {
        wrap.innerHTML = '<div class="admin-empty"><p>خواندن سفارش‌ها ممکن نشد؛ سرور را اجرا کنید.</p></div>';
      });
  }

  function patchOrder(id, patch) {
    fetch('/api/orders/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then(function () { loadOrders(); })
      .catch(function () { loadOrders(); });
  }

  /* ================= محصولات ================= */
  var editingId = null;

  function formError(msg) {
    var e = el('pf-error');
    if (msg) { e.textContent = msg; e.hidden = false; }
    else { e.textContent = ''; e.hidden = true; }
  }

  function resetForm() {
    editingId = null;
    el('product-form-title').textContent = 'افزودن محصول جدید';
    ['pf-name', 'pf-category', 'pf-price', 'pf-stock', 'pf-desc', 'pf-full', 'pf-options'].forEach(function (f) { el(f).value = ''; });
    el('pf-model3d').value = '';
    el('pf-active').value = 'true';
    el('pf-reset').hidden = true;
    formError('');
  }

  function fillForm(p) {
    editingId = p.id;
    el('product-form-title').textContent = 'ویرایش محصول: ' + p.name;
    el('pf-name').value = p.name;
    el('pf-category').value = p.category;
    el('pf-price').value = String(p.price);
    el('pf-stock').value = String(p.stock);
    el('pf-desc').value = p.description || '';
    el('pf-full').value = p.full_description || '';
    el('pf-options').value = (p.options || []).join(', ');
    el('pf-model3d').value = p.model3d || '';
    el('pf-active').value = p.active === false ? 'false' : 'true';
    el('pf-reset').hidden = false;
    formError('');
    el('product-form-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function saveProduct() {
    formError('');
    var payload = {
      name: el('pf-name').value,
      category: el('pf-category').value,
      price: el('pf-price').value,
      stock: el('pf-stock').value,
      description: el('pf-desc').value,
      full_description: el('pf-full').value,
      options: el('pf-options').value.split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean),
      model3d: el('pf-model3d').value || null,
      active: el('pf-active').value === 'true',
    };
    var url = editingId ? '/api/admin/products/' + encodeURIComponent(editingId) : '/api/admin/products';
    fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (json) { return { status: r.status, json: json }; }); })
      .then(function (out) {
        if (out.status === 201 || out.status === 200) {
          resetForm();
          loadProducts();
        } else if (out.json.errors) {
          formError(Object.values(out.json.errors).join(' '));
        } else {
          formError(out.json.message || 'ذخیره ممکن نشد.');
        }
      })
      .catch(function () { formError('ارتباط با سرور برقرار نشد.'); });
  }

  function loadProducts() {
    var wrap = el('products-wrap');
    fetch('/api/admin/products')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var products = json.products || [];
        el('products-count').innerHTML = '';
        var b = document.createElement('b');
        b.textContent = FA(String(products.length));
        el('products-count').appendChild(b);
        el('products-count').appendChild(document.createTextNode(' محصول در پایگاه داده'));
        wrap.innerHTML = '';

        if (!products.length) {
          wrap.innerHTML = '<div class="admin-empty"><p class="big">محصولی ثبت نشده است.</p><p>از فرم بالای همین صفحه اولین محصول را بسازید.</p></div>';
          return;
        }

        var scroll = document.createElement('div');
        scroll.className = 'table-scroll';
        var table = document.createElement('table');
        table.className = 'bookings-table';
        var thead = document.createElement('thead');
        var hr = document.createElement('tr');
        ['شناسه', 'نام', 'دسته', 'قیمت (تومان)', 'موجودی', 'وضعیت', 'عملیات'].forEach(function (t) {
          var th = document.createElement('th');
          th.textContent = t;
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');

        products.forEach(function (p) {
          var tr = document.createElement('tr');

          var td = function (cls, label) {
            var x = document.createElement('td');
            if (cls) x.className = cls;
            if (label) x.setAttribute('data-label', label);
            return x;
          };

          var cId = td('cell-id', 'شناسه');
          cId.textContent = p.id;
          tr.appendChild(cId);

          var cName = td('', 'نام');
          cName.textContent = p.name + (p.featured ? ' ★' : '');
          tr.appendChild(cName);

          var cCat = td('', 'دسته');
          cCat.textContent = p.category;
          tr.appendChild(cCat);

          var cPrice = td('cell-num', 'قیمت');
          cPrice.textContent = faPrice(p.price);
          tr.appendChild(cPrice);

          var cStock = td('cell-num', 'موجودی');
          cStock.textContent = FA(String(p.stock));
          if (Number(p.stock) <= 3) cStock.style.color = 'var(--danger)';
          tr.appendChild(cStock);

          var cActive = td('', 'وضعیت');
          var chip = document.createElement('span');
          chip.className = 'status-chip';
          chip.textContent = p.active === false ? 'غیرفعال' : 'فعال';
          if (p.active === false) chip.style.color = 'var(--danger)';
          cActive.appendChild(chip);
          tr.appendChild(cActive);

          var cAct = td('cell-actions', 'عملیات');
          cAct.style.cssText = 'display:flex; gap: var(--space-3xs); flex-wrap: wrap;';
          var edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'btn-add';
          edit.textContent = 'ویرایش';
          edit.addEventListener('click', function () { fillForm(p); });
          cAct.appendChild(edit);

          var toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'delete-btn';
          toggle.style.color = 'var(--ink-2)';
          toggle.textContent = p.active === false ? 'فعال‌سازی' : 'غیرفعال';
          toggle.addEventListener('click', function () {
            fetch('/api/admin/products/' + encodeURIComponent(p.id), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: p.active === false }),
            }).then(function () { loadProducts(); });
          });
          cAct.appendChild(toggle);

          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'delete-btn';
          del.textContent = 'حذف';
          del.addEventListener('click', function () {
            if (!window.confirm('محصول «' + p.name + '» برای همیشه حذف شود؟')) return;
            fetch('/api/admin/products/' + encodeURIComponent(p.id), { method: 'DELETE' })
              .then(function () { loadProducts(); });
          });
          cAct.appendChild(del);
          tr.appendChild(cAct);

          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        scroll.appendChild(table);
        wrap.appendChild(scroll);
      })
      .catch(function () {
        wrap.innerHTML = '<div class="admin-empty"><p>خواندن محصولات ممکن نشد؛ سرور را اجرا کنید.</p></div>';
      });
  }

  /* ================= رزروها ================= */
  function loadReservations() {
    var wrap = el('table-wrap');
    var count = el('admin-count');
    if (count) count.textContent = 'در حال خواندن…';

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 2500);
    fetch('/api/bookings', { signal: controller.signal })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (count) {
          count.innerHTML = '';
          var b = document.createElement('b');
          b.textContent = FA(String(json.count || 0));
          count.appendChild(b);
          count.appendChild(document.createTextNode(' رزرو ثبت‌شده'));
        }
        renderReservations(json.bookings || []);
      })
      .catch(function () {
        clearTimeout(timer);
        if (count) count.textContent = 'سرور در دسترس نیست — رزروهای نمایشی مرورگر:';
        renderReservations(loadDemoBookings());
      });
  }

  function loadDemoBookings() {
    try {
      var list = JSON.parse(localStorage.getItem('daneh-bookings') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function renderReservations(bookings) {
    var wrap = el('table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!bookings.length) {
      wrap.innerHTML = '<div class="admin-empty"><p class="big">هنوز رزروی ثبت نشده است.</p><p>اولین رزرو از صفحهٔ رزرو همین‌جا ظاهر می‌شود.</p></div>';
      return;
    }

    var scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    var table = document.createElement('table');
    table.className = 'bookings-table';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['شناسه', 'نام', 'موبایل', 'تاریخ', 'ساعت', 'نفرات', 'یادداشت', 'زمان ثبت', 'عملیات'].forEach(function (t) {
      var th = document.createElement('th');
      th.textContent = t;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    bookings.forEach(function (bk) {
      var tr = document.createElement('tr');
      function td(cls, label) {
        var x = document.createElement('td');
        if (cls) x.className = cls;
        if (label) x.setAttribute('data-label', label);
        return x;
      }

      var cId = td('cell-id', 'شناسه'); cId.textContent = bk.id; tr.appendChild(cId);
      var cName = td('', 'نام'); cName.textContent = bk.name; tr.appendChild(cName);
      var cPhone = td('cell-num', 'موبایل');
      var bdi = document.createElement('bdi');
      bdi.setAttribute('dir', 'ltr');
      bdi.textContent = bk.phone;
      cPhone.appendChild(bdi);
      tr.appendChild(cPhone);
      var cDate = td('cell-num', 'تاریخ');
      cDate.textContent = J.weekdayName(bk.date) + ' ' + J.format(bk.date);
      tr.appendChild(cDate);
      var cTime = td('cell-num', 'ساعت'); cTime.textContent = timeToFarsi(bk.time); tr.appendChild(cTime);
      var cGuests = td('cell-num', 'نفرات'); cGuests.textContent = FA(String(bk.guests)); tr.appendChild(cGuests);
      var cNotes = td('cell-notes', 'یادداشت'); cNotes.textContent = bk.notes || '—'; tr.appendChild(cNotes);
      var cCreated = td('cell-num', 'زمان ثبت'); cCreated.textContent = createdAtFarsi(bk.createdAt); tr.appendChild(cCreated);

      var cAct = td('cell-actions', 'عملیات');
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.textContent = 'حذف';
      del.setAttribute('aria-label', 'حذف رزرو ' + bk.id);
      del.addEventListener('click', function () {
        if (!window.confirm('رزرو «' + bk.id + '» حذف شود؟ این کار برگشت‌پذیر نیست.')) return;
        fetch('/api/bookings/' + encodeURIComponent(bk.id), { method: 'DELETE' })
          .then(function () { loadReservations(); })
          .catch(function () { loadReservations(); });
      });
      cAct.appendChild(del);
      tr.appendChild(cAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    wrap.appendChild(scroll);
  }

  /* ================= شروع ================= */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindTabs();
      loadOrders();
      loadProducts();
      loadReservations();
      el('orders-refresh').addEventListener('click', loadOrders);
      el('products-refresh').addEventListener('click', loadProducts);
      el('refresh-btn').addEventListener('click', loadReservations);
      el('pf-save').addEventListener('click', saveProduct);
      el('pf-reset').addEventListener('click', resetForm);
    });
  } else {
    bindTabs();
    loadOrders();
    loadProducts();
    loadReservations();
    el('orders-refresh').addEventListener('click', loadOrders);
    el('products-refresh').addEventListener('click', loadProducts);
    el('refresh-btn').addEventListener('click', loadReservations);
    el('pf-save').addEventListener('click', saveProduct);
    el('pf-reset').addEventListener('click', resetForm);
  }
})();
