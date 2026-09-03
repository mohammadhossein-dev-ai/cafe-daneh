'use strict';
/*
 * about.js — رندر بخش‌های آدرس، ساعت کاری و تماس صفحهٔ /about از site-data
 */
(function () {
  var DATA = window.SITE_DATA;

  function el(id) { return document.getElementById(id); }

  function infoRow(label, valueNode) {
    var li = document.createElement('li');
    var d = document.createElement('span');
    d.textContent = label;
    var leader = document.createElement('span');
    leader.className = 'leader';
    leader.setAttribute('aria-hidden', 'true');
    li.appendChild(d);
    li.appendChild(leader);
    li.appendChild(valueNode);
    return li;
  }

  function renderAddress() {
    var wrap = el('about-address');
    if (!wrap) return;
    var c = DATA.contact;
    wrap.innerHTML = '';

    var p = document.createElement('p');
    p.textContent = c.address;
    wrap.appendChild(p);

    var maps = document.createElement('p');
    var a = document.createElement('a');
    a.className = 'text-link';
    a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.mapsQuery);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'دریافت مسیر با نقشه ←';
    maps.appendChild(a);
    wrap.appendChild(maps);

    var note = document.createElement('p');
    note.style.cssText = 'font-size: 0.833rem; color: var(--ink-3);';
    note.textContent = c.note;
    wrap.appendChild(note);
  }

  function renderHours() {
    var ul = el('about-hours');
    if (!ul) return;
    ul.innerHTML = '';
    DATA.hours.forEach(function (row) {
      var t = document.createElement('b');
      t.textContent = row.time;
      ul.appendChild(infoRow(row.days, t));
    });
  }

  function renderContact() {
    var ul = el('about-contact');
    if (!ul) return;
    var c = DATA.contact;
    ul.innerHTML = '';
    [
      { label: 'تلفن کافه', value: c.phoneDisplay, href: 'tel:' + c.phone },
      { label: 'موبایل', value: c.mobileDisplay, href: 'tel:' + c.mobile },
      { label: 'اینستاگرام', value: c.instagram, href: c.instagramUrl + c.instagram.replace('@', '') },
    ].forEach(function (row) {
      var a = document.createElement('a');
      a.className = 'tel';
      a.href = row.href;
      if (row.href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
      var bdi = document.createElement('bdi');
      bdi.setAttribute('dir', 'ltr');
      bdi.textContent = row.value;
      a.appendChild(bdi);
      ul.appendChild(infoRow(row.label, a));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderAddress(); renderHours(); renderContact();
    });
  } else {
    renderAddress(); renderHours(); renderContact();
  }
})();
