/**
 * Consent-gated loader for third-party tracking (GDPR / TDDDG).
 *
 * Nothing in this file contacts a third party or stores anything on the
 * visitor's device by itself. Trackers are only loaded once CookieYes reports
 * that the visitor has accepted the matching category:
 *
 *   analytics     -> Google Analytics (gtag.js), Hotjar
 *   advertisement -> HubSpot tracking (marketing / CRM)
 *
 * CookieYes fires `cookieyes_banner_load` on every page load (with the stored
 * decision, if any) and `cookieyes_consent_update` whenever the visitor
 * changes their choice. `getCkyConsent()` is CookieYes's public API.
 */
(function (window, document) {
  "use strict";

  var GA_ID = "G-GMT0SXQMSW";
  var HOTJAR_ID = 3537491;
  var HUBSPOT_ID = "144867247";

  var loaded = {};

  function addScript(src, category, attrs) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    // Lets CookieYes's own blocker act as a second safety net.
    s.setAttribute("data-cookieyes", "cookieyes-" + category);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        s.setAttribute(k, attrs[k]);
      });
    }
    document.head.appendChild(s);
  }

  var services = {
    googleAnalytics: {
      category: "analytics",
      load: function () {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
        window.gtag("js", new Date());
        window.gtag("config", GA_ID);
        addScript(
          "https://www.googletagmanager.com/gtag/js?id=" + GA_ID,
          "analytics"
        );
      },
    },
    hotjar: {
      category: "analytics",
      load: function () {
        window.hj =
          window.hj ||
          function () {
            (window.hj.q = window.hj.q || []).push(arguments);
          };
        window._hjSettings = { hjid: HOTJAR_ID, hjsv: 6 };
        addScript(
          "https://static.hotjar.com/c/hotjar-" + HOTJAR_ID + ".js?sv=6",
          "analytics"
        );
      },
    },
    hubspot: {
      category: "advertisement",
      load: function () {
        addScript("https://js-eu1.hs-scripts.com/" + HUBSPOT_ID + ".js", "advertisement", {
          id: "hs-script-loader",
          defer: "",
        });
      },
    },
  };

  function acceptedCategories() {
    if (typeof window.getCkyConsent !== "function") return null;
    var consent = window.getCkyConsent();
    return consent && consent.categories ? consent.categories : null;
  }

  function applyConsent() {
    var categories = acceptedCategories();
    if (!categories) return;

    var withdrawn = false;
    Object.keys(services).forEach(function (name) {
      var service = services[name];
      var accepted = categories[service.category] === true;
      if (accepted && !loaded[name]) {
        loaded[name] = true;
        service.load();
      } else if (!accepted && loaded[name]) {
        withdrawn = true;
      }
    });

    // A tracker that is already running cannot be unloaded. Remove the
    // cookies it stored and reload so the withdrawal takes effect at once.
    if (withdrawn) {
      deleteTrackerCookies();
      window.location.reload();
    }
  }

  // First-party cookies stored by the gated services (see the privacy policy).
  var TRACKER_COOKIE_PREFIXES = [
    "_ga", // Google Analytics: _ga, _ga_<id>
    "_hj", // Hotjar: _hjSession_<id>, _hjSessionUser_<id>, ...
    "__hstc",
    "__hssc",
    "__hssrc",
    "hubspotutk",
  ];

  function deleteTrackerCookies() {
    var names = document.cookie.split(";").map(function (c) {
      return c.split("=")[0].trim();
    });
    var host = window.location.hostname;
    var parts = host.split(".");
    // Try every domain level the cookie may have been set on
    // (e.g. www.turn2x.com, .turn2x.com) and no domain at all.
    var domains = [""];
    for (var i = 0; i < parts.length - 1; i++) {
      domains.push("; domain=" + parts.slice(i).join("."));
      domains.push("; domain=." + parts.slice(i).join("."));
    }
    names.forEach(function (name) {
      var tracked = TRACKER_COOKIE_PREFIXES.some(function (prefix) {
        return name.indexOf(prefix) === 0;
      });
      if (!tracked) return;
      domains.forEach(function (domain) {
        document.cookie =
          name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + domain;
      });
    });
  }

  document.addEventListener("cookieyes_banner_load", applyConsent);
  document.addEventListener("cookieyes_consent_update", applyConsent);
  applyConsent();
})(window, document);
