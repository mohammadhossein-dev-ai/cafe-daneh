'use strict';
/*
 * home.js — لایهٔ متنی روایت صفحهٔ خانه
 * - فصل‌ها با GSAP ScrollTrigger ظاهر می‌شوند (y کوچک + fade، مطابق پریست skill)
 * - پیشرفت اسکرول صحنهٔ سه‌بعدی را خود home-scene.js از scrollY می‌خواند (مستقل از GSAP)
 * - تیزر فروشگاه: ۳ محصول منتخب از API
 * - اگر GSAP لود نشد یا reduced-motion بود → کلاس no-fx و نمایش ایستا
 */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  function faPrice(n) {
    try { return Number(n).toLocaleString('fa-IR'); }
    catch (e) { return String(n); }
  }

  function renderTeaser() {
    var wrap = document.getElementById('shop-teaser');
    if (!wrap) return;
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var products = (json.products || []).filter(function (p) { return p.active !== false; });
        var featured = products.filter(function (p) { return p.featured; });
        var pick = (featured.length >= 3 ? featured : products).slice(0, 3);
        wrap.innerHTML = '';
        pick.forEach(function (p) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '/product/' + encodeURIComponent(p.slug);
          a.textContent = p.name;
          a.style.borderBottom = 'none';
          a.style.color = 'var(--ink)';
          a.style.fontWeight = '500';
          var leader = document.createElement('span');
          leader.className = 't-leader';
          leader.setAttribute('aria-hidden', 'true');
          var price = document.createElement('span');
          price.className = 't-price';
          price.textContent = faPrice(p.price);
          li.appendChild(a);
          li.appendChild(leader);
          li.appendChild(price);
          wrap.appendChild(li);
        });
      })
      .catch(function () {
        wrap.innerHTML = '';
        var li = document.createElement('li');
        li.textContent = 'فروشگاه به‌زودی…';
        wrap.appendChild(li);
      });
  }

  function init() {
    renderTeaser();
    var nav = document.querySelector('.site-nav');

    if (!hasGsap || reduced) {
      document.documentElement.classList.add('no-fx');
      return;
    }

    try {
      window.gsap.registerPlugin(window.ScrollTrigger);

      /* ظاهر شدن بلوک متن هر فصل — y کوچک (۸–۱۶px) تا حس fade بدهد نه slide */
      window.gsap.utils.toArray('.chapter .chapter-block').forEach(function (block) {
        window.gsap.from(block, {
          opacity: 0,
          y: 14,
          duration: 0.4,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: block,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      /* محو نشان اسکرول بعد از اولین حرکت */
      var hint = document.querySelector('.scroll-hint');
      if (hint) {
        window.gsap.to(hint, {
          opacity: 0,
          scrollTrigger: { trigger: '#story', start: 'top -20%', toggleActions: 'play none none none' },
        });
      }
    } catch (e) {
      document.documentElement.classList.add('no-fx');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
