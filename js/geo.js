// 定位与高德地址解析：locate 定位、reverseGeocode 反查地址、geocode 地址转经纬度
"use strict";
window.WM = window.WM || {};
(function (WM) {
  function key() { return WM.config.getAmapKey(); }

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
    return fetch("https://restapi.amap.com/v3/geocode/regeo?location=" + lng + "," + lat + "&key=" + encodeURIComponent(k))
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
          var parts = String(j.geocodes[0].location).split(","); // "lng,lat"
          return {
            lng: Number(parts[0]),
            lat: Number(parts[1]),
            formatted: j.geocodes[0].formatted_address || address
          };
        }
        throw new Error("NOT_FOUND");
      });
  }

  WM.geo = { locate: locate, reverseGeocode: reverseGeocode, geocode: geocode };
})(window.WM);
