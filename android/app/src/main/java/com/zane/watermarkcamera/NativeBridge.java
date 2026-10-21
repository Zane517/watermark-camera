package com.zane.watermarkcamera;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** JS 桥：保存相册 + 原生定位（国内 ROM 无 GMS 时 WebView 定位退化，原生 GPS 修复更准） */
public class NativeBridge {
    private static final int REQ_STORAGE = 100;
    private final Activity activity;
    private final WebView web;

    public NativeBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    @JavascriptInterface
    public String saveImage(String base64, String name) {
        try {
            byte[] data = Base64.decode(base64, Base64.NO_WRAP);
            String mime = (name != null && name.toLowerCase().endsWith(".png")) ? "image/png" : "image/jpeg";
            if (name == null || name.isEmpty()) name = "WM_" + System.currentTimeMillis() + ".jpg";

            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                v.put(MediaStore.Images.Media.MIME_TYPE, mime);
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AI");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = activity.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "err:insert";
                OutputStream os = activity.getContentResolver().openOutputStream(uri);
                if (os == null) return "err:stream";
                os.write(data);
                os.close();
                v.clear();
                v.put(MediaStore.Images.Media.IS_PENDING, 0);
                activity.getContentResolver().update(uri, v, null, null);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "AI");
                if (!dir.exists() && !dir.mkdirs()) return "err:dir";
                File out = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(out);
                fos.write(data);
                fos.close();
                MediaScannerConnection.scanFile(activity,
                        new String[]{out.getAbsolutePath()}, null, null);
            }
            return "ok";
        } catch (Exception e) {
            return "err:" + e.getClass().getSimpleName();
        }
    }

    // 存储权限被拒时（API < 29）由 JS 触发重新申请
    @JavascriptInterface
    public void requestStorage() {
        if (Build.VERSION.SDK_INT < 29) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
                }
            });
        }
    }

    /* —— 原生定位：GPS 优先、网络兜底，结果经 __onNativeLoc 异步回灌页面 —— */

    @JavascriptInterface
    public void requestLocation() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                doLocate();
            }
        }).start();
    }

    private void doLocate() {
        try {
            if (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                deliver(null);
                return;
            }
            LocationManager lm = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) { deliver(null); return; }

            Location gps = safeLast(lm, LocationManager.GPS_PROVIDER);
            Location net = safeLast(lm, LocationManager.NETWORK_PROVIDER);
            Location best = better(gps, net);
            if (best != null && System.currentTimeMillis() - best.getTime() < 20000) {
                deliver(best);
                return;
            }

            Location fix = awaitSingle(lm, LocationManager.GPS_PROVIDER, 6000);
            if (fix == null) fix = awaitSingle(lm, LocationManager.NETWORK_PROVIDER, 4000);
            deliver(fix != null ? fix : best);
        } catch (Throwable t) {
            deliver(null);
        }
    }

    private Location safeLast(LocationManager lm, String provider) {
        try {
            if (!lm.isProviderEnabled(provider)) return null;
            return lm.getLastKnownLocation(provider);
        } catch (Throwable t) {
            return null;
        }
    }

    private Location awaitSingle(LocationManager lm, String provider, long ms) {
        final CountDownLatch latch = new CountDownLatch(1);
        final Location[] out = new Location[1];
        LocationListener lis = new LocationListener() {
            @Override
            public void onLocationChanged(Location l) {
                out[0] = l;
                latch.countDown();
            }
            @Override public void onStatusChanged(String p, int extra, android.os.Bundle b) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
        };
        try {
            if (!lm.isProviderEnabled(provider)) return null;
            lm.requestSingleUpdate(provider, lis, Looper.getMainLooper());
            latch.await(ms, TimeUnit.MILLISECONDS);
            return out[0];
        } catch (Throwable t) {
            return null;
        } finally {
            try { lm.removeUpdates(lis); } catch (Throwable ignored) { }
        }
    }

    private Location better(Location a, Location b) {
        if (a == null) return b;
        if (b == null) return a;
        if (a.hasAccuracy() && !b.hasAccuracy()) return a;
        if (!a.hasAccuracy() && b.hasAccuracy()) return b;
        return a.getAccuracy() <= b.getAccuracy() ? a : b;
    }

    private void deliver(final Location loc) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                String js;
                if (loc == null) {
                    js = "window.__onNativeLocFail&&window.__onNativeLocFail();";
                } else {
                    js = "window.__onNativeLoc&&window.__onNativeLoc(" + loc.getLatitude()
                            + "," + loc.getLongitude() + "," + loc.getAccuracy() + ");";
                }
                web.evaluateJavascript(js, null);
            }
        });
    }
}
