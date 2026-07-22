/* =========================================================================
   Site chrome: scroll-reveal animations + floating side-nav active tracking.
   Zero dependencies. Respects prefers-reduced-motion (reveals just show).
   ========================================================================= */
(function () {
  "use strict";
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // pause the ambient aurora animation while the tab is backgrounded (free; browsers
  // throttle anyway, but this stops GPU compositing work entirely when unseen).
  document.addEventListener("visibilitychange", function () {
    document.documentElement.classList.toggle("fx-paused", document.hidden);
  });

  ready(function () {
    var hasIO = "IntersectionObserver" in window;

    // ---- reveal-on-scroll -------------------------------------------------
    var reveals = document.querySelectorAll(".reveal");
    if (hasIO) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (el) { ro.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("in"); });
    }

    // ---- side-nav active-section tracking --------------------------------
    var links = Array.prototype.slice.call(document.querySelectorAll(".sidenav a"));
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var s = document.getElementById(id);
      if (s) map[id] = a;
    });
    var ids = Object.keys(map);
    if (hasIO && ids.length) {
      var so = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) { a.classList.remove("active"); });
            if (map[e.target.id]) map[e.target.id].classList.add("active");
          }
        });
      }, { threshold: 0, rootMargin: "-45% 0px -50% 0px" });
      ids.forEach(function (id) { so.observe(document.getElementById(id)); });
    }
  });
})();
