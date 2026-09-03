'use strict';
/*
 * product.js — صفحهٔ محصول: واکشی با slug، گزینه‌ها، شمارندهٔ تعداد، افزودن به سبد
 */
(function () {
  var FA = window.Jalali.faDigits;
  var product = null;
  var qty = 1;

  function el(id) { return document.getElementById(id); }

  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return FA(String(n)); }
  }

  function catIcon(category) {
    var stroke = 'fill="none" stroke="#d9a253" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
    if (category === 'دسر و کیک') {
      return '<svg width="96" height="96" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M8 30h32l-3 10H11z"/><path d="M8 30c8-4 24-4 32 0"/><path d="M24 26v-6"/><circle cx="24" cy="18" r="2.5"/></svg>';
    }
    if (category === 'دانه قهوه') {
      return '<svg width="96" height="96" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><ellipse cx="20" cy="28" rx="10" ry="14" transform="rotate(-24 20 28)"/><path d="M15 15.5c7 7.5-3 15 6.5 24"/><ellipse cx="35" cy="15" rx="6" ry="9" transform="rotate(18 35 15)"/><path d="M32.5 6.8c4 4.5-1.5 8.5 2.8 16.4"/></svg>';
    }
    if (category === 'محصولات جانبی') {
      return '<svg width="96" height="96" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M10 16h28v24H10z"/><path d="M10 16l4-8h20l4 8"/><path d="M20 16v-4h8v4"/><path d="M24 24v8M20 28h8"/></svg>';
    }
    if (category === 'نوشیدنی‌های سرد' || category === 'آیس کافی') {
      return '<svg width="96" height="96" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M14 10h20l-2.5 30h-15z"/><path d="M15.5 20h17"/><path d="M20 6l-2 4M28 6l-2 4"/><circle cx="22" cy="26" r="1.6"/><circle cx="27" cy="31" r="1.6"/></svg>';
    }
    return '<svg width="96" height="96" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M12 18h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z"/><path d="M34 20h4a4 4 0 0 1 0 8h-4"/><path d="M17 12c0-2 2-2 2-4M23 12c0-2 2-2 2-4M29 12c0-2 2-2 2-4"/></svg>';
  }

  function currentOption() {
    var checked = document.querySelector('#p-options input:checked');
    return checked ? checked.value : '';
  }

  function syncQtyInput() {
    el('qty-input').value = FA(String(qty));
  }

  function render() {
    el('p-crumb-name').textContent = product.name;
    document.title = product.name + ' — کافه دانه';
    el('p-name').textContent = product.name;
    el('p-desc').textContent = product.description || '';
    el('p-cat').textContent = product.category;
    el('p-price').textContent = faPrice(product.price);
    el('p-full').textContent = product.full_description || product.description || '';

    var stock = Number(product.stock);
    var stockEl = el('p-stock');
    if (stock <= 0) {
      stockEl.textContent = 'ناموجود — به‌زودی شارژ می‌شود';
      stockEl.style.color = 'var(--danger)';
      el('add-btn').disabled = true;
    } else if (stock <= 5) {
      stockEl.textContent = 'آخرین ' + FA(String(stock)) + ' عدد موجود';
      stockEl.style.color = 'var(--accent)';
    } else {
      stockEl.textContent = 'موجود در کافه';
    }

    /* گزینه‌ها */
    var options = Array.isArray(product.options) ? product.options : [];
    if (options.length) {
      el('p-options-wrap').hidden = false;
      var wrap = el('p-options');
      wrap.innerHTML = '';
      options.forEach(function (opt, i) {
        var label = document.createElement('label');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'p-option';
        input.value = opt;
        input.checked = i === 0;
        var span = document.createElement('span');
        span.textContent = opt;
        label.appendChild(input);
        label.appendChild(span);
        wrap.appendChild(label);
      });
    } else {
      el('p-options-wrap').hidden = true;
    }

    /* ویژوال: سه‌بعدی یا آیکون */
    var visual = el('p-visual');
    if (product.model3d === 'cup' || product.model3d === 'beans') {
      var hint = document.createElement('p');
      hint.className = 'p3d-hint';
      hint.textContent = 'برای چرخاندن، بکشید';
      visual.appendChild(hint);
      try {
        import('/js/product-3d.js').then(function (mod) {
          mod.initProductScene(visual, product);
        }).catch(function () { visualFallback(); });
      } catch (e) { visualFallback(); }
    } else {
      visualFallback();
    }

    function visualFallback() {
      visual.innerHTML = catIcon(product.category);
    }

    el('product-hero').hidden = false;
  }

  function bind() {
    el('qty-minus').addEventListener('click', function () {
      qty = Math.max(1, qty - 1);
      syncQtyInput();
    });
    el('qty-plus').addEventListener('click', function () {
      qty = Math.min(window.DanehCart.MAX_QTY, qty + 1);
      syncQtyInput();
    });
    el('qty-input').addEventListener('change', function () {
      var v = window.DanehCart.clampQty(String(el('qty-input').value).replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }));
      qty = v;
      syncQtyInput();
    });

    el('add-btn').addEventListener('click', function () {
      if (!product) return;
      if (Number(product.stock) <= 0) return;
      var list = window.DanehCart.addItem(
        window.DanehCart.load(),
        product.id,
        currentOption(),
        qty
      );
      window.DanehCart.save(list);
      var confirmEl = el('add-confirm');
      confirmEl.textContent = 'به سبد اضافه شد — ' + FA(String(window.DanehCart.count(list))) + ' قلم در سبد.';
      el('add-btn').textContent = 'افزوده شد ✓';
      var btn = el('add-btn');
      setTimeout(function () { btn.textContent = 'افزودن به سبد'; }, 1400);
    });
  }

  function init() {
    /* مسیر: /product/<slug> */
    var slug = decodeURIComponent(window.location.pathname.replace(/^\/product\/?/, '').replace(/\/$/, ''));
    if (!slug) {
      el('p-error').hidden = false;
      return;
    }
    var opts = {};
    try { opts = { signal: AbortSignal.timeout(8000) }; } catch (e) { /* مرورگر قدیمی: بدون timeout */ }
    fetch('/api/products/' + encodeURIComponent(slug), opts)
      .then(function (r) {
        if (!r.ok) throw new Error('not-found');
        return r.json();
      })
      .then(function (json) {
        product = json.product;
        render();
        bind();
        syncQtyInput();
      })
      .catch(function () {
        el('p-crumb-name').textContent = 'خطا';
        el('p-name').textContent = 'محصول پیدا نشد.';
        el('p-desc').textContent =
          'ممکن است محصول حذف شده باشد یا ارتباط با سرور برقرار نشد؛ صفحه را دوباره باز کنید یا از فروشگاه شروع کنید.';
        el('p-error').hidden = false;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
