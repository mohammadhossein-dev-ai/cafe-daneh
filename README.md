# کافه دانه — کافه آنلاین با فروشگاه ☕🌙🛒
# Daneh Coffee — Online Coffee Shop & Booking

> دوزبانه: فارسی (ابتدا) + English (پایین) / Bilingual: Persian first, English at the bottom.

---

## 🇮🇷 فارسی

نسخهٔ «Night Espresso»: تجربهٔ سینمایی سه‌بعدی در خانه + **فروشگاه کامل** (۲۰ محصول، سبد خرید، ثبت سفارش) + رزرو میز + پنل مدیریت — همه روی یک سرور Node.js بدون هیچ وابستگیِ نصبی.

### اجرای محلی

```bat
node server.js
```

| صفحه | آدرس |
|---|---|
| خانهٔ سینمایی (Three.js + GSAP) | `http://localhost:3000` |
| فروشگاه | `/shop` |
| صفحهٔ محصول (نمونه: اسپرسو) | `/product/espresso` |
| سبد خرید | `/cart` |
| ثبت سفارش | `/checkout` |
| رزرو میز | `/reservation` |
| درباره و آدرس | `/about` |
| دفتر مدیریت | `/admin` |

تغییر پورت: `set PORT=3010 && node server.js`

### 🌐 دیپلوی آنلاین (لینک زنده)

**راه ۱ — Render (راحت‌ترین، با GitHub):**
1. پروژه را روی GitHub بگذارید (فایل‌های `render.yaml` و `.gitignore` آماده‌اند).
2. در [render.com](https://render.com) → **New + → Blueprint** → مخزن را انتخاب کنید.
3. Render خودش `node server.js` را اجرا و `https://…onrender.com` را می‌سازد. در تنظیمات، متغیر `ADMIN_PASSWORD` را با یک رمز دلخواه پر کنید (صفحهٔ `/admin` محافظت می‌شود).

**راه ۲ — Railway (بدون GitHub، از همین پوشه):**
```bat
npm i -g @railway/cli
railway login
railway init
railway up
```
سپس در داشبورد Railway، متغیر `ADMIN_PASSWORD` را بسازید. `railway.json` آماده است.

**راه ۳ — هر هاست Docker:** `Dockerfile` آماده است (پورت 3000، healthcheck `/api/health`).

> ⚠️ داده‌ها (سفارش‌ها/رزروها) در فایل‌های `data/*.json` روی دیسکِ سرویس ذخیره می‌شوند. در پلن رایگان Render با هر استقرار مجدد خالی می‌شوند؛ برای ماندگاری در Railway یک Volume روی `/app/data` وصل کنید.

**رمز مدیریت:** متغیر محیطی `ADMIN_PASSWORD` را تنظیم کنید (پیشنهاد: روی هاست عمومی حتماً). با تنظیم آن، `/admin` و APIهای مدیریتی با Basic Auth قفل می‌شوند (نام کاربری دلخواه، رمز = مقدار متغیر).

### فروشگاه چطور کار می‌کند؟

1. مشتری در `/shop` فیلتر دسته می‌زند و «افزودن به سبد» می‌زند؛ در صفحهٔ محصول گزینه (تک/دبل)، تعداد و مدل سه‌بعدی قابل‌چرخش هست.
2. سبد در `localStorage` ذخیره و جمع‌ها با قیمت فعلیِ سرور به‌روز می‌شود.
3. `/checkout`: نام/موبایل/آدرس (برای ارسال)/نحوهٔ تحویل (حضوری رایگان یا ارسال ۴۵٬۰۰۰ تومان).
4. سرور قیمت‌ها و موجودی را دوباره محاسبه می‌کند، سفارش `ORD-xxxx` می‌سازد، موجودی را کم می‌کند و پرداختِ در محل ثبت می‌شود.
5. ادمین در تب «سفارش‌ها» وضعیت را تغییر می‌دهد (در انتظار تأیید ← در حال آماده‌سازی ← تحویل شد / لغو شد).

### مدل داده

- `data/products.json` — id, slug, name, description, full_description, price, category, image, model3d, options, stock, active, featured, created_at
- `data/orders.json` — id (ORD-xxxx), customer_name, phone, address, delivery, delivery_fee, subtotal, total, status, payment_status, created_at
- `data/order_items.json` — id, order_id, product_id, product_name, quantity, unit_price, options, subtotal
- `data/bookings.json` — رزروهای میز

### API

| متد | مسیر | کار |
|---|---|---|
| GET | `/api/products` (+`?category=`) | محصولات فعال |
| GET | `/api/products/:slug` | یک محصول |
| POST | `/api/orders` | ثبت سفارش (محاسبهٔ سمت سرور + کاهش موجودی + 409 برای کسری) |
| GET | `/api/orders` | سفارش‌ها با اقلام (مدیر) 🔒 |
| PATCH | `/api/orders/:id` | وضعیت سفارش/پرداخت (مدیر) 🔒 |
| GET/POST | `/api/admin/products` | فهرست کامل / افزودن (مدیر) 🔒 |
| PATCH/DELETE | `/api/admin/products/:id` | ویرایش / حذف (مدیر) 🔒 |
| GET/POST/DELETE | `/api/bookings*` | رزروها |
| GET | `/api/health` | سلامت + شمارنده‌ها |

🔒 = وقتی `ADMIN_PASSWORD` تنظیم شده باشد.

### تست

```bat
node scripts\test-shop.js     :: فروشگاه (۱۵ آزمون)
node scripts\test-cart.js     :: هستهٔ سبد (۹ آزمون)
node scripts\smoke-test.js    :: رزروها (۶ آزمون)
```

### فال‌بک‌ها

- نبود WebGL/GSAP → `no-fx` (سایت ایستا و خوانا) · موبایل → نسخهٔ سبک WebGL · `prefers-reduced-motion` → بدون حرکت · بدون سرور → راهنما در صفحات و رزروِ نمایشی.

### ویرایش محتوا

- محصولات: `/admin` یا `data/products.json` · آدرس/ساعت/تماس: `public/js/site-data.js` · رنگ/تایپ: توکن‌های `:root` در `public/css/styles.css` · متن فصل‌ها: `public/index.html`

---

## 🇬🇧 English

**Daneh Coffee** — a dark, luxurious "Night Espresso" experience: a cinematic 3D home page (Three.js cup, steam, beans, GSAP scroll storytelling) plus a full online shop and table booking, on a single zero-dependency Node.js server.

### Quick start

```bash
node server.js        # http://localhost:3000  (no npm install needed)
```

Pages: `/` (3D home) · `/shop` (20 products, 10 categories) · `/product/:slug` (options, quantity, interactive 3D) · `/cart` · `/checkout` (pickup free / shipping 45,000 T) · `/reservation` · `/about` · `/admin`.

### Deploy online

1. **Render (easiest):** push to GitHub → New + → Blueprint → it reads `render.yaml`; set the `ADMIN_PASSWORD` env var (locks `/admin` + admin APIs behind Basic Auth).
2. **Railway (no GitHub):** `npm i -g @railway/cli && railway login && railway init && railway up` — `railway.json` is included; attach a Volume on `/app/data` for persistence.
3. **Any Docker host:** included `Dockerfile` (port 3000, healthcheck `/api/health`).

> Data lives in `data/*.json` on the instance disk. Free Render plans wipe it on redeploy — use a Railway volume (or a hosted DB later) for durability.

### API summary

`GET /api/products` (+`?category=`) · `GET /api/products/:slug` · `POST /api/orders` (server-side totals, stock decrement, 409 on shortage) · `GET /api/orders` · `PATCH /api/orders/:id` · `GET/POST /api/admin/products` · `PATCH/DELETE /api/admin/products/:id` · `GET/POST/DELETE /api/bookings*` · `GET /api/health`. Admin routes are Basic-Auth protected when `ADMIN_PASSWORD` is set.

### Data model

- **products**: id, slug, name, description, full_description, price, category, image, model3d, options, stock, active, featured, created_at
- **orders**: id (ORD-xxxx), customer_name, phone, address, delivery, delivery_fee, subtotal, total, status, payment_status, created_at
- **order_items**: id, order_id, product_id, product_name, quantity, unit_price, options, subtotal
- **bookings**: table reservations (unchanged legacy API)

### Tests

```bash
npm test              # cart core (9) + bookings (6) + shop (15) = 30 checks
```

### Structure

`server.js` (static + APIs) · `public/` (HTML/CSS/JS + local Three.js, GSAP, fonts) · `public/js/cart-core.js` (pure cart logic) · `public/js/home-scene.js` (3D scene) · `data/` (JSON storage) · `scripts/` (tests).

MIT licensed. Built with the Night Espresso design system (espresso dark `#0d0a07`, caramel-gold accent `#d9a253`, Amiri + Vazirmatn, RTL, mobile-first).
