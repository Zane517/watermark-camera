// 摄像头拍摄（需 https 或 localhost）
"use strict";
window.WM = window.WM || {};
(function (WM) {
  var stream = null;

  function start(video) {
    return new Promise(function (resolve, reject) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error("浏览器不支持摄像头（需 https 或 localhost）"));
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function (s) { stream = s; video.srcObject = s; resolve(s); })
        .catch(function (e) { reject(new Error(e.message || "无法打开摄像头")); });
    });
  }

  function stop(video) {
    if (video && video.srcObject) video.srcObject.getTracks().forEach(function (t) { t.stop(); });
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    if (video) { video.srcObject = null; }
  }

  // 抓当前画面转成 dataURL
  function shoot(video) {
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(video, 0, 0);
    return cv.toDataURL("image/jpeg", 0.95);
  }

  WM.camera = { start: start, stop: stop, shoot: shoot };
})(window.WM);
