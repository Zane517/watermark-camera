package com.zane.watermarkcamera;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

/**
 * 在线更新：启动后台拉取 Pages 上的 version.json，
 * 版本号更高时把清单里的文件下载到 filesDir/www（资源拦截器会优先命中），
 * 完成后刷新页面。离线或任何异常都静默跳过，本地内置资源始终可用。
 */
public class Updater {

    private static final String VERSION_URL = "https://zane517.github.io/watermark-camera/version.json";
    private static final String BASE = "https://zane517.github.io/watermark-camera/";

    public static void start(final Context ctx, final WebView web) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    doUpdate(ctx, web);
                } catch (Throwable ignored) {
                    // 保持本地版本
                }
            }
        }).start();
    }

    private static void doUpdate(Context ctx, final WebView web) throws Exception {
        SharedPreferences sp = ctx.getSharedPreferences("www_update", Context.MODE_PRIVATE);
        int local = sp.getInt("version", 0);

        byte[] raw = fetchBytes(VERSION_URL);
        if (raw == null) {
            return; // 离线：不更新，直接用本地资源
        }
        JSONObject meta = new JSONObject(new String(raw, "UTF-8"));
        int remote = meta.optInt("version", 0);
        JSONArray files = meta.optJSONArray("files");
        if (remote <= local || files == null || files.length() == 0) {
            return;
        }

        // 先把全部文件下载到内存，任何一步失败即整体放弃，避免半更新
        ArrayList<String> rels = new ArrayList<>();
        ArrayList<byte[]> blobs = new ArrayList<>();
        for (int i = 0; i < files.length(); i++) {
            String rel = files.getString(i);
            if (rel == null || rel.isEmpty() || rel.startsWith("/") || rel.contains("..")) {
                continue;
            }
            byte[] data = fetchBytes(BASE + rel);
            if (data == null) {
                return;
            }
            rels.add(rel);
            blobs.add(data);
        }

        // 再统一落盘
        File www = new File(ctx.getFilesDir(), "www");
        for (int i = 0; i < rels.size(); i++) {
            File out = new File(www, rels.get(i));
            File parent = out.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                return;
            }
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(blobs.get(i));
            fos.close();
        }
        sp.edit().putInt("version", remote).apply();

        // 页面刷新到新资源
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                if (web != null) {
                    web.reload();
                }
            }
        });
    }

    private static byte[] fetchBytes(String u) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(15000);
            if (c.getResponseCode() != 200) {
                return null;
            }
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            in.close();
            return out.toByteArray();
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) {
                c.disconnect();
            }
        }
    }
}
