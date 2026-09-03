'use strict';
/* تست واحد هستهٔ سبد خرید (بدون DOM) */
const assert = require('assert');
const cart = require('../public/js/cart-core.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass += 1; console.log('[PASS] ' + name); }
  catch (e) { fail += 1; console.log('[FAIL] ' + name + ' | ' + e.message); }
}

t('افزودن اولین قلم', () => {
  const l = cart.addItem([], 'PRD-1', '', 2);
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].qty, 2);
});
t('افزودن تکراری ادغام می‌شود', () => {
  let l = cart.addItem([], 'PRD-1', '', 2);
  l = cart.addItem(l, 'PRD-1', '', 3);
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].qty, 5);
});
t('گزینهٔ متفاوت = خط جدا', () => {
  let l = cart.addItem([], 'PRD-1', 'تک', 1);
  l = cart.addItem(l, 'PRD-1', 'دبل', 1);
  assert.strictEqual(l.length, 2);
});
t('سقف تعداد ۲۰ است', () => {
  let l = cart.addItem([], 'PRD-1', '', 50);
  assert.strictEqual(l[0].qty, 20);
});
t('کاهش به صفر = حذف', () => {
  let l = cart.addItem([], 'PRD-1', '', 1);
  l = cart.setQty(l, 'PRD-1', '', 0);
  assert.strictEqual(l.length, 0);
});
t('حذف قلم مشخص', () => {
  let l = cart.addItem([], 'PRD-1', 'تک', 1);
  l = cart.addItem(l, 'PRD-2', '', 2);
  l = cart.removeItem(l, 'PRD-1', 'تک');
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].productId, 'PRD-2');
});
t('buildView: جمع و خطوط', () => {
  const products = [{ id: 'PRD-1', name: 'اسپرسو', price: 65000, active: true }];
  const l = cart.addItem([], 'PRD-1', 'دبل', 2);
  const v = cart.buildView(l, products);
  assert.strictEqual(v.lines.length, 1);
  assert.strictEqual(v.lines[0].lineTotal, 130000);
  assert.strictEqual(v.subtotal, 130000);
  assert.strictEqual(v.issues.length, 0);
});
t('buildView: محصول حذف‌شده → issue', () => {
  const l = cart.addItem([], 'PRD-404', '', 1);
  const v = cart.buildView(l, []);
  assert.strictEqual(v.lines.length, 0);
  assert.strictEqual(v.issues.length, 1);
});
t('count: تعداد کل', () => {
  let l = cart.addItem([], 'PRD-1', '', 3);
  l = cart.addItem(l, 'PRD-2', '', 4);
  assert.strictEqual(cart.count(l), 7);
});

console.log('RESULT: ' + pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
