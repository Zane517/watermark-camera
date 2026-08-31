// 通用工具：DOM 查询、时间格式化、混合文字绘制
"use strict";
window.WM = window.WM || {};
(function (WM) {
  function $(id) { return document.getElementById(id); }

  // 时间格式化
  function p(n) { return String(n).padStart(2, "0"); }
  function fmtDate(ms) { var d = new Date(ms); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function fmtTime(ms) { var d = new Date(ms); return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
  function fmtDateTime(ms) { return fmtDate(ms) + " " + fmtTime(ms); }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  // 字体：中文黑体系，数字/字母无衬线，同一行内按字符类型自动切换
  var HAN_FONT = '"Microsoft YaHei","PingFang SC","SimHei",sans-serif';
  var NUM_FONT = '"Roboto","Segoe UI","Arial",sans-serif';

  function isNumChar(c) { return /[0-9A-Za-z.%\-\+\s]/.test(c); }

  // 连续同类字符合并为一段绘制，减少 font 切换
  function drawMixedText(ctx, text, x, y, hanFont, numFont) {
    var i = 0;
    while (i < text.length) {
      var isNum = isNumChar(text[i]);
      var j = i;
      while (j < text.length && isNumChar(text[j]) === isNum) j++;
      var chunk = text.slice(i, j);
      ctx.font = isNum ? numFont : hanFont;
      ctx.fillText(chunk, x, y);
      x += ctx.measureText(chunk).width;
      i = j;
    }
  }

  // 测量混合文本宽度（hanFont/numFont 需已带字号）
  function measureMixedWith(ctx, text, hanFont, numFont) {
    var w = 0, i = 0;
    while (i < text.length) {
      var isNum = isNumChar(text[i]);
      var j = i;
      while (j < text.length && isNumChar(text[j]) === isNum) j++;
      ctx.font = isNum ? numFont : hanFont;
      w += ctx.measureText(text.slice(i, j)).width;
      i = j;
    }
    return w;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  WM.utils = {
    $: $, p: p, fmtDate: fmtDate, fmtTime: fmtTime, fmtDateTime: fmtDateTime,
    debounce: debounce,
    HAN_FONT: HAN_FONT, NUM_FONT: NUM_FONT,
    isNumChar: isNumChar,
    drawMixedText: drawMixedText,
    measureMixedWith: measureMixedWith,
    roundRect: roundRect
  };
})(window.WM);
