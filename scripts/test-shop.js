'use strict';
/*
 * test-shop.js — تست فروشگاه: محصولات، سفارش، موجودی، مدیریت
 * اجرا (سرور روشن): node scripts/test-shop.js
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0, fail = 0;

function log(name, ok, extra) {
  if (ok) pass += 1; else fail += 1;
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? '  |  ' + extra : ''));
}

function tomorrowYMD() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

(async () => {
  /* ۱) فهرست محصولات */
  let products = [];
  try {
    const r = await fetch(BASE + '/api/products');
    const j = await r.json();
    products = j.products || [];
    log('GET /api/products → فهرست محصولات فعال', r.status === 200 && j.ok && products.length >= 15, 'count=' + j.count);
    log('همهٔ محصولات فعال‌اند و قیمت دارند', products.every((p) => p.active !== false && Number.isInteger(p.price) && p.slug));
  } catch (e) {
    log('اتصال به سرور', false, e.message + ' — node server.js اجراست؟');
    finish();
    return;
  }

  /* ۲) جزئیات محصول با slug */
  try {
    const r = await fetch(BASE + '/api/products/espresso');
    const j = await r.json();
    log('GET /api/products/espresso', r.status === 200 && j.product && j.product.slug === 'espresso',
      'model3d=' + (j.product ? j.product.model3d : '-') + ' | price=' + (j.product ? j.product.price : '-'));
  } catch (e) { log('GET /api/products/espresso', false, e.message); }

  /* ۳) ثبت سفارش معتبر (حضوری) */
  const espresso = products.find((p) => p.slug === 'espresso');
  const cheesecake = products.find((p) => p.slug === 'new-york-cheesecake');
  let orderId = null;
  try {
    const r = await fetch(BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'مشتری آزمایشی',
        phone: '09121234567',
        delivery: 'pickup',
        items: [
          { product_id: espresso.id, quantity: 2, options: 'دبل' },
          { product_id: cheesecake.id, quantity: 1, options: '' },
        ],
      }),
    });
    const j = await r.json();
    orderId = j.order && j.order.id;
    const expectedTotal = espresso.price * 2 + cheesecake.price * 1;
    log('POST /api/orders → 201 + ORD-xxxx', r.status === 201 && /^ORD-\d+$/.test(String(orderId)), orderId);
    log('محاسبهٔ سمت سرور درست است (حضوری، بدون ارسال)', j.order && j.order.total === expectedTotal && j.order.delivery_fee === 0,
      'total=' + (j.order ? j.order.total : '?') + ' expected=' + expectedTotal);
    log('اقلام سفارش ذخیره شد', j.order && Array.isArray(j.order.items) && j.order.items.length === 2);
  } catch (e) { log('POST /api/orders', false, e.message); }

  /* ۴) سفارش ارسالی → هزینهٔ ارسال */
  try {
    const r = await fetch(BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'مشتری پستی',
        phone: '۰۹۳۵۱۲۳۴۵۶۷',
        address: 'تهران، خیابان آزمایشی، پلاک ۱، کدپستی ۱۱۱۱۱۱۱۱۱۱',
        delivery: 'shipping',
        items: [{ product_id: espresso.id, quantity: 1, options: '' }],
      }),
    });
    const j = await r.json();
    log('سفارش ارسالی → هزینهٔ ارسال ۴۵٬۰۰۰', r.status === 201 && j.order.delivery_fee === 45000 && j.order.total === espresso.price + 45000,
      'total=' + (j.order ? j.order.total : '?'));
  } catch (e) { log('سفارش ارسالی', false, e.message); }

  /* ۵) سفارش نامعتبر → 400 */
  try {
    const r = await fetch(BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'x', phone: '12', delivery: 'pickup', items: [] }),
    });
    const j = await r.json();
    log('سفارش نامعتبر → 400 + خطاها', r.status === 400 && j.ok === false && j.errors && Object.keys(j.errors).length >= 3,
      JSON.stringify(j.errors || {}));
  } catch (e) { log('سفارش نامعتبر', false, e.message); }

  /* ۶) نقض موجودی → 409 */
  try {
    const r = await fetch(BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'مشتری پرتوقع',
        phone: '09121234567',
        delivery: 'pickup',
        items: [{ product_id: cheesecake.id, quantity: 20, options: '' }],
      }),
    });
    const j = await r.json();
    log('نقض موجودی → 409 + فهرست کسری', r.status === 409 && Array.isArray(j.items) && j.items.length > 0,
      j.items ? j.items.map((i) => i.product_name + ':' + i.available).join('، ') : '');
  } catch (e) { log('نقض موجودی', false, e.message); }

  /* ۷) فهرست سفارش‌ها با اقلام */
  try {
    const r = await fetch(BASE + '/api/orders');
    const j = await r.json();
    const found = (j.orders || []).find((o) => o.id === orderId);
    log('GET /api/orders شامل سفارش تازه با اقلام', Boolean(found) && found.items.length === 2, 'count=' + j.count);
  } catch (e) { log('GET /api/orders', false, e.message); }

  /* ۸) تغییر وضعیت سفارش */
  if (orderId) {
    try {
      const r = await fetch(BASE + '/api/orders/' + orderId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'در حال آماده‌سازی', payment_status: 'پرداخت شده' }),
      });
      const j = await r.json();
      log('PATCH وضعیت سفارش', r.status === 200 && j.order.status === 'در حال آماده‌سازی' && j.order.payment_status === 'پرداخت شده');
    } catch (e) { log('PATCH وضعیت', false, e.message); }
  }

  /* ۹) مدیریت محصول: افزودن → ویرایش → حذف */
  try {
    const r1 = await fetch(BASE + '/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'کوکی تستی', category: 'دسر و کیک', price: 55000, stock: 5, description: 'محصول آزمون' }),
    });
    const j1 = await r1.json();
    const testId = j1.product && j1.product.id;
    log('POST محصول جدید → 201', r1.status === 201 && /^PRD-\d+$/.test(String(testId)), testId);

    const r2 = await fetch(BASE + '/api/admin/products/' + testId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 60000, active: false }),
    });
    const j2 = await r2.json();
    log('PATCH قیمت و غیرفعال‌سازی', r2.status === 200 && j2.product.price === 60000 && j2.product.active === false);

    const r3 = await fetch(BASE + '/api/admin/products/' + testId, { method: 'DELETE' });
    log('DELETE محصول', r3.status === 200);
  } catch (e) { log('مدیریت محصول', false, e.message); }

  /* ۱۰) موجودی پس از سفارش کاهش یافته است */
  try {
    const r = await fetch(BASE + '/api/products/espresso');
    const j = await r.json();
    log('کاهش موجودی پس از دو سفارش اسپرسو', Number(j.product.stock) <= products.find((p) => p.slug === 'espresso').stock - 3,
      'stock now=' + j.product.stock);
  } catch (e) { log('بررسی موجودی', false, e.message); }

  finish();

  function finish() {
    const total = pass + fail;
    console.log('RESULT: ' + pass + '/' + total + ' passed' + (fail ? '  (' + fail + ' failed)' : ''));
    process.exit(fail ? 1 : 0);
  }
})();
