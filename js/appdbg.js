/* appdbg.js v14 crash guard + camera watchdog (runs BEFORE appcam.js) */
(function () {
  var KEY = "wm.dbg";
  var ring = [];
  var chip = null;
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function now() { var d = new Date(); return p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ring.slice(-40))); } catch (e) {}
    try { console.log("[wm]", ring[ring.length - 1]); } catch (e) {}
  }
  function log(s) { ring.push(now() + " " + s); save(); }
  function show(msg) {
    log("ERR " + msg);
    try {
      if (!chip) {
        chip = document.createElement("div");
        chip.style.cssText = "position:fixed;left:6px;bottom:78px;max-width:78vw;z-index:99999;background:#b00020;color:#fff;font:11px/1.35 monospace;padding:4px 6px;border-radius:4px;word-break:break-all;";
        chip.onclick = function () { chip.style.display = "none"; };
        document.body.appendChild(chip);
      }
      chip.textContent = "ERR " + msg;
      chip.style.display = "block";
    } catch (e) {}
  }
  window.onerror = function (m, u, l, c) {
    show(String(m) + " @" + String(u).replace(/^.*\//, "") + ":" + l + ":" + c);
    return false;
  };
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    show("promise:" + ((r && (r.name + " " + r.message)) || String(r)));
  });
  function vid() { return document.getElementById("video"); }
  function camVisible() {
    var cw = document.getElementById("camwrap");
    return !!(cw && getComputedStyle(cw).display !== "none");
  }
  /* silent updater reload while camera active = race black screen: swallow it (files stay, applies next launch) */
  try {
    if (window.web && typeof web.reload === "function") {
      var orig = web.reload;
      Object.defineProperty(web, "reload", {
        value: function () {
          if (camVisible()) { log("reload swallowed (camera page)"); return; }
          return orig();
        },
        configurable: true,
        writable: true
      });
      log("reload guard installed");
    }
  } catch (e) { log("reload guard fail:" + e.message); }
  function restart(reason) {
    log("restart: " + reason);
    try { if (window.CAM && CAM.stop) CAM.stop(); } catch (e) {}
    try {
      if (window.CAM && CAM.start) setTimeout(function () { CAM.start(); }, 250);
      else show("no CAM.start");
    } catch (e) { show("restart:" + e.message); }
  }
  var lastBad = 0;
  function armTrack() {
    var v = vid(); if (!v || !v.srcObject) return;
    var t; try { t = v.srcObject.getVideoTracks()[0]; } catch (e) { return; }
    if (t && !t.__armed) {
      t.__armed = 1;
      t.addEventListener("ended", function () {
        log("track ended");
        if (camVisible() && Date.now() - lastBad > 4000) { lastBad = Date.now(); restart("track ended"); }
      });
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    setTimeout(function () {
      if (!camVisible()) return;
      var v = vid();
      if (!v || !v.srcObject || v.videoWidth === 0) {
        if (Date.now() - lastBad > 4000) { lastBad = Date.now(); restart("resume dead"); }
      } else armTrack();
    }, 400);
  });
  setInterval(function () {
    try {
      if (!window.CAM || document.hidden || !camVisible()) return;
      var v = vid(); if (!v) return;
      armTrack();
      if (v.srcObject && v.videoWidth === 0 && Date.now() - lastBad > 6000) {
        lastBad = Date.now();
        restart("no frames");
      }
    } catch (e) { log("wd:" + e.message); }
  }, 2000);
  log("appdbg on");
})();
