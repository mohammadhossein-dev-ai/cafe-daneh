'use strict';
/*
 * checkout.js — ثبت نهایی سفارش
 * جمع‌ها همیشه سمت سرور از قیمت فعلی محصولات محاسبه می‌شود؛ سمت کلاینت فقط نمایشی است.
 */
(function () {
  var FA = window.Jalali.faDigits;
  var J = window.Jalali;
  var body;
  var products = [];
  var view = null;
  var delivery = 'pickup';

  function el(id) { return document.getElementById(id); }
  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return FA(String(n)); }
  }

  function redirectIfEmpty() {
    var cart = window.DanehCart.load();
    if (!cart.length) {
      window.location.replace('/cart');
      return true;
    }
    return false;
  }

  function shippingFee() { return delivery === 'shipping' ? 45000 : 0; }

  function renderSummary() {
    var fee = shippingFee();
    var linesEl = el('sum-lines');
    linesEl.innerHTML = '';
    view.lines.forEach(function (l) {
      var li = document.createElement('li');
      li.style.cssText = 'display:flex; justify-content:space-between; gap: var(--space-s); padding: var(--space-3xs) 0; border-bottom: 1px solid var(--line-soft); font-size: var(--step--1);';
      var right = document.createElement('span');
      right.textContent = l.name + (l.options ? ' (' + l.options + ')' : '') + ' × ' + FA(String(l.qty));
      var left = document.createElement('span');
      left.textContent = faPrice(l.lineTotal) + ' تومان';
      li.appendChild(right);
      li.appendChild(left);
      linesEl.appendChild(li);
    });
    el('sum-subtotal').textContent = faPrice(view.subtotal) + ' تومان';
    el('sum-fee').textContent = fee === 0 ? 'رایگان' : faPrice(fee) + ' تومان';
    el('sum-total').textContent = faPrice(view.subtotal + fee) + ' تومان';
  }

  function renderForm() {
    body.innerHTML = '';

    var grid = document.createElement('div');
    grid.className = 'res-grid';
    grid.style.alignItems = 'start';

    /* فرم */
    var formCol = document.createElement('div');
    var form = document.createElement('form');
    form.className = 'booking-form';
    form.noValidate = true;
    form.id = 'checkout-form';
    form.innerHTML =
      '<div class="field">' +
      '  <label for="co-name">نام و نام خانوادگی <span class="req" aria-hidden="true">*</span></label>' +
      '  <input type="text" id="co-name" dir="auto" autocomplete="name" required placeholder="مثلاً سارا محمدی" />' +
      '  <p class="field-error" id="err-customer_name" role="alert" hidden></p>' +
      '</div>' +
      '<div class="field">' +
      '  <label for="co-phone">شمارهٔ موبایل <span class="req" aria-hidden="true">*</span></label>' +
      '  <input type="tel" id="co-phone" dir="ltr" inputmode="tel" autocomplete="tel" required placeholder="0912 123 4567" />' +
      '  <p class="field-error" id="err-phone" role="alert" hidden></p>' +
      '</div>' +
      '<div class="field field-wide">' +
      '  <p style="font-size: var(--step--1); font-weight: 600; color: var(--ink-2); margin-bottom: var(--space-3xs);">نحوهٔ تحویل</p>' +
      '  <div class="delivery-radios">' +
      '    <label><input type="radio" name="delivery" value="pickup" checked /> تحویل حضوری در کافه — رایگان</label>' +
      '    <label><input type="radio" name="delivery" value="shipping" /> ارسال — ۴۵٬۰۰۰ تومان</label>' +
      '  </div>' +
      '</div>' +
      '<div class="field field-wide" id="address-field" hidden>' +
      '  <label for="co-address">آدرس پستی <span class="req" aria-hidden="true">*</span></label>' +
      '  <textarea id="co-address" dir="auto" rows="3" placeholder="استان، شهر، خیابان، پلاک و کد پستی"></textarea>' +
      '  <p class="field-error" id="err-address" role="alert" hidden></p>' +
      '</div>' +
      '<div class="field field-wide">' +
      '  <label for="co-notes">توضیحات سفارش (اختیاری)</label>' +
      '  <input type="text" id="co-notes" dir="auto" maxlength="300" placeholder="مثلاً: دانه را آسیاب کنید، زنگ نزنید…" />' +
      '  <p class="field-error" id="err-notes" role="alert" hidden></p>' +
      '</div>' +
      '<div class="form-level-error field-wide" id="form-level-error" role="alert" hidden style="grid-column: 1 / -1;"></div>' +
      '<div class="field field-wide">' +
      '  <button type="submit" class="btn btn-primary btn-block" id="co-submit">پرداخت و ثبت سفارش</button>' +
      '</div>';
    formCol.appendChild(form);
    grid.appendChild(formCol);

    /* خلاصه */
    var aside = document.createElement('div');
    aside.className = 'summary-box';
    aside.innerHTML =
      '<div class="row" style="margin-bottom: var(--space-2xs);"><strong style="color: var(--ink);">سفارش شما</strong></div>' +
      '<ul id="sum-lines" style="list-style:none;"></ul>' +
      '<div class="row"><span>جمع اقلام</span><span class="val" id="sum-subtotal"></span></div>' +
      '<div class="row"><span>هزینهٔ ارسال</span><span class="val" id="sum-fee"></span></div>' +
      '<div class="row total"><span>مبلغ نهایی</span><span class="val" id="sum-total"></span></div>';
    grid.appendChild(aside);

    body.appendChild(grid);

    /* تعامل */
    form.querySelectorAll('input[name="delivery"]').forEach(function (input) {
      input.addEventListener('change', function () {
        delivery = form.querySelector('input[name="delivery"]:checked').value;
        el('address-field').hidden = delivery !== 'shipping';
        renderSummary();
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ['customer_name', 'phone', 'address', 'notes'].forEach(function (f) {
        var e = el('err-' + f);
        if (e) { e.hidden = true; e.textContent = ''; }
      });
      var formErr = el('form-level-error');
      formErr.hidden = true;

      var payload = {
        customer_name: el('co-name').value.trim().replace(/\s+/g, ' '),
        phone: el('co-phone').value,
        address: el('co-address').value.trim(),
        notes: el('co-notes').value.trim(),
        delivery: delivery,
        items: view.lines.map(function (l) {
          return { product_id: l.productId, quantity: l.qty, options: l.options };
        }),
      };

      var btn = el('co-submit');
      btn.disabled = true;
      btn.textContent = 'در حال ثبت…';

      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (json) { return { status: r.status, json: json }; });
        })
        .then(function (out) {
          if (out.status === 201 && out.json.ok && out.json.order) {
            window.DanehCart.clear();
            renderSuccess(out.json.order);
          } else if (out.status === 400 && out.json.errors) {
            Object.keys(out.json.errors).forEach(function (f) {
              var e = el('err-' + f);
              if (e) { e.textContent = out.json.errors[f]; e.hidden = false; }
            });
            btn.disabled = false;
            btn.textContent = 'پرداخت و ثبت سفارش';
          } else if (out.status === 409) {
            formErr.textContent = 'موجودی برخی اقلام کافی نیست: ' +
              (out.json.items || []).map(function (it) { return it.product_name + ' (' + it.available + ' عدد)'; }).join('، ') +
              ' — سبد را به‌روزرسانی کنید.';
            formErr.hidden = false;
            btn.disabled = false;
            btn.textContent = 'پرداخت و ثبت سفارش';
          } else {
            formErr.textContent = 'ثبت سفارش ممکن نشد. دوباره تلاش کنید یا با کافه تماس بگیرید.';
            formErr.hidden = false;
            btn.disabled = false;
            btn.textContent = 'پرداخت و ثبت سفارش';
          }
        })
        .catch(function () {
          var formErr = el('form-level-error');
          formErr.textContent = 'ارتباط با سرور برقرار نشد. سرور کافه را اجرا کنید: node server.js';
          formErr.hidden = false;
          btn.disabled = false;
          btn.textContent = 'پرداخت و ثبت سفارش';
        });
    });
  }

  function renderSuccess(order) {
    body.innerHTML = '';
    var panel = document.createElement('div');
    panel.className = 'booking-success';
    panel.innerHTML =
      '<h3>سفارش شما ثبت شد.</h3>' +
      '<div class="ref"><span class="code">' + order.id + '</span>' +
      '<span class="created">' + J.weekdayName(order.created_at.slice(0, 10)) + ' ' + J.format(order.created_at.slice(0, 10)) + '</span></div>' +
      '<dl>' +
      '<dt>نام</dt><dd>' + order.customer_name + '</dd>' +
      '<dt>مبلغ نهایی</dt><dd>' + faPrice(order.total) + ' تومان</dd>' +
      '<dt>نحوهٔ تحویل</dt><dd>' + (order.delivery === 'shipping' ? 'ارسال پستی' : 'تحویل حضوری در کافه') + '</dd>' +
      '<dt>پرداخت</dt><dd>' + order.payment_status + '</dd>' +
      '</dl>' +
      '<p style="margin-top: var(--space-s); font-size: var(--step--1); color: var(--ink-3);">برای هماهنگی تحویل، به‌زودی با شمارهٔ شما تماس می‌گیریم. شمارهٔ پیگیری را نگه دارید.</p>' +
      '<div class="actions"><a class="btn btn-primary" href="/shop">ادامهٔ خرید</a> <a class="btn btn-secondary" href="/">بازگشت به خانه</a></div>';
    body.appendChild(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function init() {
    body = el('checkout-body');
    if (redirectIfEmpty()) return;
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        products = json.products || [];
        view = window.DanehCart.buildView(window.DanehCart.load(), products);
        if (!view.lines.length) {
          window.location.replace('/cart');
          return;
        }
        renderForm();
        renderSummary();
      })
      .catch(function () {
        body.innerHTML = '';
        var err = document.createElement('div');
        err.className = 'admin-empty';
        err.innerHTML = '<p class="big">سرور در دسترس نیست.</p><p>سرور کافه را اجرا کنید: <span dir="ltr">node server.js</span></p>';
        body.appendChild(err);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
