package com.zane.watermarkcamera;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 本地资源加载器：对虚拟域名的请求，
 * 优先取在线更新目录 filesDir/www，其次取 APK 内置 assets/www（离线兜底）。
 */
public class LocalAssets {

    public static final String HOST = "appassets.androidplatform.net";

    private final File www;
    private final AssetManager am;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("css", "text/css");
        MIME.put("js", "application/javascript");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("ico", "image/x-icon");
    }

    public LocalAssets(Context ctx) {
        www = new File(ctx.getFilesDir(), "www");
        am = ctx.getAssets();
    }

    /** 仅处理本地虚拟域名；其他域名返回 null（走正常网络）。 */
    public WebResourceResponse intercept(Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost())) {
            return null;
        }
        String path = uri.getPath();
        if (path == null || path.isEmpty() || path.endsWith("/")) {
            path = "/index.html";
        }
        if (path.contains("..")) {
            return null; // 路径穿越防护
        }
        path = path.substring(1); // 去掉前导斜杠

        String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : "html";
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";

        // 1) 在线更新后的副本优先
        File f = new File(www, path);
        if (f.isFile()) {
            try {
                return new WebResourceResponse(mime, "UTF-8", new FileInputStream(f));
            } catch (Exception ignored) {
                // 落到 assets 兜底
            }
        }

        // 2) APK 内置资源（离线兜底）
        try {
            InputStream in = am.open("www/" + path);
            return new WebResourceResponse(mime, "UTF-8", in);
        } catch (Exception e) {
            return new WebResourceResponse(mime, "UTF-8", new ByteArrayInputStream(new byte[0]));
        }
    }
}
