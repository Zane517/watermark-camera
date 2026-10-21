/* App 相机页 UI 绑定（依赖 appcam.js 暴露的 window.CAM） */
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

  $("nowBtn").addEventListener("click", function () {
    state.manualTime = false; persist(); C.fillForm(); C.toast("已恢复自动时间");
  });
  $("geoBtn").addEventListener("click", C.locate);
  $("locChip").addEventListener("click", C.locate);

  var segAll = document.querySelectorAll("#styleSeg button");
  Array.prototype.forEach.call(segAll, function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(segAll, function (x) { x.classList.remove("on"); });
      b.classList.add("on"); state.style = b.getAttribute("data-s"); persist();
    });
    if (b.getAttribute("data-s") === state.style) {
      Array.prototype.forEach.call(segAll, function (x) { x.classList.remove("on"); });
      b.classList.add("on");
    }
  });
  function bindSwitch(id, key) {
    var el = $(id);
    el.addEventListener("click", function () {
      el.classList.toggle("on"); state[key] = el.classList.contains("on"); persist();
    });
    el.classList.toggle("on", !!state[key]);
  }
  bindSwitch("swCenter", "center"); bindSwitch("swGeo", "geo");

  $("viewBox").addEventListener("click", function (e) {
    if (e.target === $("locChip") || e.target === $("editTop")) return;
    C.openSheet();
  });
  $("editTop").addEventListener("click", C.openSheet);
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
  $("toolBtn").addEventListener("click", function () { location.href = "index.html"; });
})();
