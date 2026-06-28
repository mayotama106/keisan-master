/* ui.js — 小さな DOM ヘルパとトースト（依存ライブラリなし） */
(function (global) {
  'use strict';

  // el('div.cls#id', {attr}, [children|string])
  function el(tag, attrs, children) {
    var parts = tag.split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (p[0] === '.') node.classList.add(p.slice(1));
      else if (p[0] === '#') node.id = p.slice(1);
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className += ' ' + attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function mount(node) {
    var app = document.getElementById('app');
    clear(app);
    app.appendChild(node);
    app.scrollTop = 0;
  }

  var toastTimer = null;
  function toast(msg) {
    var root = document.getElementById('overlay-root');
    clear(root);
    var t = el('div.toast', null, msg);
    root.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { clear(root); }, 250);
    }, 1800);
  }

  function fmtMs(ms) {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + '秒';
  }
  function pct(x) { return Math.round(x * 100) + '%'; }

  global.UI = { el: el, clear: clear, mount: mount, toast: toast, fmtMs: fmtMs, pct: pct };
})(window);
