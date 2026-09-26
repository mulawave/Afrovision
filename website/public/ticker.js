/*
 * Ticker widget - drop-in scrolling news bar.
 *
 * Usage (any site, including plain HTML):
 *   <div data-ticker></div>
 *   <script src="https://afrovision.online/ticker.js" defer></script>
 *
 * Optional attributes on the element:
 *   data-src        URL returning { "items": ["text", ...] }
 *                   (default: /api/ticker on the site this script is loaded from)
 *   data-speed      scroll speed in pixels per second          (default 60)
 *   data-separator  text between items                         (default "   •   ")
 *
 * Styling (CSS custom properties, set on the element or any parent):
 *   --ticker-bg, --ticker-color, --ticker-border, --ticker-font-size, --ticker-font
 */
(function () {
  "use strict";

  var CACHE_PREFIX = "ticker:v1:";
  // The feed lives next to this script, so embedding sites need no config.
  var DEFAULT_SRC = (function () {
    try {
      return new URL("/api/ticker", document.currentScript.src).href;
    } catch (e) {
      return "/api/ticker";
    }
  })();
  var CACHE_TTL_MS = 5 * 60 * 1000;

  var STYLE =
    ":host{display:block}" +
    ".bar{overflow:hidden;background:var(--ticker-bg,#0b1533);" +
    "border-bottom:1px solid var(--ticker-border,rgba(240,165,42,.15))}" +
    ".track{display:flex;width:max-content;white-space:nowrap;padding:6px 0;" +
    "animation:ticker-scroll 40s linear infinite}" +
    ".bar:hover .track{animation-play-state:paused}" +
    // white-space:pre keeps the separator's spaces (normal wrapping rules
    // would collapse them and run the items together at the loop point).
    ".item{white-space:pre;color:var(--ticker-color,#f5c266);" +
    "font:500 var(--ticker-font-size,11px)/1.4 var(--ticker-font,system-ui,-apple-system,sans-serif);" +
    "letter-spacing:.02em}" +
    "@keyframes ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
    "@media (prefers-reduced-motion:reduce){.track{animation:none}.bar{overflow-x:auto}}";

  function readCache(src) {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_PREFIX + src));
      if (cached && Date.now() - cached.t < CACHE_TTL_MS) return cached.items;
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function writeCache(src, items) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + src, JSON.stringify({ t: Date.now(), items: items }));
    } catch (e) { /* storage unavailable */ }
  }

  // Accepts { items: ["..."] } or a plain array of strings / { text } objects.
  function normalize(data) {
    var list = Array.isArray(data) ? data : (data && data.items) || [];
    return list
      .map(function (x) { return typeof x === "string" ? x : x && x.text; })
      .filter(function (t) { return typeof t === "string" && t.trim(); })
      .map(function (t) { return t.trim(); });
  }

  function load(src, force) {
    var cached = force ? null : readCache(src);
    if (cached) return Promise.resolve(cached);
    return fetch(src, { credentials: "omit" })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (data) {
        var items = normalize(data);
        if (items.length) writeCache(src, items);
        return items.length ? items : readCache(src) || [];
      })
      .catch(function () { return readCache(src) || []; });
  }

  function render(host, items) {
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    if (!items.length) {
      root.innerHTML = "";
      host.style.display = "none";
      return;
    }
    host.style.display = "";

    var separator = host.getAttribute("data-separator") || "   \u2022   ";
    var speed = parseFloat(host.getAttribute("data-speed")) || 60;
    var text = items.join(separator) + separator;

    root.innerHTML =
      "<style>" + STYLE + "</style>" +
      '<div class="bar" role="marquee" aria-live="off">' +
      '<div class="track"><span class="item"></span><span class="item" aria-hidden="true"></span></div>' +
      "</div>";

    // textContent (never innerHTML) so item text can't inject markup.
    var spans = root.querySelectorAll(".item");
    spans[0].textContent = text;
    spans[1].textContent = text;
    host.setAttribute("aria-label", items.join(". "));

    // Two identical copies scroll by half the track width, so the loop is
    // seamless; duration follows the text length for a constant speed.
    requestAnimationFrame(function () {
      var width = spans[0].getBoundingClientRect().width;
      if (width > 0) root.querySelector(".track").style.animationDuration = width / speed + "s";
    });
  }

  function mount(host) {
    if (host.__tickerMounted) return;
    host.__tickerMounted = true;
    var src = host.getAttribute("data-src") || DEFAULT_SRC;
    var refresh = function (force) {
      load(src, force).then(function (items) { render(host, items); });
    };
    refresh(false);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && !readCache(src)) refresh(true);
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-ticker]"), mount);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // For pages that add the element later (e.g. single-page apps).
  window.Ticker = { mount: mount, init: init };
})();
