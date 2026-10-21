package com.zane.watermarkcamera;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 本地封装壳：首页为相机水印页（app.html），完整网页工具为 index.html；
 * 虚拟域名加载内置资源（离线可用），后台检查在线更新；
 * NativeBridge 提供拍照保存相册能力（AppNative.saveImage / requestStorage）。
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://" + LocalAssets.HOST + "/app.html";
    private static final int REQ_PERMISSIONS = 100;
    private static final int REQ_FILE_CHOOSER = 101;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);              // localStorage：高德 Key / 水印状态
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setDatabaseEnabled(true);

        final LocalAssets assets = new LocalAssets(this);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse local = assets.intercept(req.getUrl());
                return local != null ? local : super.shouldInterceptRequest(view, req);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, hasLocationPermission(), false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                startActivityForResult(Intent.createChooser(intent, "选择图片"), REQ_FILE_CHOOSER);
                return true;
            }
        });

        // JS 桥：拍照结果写入系统相册
        web.addJavascriptInterface(new NativeBridge(), "AppNative");

        web.loadUrl(START_URL);

        // 后台检查在线更新（version.json），离线时静默跳过
        Updater.start(this, web);

        // 摄像头 + 定位一次性申请；存储仅 Android 9 及以下需要（Q+ 走 MediaStore 免权限）
        if (Build.VERSION.SDK_INT >= 29) {
            requestPermissions(new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQ_PERMISSIONS);
        } else {
            requestPermissions(new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
            }, REQ_PERMISSIONS);
        }
    }

    /** 供 JS 调用：base64 JPEG/PNG 落库相册 Pictures/AI 目录 */
    public class NativeBridge {
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
                    Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "err:insert";
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) return "err:stream";
                    os.write(data);
                    os.close();
                    v.clear();
                    v.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, v, null, null);
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "AI");
                    if (!dir.exists() && !dir.mkdirs()) return "err:dir";
                    File out = new File(dir, name);
                    FileOutputStream fos = new FileOutputStream(out);
                    fos.write(data);
                    fos.close();
                    MediaScannerConnection.scanFile(MainActivity.this,
                            new String[]{out.getAbsolutePath()}, null, null);
                }
                return "ok";
            } catch (Exception e) {
                return "err:" + e.getClass().getSimpleName();
            }
        }

        /** 仅 Android 9 及以下：存储权限被拒时由 JS 触发再次申请 */
        @JavascriptInterface
        public void requestStorage() {
            if (Build.VERSION.SDK_INT < 29) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_PERMISSIONS);
                    }
                });
            }
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
