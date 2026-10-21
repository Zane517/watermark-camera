/* App 相机页 UI 绑定（依赖 appcam.js 的 window.CAM 与 watermark.js 的 lastLayout 命中数据） */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var C = window.CAM;
  var state = C.state, persist = C.persist;

  function bindText(id, key, manualTime) {
    $(id).addEventListener("input", function () {
      state[key] = this.value;
      if (manualTime) state.manualTime = true;
      persist();
    });
  }
  bindText("fTime", "time", true); bindText("fLat", "lat"); bindText("fLng", "lng");
  bindText("fAddr", "addr"); bindText("fId", "person"); bindText("fMemo", "memo");
  bindText("fArc", "arcText");

  $("nowBtn").addEventListener("click", function () {
    state.manualTime = false; persist(); C.fillForm(); C.toast("已恢复自动时间");
  });
  $("geoBtn").addEventListener("click", C.locate);

  function bindSeg(sel, attr, key) {
    var all = document.querySelectorAll(sel);
    Array.prototype.forEach.call(all, function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(all, function (x) { x.classList.remove("on"); });
        b.classList.add("on"); state[key] = b.getAttribute(attr); persist();
      });
      if (b.getAttribute(attr) === state[key]) {
        Array.prototype.forEach.call(all, function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      }
    });
  }
  bindSeg("#styleSeg button", "data-s", "style");
  bindSeg("#aspectSeg button", "data-a", "aspect");

  function bindSwitch(id, key) {
    var el = $(id);
    el.addEventListener("click", function () {
      el.classList.toggle("on"); state[key] = el.classList.contains("on"); persist();
    });
    el.classList.toggle("on", !!state[key]);
  }
  bindSwitch("swCenter", "center"); bindSwitch("swGeo", "geo"); bindSwitch("swArc", "arc");

  /* 点水印哪行就编辑哪行：命中 lastLayout 包围盒 → 打开面板并聚焦对应字段 */
  function lineTarget(text) {
    if (text.indexOf("经度") === 0) return "fLng";
    if (text.indexOf("纬度") === 0) return "fLat";
    if (text.indexOf("地址") === 0) return "fAddr";
    if (text.indexOf("时间") === 0) return "fTime";
    if (text.indexOf("拍摄人") === 0) return "fId";
    if (text.indexOf("备注") === 0) return "fMemo";
    return "";
  }
  function flash(el) {
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("hl");
    setTimeout(function () { el.classList.remove("hl"); }, 1600);
  }
  function focusField(id) {
    C.openSheet();
    var el = $(id);
    flash(el);
    if (el && el.focus) el.focus();
  }
  var overlayEl = $("overlay");
  $("viewBox").addEventListener("click", function (e) {
    var lay = (window.WM && WM.watermark) ? WM.watermark.lastLayout : null;
    if (lay && overlayEl && overlayEl.width) {
      var r = overlayEl.getBoundingClientRect();
      if (r.width > 0) {
        var x = (e.clientX - r.left) * (overlayEl.width / r.width);
        var y = (e.clientY - r.top) * (overlayEl.height / r.height);
        for (var i = 0; i < lay.lines.length; i++) {
          var b = lay.lines[i];
          if (x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y && y <= b.y + b.h) {
            var id = lineTarget(b.text);
            if (id) { focusField(id); return; }
            break; // 坐标系等固定行：仍开面板但不聚焦
          }
        }
        var c = lay.center;
        if (c && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
          C.openSheet();
          flash($("swCenter"));
          return;
        }
      }
    }
    C.openSheet();
  });
  $("scrim").addEventListener("click", C.closeSheet);
  $("closeSheet").addEventListener("click", C.closeSheet);

  $("shutter").addEventListener("click", C.shoot);
  $("importBtn").addEventListener("click", function () { $("fileInput").click(); });
  $("fileInput").addEventListener("change", function () {
    var f = this.files && this.files[0];
    this.value = "";
    if (f) C.loadFile(f);
  });
  var facing = "environment";
  $("flipBtn").addEventListener("click", function () {
    facing = (facing === "environment") ? "user" : "environment";
    C.facingSet(facing); C.startCam();
  });
})();
