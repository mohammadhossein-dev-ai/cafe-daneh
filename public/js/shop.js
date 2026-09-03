'use strict';
/*
 * shop.js — صفحهٔ فروشگاه: فیلتر دسته + شبکهٔ محصولات + افزودن سریع به سبد
 */
(function () {
  var products = [];
  var activeCategory = 'همه';

  var grid, chips;

  /* آیکون‌های خطی طلایی بر اساس دسته (بدون عکس استوک — هویت گرافیکی) */
  function catIcon(category) {
    var stroke = 'fill="none" stroke="#d9a253" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
    if (category === 'دسر و کیک') {
      return '<svg width="56" height="56" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M8 30h32l-3 10H11z"/><path d="M8 30c8-4 24-4 32 0"/><path d="M24 26v-6"/><circle cx="24" cy="18" r="2.5"/></svg>';
    }
    if (category === 'دانه قهوه') {
      return '<svg width="56" height="56" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><ellipse cx="20" cy="28" rx="10" ry="14" transform="rotate(-24 20 28)"/><path d="M15 15.5c7 7.5-3 15 6.5 24"/><ellipse cx="35" cy="15" rx="6" ry="9" transform="rotate(18 35 15)"/><path d="M32.5 6.8c4 4.5-1.5 8.5 2.8 16.4"/></svg>';
    }
    if (category === 'محصولات جانبی') {
      return '<svg width="56" height="56" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M10 16h28v24H10z"/><path d="M10 16l4-8h20l4 8"/><path d="M20 16v-4h8v4"/><path d="M24 24v8M20 28h8"/></svg>';
    }
    if (category === 'نوشیدنی‌های سرد' || category === 'آیس کافی') {
      return '<svg width="56" height="56" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M14 10h20l-2.5 30h-15z"/><path d="M15.5 20h17"/><path d="M20 6l-2 4M28 6l-2 4"/><circle cx="22" cy="26" r="1.6"/><circle cx="27" cy="31" r="1.6"/></svg>';
    }
    /* فنجان داغ: اسپرسو/آمریکانو/لاته/کاپوچینو/موکا */
    return '<svg width="56" height="56" viewBox="0 0 48 48" ' + stroke + ' aria-hidden="true"><path d="M12 18h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z"/><path d="M34 20h4a4 4 0 0 1 0 8h-4"/><path d="M17 12c0-2 2-2 2-4M23 12c0-2 2-2 2-4M29 12c0-2 2-2 2-4"/></svg>';
  }

  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return String(n); }
  }

  function loadCart() { return window.DanehCart ? window.DanehCart.load() : []; }
  function persist(list) { if (window.DanehCart) window.DanehCart.save(list); }

  function quickAdd(productId) {
    var list = window.DanehCart.addItem(loadCart(), productId, '', 1);
    persist(list);
  }

  function renderGrid() {
    var list = products.filter(function (p) {
      return activeCategory === 'همه' || p.category === activeCategory;
    });
    grid.innerHTML = '';

    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.innerHTML = '<p class="big">فعلاً در این دسته چیزی نداریم.</p><p>دستهٔ دیگری را امتحان کنید.</p>';
      grid.appendChild(empty);
      return;
    }

    list.forEach(function (p) {
      var tile = document.createElement('article');
      tile.className = 'product-tile';
      tile.setAttribute('data-od-id', 'product-' + p.slug);

      var visual = document.createElement('div');
      visual.className = 'tile-visual';
      visual.innerHTML = catIcon(p.category);
      tile.appendChild(visual);

      var cat = document.createElement('p');
      cat.className = 'tile-cat';
      cat.textContent = p.category;
      tile.appendChild(cat);

      var name = document.createElement('h3');
      name.className = 'tile-name';
      var a = document.createElement('a');
      a.href = '/product/' + encodeURIComponent(p.slug);
      a.textContent = p.name;
      name.appendChild(a);
      tile.appendChild(name);

      var desc = document.createElement('p');
      desc.className = 'tile-desc';
      desc.textContent = p.description || '';
      tile.appendChild(desc);

      var bottom = document.createElement('div');
      bottom.className = 'tile-bottom';

      var price = document.createElement('span');
      price.className = 'tile-price';
      price.textContent = faPrice(p.price);
      var unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = 'تومان';
      price.appendChild(unit);
      bottom.appendChild(price);

      var out = Number(p.stock) <= 0;
      if (out) {
        var badge = document.createElement('span');
        badge.className = 'soldout-badge';
        badge.textContent = 'ناموجود';
        bottom.appendChild(badge);
      } else {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-add';
        btn.textContent = 'افزودن به سبد';
        btn.setAttribute('aria-label', 'افزودن ' + p.name + ' به سبد خرید');
        btn.addEventListener('click', function () {
          quickAdd(p.id);
          btn.textContent = 'به سبد اضافه شد';
          btn.disabled = true;
          setTimeout(function () { btn.textContent = 'افزودن به سبد'; btn.disabled = false; }, 1200);
        });
        bottom.appendChild(btn);
      }
      tile.appendChild(bottom);
      grid.appendChild(tile);
    });
  }

  function renderChips() {
    var cats = ['همه'];
    products.forEach(function (p) {
      if (cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    chips.innerHTML = '';
    cats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c;
      b.setAttribute('aria-pressed', String(c === activeCategory));
      b.addEventListener('click', function () {
        activeCategory = c;
        renderChips();
        renderGrid();
      });
      chips.appendChild(b);
    });
  }

  function init() {
    grid = document.getElementById('shop-grid');
    chips = document.getElementById('shop-chips');
    if (!grid) return;

    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        products = (json.products || []).filter(function (p) { return p.active !== false; });
        renderChips();
        renderGrid();
      })
      .catch(function () {
        grid.innerHTML = '';
        var err = document.createElement('div');
        err.className = 'admin-empty';
        err.innerHTML = '<p class="big">فروشگاه در دسترس نیست.</p><p>اگر سرور کافه خاموش است، با دستور «node server.js» اجرا کنید و صفحه را دوباره باز کنید.</p>';
        grid.appendChild(err);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
