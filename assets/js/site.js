window.PARAMETER_CONFIG={"newsletterEndpoint":"","newsletterMethod":"POST","newsletterEmailField":"email","mailchimpAction":"https://github.us20.list-manage.com/subscribe/post?u=b59498ef7b47fcea455658305&id=0c73678b2b"};
/* To enable subscriptions: paste your Mailchimp embedded-form action URL into "mailchimpAction", e.g. "https://YOURDOMAIN.usXX.list-manage.com/subscribe/post?u=XXXX&id=YYYY" */
/* The Parameter: progressive enhancement only. Pages are fully readable without this file. */
(function () {
  "use strict";

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("site-menu");
  if (toggle && menu) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      menu.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Newsletter forms ---------- */
  var config = window.PARAMETER_CONFIG || {};
  if (config.mailchimpAction || config.newsletterEndpoint) {
    var demoNotice = document.getElementById("newsletter-demo-notice");
    if (demoNotice) demoNotice.hidden = true;
  }
  var forms = document.querySelectorAll("form[data-newsletter]");
  Array.prototype.forEach.call(forms, function (form) {
    var input = form.querySelector('input[type="email"]');
    var error = form.querySelector(".field-error");
    var status = form.querySelector(".form-status");
    var button = form.querySelector('button[type="submit"]');

    function showError(msg) {
      input.setAttribute("aria-invalid", "true");
      error.textContent = msg;
      error.hidden = false;
      status.textContent = "";
      status.removeAttribute("data-state");
      input.focus();
    }
    function clearError() {
      input.removeAttribute("aria-invalid");
      error.textContent = "";
      error.hidden = true;
    }
    function setStatus(state, msg) {
      status.setAttribute("data-state", state);
      status.textContent = msg;
    }

    input.addEventListener("input", function () { if (!error.hidden) clearError(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearError();
      var value = input.value.trim();
      if (!value) { showError("Enter your email address."); return; }
      if (!input.checkValidity()) { showError("Enter a valid email address, for example name@example.com."); return; }

      if (config.mailchimpAction) {
        button.disabled = true;
        setStatus("info", "Sending your request…");
        var cbName = "mcCallback" + Date.now();
        var scriptEl = document.createElement("script");
        var done = false;
        function finish(state, msg) {
          if (done) return; done = true;
          setStatus(state, msg);
          button.disabled = false;
          try { delete window[cbName]; } catch (err) { window[cbName] = undefined; }
          if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        }
        window[cbName] = function (data) {
          if (data && data.result === "success") {
            finish("success", "Almost done. Check your inbox and open the confirmation email from us to complete your subscription.");
            form.reset();
          } else {
            var msg = (data && data.msg ? String(data.msg) : "").replace(/<[^>]*>/g, "").replace(/^\d+\s*-\s*/, "").trim();
            finish("error", msg || "The subscription could not be completed. Please try again.");
          }
        };
        scriptEl.onerror = function () { finish("error", "We could not reach the subscription service. Check your connection and try again."); };
        scriptEl.src = config.mailchimpAction.replace("/subscribe/post?", "/subscribe/post-json?") +
          "&EMAIL=" + encodeURIComponent(value) + "&c=" + cbName;
        document.body.appendChild(scriptEl);
        setTimeout(function () { finish("error", "The subscription service took too long to respond. Please try again."); }, 15000);
        return;
      }

      if (!config.newsletterEndpoint) {
        setStatus("info", "Subscriptions are not set up on this demonstration site yet, so nothing was sent and you are not subscribed.");
        return;
      }

      button.disabled = true;
      setStatus("info", "Sending your request…");
      var body = new FormData();
      body.append(config.newsletterEmailField || "email", value);
      fetch(config.newsletterEndpoint, { method: config.newsletterMethod || "POST", body: body, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (res.ok) {
            setStatus("success", "The subscription service accepted your request. If it sends a confirmation email, you must open it to complete signup.");
            form.reset();
          } else {
            setStatus("error", "The subscription service did not accept the request (status " + res.status + "). Please try again later.");
          }
        })
        .catch(function () {
          setStatus("error", "We could not reach the subscription service. Check your connection and try again.");
        })
        .then(function () { button.disabled = false; });
    });
  });

  /* ---------- Search ---------- */
  var results = document.getElementById("search-results");
  if (results) {
    var form = document.getElementById("search-page-form");
    var qInput = document.getElementById("search-page-q");
    var section = document.getElementById("search-section");
    var statusEl = document.getElementById("search-status");
    var fallback = document.getElementById("search-fallback");
    var index = null;

    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
    };
    var tokens = function (q) { return q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); };

    var score = function (a, toks) {
      var total = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], hit = false;
        if (a.headline.toLowerCase().indexOf(t) > -1) { total += 5; hit = true; }
        if (a.tags.join(" ").toLowerCase().indexOf(t) > -1) { total += 3; hit = true; }
        if ((a.category + " " + a.sectionName).toLowerCase().indexOf(t) > -1) { total += 2; hit = true; }
        if (a.summary.toLowerCase().indexOf(t) > -1) { total += 1; hit = true; }
        if (a.authorName.toLowerCase().indexOf(t) > -1) { total += 1; hit = true; }
        if (!hit) return 0; // every term must match somewhere
      }
      return total;
    };

    var render = function () {
      var q = qInput.value.trim();
      var sec = section.value;
      var toks = tokens(q);
      var list = index.filter(function (a) { return !sec || a.section === sec; });
      var hits;
      if (toks.length) {
        hits = list.map(function (a) { return { a: a, s: score(a, toks) }; })
          .filter(function (x) { return x.s > 0; })
          .sort(function (x, y) { return y.s - x.s || (x.a.published < y.a.published ? 1 : -1); })
          .map(function (x) { return x.a; });
      } else {
        hits = list;
      }
      results.innerHTML = hits.map(function (a) {
        return '<li><article class="compact compact--thumb">' +
          '<div class="thumb"><img src="' + esc(a.thumb) + '" alt="" width="400" height="225" loading="lazy"></div>' +
          '<p class="category">' + esc(a.category) + '</p>' +
          '<h3 class="compact__title"><a class="title-link stretched" href="' + esc(a.url) + '">' + esc(a.headline) + '</a></h3>' +
          '<p class="meta"><time datetime="' + esc(a.published) + '">' + esc(a.publishedLabel) + '</time><span>' + a.readingMinutes + ' min read</span></p>' +
          '</article></li>';
      }).join("");
      var label = toks.length ? (hits.length + (hits.length === 1 ? " article matches " : " articles match ") + "“" + q + "”") : ("Showing all " + hits.length + " articles");
      if (sec) label += " in " + section.options[section.selectedIndex].text;
      statusEl.textContent = label + (hits.length === 0 ? ". Try fewer words, or browse the sections from the navigation." : ".");
      if (fallback) fallback.hidden = true;
    };

    var load = function () {
      return fetch("/assets/search-index.json").then(function (r) {
        if (!r.ok) throw new Error("index");
        return r.json();
      });
    };

    var params = new URLSearchParams(window.location.search);
    qInput.value = params.get("q") || "";
    if (params.get("section")) section.value = params.get("section");

    load().then(function (data) {
      index = data;
      render();
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var url = new URL(window.location.href);
        url.searchParams.set("q", qInput.value.trim());
        if (section.value) url.searchParams.set("section", section.value); else url.searchParams.delete("section");
        window.history.replaceState(null, "", url);
        render();
      });
      section.addEventListener("change", function () { render(); });
    }).catch(function () {
      statusEl.textContent = "Search could not load. You can browse all articles below.";
    });
  }
})();
