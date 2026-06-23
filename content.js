/* content.js — runtime text layer for sardin-ventures.
 *
 * Every editable piece of copy on the site carries a `data-edit="<key>"`
 * attribute, and each <body> carries a `data-page="home|runz|ohjata"`.
 * The editor (/editor/) produces /content.json, shaped like:
 *
 *   { "home": { "hero.eyebrow": "…", … }, "runz": { … }, "ohjata": { … } }
 *
 * This script fetches that file and overwrites the matching elements. The
 * inline HTML is the default copy, so the site renders correctly even when
 * content.json is missing or fails to load — content.json is a pure override
 * layer on top of the markup, never a hard dependency.
 *
 * Inside the editor the pages are loaded with `?edit=1`; we bail out there so
 * the editor has full control over what each element shows. */
(function () {
  "use strict";

  // The editor manages content itself — don't fight it.
  try {
    if (new URLSearchParams(window.location.search).has("edit")) return;
  } catch (e) {
    /* URLSearchParams unsupported — fall through and apply normally. */
  }

  var page = document.body && document.body.getAttribute("data-page");
  if (!page) return;

  // Cache-bust so edits show up without a hard refresh, but let the browser
  // reuse within a session.
  fetch("/content.json?v=" + Date.now(), { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("content.json " + res.status);
      return res.json();
    })
    .then(function (data) {
      var pageData = (data && data[page]) || null;
      if (!pageData) return;
      var nodes = document.querySelectorAll("[data-edit]");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var key = el.getAttribute("data-edit");
        if (Object.prototype.hasOwnProperty.call(pageData, key)) {
          el.innerHTML = pageData[key];
        }
      }
    })
    .catch(function () {
      /* No content.json yet, or invalid — inline defaults stand. */
    });
})();
