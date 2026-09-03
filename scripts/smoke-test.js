'use strict';
/*
 * smoke-test.js — تست دودِ سرور و API رزرو
 *
 * اجرا (سرور باید روشن باشد):
 *   node scripts/smoke-test.js                 ← تست کامل (سلامت + خطا + ثبت + خواندن + فایل داده)
 *   node scripts/smoke-test.js check RSV-1001  ← فقط بررسی وجود یک شناسه (برای تست ماندگاری پس از ری‌استارت)
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const mode = process.argv[2] || 'full';
const arg3 = process.argv[3];

let passCount = 0;
let failCount = 0;

function log(name, ok, extra) {
  if (ok) passCount += 1;
  else failCount += 1;
  const line = (ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? '  |  ' + extra : '');
  console.log(line);
  return ok;
}

function tomorrowYMD() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

async function main() {
  if (mode === 'check') {
    /* --- حالت بررسی ماندگاری: آیا این شناسه پس از ری‌استارت سرور هنوز هست؟ --- */
    const id = arg3;
    if (!id) {
      console.log('استفاده: node scripts/smoke-test.js check RSV-1001');
      process.exit(2);
    }
    try {
      const res = await fetch(BASE + '/api/bookings');
      const json = await res.json();
      const found = (json.bookings || []).find((b) => b.id === id);
      log('ماندگاری پس از ری‌استارت: ' + id + ' هنوز در دیتابیس است', Boolean(found),
        found ? 'createdAt=' + found.createdAt + ' | name=' + found.name : 'یافت نشد');
    } catch (err) {
      log('اتصال به سرور', false, err.message);
    }
    finish();
    return;
  }

  /* --- تست کامل --- */

  // ۱) سلامت سرور
  try {
    const res = await fetch(BASE + '/api/health');
    const json = await res.json();
    log('GET /api/health → 200 و ok=true', res.status === 200 && json.ok === true,
      'bookings=' + json.bookings);
  } catch (err) {
    log('اتصال به سرور (' + BASE + ')', false, err.message + ' — آیا node server.js اجراست؟');
    finish();
    return;
  }

  // ۲) ارسال رزرو نامعتبر → باید 400 با فهرست خطاهای فارسی برگردد
  try {
    const res = await fetch(BASE + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', phone: '123', date: '2026-13-40', time: '25:99', guests: '۹۹' }),
    });
    const json = await res.json().catch(() => ({}));
    log('POST رزرو نامعتبر → 400 + خطاهای فیلدی',
      res.status === 400 && json.ok === false && json.errors && typeof json.errors === 'object' &&
        Boolean(json.errors.name) && Boolean(json.errors.phone),
      'errors=' + JSON.stringify(json.errors || {}));
  } catch (err) {
    log('POST رزرو نامعتبر', false, err.message);
  }

  // ۳) ارسال رزرو معتبر → 201 + شناسه یکتا + زمان ثبت
  const payload = {
    name: 'مهمان آزمایشی',
    phone: '۰۹۱۲۱۲۳۴۵۶۷', // عمداً با ارقام فارسی — باید نرمال‌سازی شود
    date: tomorrowYMD(),
    time: '18:30',
    guests: '۲',
    notes: 'رزرو آزمایشی smoke-test؛ کنار پنجره لطفاً.',
  };
  let createdId = null;
  let created = null;
  try {
    const res = await fetch(BASE + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    created = json.booking;
    createdId = created && created.id;
    log('POST رزرو معتبر → 201 + شناسه RSV-xxxx + createdAt',
      res.status === 201 && json.ok === true && /^RSV-\d+$/.test(String(createdId)) &&
        Boolean(created && created.createdAt),
      createdId ? 'id=' + createdId + ' | createdAt=' + created.createdAt : 'status=' + res.status);
    if (created) {
      log('نرمال‌سازی شماره موبایل فارسی → 09121234567', created.phone === '09121234567',
        'phone=' + created.phone);
    }
  } catch (err) {
    log('POST رزرو معتبر', false, err.message);
  }

  // ۴) خواندن فهرست — رزرو تازه باید با تمام فیلدها باشد
  try {
    const res = await fetch(BASE + '/api/bookings');
    const json = await res.json();
    const found = (json.bookings || []).find((b) => b.id === createdId);
    log('GET /api/bookings شامل رزرو تازه با تمام فیلدها',
      Boolean(found) && found.name === payload.name && found.date === payload.date &&
        found.time === payload.time && Number(found.guests) === 2 && found.status === 'ثبت‌شده',
      found ? 'count=' + json.count : 'یافت نشد');
  } catch (err) {
    log('GET /api/bookings', false, err.message);
  }

  // ۵) بررسی فایل پایگاه داده روی دیسک
  try {
    const file = path.join(__dirname, '..', 'data', 'bookings.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const row = Array.isArray(rows) && rows.find((b) => b.id === createdId);
    log('data/bookings.json روی دیسک شامل رزرو است',
      Boolean(row), 'rows=' + (Array.isArray(rows) ? rows.length : '?'));
  } catch (err) {
    log('خواندن data/bookings.json', false, err.message);
  }

  // ۶) شناسه را برای تست ماندگاری ذخیره کن
  if (createdId) {
    fs.writeFileSync(path.join(__dirname, '..', 'data', '.last-test-id.txt'), createdId, 'utf8');
    console.log('LAST_ID=' + createdId);
    console.log('گام بعدی: سرور را قطع و دوباره اجرا کنید، سپس:');
    console.log('  node scripts/smoke-test.js check ' + createdId);
  }

  finish();
}

function finish() {
  const total = passCount + failCount;
  console.log('RESULT: ' + passCount + '/' + total + ' passed' + (failCount ? '  (' + failCount + ' failed)' : ''));
  process.exit(failCount ? 1 : 0);
}

main();
