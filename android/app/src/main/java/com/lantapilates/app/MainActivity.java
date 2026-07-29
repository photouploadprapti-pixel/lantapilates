package com.lantapilates.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor host for the offline tablet / TV-box APK.
 * Does NOT enable online TV mode (that would show the tablet tab picker).
 * Requests all-files access so .ts workout files in LantaPilates are readable.
 */
public class MainActivity extends BridgeActivity {
    private static final int REQUEST_STORAGE = 4201;
    private boolean askedForAllFiles = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalVideosPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ensureStorageAccess();
    }

    @Override
    public void onStart() {
        super.onStart();
        applyPlaybackWebViewSettings();
        injectRemoteModeIfLeanback();
        applyImmersiveMode();
    }

    /**
     * Always enable D-pad / remote helpers in the offline APK.
     * Does NOT enable online TV tab mode (__LANTA_TV__).
     */
    private void injectRemoteModeIfLeanback() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();

        webView.evaluateJavascript(
            "(function(){"
                + "window.__LANTA_REMOTE__=true;"
                + "try{sessionStorage.setItem('lanta-remote-mode','1');}catch(e){}"
                + "document.documentElement.dataset.lantaRemote='true';"
                + "var focusPlay=function(){"
                + "var el=document.querySelector('[data-tv-autofocus]');"
                + "if(el&&typeof el.focus==='function'){el.focus();}"
                + "};"
                + "focusPlay();"
                + "setTimeout(focusPlay,300);"
                + "setTimeout(focusPlay,1000);"
                + "})();",
            null
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        // User may have just granted all-files access in system settings.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            && Environment.isExternalStorageManager()) {
            askedForAllFiles = true;
        }
        // Re-scan after returning from settings / plugging a USB pen drive.
        notifyWebToRefreshLibrary();
    }

    /**
     * Asks the web app to re-scan LantaPilates on internal storage and USB.
     */
    private void notifyWebToRefreshLibrary() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        getBridge().getWebView().evaluateJavascript(
            "(function(){"
                + "try{"
                + "window.dispatchEvent(new CustomEvent('lanta-library-refresh'));"
                + "}catch(e){}"
                + "})();",
            null
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_STORAGE) {
            ensureStorageAccess();
        }
    }

    /**
     * .ts files are often not indexed as MediaStore video, so READ_MEDIA_VIDEO is not enough.
     * Prompt for MANAGE_EXTERNAL_STORAGE (all files) on Android 11+.
     */
    private void ensureStorageAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) {
                return;
            }
            if (askedForAllFiles) {
                return;
            }
            askedForAllFiles = true;
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                Toast.makeText(
                    this,
                    "Allow all files access so LantaPilates .ts videos can be found, then return here.",
                    Toast.LENGTH_LONG
                ).show();
            } catch (Exception exception) {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
                } catch (Exception ignored) {
                    requestLegacyStoragePermissions();
                }
            }
            return;
        }

        requestLegacyStoragePermissions();
    }

    private void requestLegacyStoragePermissions() {
        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO)
                != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
        } else if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
            != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                needed.toArray(new String[0]),
                REQUEST_STORAGE
            );
        }
    }

    private void applyPlaybackWebViewSettings() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
    }

    private void applyImmersiveMode() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
