'use strict';
/*
 * server.js — کافه دانه · سرور محلی (بدون وابستگی خارجی)
 *
 * بخش‌ها:
 *   ۱) فایل‌های استاتیک public/ + مسیرهای تمیز:
 *        /  /shop  /cart  /checkout  /product/:slug  /reservation  /about  /admin
 *   ۲) API رزروها (سالم و دست‌نخورده):
 *        GET /api/health · GET/POST /api/bookings · DELETE /api/bookings/:id
 *   ۳) API فروشگاه:
 *        GET  /api/products            ← فقط محصولات فعال (فروشگاه)
 *        GET  /api/products/:slug      ← یک محصول با slug یا id (فعال)
 *        POST /api/orders              ← ثبت سفارش (اعتبارسنجی + محاسبه سمت سرور + کاهش موجودی)
 *   ۴) API مدیریت:
 *        GET   /api/admin/products     ← همهٔ محصولات (شامل غیرفعال)
 *        POST  /api/admin/products     ← محصول جدید
 *        PATCH /api/admin/products/:id ← ویرایش جزئی
 *        DELETE /api/admin/products/:id← حذف
 *        GET   /api/orders             ← فهرست سفارش‌ها با اقلام
 *        PATCH /api/orders/:id         ← تغییر وضعیت سفارش / پرداخت
 *
 * پایگاه داده (JSON + نوشتن اتمیک tmp+rename):
 *   data/bookings.json · data/products.json (seed خودکار) · data/orders.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
/* روی هاست ابری باید روی همهٔ اینترفیس‌ها گوش بدهیم وگرنه پروکسی به برنامه نمی‌رسد */
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
};

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
const SHIPPING_FEE = 45000;
const MAX_DAYS_AHEAD = 60;

/* رمز مدیریت — اگر تنظیم شود، صفحات و APIهای مدیریتی با Basic Auth محافظت می‌شوند */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

function isAdminAuthorized(req) {
  if (!ADMIN_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const idx = decoded.indexOf(':');
  const pass = idx === -1 ? '' : decoded.slice(idx + 1);
  return pass === ADMIN_PASSWORD;
}

function denyAdmin(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Daneh Admin", charset="UTF-8"',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify({ ok: false, message: 'دسترسی مدیریتی نیاز به رمز دارد (ADMIN_PASSWORD).' }));
}

/* ================= ابزارهای پایه ================= */

function faToEnDigits(value) {
  return String(value == null ? '' : value)
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function nextNumericId(list, prefix, start) {
  let max = start;
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  for (const row of list) {
    const m = re.exec(String(row.id || ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + '-' + (max + 1);
}

/* ================= پایگاه داده ================= */

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf8');
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
  if (!fs.existsSync(PRODUCTS_FILE)) writeJsonAtomic(PRODUCTS_FILE, seedProducts());
}

function readBookings() {
  const list = readJson(BOOKINGS_FILE, []);
  return Array.isArray(list) ? list : [];
}
function writeBookings(list) { writeJsonAtomic(BOOKINGS_FILE, list); }

function readProducts() {
  const list = readJson(PRODUCTS_FILE, []);
  return Array.isArray(list) ? list : [];
}
function writeProducts(list) { writeJsonAtomic(PRODUCTS_FILE, list); }

function readOrders() {
  const list = readJson(ORDERS_FILE, []);
  return Array.isArray(list) ? list : [];
}
function writeOrders(list) { writeJsonAtomic(ORDERS_FILE, list); }

function readOrderItems() {
  const file = path.join(DATA_DIR, 'order_items.json');
  const list = readJson(file, []);
  return Array.isArray(list) ? list : [];
}
function writeOrderItems(list) {
  writeJsonAtomic(path.join(DATA_DIR, 'order_items.json'), list);
}

/* ================= Seed محصولات کافه ================= */

function seedProducts() {
  const now = new Date().toISOString();
  const rows = [
    ['espresso', 'اسپرسو', 'تک‌شات با کرمای متراکم و پایانی شکلاتی', 'اسپرسوی ما از blend خانهٔ دانه است؛ ۹۰٪ عربیکا با برشت متوسط رو به تیره. کرمای گیری‌دار، بدنهٔ سنگین و پایانی شکلاتی-آجیلی. قدمت برشت: حداکثر یک هفته.', 65000, 'اسپرسو', 'cup', ['تک', 'دبل'], 60, true],
    ['americano', 'آمریکانو', 'اسپرسو با آب داغ؛ لطیف، روشن و بی‌تکلف', 'دبل‌شات اسپرسو با آب ۸۵ درجه؛ تلخیِ کنترل‌شده و بدنهٔ سبک. برای شروع روزهای کاری ساخته شده است.', 75000, 'آمریکانو', 'cup', [], 45, false],
    ['latte', 'لاته', 'شیر بخارخورده با لایهٔ نازک فوم', 'دبل‌شات زیر شیر مخملی؛ نسبت ۱ به ۴. می‌توانید وانیل یا کارامل بخواهید — در یادداشت سفارش بنویسید.', 100000, 'لاته', 'cup', [], 40, true],
    ['cappuccino', 'کاپوچینو', 'تعادل اسپرسو، شیر و فوم مخملی', 'نسبت کلاسیک یک‌سوم: اسپرسو، شیر داغ و فوم ضخیم. با پودر کاکائو تلخ سرو می‌شود.', 95000, 'کاپوچینو', 'cup', [], 40, false],
    ['mocha', 'موکا', 'اسپرسو، شکلات تلخ ۶۰٪ و شیر', 'شکلات تلخ ۶۰٪ آب‌شده در شات اسپرسو، با شیر داغ و کمی کاکائو روی فوم.', 120000, 'موکا', 'cup', [], 30, false],
    ['flat-white', 'فلت وایت', 'دبل‌شات با میکروفوم؛ قوی و گرد', 'دو شات ریسترتو زیر میکروفوم نازک؛ قوی‌تر از لاته، نرم‌تر از کاپوچینو.', 110000, 'اسپرسو', 'cup', [], 25, false],
    ['iced-latte', 'آیس لاته', 'اسپرسوی داغ روی شیر سرد و یخ', 'دبل‌شات تازه روی شیر سرد و یخ فراوان؛ تلخی و خنکی در یک لیوان بلند.', 115000, 'آیس کافی', 'cup', [], 30, false],
    ['iced-americano', 'آیس آمریکانو', 'اسپرسو، آب سرد و یخ', 'نسخهٔ تابستانی آمریکانو؛ شفاف، تلخ و خنک — بدون شیر.', 85000, 'آیس کافی', 'cup', [], 30, false],
    ['cold-brew', 'کلد برو', 'عصارهٔ سرد ۱۸ ساعته؛ خنک و نرم', 'دم‌آوری سرد ۱۸ ساعته با آب مقطر؛ اسیدیتهٔ پایین، شیرینی طبیعی و کافئین بالا. با یخ یا شیر سرد میل کنید.', 125000, 'نوشیدنی‌های سرد', 'cup', [], 20, false],
    ['mint-lemonade', 'لیموناد نعنا', 'لیموی تازه، نعنای خردشده و یخ فراوان', 'لیموی تازه‌فشرده با شربت خانگی و نعنای خردشده؛ همراه هر قهوه‌ای یک نفس تازه.', 95000, 'نوشیدنی‌های سرد', null, [], 25, false],
    ['peach-iced-tea', 'آیس تی هلو', 'چای سرد با شربت هلو خانگی', 'چای سیاه سرد‌شده با شربت هلو خانگی و برش‌های هلو.', 75000, 'نوشیدنی‌های سرد', null, [], 25, false],
    ['new-york-cheesecake', 'چیزکیک نیویورکی', 'با سس توت‌فرنگی خانگی', 'بیس بیسکوییتی کره‌ای، بافت پنیر خامه‌ای متراکم و سس توت‌فرنگی خانگی. هر روز صبح تازه پخته می‌شود.', 145000, 'دسر و کیک', null, [], 12, false],
    ['warm-brownie', 'براونی گرم', 'با بستنی وانیلی و گردوی بو داده', 'براونی ۷۰٪ شکلات، گرم‌شده در فر و سرو با بستنی وانیلی و گردوی بو داده.', 135000, 'دسر و کیک', null, [], 12, false],
    ['tiramisu', 'تیرامیسو', 'لایه‌های ماسکارپونه و لیدی‌فینگر قهوه‌خورده', 'لیدی‌فینگر آغشته به اسپرسوی سرد، کرم ماسکارپونه و پودر کاکائو؛ ۲۴ ساعت استراحت‌کرده.', 165000, 'دسر و کیک', null, [], 10, true],
    ['espresso-beans-250g', 'دانهٔ اسپرسو — ۲۵۰ گرم', 'برشت هفتگی؛ مخصوص اسپرسو و موکاپات', 'blend خانه: ۹۰٪ عربیکا برزیل/اتیوپی. برشت متوسط-تیره با پنهل شکلات، آجیل و کارامل. تاریخ برشت روی بسته.', 385000, 'دانه قهوه', 'beans', ['دانه کامل', 'آسیاب‌شده برای اسپرسو', 'آسیاب‌شده برای موکاپات'], 18, false],
    ['espresso-beans-500g', 'دانهٔ اسپرسو — ۵۰۰ گرم', 'برشت هفتگی؛ مخصوص اسپرسو و موکاپات', 'همان blend محبوب اسپرسو در بستهٔ ۵۰۰ گرمی با کیسهٔ سوپاپ‌دار و والو یک‌طرفه.', 690000, 'دانه قهوه', 'beans', ['دانه کامل', 'آسیاب‌شده برای اسپرسو'], 10, false],
    ['ethiopia-filter-250g', 'دانهٔ فیلتر اتیوپی — ۲۵۰ گرم', 'تک‌خاستگاه یرگاچف؛ اسیدیتهٔ گل و مرکبات', 'یرگاچف G1 شسته‌شده؛ عطر گل‌های سفید، لیموترش و چای سیاه. برای V60 و شیمی‌کس عالی است.', 420000, 'دانه قهوه', 'beans', ['دانه کامل', 'آسیاب‌شده برای فیلتر'], 14, false],
    ['daneh-ceramic-cup', 'فنجان سرامیکی دانه', 'فنجان ۲۰۰ میلی‌لیتری با مارک دست‌ساز', 'فنجان سرامیکی مات مشکی با حلقهٔ طلایی و مارک دانه؛ هم‌طراحی با فنجان سه‌بعدی همین سایت.', 285000, 'محصولات جانبی', null, [], 8, false],
    ['v60-starter', 'دم‌کن V60 و فیلتر', 'دم‌آوری دستی؛ همراه ۴۰ فیلتر کاغذی', 'قطره‌ای سرامیکی نسخهٔ ۰۲ با دستهٔ چوبی و ۴۰ عدد فیلتر کاغذی؛ برای شروع دم‌آوری دستی کافی است.', 520000, 'محصولات جانبی', null, [], 6, false],
    ['french-press-600', 'پرس فرنچ ۶۰۰ میلی', 'سه‌تکه، صافی استیل؛ ساده و بی‌ادعا', 'پرس فرنچ بوروسیلیکات با صافی استیل دوبل؛ برای قهوه‌های بدنه‌دار صبحگاهی.', 490000, 'محصولات جانبی', null, [], 7, false],
  ];
  return rows.map(function (r, i) {
    return {
      id: 'PRD-' + (101 + i),
      slug: r[0],
      name: r[1],
      description: r[2],
      full_description: r[3],
      price: r[4],
      category: r[5],
      image: null,
      model3d: r[6],
      options: r[7],
      stock: r[8],
      active: true,
      featured: r[9],
      created_at: now,
    };
  });
}

/* ================= اعتبارسنجی رزرو (دست‌نخورده) ================= */

const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 23 * 60;

function validateBooking(body) {
  const errors = {};
  const name = String(body.name == null ? '' : body.name).trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) errors.name = 'نام باید بین ۲ تا ۶۰ نویسه باشد.';

  let phone = faToEnDigits(body.phone).replace(/[\s\-()]/g, '');
  if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  else if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  else if (/^989\d{9}$/.test(phone)) phone = '0' + phone.slice(2);
  if (!/^09\d{9}$/.test(phone)) errors.phone = 'شماره موبایل معتبر وارد کنید؛ مثال: ۰۹۱۲۱۲۳۴۵۶۷.';

  const date = faToEnDigits(body.date).trim();
  let dateObj = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) dateObj = null;
  }
  if (!dateObj) {
    errors.date = 'تاریخ معتبر انتخاب کنید.';
  } else {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dateObj - today) / 86400000);
    if (diffDays < 0) errors.date = 'تاریخ رزرو نمی‌تواند در گذشته باشد.';
    else if (diffDays > MAX_DAYS_AHEAD) errors.date = 'تاریخ رزرو حداکثر تا ۶۰ روز آینده باشد.';
  }

  const time = faToEnDigits(body.time).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    errors.time = 'ساعت معتبر انتخاب کنید.';
  } else {
    const [h, m] = time.split(':').map(Number);
    const minutes = h * 60 + m;
    if (minutes < OPEN_MIN || minutes > CLOSE_MIN) errors.time = 'ساعت رزرو باید بین ۰۸:۰۰ تا ۲۳:۰۰ باشد.';
  }

  const guests = parseInt(faToEnDigits(body.guests), 10);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) errors.guests = 'تعداد نفرات باید عددی بین ۱ تا ۲۰ باشد.';

  const notes = String(body.notes == null ? '' : body.notes).trim();
  if (notes.length > 300) errors.notes = 'یادداشت حداکثر ۳۰۰ نویسه است.';

  return { errors, value: { name, phone, date, time, guests, notes } };
}

/* ================= اعتبارسنجی سفارش ================= */

function validateOrder(body, products) {
  const errors = {};
  const byId = new Map(products.map((p) => [String(p.id), p]));

  const customer_name = String(body.customer_name == null ? '' : body.customer_name).trim().replace(/\s+/g, ' ');
  if (customer_name.length < 2 || customer_name.length > 60) errors.customer_name = 'نام باید بین ۲ تا ۶۰ نویسه باشد.';

  let phone = faToEnDigits(body.phone).replace(/[\s\-()]/g, '');
  if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  else if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  else if (/^989\d{9}$/.test(phone)) phone = '0' + phone.slice(2);
  if (!/^09\d{9}$/.test(phone)) errors.phone = 'شماره موبایل معتبر وارد کنید؛ مثال: ۰۹۱۲۱۲۳۴۵۶۷.';

  const delivery = body.delivery === 'shipping' ? 'shipping' : 'pickup';
  const address = String(body.address == null ? '' : body.address).trim();
  if (delivery === 'shipping' && address.length < 10) errors.address = 'آدرس پستی را کامل وارد کنید (حداقل ۱۰ نویسه).';
  if (address.length > 500) errors.address = 'آدرس حداکثر ۵۰۰ نویسه است.';

  const notes = String(body.notes == null ? '' : body.notes).trim();
  if (notes.length > 300) errors.notes = 'توضیحات سفارش حداکثر ۳۰۰ نویسه است.';

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) errors.items = 'سبد خرید خالی است.';
  if (rawItems.length > 30) errors.items = 'تعداد اقلام سفارش بیش از حد مجاز است.';

  const merged = new Map();
  const stockIssues = [];
  if (rawItems.length && rawItems.length <= 30) {
    for (const raw of rawItems) {
      const product = byId.get(String(raw && raw.product_id));
      if (!product || product.active === false) {
        errors.items = 'یکی از محصولات سبد دیگر موجود نیست؛ سبد را به‌روزرسانی کنید.';
        break;
      }
      const qty = parseInt(faToEnDigits(raw.quantity), 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        errors.items = 'تعداد هر قلم باید بین ۱ تا ۲۰ باشد.';
        break;
      }
      const options = String(raw.options == null ? '' : raw.options).trim().slice(0, 80);
      const key = product.id + '::' + options;
      const prev = merged.get(key) || {
        product_id: product.id, product_name: product.name,
        quantity: 0, unit_price: product.price, options,
      };
      prev.quantity += qty;
      merged.set(key, prev);
    }
    if (!errors.items) {
      for (const item of merged.values()) {
        const p = products.find((x) => String(x.id) === String(item.product_id));
        if (p && Number(p.stock) < item.quantity) {
          stockIssues.push({ product_id: p.id, product_name: p.name, available: Number(p.stock) });
        }
      }
    }
  }

  const items = Array.from(merged.values());
  const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const delivery_fee = delivery === 'shipping' ? SHIPPING_FEE : 0;
  const total = subtotal + delivery_fee;

  return {
    errors,
    stockIssues,
    value: { customer_name, phone, address, notes, delivery, items, subtotal, delivery_fee, total },
  };
}

/* ================= فایل استاتیک ================= */

const CLEAN_ROUTES = {
  '/': '/index.html',
  '/shop': '/shop.html',
  '/cart': '/cart.html',
  '/checkout': '/checkout.html',
  '/reservation': '/reservation.html',
  '/about': '/about.html',
  '/admin': '/admin.html',
};

function notFoundPage(res) {
  const html =
    '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">' +
    '<title>۴۰۴ — کافه دانه</title></head>' +
    '<body style="font-family:Tahoma,sans-serif;background:#0d0a07;color:#f2e8d8;' +
    'display:grid;place-items:center;min-height:100vh;margin:0">' +
    '<div style="text-align:center"><h1 style="font-size:42px;margin:0 0 8px">۴۰۴</h1>' +
    '<p style="color:#c9b8a0;margin:0 0 20px">این میز خالی است؛ صفحه‌ای که دنبالش بودید پیدا نشد.</p>' +
    '<a href="/" style="color:#d9a253">بازگشت به کافه دانه</a></div></body></html>';
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.length > 1 && rel.endsWith('/')) rel = rel.slice(0, -1);
  if (CLEAN_ROUTES[rel]) rel = CLEAN_ROUTES[rel];
  if (rel === '/product' || rel.indexOf('/product/') === 0) rel = '/product.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      notFoundPage(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size,
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(res);
  });
}

function readJsonBody(req, limitBytes = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) { reject(new Error('payload-too-large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ================= سرور ================= */

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch { /* keep default */ }

  try {
    /* ---------- محافظت ادمین (وقتی ADMIN_PASSWORD تنظیم شده باشد) ---------- */
    if (ADMIN_PASSWORD) {
      const isOrderMutate = /^\/api\/orders\/[^/]+$/.test(pathname) && (req.method === 'PATCH' || req.method === 'DELETE');
      const needsAdmin =
        pathname === '/admin' ||
        pathname === '/admin.html' ||
        pathname.startsWith('/api/admin') ||
        (pathname === '/api/orders' && req.method === 'GET') ||
        isOrderMutate;
      if (needsAdmin && !isAdminAuthorized(req)) {
        denyAdmin(res);
        return;
      }
    }

    /* ---------- سلامت ---------- */
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'cafe-daneh',
        time: new Date().toISOString(),
        bookings: readBookings().length,
        orders: readOrders().length,
        products: readProducts().length,
      });
      return;
    }

    /* ---------- API رزروها (دست‌نخورده) ---------- */
    if (pathname === '/api/bookings' && req.method === 'GET') {
      const list = readBookings().slice().sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
      sendJson(res, 200, { ok: true, count: list.length, bookings: list });
      return;
    }

    if (pathname === '/api/bookings' && req.method === 'POST') {
      let raw;
      try { raw = await readJsonBody(req); } catch (err) {
        if (err && err.message === 'payload-too-large') sendJson(res, 413, { ok: false, message: 'حجم درخواست بیش از حد مجاز است.' });
        else sendJson(res, 400, { ok: false, message: 'خواندن درخواست ممکن نشد.' });
        return;
      }
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
        if (typeof body !== 'object' || body === null || Array.isArray(body)) body = {};
      } catch {
        sendJson(res, 400, { ok: false, message: 'بدنه درخواست JSON معتبر نیست.' });
        return;
      }
      const { errors, value } = validateBooking(body);
      if (Object.keys(errors).length > 0) {
        sendJson(res, 400, { ok: false, errors });
        return;
      }
      const list = readBookings();
      const booking = {
        id: nextNumericId(list, 'RSV', 1000),
        ...value,
        status: 'ثبت‌شده',
        createdAt: new Date().toISOString(),
      };
      list.push(booking);
      writeBookings(list);
      sendJson(res, 201, { ok: true, booking });
      return;
    }

    const bookingDelete = /^\/api\/bookings\/([^/]+)$/.exec(pathname);
    if (bookingDelete && req.method === 'DELETE') {
      const id = decodeURIComponent(bookingDelete[1]);
      const list = readBookings();
      const index = list.findIndex((b) => b.id === id);
      if (index === -1) {
        sendJson(res, 404, { ok: false, message: 'رزروی با این شناسه پیدا نشد.' });
        return;
      }
      list.splice(index, 1);
      writeBookings(list);
      sendJson(res, 200, { ok: true, id });
      return;
    }

    /* ---------- API فروشگاه: محصولات ---------- */
    if (pathname === '/api/products' && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const category = url.searchParams.get('category');
      let list = readProducts().filter((p) => p.active !== false);
      if (category) list = list.filter((p) => p.category === category);
      sendJson(res, 200, { ok: true, count: list.length, products: list });
      return;
    }

    const productDetail = /^\/api\/products\/([^/]+)$/.exec(pathname);
    if (productDetail && req.method === 'GET') {
      const key = decodeURIComponent(productDetail[1]);
      const product = readProducts().find((p) => p.active !== false && (p.slug === key || p.id === key));
      if (!product) {
        sendJson(res, 404, { ok: false, message: 'محصولی با این شناسه پیدا نشد.' });
        return;
      }
      sendJson(res, 200, { ok: true, product });
      return;
    }

    /* ---------- API فروشگاه: ثبت سفارش ---------- */
    if (pathname === '/api/orders' && req.method === 'POST') {
      let raw;
      try { raw = await readJsonBody(req, 32768); } catch (err) {
        sendJson(res, err && err.message === 'payload-too-large' ? 413 : 400, { ok: false, message: 'خواندن درخواست ممکن نشد.' });
        return;
      }
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
        if (typeof body !== 'object' || body === null || Array.isArray(body)) body = {};
      } catch {
        sendJson(res, 400, { ok: false, message: 'بدنه درخواست JSON معتبر نیست.' });
        return;
      }

      const products = readProducts();
      const { errors, stockIssues, value } = validateOrder(body, products);
      if (Object.keys(errors).length > 0) {
        sendJson(res, 400, { ok: false, errors });
        return;
      }
      if (stockIssues.length > 0) {
        sendJson(res, 409, { ok: false, message: 'موجودی برخی اقلام کافی نیست.', items: stockIssues });
        return;
      }

      /* کاهش موجودی + ثبت سفارش در یک پاس هماهنگ */
      const orders = readOrders();
      const itemsAll = readOrderItems();
      const order = {
        id: nextNumericId(orders, 'ORD', 1000),
        customer_name: value.customer_name,
        phone: value.phone,
        address: value.address,
        notes: value.notes,
        delivery: value.delivery,
        delivery_fee: value.delivery_fee,
        subtotal: value.subtotal,
        total: value.total,
        status: 'در انتظار تأیید',
        payment_status: 'پرداخت در محل',
        created_at: new Date().toISOString(),
      };
      const newItems = value.items.map(function (item) {
        const row = {
          id: order.id + '-' + crypto.randomBytes(3).toString('hex'),
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          options: item.options,
          subtotal: item.unit_price * item.quantity,
        };
        itemsAll.push(row);
        const p = products.find((x) => String(x.id) === String(item.product_id));
        if (p) p.stock = Math.max(0, Number(p.stock) - item.quantity);
        return row;
      });
      orders.push(order);
      writeProducts(products);
      writeOrders(orders);
      writeOrderItems(itemsAll);
      sendJson(res, 201, { ok: true, order: { ...order, items: newItems } });
      return;
    }

    /* ---------- API مدیریت ---------- */
    if (pathname === '/api/admin/products' && req.method === 'GET') {
      const list = readProducts().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      sendJson(res, 200, { ok: true, count: list.length, products: list });
      return;
    }

    if (pathname === '/api/admin/products' && req.method === 'POST') {
      let raw;
      try { raw = await readJsonBody(req); } catch { sendJson(res, 400, { ok: false, message: 'خواندن درخواست ممکن نشد.' }); return; }
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, message: 'بدنه درخواست JSON معتبر نیست.' }); return; }

      const name = String(body.name == null ? '' : body.name).trim();
      const price = parseInt(faToEnDigits(body.price), 10);
      const stock = parseInt(faToEnDigits(body.stock), 10);
      const category = String(body.category == null ? '' : body.category).trim();
      const errors = {};
      if (name.length < 2 || name.length > 80) errors.name = 'نام محصول باید بین ۲ تا ۸۰ نویسه باشد.';
      if (!Number.isInteger(price) || price < 0 || price > 999999999) errors.price = 'قیمت معتبر وارد کنید (تومان).';
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) errors.stock = 'موجودی معتبر وارد کنید.';
      if (category.length < 2 || category.length > 40) errors.category = 'دسته‌بندی را وارد کنید.';
      const description = String(body.description == null ? '' : body.description).trim().slice(0, 300);
      const full_description = String(body.full_description == null ? '' : body.full_description).trim().slice(0, 2000);
      const options = Array.isArray(body.options) ? body.options.map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 6) : [];
      const model3d = body.model3d === 'cup' || body.model3d === 'beans' ? body.model3d : null;

      if (Object.keys(errors).length) {
        sendJson(res, 400, { ok: false, errors });
        return;
      }

      const list = readProducts();
      const product = {
        id: nextNumericId(list, 'PRD', 100),
        slug: String(body.slug == null ? '' : body.slug).trim() ||
          name.replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, ''),
        name,
        description,
        full_description,
        price,
        category,
        image: null,
        model3d,
        options,
        stock,
        active: body.active !== false,
        featured: body.featured === true,
        created_at: new Date().toISOString(),
      };
      list.push(product);
      writeProducts(list);
      sendJson(res, 201, { ok: true, product });
      return;
    }

    const productPatch = /^\/api\/admin\/products\/([^/]+)$/.exec(pathname);
    if (productPatch && req.method === 'PATCH') {
      let raw;
      try { raw = await readJsonBody(req); } catch { sendJson(res, 400, { ok: false, message: 'خواندن درخواست ممکن نشد.' }); return; }
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, message: 'بدنه درخواست JSON معتبر نیست.' }); return; }

      const list = readProducts();
      const product = list.find((p) => p.id === decodeURIComponent(productPatch[1]) || p.slug === decodeURIComponent(productPatch[1]));
      if (!product) {
        sendJson(res, 404, { ok: false, message: 'محصولی با این شناسه پیدا نشد.' });
        return;
      }

      if (body.name != null) {
        const name = String(body.name).trim();
        if (name.length < 2 || name.length > 80) { sendJson(res, 400, { ok: false, errors: { name: 'نام محصول باید بین ۲ تا ۸۰ نویسه باشد.' } }); return; }
        product.name = name;
      }
      if (body.price != null) {
        const price = parseInt(faToEnDigits(body.price), 10);
        if (!Number.isInteger(price) || price < 0 || price > 999999999) { sendJson(res, 400, { ok: false, errors: { price: 'قیمت معتبر وارد کنید (تومان).' } }); return; }
        product.price = price;
      }
      if (body.stock != null) {
        const stock = parseInt(faToEnDigits(body.stock), 10);
        if (!Number.isInteger(stock) || stock < 0 || stock > 100000) { sendJson(res, 400, { ok: false, errors: { stock: 'موجودی معتبر وارد کنید.' } }); return; }
        product.stock = stock;
      }
      if (body.category != null) {
        const category = String(body.category).trim();
        if (category.length < 2 || category.length > 40) { sendJson(res, 400, { ok: false, errors: { category: 'دسته‌بندی را وارد کنید.' } }); return; }
        product.category = category;
      }
      if (body.description != null) product.description = String(body.description).trim().slice(0, 300);
      if (body.full_description != null) product.full_description = String(body.full_description).trim().slice(0, 2000);
      if (body.active != null) product.active = body.active === true;
      if (body.featured != null) product.featured = body.featured === true;
      if (Array.isArray(body.options)) product.options = body.options.map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 6);

      writeProducts(list);
      sendJson(res, 200, { ok: true, product });
      return;
    }

    const productDelete = /^\/api\/admin\/products\/([^/]+)$/.exec(pathname);
    if (productDelete && req.method === 'DELETE') {
      const key = decodeURIComponent(productDelete[1]);
      const list = readProducts();
      const index = list.findIndex((p) => p.id === key || p.slug === key);
      if (index === -1) {
        sendJson(res, 404, { ok: false, message: 'محصولی با این شناسه پیدا نشد.' });
        return;
      }
      const [removed] = list.splice(index, 1);
      writeProducts(list);
      sendJson(res, 200, { ok: true, id: removed.id });
      return;
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      const orders = readOrders().slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const itemsAll = readOrderItems();
      const withItems = orders.map((o) => ({
        ...o,
        items: itemsAll.filter((it) => it.order_id === o.id),
      }));
      sendJson(res, 200, { ok: true, count: orders.length, orders: withItems });
      return;
    }

    const orderPatch = /^\/api\/orders\/([^/]+)$/.exec(pathname);
    if (orderPatch && req.method === 'PATCH') {
      let raw;
      try { raw = await readJsonBody(req); } catch { sendJson(res, 400, { ok: false, message: 'خواندن درخواست ممکن نشد.' }); return; }
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, message: 'بدنه درخواست JSON معتبر نیست.' }); return; }

      const orders = readOrders();
      const order = orders.find((o) => o.id === decodeURIComponent(orderPatch[1]));
      if (!order) {
        sendJson(res, 404, { ok: false, message: 'سفارشی با این شناسه پیدا نشد.' });
        return;
      }
      const ALLOWED_STATUS = ['در انتظار تأیید', 'در حال آماده‌سازی', 'تحویل شد', 'لغو شد'];
      if (body.status != null) {
        if (!ALLOWED_STATUS.includes(body.status)) {
          sendJson(res, 400, { ok: false, message: 'وضعیت نامعتبر است.' });
          return;
        }
        order.status = body.status;
      }
      if (body.payment_status != null) {
        if (!['پرداخت در محل', 'پرداخت شده'].includes(body.payment_status)) {
          sendJson(res, 400, { ok: false, message: 'وضعیت پرداخت نامعتبر است.' });
          return;
        }
        order.payment_status = body.payment_status;
      }
      writeOrders(orders);
      sendJson(res, 200, { ok: true, order });
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { ok: false, message: 'این مسیر API وجود ندارد.' });
      return;
    }

    /* ---------- استاتیک ---------- */
    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, pathname);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
  } catch (err) {
    console.error('[خطا]', req.method, req.url, err);
    sendJson(res, 500, { ok: false, message: 'خطای داخلی سرور.' });
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      '[خطا] پورت ' + PORT + ' اشغال است. یا سرور قبلاً اجرا شده یا برنامه دیگری از این پورت استفاده می‌کند.\n' +
      'راه حل: با دستور  set PORT=3010 && node server.js  پورت دیگری انتخاب کنید.'
    );
    process.exit(1);
  }
  console.error('[خطای سرور]', err);
});

server.listen(PORT, HOST, () => {
  ensureStorage();
  console.log('');
  console.log('  ☕ کافه دانه روشن شد (کافه آنلاین).');
  console.log('  خانه:        http://localhost:' + PORT);
  console.log('  فروشگاه:     http://localhost:' + PORT + '/shop');
  console.log('  سبد خرید:    http://localhost:' + PORT + '/cart');
  console.log('  رزرو میز:    http://localhost:' + PORT + '/reservation');
  console.log('  دفتر مدیریت: http://localhost:' + PORT + '/admin');
  console.log('  پایگاه داده: ' + DATA_DIR);
  console.log('');
  console.log('  برای توقف سرور: Ctrl+C');
  console.log('');
});
