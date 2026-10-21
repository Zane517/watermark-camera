/* App 相机页核心：取景、逐帧调用网页版 watermark.js 渲染水印、定位、拍照保存（UI 绑定见 appedit.js） */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var video = $("video"), overlay = $("overlay"), viewBox = $("viewBox"),
      toastEl = $("toast"), locChip = $("locChip");
  var buf = document.createElement("canvas"); // 底图缓冲：先 cover 裁切，再交给网页版引擎叠水印
  var stream = null, facing = "environment", mode = "camera", img = null;

  var state = { time:"", lat:"", lng:"", addr:"", person:"", memo:"",
                style:"classic", center:true, geo:true, manualTime:false };
  try { var sv = JSON.parse(localStorage.getItem("wm.app.state") || "{}");
        for (var key in sv) state[key] = sv[key]; } catch (e) {}
  function persist() { try { localStorage.setItem("wm.app.state", JSON.stringify(state)); } catch (e) {} }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1900);
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStr() {
    var d = new Date();
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+
           pad(d.getHours())+":"+pad(d.getMinutes())+":"+pad(d.getSeconds());
  }
  function timeStr() { return state.manualTime ? state.time : nowStr(); }

  /* WGS84 → GCJ-02：仅用于高德反查入参，存储与展示始终 WGS84 */
  function wgs2gcj(lng, lat) {
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat];
    var PI = 3.14159265358979324, A = 6378245, EE = 0.00669342162296594323;
    function tL(x, y) {
      var r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*PI) + 20*Math.sin(2*x*PI))*2/3
         + (20*Math.sin(y*PI) + 40*Math.sin(y/3*PI))*2/3
         + (160*Math.sin(y/12*PI) + 320*Math.sin(y*PI/30))*2/3;
      return r;
    }
    function tG(x, y) {
      var r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*PI) + 20*Math.sin(2*x*PI))*2/3
         + (20*Math.sin(x*PI) + 40*Math.sin(x/3*PI))*2/3
         + (150*Math.sin(x/12*PI) + 300*Math.sin(x/30*PI))*2/3;
      return r;
    }
    var dLa = tL(lng - 105, lat - 35), dLo = tG(lng - 105, lat - 35);
    var rl = lat / 180 * PI, m = Math.sin(rl);
    m = 1 - EE * m * m;
    var sm = Math.sqrt(m);
    return [lng + dLo * 180 / (A / sm * Math.cos(rl) * PI),
            lat + dLa * 180 / ((A * (1 - EE)) / (m * sm) * PI)];
  }

  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function startCam() {
    stopCam();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("当前环境不支持摄像头"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then(function (s) { stream = s; video.srcObject = s; mode = "camera"; video.play(); })
      .catch(function (e) { toast("摄像头不可用" + (e && e.name ? "：" + e.name : "")); });
  }
  function locate() {
    if (!navigator.geolocation) { locChip.textContent = "不支持定位"; return; }
    locChip.textContent = "定位中…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.lat = pos.coords.latitude.toFixed(6);
      state.lng = pos.coords.longitude.toFixed(6);
      locChip.textContent = "已定位"; fillForm(); persist(); reverseAddr();
    }, function () { locChip.textContent = "定位失败，点此重试"; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  function reverseAddr() {
    var key = localStorage.getItem("wm.amap.key");
    if (!key || !state.lng || !state.lat) return;
    var g = wgs2gcj(+state.lng, +state.lat);
    fetch("https://restapi.amap.com/v3/geocode/regeo?key=" + encodeURIComponent(key) +
          "&location=" + g[0] + "," + g[1])
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.regeocode) return;
        var a = j.regeocode.addressComponent || {};
        var s = (a.province||"")+(a.city||"")+(a.district||"")+(a.street||"")+
                ((a.streetNumber && a.streetNumber.number) || "");
        if (s) { state.addr = s; fillForm(); persist(); locChip.textContent = "已反查地址"; }
      }).catch(function () {});
  }

  /* 与网页版同源：映射到 watermark.js 的 state 字段，默认值取 WM.config.defaults */
  function webState() {
    var d = WM.config.defaults;
    return {
      style: state.style,
      showCenter: state.center,
      showArc: d.showArc,
      showTime: d.showTime,
      showLng: state.geo,
      showAddr: state.geo,
      bg: d.bg, x: d.x, y: d.y, crs: d.crs,
      time: timeStr(),
      lat: state.lat, lng: state.lng, addr: state.addr,
      who: state.person, memo: state.memo,
      scale: 2.4
    };
  }
  function coverTo(ctx, src, sw, sh, W, H) {
    var s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function drawFrame() {
    var dpr = window.devicePixelRatio || 1;
    var W = Math.max(1, Math.round(viewBox.clientWidth * dpr));
    var H = Math.max(1, Math.round(viewBox.clientHeight * dpr));
    buf.width = W; buf.height = H;
    var bc = buf.getContext("2d");
    bc.fillStyle = "#000";
    bc.fillRect(0, 0, W, H);
    if (mode === "image" && img && img.naturalWidth) coverTo(bc, img, img.naturalWidth, img.naturalHeight, W, H);
    else if (video.videoWidth) coverTo(bc, video, video.videoWidth, video.videoHeight, W, H);
    WM.watermark.renderTo(overlay, buf, webState());
    requestAnimationFrame(drawFrame);
  }

  function shoot() {
    if (!overlay.width) return;
    var flash = $("flash");
    flash.classList.add("go");
    setTimeout(function () { flash.classList.remove("go"); }, 120);
    var url = overlay.toDataURL("image/jpeg", 0.95);
    var name = "WM_" + Date.now() + ".jpg";
    if (window.AppNative) {
      var r = AppNative.saveImage(url.substring(url.indexOf(",") + 1), name);
      if (r === "ok") toast("已保存到相册（Pictures/AI）");
      else if (r === "err:permission") { AppNative.requestStorage(); toast("请允许存储权限后重新拍摄"); }
      else toast("保存失败：" + r);
    } else {
      var a = document.createElement("a"); a.href = url; a.download = name; a.click();
      toast("已下载");
    }
  }
  function loadFile(f) {
    stopCam();
    img = new Image();
    img.onload = function () { mode = "image"; toast("已导入 · 点击画面编辑水印"); locate(); };
    img.src = URL.createObjectURL(f);
  }
  function openSheet() { $("sheet").classList.add("open"); $("scrim").classList.add("open"); }
  function closeSheet() { $("sheet").classList.remove("open"); $("scrim").classList.remove("open"); }
  function fillForm() {
    $("fTime").value = timeStr(); $("fLat").value = state.lat; $("fLng").value = state.lng;
    $("fAddr").value = state.addr; $("fId").value = state.person; $("fMemo").value = state.memo;
  }
  window.CAM = { state: state, persist: persist, toast: toast, locate: locate,
                 startCam: startCam, shoot: shoot, loadFile: loadFile,
                 fillForm: fillForm, openSheet: openSheet, closeSheet: closeSheet,
                 facingSet: function (f) { facing = f; } };
  setInterval(function () {
    if (!state.manualTime && document.activeElement !== $("fTime")) $("fTime").value = nowStr();
  }, 1000);
  fillForm();
  startCam(); locate();
  requestAnimationFrame(drawFrame);
})();
