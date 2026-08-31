// 水印绘制，只拿 state 和 canvas，不碰界面元素
// state 字段：style, showCenter, showArc, showTime, showLng, showAddr, bg, x, y, crs,
//            time, lat, lng, addr, who, memo, arcText, scale
"use strict";
window.WM = window.WM || {};
(function (WM) {
  var U = WM.utils;

  function buildLines(st) {
    var lines = [];
    var t = st.time || U.fmtDateTime(Date.now());
    if (st.showLng) lines.push("经度：" + (st.lng || "--"));
    if (st.showLng) lines.push("纬度：" + (st.lat || "--"));
    lines.push("坐标系：" + (st.crs || "WGS84坐标系"));
    if (st.showAddr) lines.push("地址：" + (st.addr || "--"));
    if (st.showTime) lines.push("时间：" + t);
    if (st.who) lines.push("拍摄人：" + st.who);
    if (st.memo) lines.push("备注：" + st.memo);
    return lines;
  }

  // 文字沿弧线排，每个字顺弧度转一点角度，字号和位置按图大小自动定，竖图长图都不出边
  function drawArcAuto(ctx, text, imgW, imgH, color, alpha) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var chars = text.split("");
    var diag = Math.sqrt(imgW * imgW + imgH * imgH);
    var fs = Math.max(14, Math.round(diag * 0.016));

    function measureAll(size) {
      return chars.reduce(function (a, c) {
        ctx.font = "700 " + size + "px " + (U.isNumChar(c) ? U.NUM_FONT : U.HAN_FONT);
        return a + ctx.measureText(c).width;
      }, 0);
    }
    var totalW = measureAll(fs);
    while (totalW > imgW * 0.55 && fs > 6) { fs = Math.round(fs * 0.85); totalW = measureAll(fs); }

    var arcLen = totalW * 1.06;                       // 字距略拉开
    var h = Math.min(arcLen * 0.75, imgH * 0.14);     // 弧的高度上限，竖图时别顶到顶
    var radius = (arcLen * arcLen) / (8 * h) + h / 2;
    var halfAng = arcLen / (2 * radius);
    var halfW = Math.sin(halfAng) * radius;

    var padX = Math.max(8, fs * 0.95);
    var padY = Math.max(8, fs * 0.8);
    var cx = imgW - halfW - fs - padX;
    var cy = imgH - padY;

    var widths = chars.map(function (c) {
      ctx.font = "700 " + fs + "px " + (U.isNumChar(c) ? U.NUM_FONT : U.HAN_FONT);
      return ctx.measureText(c).width;
    });

    var cur = 0;
    for (var i = 0; i < chars.length; i++) {
      var center = cur + widths[i] / 2;
      var frac = center / totalW;
      var ang = -halfAng + frac * 2 * halfAng;
      var x = cx + Math.sin(ang) * radius;
      var y = cy - radius * (Math.cos(ang) - Math.cos(halfAng));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.font = "700 " + fs + "px " + (U.isNumChar(chars[i]) ? U.NUM_FONT : U.HAN_FONT);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      cur += widths[i];
    }
    ctx.restore();
  }

  // 经典风格：左下信息 + 中间「现场拍照」+ 右下弧形文字
  function renderClassic(ctx, st, W, H) {
    var lines = buildLines(st);
    var scale = st.scale;

    if (lines.length) {
      var diag = Math.sqrt(W * W + H * H);
      var fs = Math.max(8, Math.round(diag * scale / 100 * 0.8));
      var pad = Math.round(fs * 0.5);
      var lineH = Math.round(fs * 1.32);
      var hanFont = fs + "px " + U.HAN_FONT;
      var numFont = fs + "px " + U.NUM_FONT;
      var maxW = Math.max.apply(null, lines.map(function (l) {
        return U.measureMixedWith(ctx, l, hanFont, numFont);
      }));
      var blockW = Math.min(W * 0.92, maxW + pad * 2);
      var blockH = lines.length * lineH + pad * 1.6;
      // 超宽图信息块可能比画面还高，缩字号直到装得下
      var guard = 0;
      while (blockH > H * 0.92 && fs > 6 && guard++ < 40) {
        fs = Math.max(6, Math.round(fs * 0.9));
        pad = Math.round(fs * 0.5);
        lineH = Math.round(fs * 1.32);
        hanFont = fs + "px " + U.HAN_FONT;
        numFont = fs + "px " + U.NUM_FONT;
        maxW = Math.max.apply(null, lines.map(function (l) {
          return U.measureMixedWith(ctx, l, hanFont, numFont);
        }));
        blockW = Math.min(W * 0.92, maxW + pad * 2);
        blockH = lines.length * lineH + pad * 1.6;
      }
      var bx = Math.max(4, Math.min(W - blockW - 4, 4));
      var by = Math.max(4, Math.min(H - blockH - 4, H - blockH - 4));
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      lines.forEach(function (ln, i) {
        U.drawMixedText(ctx, ln, bx + pad, by + pad + fs / 2 + i * lineH, hanFont, numFont);
      });
    }

    if (st.showCenter) {
      var cFont = Math.round(Math.hypot(W, H) * 0.03);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, cFont * 0.035);
      ctx.strokeStyle = "rgba(210,210,210,0.30)";
      ctx.font = "900 " + cFont + "px " + U.HAN_FONT;
      ctx.strokeText("现场拍照", W / 2, H / 2);
      ctx.fillStyle = "rgba(50,50,55,0.25)";
      ctx.fillText("现场拍照", W / 2, H / 2);
      ctx.restore();
    }

    if (st.showArc) {
      var text = (st.arcText || "").trim() || "今日水印相机";
      drawArcAuto(ctx, text, W, H, "rgb(225,225,225)", 0.69);
    }
  }

  // 简洁/角落：一个信息块，位置由 st.x / st.y 决定
  function renderSimple(ctx, st, W, H) {
    var lines = buildLines(st);
    if (!lines.length) return;
    var fs = Math.max(8, Math.round(W * st.scale / 100));
    var pad = Math.round(fs * 0.45);
    var hanFont = fs + "px " + U.HAN_FONT;
    var numFont = fs + "px " + U.NUM_FONT;
    var lineH = Math.round(fs * 1.55);
    var maxW = Math.max.apply(null, lines.map(function (l) {
      return U.measureMixedWith(ctx, l, hanFont, numFont);
    }));
    var blockW = Math.min(W * 0.96, maxW + pad * 2);
    var blockH = lines.length * lineH + pad * 1.4;
    var guard = 0;
    while ((blockH > H * 0.92 || blockW > W * 0.96) && fs > 6 && guard++ < 40) {
      fs = Math.max(6, Math.round(fs * 0.9));
      pad = Math.round(fs * 0.45);
      lineH = Math.round(fs * 1.55);
      hanFont = fs + "px " + U.HAN_FONT;
      numFont = fs + "px " + U.NUM_FONT;
      maxW = Math.max.apply(null, lines.map(function (l) {
        return U.measureMixedWith(ctx, l, hanFont, numFont);
      }));
      blockW = Math.min(W * 0.96, maxW + pad * 2);
      blockH = lines.length * lineH + pad * 1.4;
    }
    var bx = Math.max(10, Math.min(W - blockW - 10, st.x * W));
    // 角落风格固定在左下，简洁风格按比例放
    var by = st.style === "corner"
      ? Math.max(10, H - blockH - 10)
      : Math.max(10, Math.min(H - blockH - 10, st.y * H));
    if (st.bg) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      U.roundRect(ctx, bx, by, blockW, blockH, Math.round(fs * 0.3));
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach(function (ln, i) {
      U.drawMixedText(ctx, ln, bx + pad, by + pad + fs / 2 + i * lineH, hanFont, numFont);
    });
  }

  // 画到指定 canvas 上：先画底图，再叠水印
  function renderTo(cv, src, st) {
    var W = src.naturalWidth || src.width;
    var H = src.naturalHeight || src.height;
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0, W, H);
    if (st.style === "classic") renderClassic(ctx, st, W, H);
    else renderSimple(ctx, st, W, H);
    return cv;
  }

  WM.watermark = {
    buildLines: buildLines,
    drawArcAuto: drawArcAuto,
    renderTo: renderTo
  };
})(window.WM);
