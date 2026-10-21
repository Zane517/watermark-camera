/* App 相机页核心：取景、逐帧水印、定位、拍照保存，UI 绑定见 appedit.js */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var video = $("video"), overlay = $("overlay"), viewBox = $("viewBox"),
      toastEl = $("toast"), clock = $("clock"), locChip = $("locChip");
  var ctx = overlay.getContext("2d");
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
    fetch("https://restapi.amap.com/v3/geocode/regeo?key=" + encodeURIComponent(key) +
          "&location=" + state.lng + "," + state.lat)
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.regeocode) return;
        var a = j.regeocode.addressComponent || {};
        var s = (a.province||"")+(a.city||"")+(a.district||"")+(a.street||"")+
                ((a.streetNumber && a.streetNumber.number) || "");
        if (s) { state.addr = s; fillForm(); persist(); locChip.textContent = "已反查地址"; }
      }).catch(function () {});
  }

  function fit() {
    var dpr = window.devicePixelRatio || 1;
    var w = viewBox.clientWidth, h = viewBox.clientHeight;
    if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) {
      overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w: w, h: h };
  }
  function coverRect(sw, sh, W, H) {
    var s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    return { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawMark(W, H) {
    var k = Math.min(W, H), fs = Math.max(13, k * 0.028), pad = k * 0.05;
    var lines = [timeStr()];
    if (state.geo && (state.lat || state.lng))
      lines.push("纬度 " + (state.lat || "--") + "   经度 " + (state.lng || "--"));
    if (state.geo && state.addr) lines.push(state.addr);
    var extra = (state.person || "") + (state.memo ? ((state.person ? " · " : "") + state.memo) : "");
    if (extra) lines.push(extra);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    var maxw = 0, i, lh = fs * 1.4, blockH = lines.length * lh;
    for (i = 0; i < lines.length; i++) {
      ctx.font = (i === 0 ? "700 " : "400 ") + fs + "px MiSans, PingFang SC, sans-serif";
      maxw = Math.max(maxw, ctx.measureText(lines[i]).width);
    }
    var ty = (state.style === "clean") ? pad : (H - pad - blockH - fs * 0.3);
    var tx = pad, hasBg = state.style !== "classic";
    if (hasBg) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      roundRect(tx - fs*0.75, ty - fs*0.5, maxw + fs*1.5, blockH + fs*0.9, fs*0.6); ctx.fill();
    } else {
      ctx.fillStyle = "#3482ff";
      roundRect(tx - fs*0.55, ty - fs*0.1, fs*0.16, blockH + fs*0.2, fs*0.08); ctx.fill();
    }
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = fs * 0.3;
    ctx.fillStyle = "#ffffff";
    for (i = 0; i < lines.length; i++) {
      ctx.font = (i === 0 ? "700 " : "400 ") + fs + "px MiSans, PingFang SC, sans-serif";
      ctx.fillText(lines[i], tx, ty + i * lh + (hasBg ? fs * 0.2 : 0));
    }
    ctx.shadowBlur = 0;
    if (state.center) {
      var cfs = k * 0.17;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 " + cfs + "px MiSans, PingFang SC, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.17)";
      ctx.fillText("现场拍照", W / 2, H / 2);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
    }
  }
  function drawFrame() {
    var d = fit();
    ctx.clearRect(0, 0, d.w, d.h);
    if (mode === "image" && img && img.naturalWidth) {
      var r = coverRect(img.naturalWidth, img.naturalHeight, d.w, d.h);
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    } else if (video.videoWidth) {
      var r2 = coverRect(video.videoWidth, video.videoHeight, d.w, d.h);
      ctx.drawImage(video, r2.x, r2.y, r2.w, r2.h);
    }
    drawMark(d.w, d.h);
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
  function fillForm() {
    $("fTime").value = timeStr(); $("fLat").value = state.lat; $("fLng").value = state.lng;
    $("fAddr").value = state.addr; $("fId").value = state.person; $("fMemo").value = state.memo;
  }
  function openSheet() { $("sheet").classList.add("open"); $("scrim").classList.add("open"); }
  function closeSheet() { $("sheet").classList.remove("open"); $("scrim").classList.remove("open"); }

  window.CAM = { state: state, persist: persist, toast: toast, locate: locate,
                 startCam: startCam, shoot: shoot, loadFile: loadFile,
                 fillForm: fillForm, openSheet: openSheet, closeSheet: closeSheet,
                 facingSet: function (f) { facing = f; },
                 camMode: function () { return "camera"; } };

  setInterval(function () {
    clock.textContent = nowStr();
    if (!state.manualTime && document.activeElement !== $("fTime")) $("fTime").value = nowStr();
  }, 1000);
  fillForm(); clock.textContent = nowStr();
  startCam(); locate();
  requestAnimationFrame(drawFrame);
})();
