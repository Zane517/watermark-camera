// 定位与高德地址解析：locate 定位、reverseGeocode 反查地址、geocode 地址转经纬度
// 坐标统一为 WGS84：geocode 的高德 GCJ-02 结果本地转换后再返回；reverseGeocode 入参先由 WGS84 转成 GCJ-02 以保证反查准确。
"use strict";
window.WM = window.WM || {};
(function (WM) {
 function key() { return WM.config.getAmapKey(); }

 /* —— GCJ-02 ⇄ WGS84 转换（国测局椭球参数，中国境外原样返回） —— */
 var PI = 3.14159265358979324;
 var A = 6378245.0;
 var EE = 0.00669342162296594323;
 function outOfChina(lng, lat) {
 return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
 }
 function transformLat(x, y) {
 var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
 r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
 r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
 r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
 return r;
 }
 function transformLng(x, y) {
 var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
 r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
 r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
 r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
 return r;
 }
 function wgs2gcj(lng, lat) {
 if (outOfChina(lng, lat)) return [lng, lat];
 var dLat = transformLat(lng - 105, lat - 35);
 var dLng = transformLng(lng - 105, lat - 35);
 var radLat = lat / 180 * PI;
 var magic = Math.sin(radLat);
 magic = 1 - EE * magic * magic;
 var sqrtMagic = Math.sqrt(magic);
 dLat = dLat * 180 / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
 dLng = dLng * 180 / (A / sqrtMagic * Math.cos(radLat) * PI);
 return [lng + dLng, lat + dLat];
 }
 function gcj2wgs(lng, lat) {
 if (outOfChina(lng, lat)) return [lng, lat];
 var wgs = [lng, lat];
 for (var i = 0; i < 3; i++) {
 var t = wgs2gcj(wgs[0], wgs[1]);
 wgs[0] += lng - t[0];
 wgs[1] += lat - t[1];
 }
 return wgs;
 }

 // 浏览器定位，返回 WGS84 坐标
 function locate() {
 return new Promise(function (resolve, reject) {
 if (!navigator.geolocation) { reject(new Error("浏览器不支持定位")); return; }
 navigator.geolocation.getCurrentPosition(
 function (pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
 function (err) { reject(new Error(err.message || "定位失败")); },
 { enableHighAccuracy: true, timeout: 8000 }
 );
 });
 }

 function reverseGeocode(lat, lng) {
 var k = key();
 if (!k) return Promise.resolve("");
 // 入参是 WGS84，先转 GCJ-02 再请求高德，反查出的地址才准确
 var g = wgs2gcj(lng, lat);
 return fetch("https://restapi.amap.com/v3/geocode/regeo?location=" + g[0] + "," + g[1] + "&key=" + encodeURIComponent(k))
 .then(function (r) { return r.json(); })
 .then(function (j) { return (j && j.regeocode && j.regeocode.formatted_address) || ""; })
 .catch(function () { return ""; });
 }

 function geocode(address) {
 var k = key();
 if (!k) return Promise.reject(new Error("NO_KEY"));
 return fetch("https://restapi.amap.com/v3/geocode/geo?address=" + encodeURIComponent(address) + "&key=" + encodeURIComponent(k))
 .then(function (r) { return r.json(); })
 .then(function (j) {
 if (j && j.status === "1" && j.geocodes && j.geocodes.length) {
 var parts = String(j.geocodes[0].location).split(","); // "lng,lat"（GCJ-02）
 var w = gcj2wgs(Number(parts[0]), Number(parts[1])); // 本地转换为 WGS84 再返回
 return {
 lng: w[0],
 lat: w[1],
 formatted: j.geocodes[0].formatted_address || address
 };
 }
 throw new Error("NOT_FOUND");
 });
 }

 WM.geo = { locate: locate, reverseGeocode: reverseGeocode, geocode: geocode, wgs2gcj: wgs2gcj, gcj2wgs: gcj2wgs };
})(window.WM);
