'use strict';
/*
 * site-common.js — کد مشترک همهٔ صفحات
 * ۱) پس‌زمینهٔ ناوبری هنگام اسکرول
 * ۲) رندر پابرگ (تماس، ساعت کاری، سال شمسی) از site-data
 */
(function () {
  var DATA = window.SITE_DATA;
  var J = window.Jalali;
  var FA = J.faDigits;

  function el(id) { return document.getElementById(id); }

  /* ناوبری هنگام اسکرول */
  var nav = document.querySelector('.site-nav');
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* پابرگ */
  var colophon = el('footer-colophon');
  if (colophon) {
    colophon.textContent =
      'کافه‌ای کوچک برای قهوهٔ جدی و نشستن‌های طولانی؛ ' + DATA.contact.address;
  }

  var contact = el('footer-contact');
  if (contact) {
    contact.innerHTML = '';
    var c = DATA.contact;
    [
      { text: c.phoneDisplay, href: 'tel:' + c.phone },
      { text: c.mobileDisplay, href: 'tel:' + c.mobile },
      { text: c.instagram, href: c.instagramUrl + c.instagram.replace('@', '') },
    ].forEach(function (r) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = r.href;
      if (r.href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
      var bdi = document.createElement('bdi');
      bdi.setAttribute('dir', 'ltr');
      bdi.textContent = r.text;
      a.appendChild(bdi);
      li.appendChild(a);
      contact.appendChild(li);
    });
  }

  var hours = el('footer-hours');
  if (hours) {
    hours.innerHTML = '';
    DATA.hours.forEach(function (r) {
      var li = document.createElement('li');
      li.textContent = r.days + ' — ' + r.time;
      hours.appendChild(li);
    });
  }

  var year = el('legal-year');
  if (year) {
    var now = new Date();
    var jy = J.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
    year.textContent = FA(String(jy));
  }

  /* نشان تعداد سبد خرید */
  function refreshCartBadge() {
    var badge = document.getElementById('cart-count');
    if (!badge || !window.DanehCart) return;
    var n = window.DanehCart.count(window.DanehCart.load());
    badge.textContent = FA(String(n));
    badge.hidden = n === 0;
  }
  window.addEventListener('daneh:cart', refreshCartBadge);
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === window.DanehCart.KEY) refreshCartBadge();
  });
  refreshCartBadge();
})();
