'use strict';
/*
 * reservation.js — فرم رزرو صفحهٔ /reservation
 * منطق مشابه نسخهٔ قبلی: تشخیص حالت (API سرور / پیش‌نمایش localStorage)،
 * اعتبارسنجی هماهنگ با سرور، ثبت و نمایش پیام موفقیت با شناسه.
 */
(function () {
  var DATA = window.SITE_DATA;
  var J = window.Jalali;
  var FA = J.faDigits;
  var DEMO_KEY = '***';

  var storageMode = 'demo';

  function el(id) { return document.getElementById(id); }

  function timeToFarsi(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return String(t || '');
    return FA(m[1]) + ':' + FA(m[2]);
  }

  /* ---------- رندر کنارِ فرم ---------- */
  function renderAside() {
    var c = DATA.contact;
    var hours = el('res-hours');
    if (hours) {
      hours.innerHTML = '';
      DATA.hours.forEach(function (row) {
        var li = document.createElement('li');
        var d = document.createElement('span');
        d.textContent = row.days;
        var leader = document.createElement('span');
        leader.className = 'leader';
        leader.setAttribute('aria-hidden', 'true');
        var t = document.createElement('b');
        t.textContent = row.time;
        li.appendChild(d); li.appendChild(leader); li.appendChild(t);
        hours.appendChild(li);
      });
    }
    var contact = el('res-contact');
    if (contact) {
      contact.innerHTML = '';
      [
        { label: 'تلفن', value: c.phoneDisplay, href: 'tel:' + c.phone },
        { label: 'موبایل', value: c.mobileDisplay, href: 'tel:' + c.mobile },
        { label: 'اینستاگرام', value: c.instagram, href: c.instagramUrl + c.instagram.replace('@', '') },
      ].forEach(function (row) {
        var li = document.createElement('li');
        var d = document.createElement('span');
        d.textContent = row.label;
        var leader = document.createElement('span');
        leader.className = 'leader';
        leader.setAttribute('aria-hidden', 'true');
        var a = document.createElement('a');
        a.className = 'tel';
        a.href = row.href;
        if (row.href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
        var bdi = document.createElement('bdi');
        bdi.setAttribute('dir', 'ltr');
        bdi.textContent = row.value;
        a.appendChild(bdi);
        li.appendChild(d); li.appendChild(leader); li.appendChild(a);
        contact.appendChild(li);
      });
    }
    var note = el('res-note');
    if (note) note.textContent = c.note;
  }

  /* ---------- حالت ذخیره‌سازی ---------- */
  function probeStorageMode() {
    var banner = el('storage-banner');
    var bannerText = el('storage-banner-text');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 2500);
    fetch('/api/health', { signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json || json.ok !== true) throw new Error('bad-health');
        storageMode = 'api';
        if (banner) banner.hidden = true;
      })
      .catch(function () {
        storageMode = 'demo';
        if (banner && bannerText) {
          bannerText.innerHTML =
            '<b>حالت پیش‌نمایش استاتیک:</b> رزروهای این صفحه فعلاً فقط در حافظهٔ مرورگر شما (localStorage) نگه‌داری می‌شوند. ' +
            'برای ثبت دائمی در پایگاه داده، پروژه را با سرور محلی اجرا کنید: <span dir="ltr">node server.js</span>';
          banner.hidden = false;
        }
      });
  }

  /* ---------- اعتبارسنجی (هماهنگ با سرور) ---------- */
  var validators = {
    name: function (v) {
      var s = String(v || '').trim().replace(/\s+/g, ' ');
      if (s.length < 2 || s.length > 60) return 'نام باید بین ۲ تا ۶۰ نویسه باشد.';
      return null;
    },
    phone: function (v) {
      var s = String(v || '');
      s = s.replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
           .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
      s = s.replace(/[\s\-()]/g, '');
      if (s.indexOf('+98') === 0) s = '0' + s.slice(3);
      else if (s.indexOf('0098') === 0) s = '0' + s.slice(4);
      else if (/^989\d{9}$/.test(s)) s = '0' + s.slice(2);
      if (!/^09\d{9}$/.test(s)) return 'شمارهٔ موبایل معتبر وارد کنید؛ مثال: ۰۹۱۲۱۲۳۴۵۶۷.';
      return null;
    },
    date: function (v) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim());
      if (!m) return 'تاریخ معتبر انتخاب کنید.';
      var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      var dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return 'تاریخ معتبر انتخاب کنید.';
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var diff = Math.round((dt - today) / 86400000);
      if (diff < 0) return 'تاریخ رزرو نمی‌تواند در گذشته باشد.';
      if (diff > 60) return 'تاریخ رزرو حداکثر تا ۶۰ روز آینده باشد.';
      return null;
    },
    time: function (v) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
      if (!m) return 'ساعت معتبر انتخاب کنید.';
      var minutes = Number(m[1]) * 60 + Number(m[2]);
      if (minutes < 480 || minutes > 1380) return 'ساعت رزرو باید بین ۰۸:۰۰ تا ۲۳:۰۰ باشد.';
      return null;
    },
    guests: function (v) {
      var n = parseInt(String(v || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }), 10);
      if (!Number.isInteger(n) || n < 1 || n > 20) return 'تعداد نفرات باید عددی بین ۱ تا ۲۰ باشد.';
      return null;
    },
    notes: function (v) {
      if (String(v || '').trim().length > 300) return 'یادداشت حداکثر ۳۰۰ نویسه است.';
      return null;
    },
  };

  function showError(fieldName, message) {
    var input = el('bk-' + fieldName);
    var errEl = el('err-' + fieldName);
    if (errEl) {
      if (message) { errEl.textContent = message; errEl.hidden = false; }
      else { errEl.textContent = ''; errEl.hidden = true; }
    }
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors() {
    Object.keys(validators).forEach(function (f) { showError(f, null); });
    var formErr = el('form-level-error');
    if (formErr) { formErr.hidden = true; formErr.textContent = ''; }
  }

  function collectForm() {
    return {
      name: (el('bk-name') || {}).value || '',
      phone: (el('bk-phone') || {}).value || '',
      date: (el('bk-date') || {}).value || '',
      time: (el('bk-time') || {}).value || '',
      guests: (el('bk-guests') || {}).value || '',
      notes: (el('bk-notes') || {}).value || '',
    };
  }

  function validateForm(data) {
    var firstInvalid = null;
    Object.keys(validators).forEach(function (f) {
      var msg = validators[f](data[f]);
      showError(f, msg);
      if (msg && !firstInvalid) firstInvalid = f;
    });
    return firstInvalid;
  }

  function normalizePhone(value) {
    var s = String(value || '');
    s = s.replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
         .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
    return s.replace(/[\s\-()]/g, '');
  }

  /* ---------- نمایش موفقیت ---------- */
  function showSuccess(booking, isDemo) {
    var form = el('booking-form');
    var panel = el('booking-success');
    if (!form || !panel) return;
    el('success-id').textContent = booking.id;
    var createdText = '';
    if (booking.createdAt) {
      var d = new Date(booking.createdAt);
      createdText = 'ثبت‌شده در ' + FA(String(d.getHours()).padStart(2, '0')) + ':' +
        FA(String(d.getMinutes()).padStart(2, '0'));
    }
    el('success-created').textContent = createdText;
    el('success-name').textContent = booking.name;
    el('success-date').textContent =
      J.weekdayName(booking.date) + ' ' + J.format(booking.date) +
      ' (' + J.formatNumeric(booking.date) + ' میلادی)';
    el('success-time').textContent = timeToFarsi(booking.time);
    el('success-guests').textContent = FA(String(booking.guests)) + ' نفر';
    el('success-demo-note').hidden = !isDemo;
    form.hidden = true;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function demoSave(booking) {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
    } catch (e) { list = []; }
    list.push(booking);
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  }

  function nextDemoId() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) { /* noop */ }
    var max = 0;
    list.forEach(function (b) {
      var m = /^RSV-DEMO-(\d+)$/.exec(String(b.id || ''));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'RSV-DEMO-' + (max + 1);
  }

  /* ---------- اتصال فرم ---------- */
  function bindForm() {
    var form = el('booking-form');
    if (!form) return;

    var dateInput = el('bk-date');
    if (dateInput) {
      var now = new Date();
      dateInput.min = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      dateInput.addEventListener('change', function () {
        var hint = el('bk-date-hint');
        if (!hint) return;
        var msg = validators.date(dateInput.value);
        if (dateInput.value && !msg) {
          hint.textContent = J.weekdayName(dateInput.value) + ' ' + J.format(dateInput.value);
          hint.hidden = false;
        } else {
          hint.textContent = '';
          hint.hidden = true;
        }
      });
    }

    var guests = el('bk-guests');
    if (guests) {
      for (var i = 1; i <= 20; i += 1) {
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = FA(String(i)) + ' نفر';
        guests.appendChild(opt);
      }
    }

    ['name', 'phone', 'date', 'time', 'guests', 'notes'].forEach(function (f) {
      var input = el('bk-' + f);
      if (!input) return;
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') {
          showError(f, validators[f](input.value));
        }
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearAllErrors();

      var data = collectForm();
      var firstInvalid = validateForm(data);
      if (firstInvalid) {
        var target = el('bk-' + firstInvalid);
        if (target) target.focus();
        return;
      }

      var submitBtn = el('submit-btn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'در حال ثبت…'; }

      var payload = {
        name: String(data.name).trim().replace(/\s+/g, ' '),
        phone: normalizePhone(data.phone),
        date: data.date,
        time: data.time,
        guests: data.guests,
        notes: String(data.notes || '').trim(),
      };

      var finish = function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت رزرو'; }
      };

      if (storageMode === 'api') {
        fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (json) {
              return { res: res, json: json };
            });
          })
          .then(function (out) {
            finish();
            if (out.res.status === 201 && out.json.ok && out.json.booking) {
              showSuccess(out.json.booking, false);
              form.reset();
              var hint = el('bk-date-hint');
              if (hint) hint.hidden = true;
            } else if (out.res.status === 400 && out.json.errors) {
              Object.keys(out.json.errors).forEach(function (f) {
                showError(f, out.json.errors[f]);
              });
            } else {
              var formErr = el('form-level-error');
              if (formErr) {
                formErr.textContent =
                  'ثبت رزرو ممکن نشد. اگر سرور کافه خاموش است، آن را با دستور «node server.js» اجرا کنید و دوباره تلاش کنید.';
                formErr.hidden = false;
              }
            }
          })
          .catch(function () {
            finish();
            var formErr = el('form-level-error');
            if (formErr) {
              formErr.textContent = 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید یا سرور محلی را اجرا کنید.';
              formErr.hidden = false;
            }
          });
      } else {
        var booking = {
          id: nextDemoId(),
          name: payload.name,
          phone: payload.phone,
          date: payload.date,
          time: payload.time,
          guests: Number(payload.guests),
          notes: payload.notes,
          status: 'ثبت‌شده (پیش‌نمایش)',
          createdAt: new Date().toISOString(),
          demo: true,
        };
        demoSave(booking);
        finish();
        showSuccess(booking, true);
        form.reset();
        var hint2 = el('bk-date-hint');
        if (hint2) hint2.hidden = true;
      }
    });

    var resetBtn = el('success-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        el('booking-success').hidden = true;
        el('booking-form').hidden = false;
        el('bk-name').focus();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderAside(); bindForm(); probeStorageMode();
    });
  } else {
    renderAside(); bindForm(); probeStorageMode();
  }
})();
