// 全局配置
// 高德 Key 不写在本文件里。运行时由页面「配置定位 Key」按钮写入浏览器 localStorage，
// 只保存在本机，不会上传，也不会写回源码。
"use strict";
window.WM = window.WM || {};
(function (WM) {
  var STORE_KEY = "wm.amap.key";

  var config = {
    // 高德 Web 服务 Key，可留空。留空时只能取经纬度，不能反查地址或地址转经纬度
    AMAP_KEY: "",

    // 导出图片质量
    EXPORT_QUALITY: 0.95,
    PREVIEW_QUALITY: 0.92,

    // 默认水印选项
    defaults: {
      style: "classic",
      showCenter: true,
      showArc: true,
      showTime: true,
      showLng: true,
      showAddr: true,
      bg: true,      // 简洁/角落风格的文字底衬
      x: 0.03,       // 角落风格水平位置比例
      y: 0.03,       // 角落风格垂直位置比例
      crs: "WGS84坐标系"
    }
  };

  function safeStore() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  config.getAmapKey = function () {
    var s = safeStore();
    var k = s ? (s.getItem(STORE_KEY) || "") : "";
    k = (k || "").trim();
    return k || config.AMAP_KEY;
  };

  config.setAmapKey = function (k) {
    var s = safeStore();
    if (!s) return false;
    s.setItem(STORE_KEY, (k || "").trim());
    return true;
  };

  WM.config = config;
})(window.WM);
