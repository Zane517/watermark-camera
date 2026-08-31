// 界面绑定与主流程
"use strict";
(function () {
  var WM = window.WM;
  var U = WM.utils, $ = U.$;

  var fileInput = $("fileInput"), uploadBox = $("uploadBox"), display = $("display"), ph = $("placeholder");
  var timeText = $("timeText"), latV = $("latV"), lngV = $("lngV"), addrV = $("addrV");
  var idV = $("idV"), memoV = $("memoV"), addrQuery = $("addrQuery");
  var scaleSlider = $("scaleSlider"), exportBtn = $("exportBtn"), arcTextV = $("arcTextV");
  var cam = $("cam"), camBtn = $("camBtn"), camBtns = $("camBtns"), shootBtn = $("shootBtn"), stopCam = $("stopCam");
  var posStatus = $("posStatus");

  // 运行时状态
  var src = null, lastCanvas = null;
  var opt = Object.assign({}, WM.config.defaults);

  function collectState() {
    return {
      style: opt.style,
      showCenter: opt.showCenter,
      showArc: opt.showArc,
      showTime: opt.showTime,
      showLng: opt.showLng,
      showAddr: opt.showAddr,
      bg: opt.bg,
      x: opt.x,
      y: opt.y,
      crs: opt.crs,
      time: timeText.value || U.fmtDateTime(Date.now()),
      lat: latV.value.trim(),
      lng: lngV.value.trim(),
      addr: addrV.value.trim(),
      who: idV.value.trim(),
      memo: memoV.value.trim(),
      arcText: arcTextV.value,
      scale: parseFloat(scaleSlider.value) || 2.4
    };
  }

  function render() {
    if (!src) return;
    var cv = document.createElement("canvas");
    WM.watermark.renderTo(cv, src, collectState());
    lastCanvas = cv;
    display.src = cv.toDataURL("image/jpeg", WM.config.PREVIEW_QUALITY);
  }
  var rerender = U.debounce(render, 150);

  function setStatus(msg, cls) {
    posStatus.textContent = msg;
    posStatus.className = "st" + (cls ? " " + cls : "");
  }

  // 时间：默认取当前，可手动改
  timeText.value = U.fmtDateTime(Date.now());
  $("refreshTime").onclick = function () {
    timeText.value = U.fmtDateTime(Date.now());
    render();
  };

  // 自动定位：浏览器定位 + 反查地址
  $("autoPos").onclick = function () {
    setStatus("正在定位…", "");
    WM.geo.locate().then(function (c) {
      latV.value = c.lat.toFixed(6);
      lngV.value = c.lng.toFixed(6);
      setStatus("已定位：" + c.lat.toFixed(4) + ", " + c.lng.toFixed(4), "ok");
      setCrs("WGS84坐标系");
      render();
      if (!WM.config.getAmapKey()) {
        setStatus("已定位（未配置 Key，跳过地址反查）", "warn");
        return;
      }
      setStatus("已定位，正在反查地址…", "ok");
      return WM.geo.reverseGeocode(c.lat, c.lng).then(function (addr) {
        if (addr) { addrV.value = addr; render(); setStatus("已定位并回填地址", "ok"); }
      });
    }).catch(function (e) {
      setStatus("定位失败（" + e.message + "），请手动填写经纬度", "err");
    });
  };

  // 地址转经纬度
  $("geoBtn").onclick = function () {
    var addr = addrQuery.value.trim();
    if (!addr) { setStatus("请先输入要查询的地址", "err"); return; }
    if (!WM.config.getAmapKey()) { setStatus("未配置高德 Key，点右上角「配置定位 Key」填写", "err"); return; }
    setStatus("正在解析地址…", "");
    WM.geo.geocode(addr).then(function (r) {
      latV.value = r.lat.toFixed(6);
      lngV.value = r.lng.toFixed(6);
      if (!addrV.value) addrV.value = r.formatted;
      setCrs("GCJ02坐标系");
      setStatus("已解析：" + r.lat.toFixed(4) + ", " + r.lng.toFixed(4) + "（GCJ-02）", "ok");
      render();
    }).catch(function (e) {
      if (e && e.message === "NO_KEY") setStatus("未配置高德 Key，点右上角「配置定位 Key」填写", "err");
      else if (e && e.message === "NOT_FOUND") setStatus("未找到该地址对应的经纬度，请检查地址写法", "err");
      else setStatus("解析失败，请检查网络", "err");
    });
  };

  // 坐标系：WGS84 / GCJ-02 切换
  function setCrs(v) {
    opt.crs = v;
    Array.prototype.forEach.call($("crsSeg").children, function (b) {
      b.classList.toggle("on", b.dataset.crs === v);
    });
  }
  Array.prototype.forEach.call($("crsSeg").children, function (b) {
    b.onclick = function () { setCrs(b.dataset.crs); render(); };
  });

  // 摄像头：打开 / 拍摄 / 关闭
  camBtn.onclick = function () {
    WM.camera.start(cam).then(function () {
      cam.style.display = "block";
      camBtns.style.display = "flex";
    }).catch(function (e) { alert("无法打开摄像头：" + e.message); });
  };
  shootBtn.onclick = function () {
    var data = WM.camera.shoot(cam);
    if (data) loadSrc(data);
    else alert("还没有拿到画面，请稍等一下再拍");
  };
  stopCam.onclick = function () {
    WM.camera.stop(cam);
    cam.style.display = "none";
    camBtns.style.display = "none";
  };

  // 导入图片（点击 / 拖拽）
  uploadBox.onclick = function () { fileInput.click(); };
  uploadBox.ondragover = function (e) { e.preventDefault(); uploadBox.style.borderColor = "var(--acc)"; };
  uploadBox.ondragleave = function () { uploadBox.style.borderColor = "var(--line)"; };
  uploadBox.ondrop = function (e) {
    e.preventDefault();
    uploadBox.style.borderColor = "var(--line)";
    var f = e.dataTransfer.files[0];
    if (f && f.type.indexOf("image/") === 0) handleFile(f);
  };
  fileInput.onchange = function (e) { if (e.target.files[0]) handleFile(e.target.files[0]); };
  function handleFile(f) {
    var rd = new FileReader();
    rd.onload = function (ev) { loadSrc(ev.target.result); };
    rd.readAsDataURL(f);
  }

  function loadSrc(data) {
    var img = new Image();
    img.onload = function () {
      src = img;
      display.style.display = "block";
      ph.style.display = "none";
      timeText.value = U.fmtDateTime(Date.now());
      render();
    };
    img.src = data;
  }

  // 风格与开关控件
  Array.prototype.forEach.call($("styleSeg").children, function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call($("styleSeg").children, function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      opt.style = b.dataset.style;
      render();
    };
  });
  function bindSwitch(id, key) {
    var s = $(id);
    s.onclick = function () {
      s.classList.toggle("on");
      opt[key] = s.classList.contains("on");
      render();
    };
  }
  bindSwitch("swCenter", "showCenter");
  bindSwitch("swArc", "showArc");
  bindSwitch("swTime", "showTime");
  bindSwitch("swLng", "showLng");
  bindSwitch("swAddr", "showAddr");
  bindSwitch("swBg", "bg");

  scaleSlider.oninput = rerender;
  [timeText, latV, lngV, addrV, idV, memoV, arcTextV].forEach(function (el) {
    el.addEventListener("input", rerender);
  });

  // 配置高德 Key（存 localStorage，不写进源码）
  $("keyBtn").onclick = function () {
    var cur = WM.config.getAmapKey();
    var tip = "填写高德 Web 服务 Key（Web服务类型），只保存在本机浏览器，不会写进源码文件。\n留空可清除已保存的 Key。";
    var v = window.prompt(tip, cur);
    if (v === null) return;
    if (WM.config.setAmapKey(v)) {
      setStatus(v.trim() ? "Key 已保存到本机" : "已清除本机保存的 Key", v.trim() ? "ok" : "warn");
    } else {
      setStatus("当前环境不支持本地存储，无法保存 Key", "err");
    }
  };

  // 导出原图
  exportBtn.onclick = function () {
    if (!src) { alert("请先选择或拍摄一张照片"); return; }
    render();
    var a = document.createElement("a");
    a.href = lastCanvas.toDataURL("image/jpeg", WM.config.EXPORT_QUALITY);
    a.download = "今日水印_" + U.fmtDate(Date.now()).replace(/-/g, "") + ".jpg";
    a.click();
  };
})();
