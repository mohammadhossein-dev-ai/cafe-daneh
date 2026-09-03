'use strict';
/*
 * cart-core.js — هستهٔ سبد خرید (منطق خالص + لایهٔ ذخیره‌سازی)
 * در مرورگر و node قابل استفاده است (برای تست واحد).
 */
(function (root) {
  var KEY = 'daneh-cart-v1';
  var MAX_QTY = 20;

  function clampQty(n) {
    n = parseInt(n, 10);
    if (!Number.isInteger(n) || n < 1) return 1;
    if (n > MAX_QTY) return MAX_QTY;
    return n;
  }

  function load() {
    if (typeof localStorage === 'undefined') return [];
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (it) {
        return it && typeof it.productId === 'string' && Number.isInteger(clampQty(it.qty));
      }) : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('daneh:cart'));
    }
  }

  function sameLine(item, productId, options) {
    return item.productId === productId && (item.options || '') === (options || '');
  }

  function addItem(list, productId, options, qty) {
    var next = list.map(function (it) { return { productId: it.productId, options: it.options || '', qty: it.qty }; });
    qty = clampQty(qty || 1);
    var found = false;
    for (var i = 0; i < next.length; i += 1) {
      if (sameLine(next[i], productId, options)) {
        next[i].qty = clampQty(next[i].qty + qty);
        found = true;
        break;
      }
    }
    if (!found) next.push({ productId: String(productId), options: options || '', qty: qty });
    return next;
  }

  function setQty(list, productId, options, qty) {
    var next = [];
    var q = parseInt(qty, 10);
    for (var i = 0; i < list.length; i += 1) {
      var it = list[i];
      if (sameLine(it, productId, options)) {
        /* صفر/منفی/نامعتبر → حذف خط */
        if (!Number.isInteger(q) || q <= 0) continue;
        next.push({ productId: it.productId, options: it.options || '', qty: clampQty(q) });
      } else {
        next.push(it);
      }
    }
    return next;
  }

  function removeItem(list, productId, options) {
    return list.filter(function (it) { return !sameLine(it, productId, options); });
  }

  function clear() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('daneh:cart'));
    }
  }

  function count(list) {
    return list.reduce(function (s, it) { return s + it.qty; }, 0);
  }

  /**
   * buildView — ادغام سبد با محصولات سرور
   * products: فهرست محصولات (active) از API
   * خروجی: { lines, subtotal, issues }
   *   lines: [{ productId, name, options, qty, unitPrice, lineTotal, product }]
   *   issues: اقلامی که محصول‌شان حذف/غیرفعال شده
   */
  function buildView(list, products) {
    var byId = {};
    (products || []).forEach(function (p) { byId[String(p.id)] = p; });
    var lines = [];
    var issues = [];
    list.forEach(function (it) {
      var p = byId[String(it.productId)];
      if (!p) {
        issues.push({ productId: it.productId, options: it.options || '', qty: it.qty, reason: 'removed' });
        return;
      }
      lines.push({
        productId: it.productId,
        name: p.name,
        options: it.options || '',
        qty: it.qty,
        unitPrice: Number(p.price) || 0,
        lineTotal: (Number(p.price) || 0) * it.qty,
        product: p,
      });
    });
    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
    return { lines: lines, subtotal: subtotal, issues: issues };
  }

  var api = {
    KEY: KEY,
    MAX_QTY: MAX_QTY,
    clampQty: clampQty,
    load: load,
    save: save,
    clear: clear,
    addItem: addItem,
    setQty: setQty,
    removeItem: removeItem,
    count: count,
    buildView: buildView,
  };

  if (typeof window !== 'undefined') {
    window.DanehCart = api;
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.DanehCart = api;
})(typeof window !== 'undefined' ? window : globalThis);
