/* Minimal screenshot lightbox: clicking a gallery image opens it in an on-page
   overlay instead of navigating away. Click anywhere or press Esc to close.
   Uses event delegation so it works regardless of when the gallery links exist.
   The underlying <a href> stays as a no-JS / right-click fallback. */
(function () {
  "use strict";

  var box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Screenshot viewer");

  var img = document.createElement("img");
  img.alt = "";
  var hint = document.createElement("p");
  hint.className = "lightbox-hint";
  hint.textContent = "Click anywhere or press Esc to close";
  box.appendChild(img);
  box.appendChild(hint);

  function ensureAttached() {
    if (!box.parentNode && document.body) document.body.appendChild(box);
  }

  var lastFocus = null;
  function open(src, alt) {
    ensureAttached();
    img.src = src;
    img.alt = alt || "";
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
    var a = t && t.closest ? t.closest(".media-card a, a.screenshot-card") : null;
    if (!a) return;
    e.preventDefault();
    var im = a.querySelector("img");
    open(a.getAttribute("href"), im ? im.alt : "");
  });

  box.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box.classList.contains("is-open")) close();
  });
})();
