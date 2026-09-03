'use strict';
/*
 * jalali.js — تبدیل تاریخ میلادی به شمسی (الگوریتم jalaali)
 * استفاده: window.Jalali.format('2026-08-30')  →  «۹ شهریور ۱۴۰۵»
 *          window.Jalali.formatNumeric('2026-08-30')  →  «۱۴۰۵/۰۶/۰۹»
 *          window.Jalali.weekdayName('2026-08-30')    →  «یکشنبه»
 */
(function () {
  function div(a, b) {
    return ~~(a / b);
  }
  function mod(a, b) {
    return a - ~~(a / b) * b;
  }

  var BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];

  function jalCal(jy) {
    var bl = BREAKS.length;
    var gy = jy + 621;
    var leapJ = -14;
    var jp = BREAKS[0];
    var jm;
    var jump = 0;
    var leap;
    var leapG;
    var march;
    var n;
    var i;

    if (jy < jp || jy >= BREAKS[bl - 1]) {
      throw new Error('سال شمسی نامعتبر: ' + jy);
    }
    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }

  function g2d(gy, gm, gd) {
    var d =
      div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
      div(153 * mod(gm + 9, 12) + 2, 5) +
      gd -
      34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1;
    var gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  function d2j(jdn) {
    var gy = d2g(jdn).gy;
    var jy = gy - 621;
    var r = jalCal(jy);
    var jdn1f = g2d(gy, 3, r.march);
    var jd;
    var jm;
    var k;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy: jy, jm: jm, jd: jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  function toJalaali(gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  }

  var MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];
  var WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  function faDigits(value) {
    return String(value).replace(/\d/g, function (d) {
      return FA_DIGITS[Number(d)];
    });
  }

  /** رشتهٔ 'YYYY-MM-DD' یا Date → اجزای میلادی معتبر */
  function parseYMD(input) {
    if (input instanceof Date && !isNaN(input)) {
      return {
        y: input.getFullYear(),
        m: input.getMonth() + 1,
        d: input.getDate(),
        date: input,
      };
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input));
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var da = Number(m[3]);
    var dt = new Date(y, mo - 1, da);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) {
      return null;
    }
    return { y: y, m: mo, d: da, date: dt };
  }

  function toJalali(input) {
    var p = parseYMD(input);
    if (!p) return null;
    var j = toJalaali(p.y, p.m, p.d);
    return { jy: j.jy, jm: j.jm, jd: j.jd, gregorian: p };
  }

  window.Jalali = {
    toJalaali: toJalaali,
    faDigits: faDigits,
    months: MONTHS,
    weekdays: WEEKDAYS,
    /** «۹ شهریور ۱۴۰۵» */
    format: function (input) {
      var j = toJalali(input);
      if (!j) return '';
      return faDigits(j.jd) + ' ' + MONTHS[j.jm - 1] + ' ' + faDigits(j.jy);
    },
    /** «۱۴۰۵/۰۶/۰۹» */
    formatNumeric: function (input) {
      var j = toJalali(input);
      if (!j) return '';
      return (
        faDigits(j.jy) + '/' +
        faDigits(String(j.jm).padStart(2, '0')) + '/' +
        faDigits(String(j.jd).padStart(2, '0'))
      );
    },
    /** «یکشنبه» */
    weekdayName: function (input) {
      var p = parseYMD(input);
      if (!p) return '';
      return WEEKDAYS[p.date.getDay()];
    },
  };
})();
