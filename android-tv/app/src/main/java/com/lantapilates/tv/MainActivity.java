package com.lantapilates.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

/**
 * Leanback host: native tablet picker first, then the live website in TV mode.
 */
public class MainActivity extends Activity {
    private WebView webView;
    private ProgressBar loading;
    private LinearLayout tabPicker;
    private boolean showingPicker = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        loading = findViewById(R.id.loading);
        tabPicker = findViewById(R.id.tab_picker);

        configureWebView();
        bindTabButtons();
        showTabPicker();
        applyImmersiveMode();
    }

    private void bindTabButtons() {
        Button tab1 = findViewById(R.id.btn_tab1);
        Button tab2 = findViewById(R.id.btn_tab2);
        Button tab3 = findViewById(R.id.btn_tab3);
        Button tab4 = findViewById(R.id.btn_tab4);

        tab1.setOnClickListener(v -> openTablet("tab1"));
        tab2.setOnClickListener(v -> openTablet("tab2"));
        tab3.setOnClickListener(v -> openTablet("tab3"));
        tab4.setOnClickListener(v -> openTablet("tab4"));

        tab1.requestFocus();
    }

    /**
     * Loads the selected tablet welcome page inside the WebView.
     *
     * @param slug tablet slug such as tab1
     */
    private void openTablet(String slug) {
        showingPicker = false;
        tabPicker.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        loading.setVisibility(View.VISIBLE);

        String url = getString(R.string.base_url) + "/" + slug + "/?tv=1";
        webView.loadUrl(url);
        webView.requestFocus();
    }

    /**
     * Returns to the native tablet chooser without leaving the app.
     */
    private void showTabPicker() {
        showingPicker = true;
        loading.setVisibility(View.GONE);
        webView.stopLoading();
        webView.loadUrl("about:blank");
        webView.setVisibility(View.GONE);
        tabPicker.setVisibility(View.VISIBLE);

        Button tab1 = findViewById(R.id.btn_tab1);
        if (tab1 != null) {
            tab1.requestFocus();
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " LantaTV/1.0");

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.addJavascriptInterface(new LantaTvBridge(), "LantaTV");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (!showingPicker) {
                    loading.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
                if (showingPicker || url == null || url.startsWith("about:")) {
                    return;
                }

                // Ensure TV mode + overscan padding even before the next Netlify deploy.
                view.evaluateJavascript(
                    "window.__LANTA_TV__=true;"
                        + "try{sessionStorage.setItem('lanta-tv-mode','1');}catch(e){};"
                        + "document.documentElement.dataset.tvApp='true';"
                        + "document.documentElement.classList.add('tv-app');"
                        + "(function(){"
                        + "if(document.getElementById('lanta-tv-inject'))return;"
                        + "var s=document.createElement('style');"
                        + "s.id='lanta-tv-inject';"
                        + "s.textContent="
                        + "'html.tv-app body{box-sizing:border-box;}"
                        + ".tv-app [aria-label=\\\"Admin login\\\"]{display:none!important;}"
                        + "body{padding:max(2.5rem,5.5vh) max(3rem,5.5vw)!important;}"
                        + "button[aria-label=\\\"Play workout\\\"]{"
                        + "height:5.5rem!important;width:5.5rem!important;margin-top:2rem!important;}"
                        + "';"
                        + "document.head.appendChild(s);"
                        + "})();",
                    null
                );
                view.requestFocus();
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request.isForMainFrame()) {
                    loading.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
    }

    /**
     * JS bridge so the website can reopen the native tablet picker.
     */
    private class LantaTvBridge {
        @JavascriptInterface
        public void openTabPicker() {
            runOnUiThread(() -> showTabPicker());
        }

        @JavascriptInterface
        public void selectTab(String slug) {
            if (slug == null) {
                return;
            }
            final String normalized = slug.trim().toLowerCase();
            if (!normalized.matches("tab[1-4]")) {
                return;
            }
            runOnUiThread(() -> openTablet(normalized));
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (!showingPicker && webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (!showingPicker) {
            showTabPicker();
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
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

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
