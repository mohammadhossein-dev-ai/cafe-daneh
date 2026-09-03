'use strict';
/*
 * cart.js — صفحهٔ سبد خرید: خط‌ها، تعداد، حذف، جمع‌ها؛ خالی‌بودن سبد
 */
(function () {
  var FA = window.Jalali.faDigits;
  var body;

  function el(id) { return document.getElementById(id); }
  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return FA(String(n)); }
  }

  function renderEmpty() {
    body.innerHTML = '';
    var empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.innerHTML =
      '<p class="big">سبد شما خالی است.</p>' +
      '<p>یک فنجان گرم انتخاب کنید — فروشگاه همین‌جاست.</p>' +
      '<p style="margin-top: var(--space-s);"><a class="btn btn-primary" href="/shop">مشاهده فروشگاه</a></p>';
    body.appendChild(empty);
  }

  function render(lines, subtotal) {
    body.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'res-grid';
    wrap.style.alignItems = 'start';

    var linesCol = document.createElement('div');
    linesCol.className = 'cart-lines';
    lines.forEach(function (l) {
      var line = document.createElement('div');
      line.className = 'cart-line';

      var head = document.createElement('div');
      head.className = 'cl-head';
      var name = document.createElement('span');
      name.className = 'cl-name';
      var a = document.createElement('a');
      a.href = '/product/' + encodeURIComponent(l.product.slug);
      a.textContent = l.name;
      name.appendChild(a);
      var total = document.createElement('span');
      total.className = 'cl-total';
      total.textContent = faPrice(l.lineTotal) + ' تومان';
      head.appendChild(name);
      head.appendChild(total);
      line.appendChild(head);

      var row = document.createElement('div');
      row.className = 'cl-row';

      var right = document.createElement('div');
      right.style.cssText = 'display:flex; align-items:center; gap: var(--space-s); flex-wrap: wrap;';
      if (l.options) {
        var opt = document.createElement('span');
        opt.className = 'cl-options';
        opt.textContent = 'گزینه: ' + l.options;
        right.appendChild(opt);
      }
      var unit = document.createElement('span');
      unit.className = 'cl-unit';
      unit.textContent = 'واحد ' + faPrice(l.unitPrice) + ' تومان';
      right.appendChild(unit);

      var stepper = document.createElement('div');
      stepper.className = 'qty-stepper';
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', 'کاهش تعداد ' + l.name);
      var input = document.createElement('input');
      input.type = 'text';
      input.readOnly = true;
      input.value = FA(String(l.qty));
      input.setAttribute('aria-label', 'تعداد ' + l.name);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'افزایش تعداد ' + l.name);
      stepper.appendChild(minus);
      stepper.appendChild(input);
      stepper.appendChild(plus);
      right.appendChild(stepper);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-danger';
      remove.textContent = 'حذف';
      remove.setAttribute('aria-label', 'حذف ' + l.name + ' از سبد');

      minus.addEventListener('click', function () {
        window.DanehCart.save(window.DanehCart.setQty(window.DanehCart.load(), l.productId, l.options, l.qty - 1));
        load();
      });
      plus.addEventListener('click', function () {
        window.DanehCart.save(window.DanehCart.setQty(window.DanehCart.load(), l.productId, l.options, l.qty + 1));
        load();
      });
      remove.addEventListener('click', function () {
        window.DanehCart.save(window.DanehCart.removeItem(window.DanehCart.load(), l.productId, l.options));
        load();
      });

      row.appendChild(right);
      row.appendChild(remove);
      line.appendChild(row);
      linesCol.appendChild(line);
    });
    wrap.appendChild(linesCol);

    var aside = document.createElement('div');
    aside.className = 'summary-box';
    var r1 = document.createElement('div');
    r1.className = 'row';
    r1.innerHTML = '<span>جمع سبد</span><span class="val">' + faPrice(subtotal) + ' تومان</span>';
    aside.appendChild(r1);
    var note = document.createElement('p');
    note.style.cssText = 'font-size: 0.6875rem; color: var(--ink-3); line-height: 1.8;';
    note.textContent = 'هزینهٔ ارسال در مرحلهٔ بعد محاسبه می‌شود (تحویل حضوری در کافه رایگان است).';
    aside.appendChild(note);

    var actions = document.createElement('div');
    actions.className = 'cart-actions';
    var cont = document.createElement('a');
    cont.className = 'btn btn-secondary';
    cont.href = '/shop';
    cont.textContent = 'ادامه خرید';
    var pay = document.createElement('a');
    pay.className = 'btn btn-primary';
    pay.href = '/checkout';
    pay.textContent = 'ادامه به پرداخت';
    actions.appendChild(cont);
    actions.appendChild(pay);
    aside.appendChild(actions);

    wrap.appendChild(aside);
    body.appendChild(wrap);
  }

  function load() {
    var cart = window.DanehCart.load();
    if (!cart.length) {
      renderEmpty();
      return;
    }
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var view = window.DanehCart.buildView(cart, json.products || []);
        if (!view.lines.length) {
          renderEmpty();
          return;
        }
        if (view.issues.length) {
          /* اقلام نامعتبر از سبد حذف شده‌اند — ذخیرهٔ نسخهٔ پاک‌شده */
          var valid = view.lines.map(function (l) {
            return { productId: l.productId, options: l.options, qty: l.qty };
          });
          window.DanehCart.save(valid);
        }
        render(view.lines, view.subtotal);
      })
      .catch(function () {
        body.innerHTML = '';
        var err = document.createElement('div');
        err.className = 'admin-empty';
        err.innerHTML = '<p class="big">سبد در دسترس نیست.</p><p>سرور کافه را اجرا کنید: <span dir="ltr">node server.js</span></p>';
        body.appendChild(err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      body = el('cart-body');
      load();
      window.addEventListener('daneh:cart', function () { load(); });
    });
  } else {
    body = el('cart-body');
    load();
    window.addEventListener('daneh:cart', function () { load(); });
  }
})();
