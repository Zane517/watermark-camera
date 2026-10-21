package com.zane.watermarkcamera;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** 拍照保存桥：base64 图片 → 系统相册 Pictures/AI（Q+ 走 MediaStore 免权限） */
public class NativeBridge {
    private static final int REQ_STORAGE = 100;
    private final Activity activity;

    public NativeBridge(Activity activity) {
        this.activity = activity;
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
}
