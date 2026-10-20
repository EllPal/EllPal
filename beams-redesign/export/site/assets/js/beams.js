// Interactions du site Beams (export statique).
// - data-on-mousemove="heroMove|spotMove" : parallaxe du hero et lumière qui suit le curseur sur les grilles de cartes.
// - data-set-state='{…}' : bascule vers un état pré-rendu (onglets du contact, filtres des actualités, copie des couleurs).
(function () {
  'use strict';

  var behaviours = {
    heroMove: function (e, el) {
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      el.style.setProperty('--hx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty('--hy', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    },
    spotMove: function (e, el) {
      var cards = el.querySelectorAll('.spot');
      for (var i = 0; i < cards.length; i++) {
        var b = cards[i].getBoundingClientRect();
        cards[i].style.setProperty('--mx', (e.clientX - b.left) + 'px');
        cards[i].style.setProperty('--my', (e.clientY - b.top) + 'px');
      }
    }
  };

  document.addEventListener('mousemove', function (e) {
    var el = e.target.closest ? e.target.closest('[data-on-mousemove]') : null;
    while (el) {
      var fn = behaviours[el.getAttribute('data-on-mousemove')];
      if (fn) fn(e, el);
      el = el.parentElement ? el.parentElement.closest('[data-on-mousemove]') : null;
    }
  }, { passive: true });

  var store = document.getElementById('beams-state');
  if (!store) return;
  var data = JSON.parse(store.textContent);
  var state = data.initial;
  var timer = null;

  function key(s) {
    var o = {};
    Object.keys(s).sort().forEach(function (k) { o[k] = s[k]; });
    return JSON.stringify(o);
  }

  function apply(next) {
    var html = data.variants[key(next)];
    if (!html) return;
    state = next;
    var region = document.querySelector('[data-region="main"]');
    if (region) region.outerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-set-state]') : null;
    if (!el) return;
    e.preventDefault();
    var next = Object.assign({}, state, JSON.parse(el.getAttribute('data-set-state')));
    apply(next);
    if (data.copyKey && next[data.copyKey]) {
      try { if (navigator.clipboard) navigator.clipboard.writeText(next[data.copyKey]); } catch (err) { /* presse-papiers indisponible */ }
      clearTimeout(timer);
      timer = setTimeout(function () { apply(Object.assign({}, state, data.initial)); }, 1600);
    }
  });
})();
