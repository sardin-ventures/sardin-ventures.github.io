/* Minimal screenshot lightbox: clicking a gallery image opens it in an on-page
   overlay instead of navigating away. Arrow keys, the side buttons or a swipe
   step through every screenshot on the page; click the backdrop or press Esc
   to close. Uses event delegation so it works regardless of when the gallery
   links exist. The underlying <a href> stays as a no-JS / right-click fallback. */
(function () {
  "use strict";

  var SELECTOR = ".media-card a, a.screenshot-card";

  var box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Screenshot viewer");

  var figure = document.createElement("figure");
  figure.className = "lightbox-figure";
  var img = document.createElement("img");
  img.alt = "";
  var caption = document.createElement("figcaption");
  caption.className = "lightbox-caption";
  figure.appendChild(img);
  figure.appendChild(caption);

  function navButton(cls, label, glyph) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lightbox-nav " + cls;
    b.setAttribute("aria-label", label);
    b.textContent = glyph;
    return b;
  }
  var prev = navButton("lightbox-prev", "Previous screenshot", "←");
  var next = navButton("lightbox-next", "Next screenshot", "→");

  var hint = document.createElement("p");
  hint.className = "lightbox-hint";
  hint.textContent = "← → to browse · Esc or click to close";

  box.appendChild(figure);
  box.appendChild(prev);
  box.appendChild(next);
  box.appendChild(hint);

  function ensureAttached() {
    if (!box.parentNode && document.body) document.body.appendChild(box);
  }

  var links = [];
  var index = 0;
  var lastFocus = null;

  function captionFor(a) {
    var fig = a.closest ? a.closest("figure") : null;
    var cap = fig ? fig.querySelector("figcaption") : null;
    if (cap && cap.textContent.trim()) return cap.textContent.trim();
    var im = a.querySelector("img");
    return im ? im.alt : "";
  }

  function show(i) {
    index = (i + links.length) % links.length;
    var a = links[index];
    var im = a.querySelector("img");
    img.src = a.getAttribute("href");
    img.alt = im ? im.alt : "";
    caption.textContent = captionFor(a) + "  ·  " + (index + 1) + " / " + links.length;
    var many = links.length > 1;
    prev.hidden = !many;
    next.hidden = !many;
  }

  function open(a) {
    ensureAttached();
    links = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    show(Math.max(0, links.indexOf(a)));
    box.classList.add("is-open");
    lastFocus = document.activeElement;
    box.tabIndex = -1;
    box.focus();
  }
  function close() {
    box.classList.remove("is-open");
    img.removeAttribute("src");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // delegated: catch any click landing inside a gallery link
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest(SELECTOR) : null;
    if (!a) return;
    e.preventDefault();
    open(a);
  });

  prev.addEventListener("click", function (e) { e.stopPropagation(); show(index - 1); });
  next.addEventListener("click", function (e) { e.stopPropagation(); show(index + 1); });
  box.addEventListener("click", close);

  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });

  // horizontal swipe browses on touch screens; a tap still closes
  var startX = null, startY = null;
  box.addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - startX, dy = t.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      show(index + (dx < 0 ? 1 : -1));
    }
  });
})();
