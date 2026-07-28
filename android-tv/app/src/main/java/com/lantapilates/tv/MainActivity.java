package com.lantapilates.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * Leanback host: native tablet picker + native Play/Change controls over the website WebView.
 * Native buttons are used because WebView D-pad focus is unreliable on Xiaomi / TX98 boxes.
 */
public class MainActivity extends Activity {
    private WebView webView;
    private ProgressBar loading;
    private LinearLayout tabPicker;
    private LinearLayout nativeWelcomeControls;
    private LinearLayout nativePlayControls;
    private Button btnNativePlay;
    private Button btnNativeChange;
    private Button btnNativeBack;
    private Button btnNativePrev;
    private Button btnNativeRewind;
    private Button btnNativePause;
    private Button btnNativeForward;
    private Button btnNativeNext;

    private boolean showingPicker = true;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String currentSlug = "tab1";
    /** True when Play/Pause froze WebView media so resume can continue mid-video. */
    private boolean webViewMediaPaused = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        loading = findViewById(R.id.loading);
        tabPicker = findViewById(R.id.tab_picker);
        nativeWelcomeControls = findViewById(R.id.native_welcome_controls);
        nativePlayControls = findViewById(R.id.native_play_controls);
        btnNativePlay = findViewById(R.id.btn_native_play);
        btnNativeChange = findViewById(R.id.btn_native_change);
        btnNativeBack = findViewById(R.id.btn_native_back);
        btnNativePrev = findViewById(R.id.btn_native_prev);
        btnNativeRewind = findViewById(R.id.btn_native_rewind);
        btnNativePause = findViewById(R.id.btn_native_pause);
        btnNativeForward = findViewById(R.id.btn_native_forward);
        btnNativeNext = findViewById(R.id.btn_native_next);

        configureWebView();
        bindTabButtons();
        bindNativeControls();
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

    private void bindNativeControls() {
        btnNativePlay.setOnClickListener(v -> startWorkoutFromNative());
        btnNativeChange.setOnClickListener(v -> showTabPicker());
        btnNativeBack.setOnClickListener(v -> {
            ensureWebViewMediaResumed();
            // Prefer inline exit (keeps warmed playlist) over a full welcome reload.
            runPageJs(
                "if(typeof window.__lantaTvExitPlay==='function'){return window.__lantaTvExitPlay();}"
                    + "return 'none';"
            );
            handler.postDelayed(() -> {
                if (webView == null) {
                    return;
                }
                String current = webView.getUrl();
                if (current != null && current.toLowerCase().contains("/play")) {
                    String welcomeUrl = getString(R.string.base_url) + "/" + currentSlug + "/?tv=1";
                    webView.loadUrl(welcomeUrl);
                    return;
                }
                showWelcomeBar();
            }, 250);
        });
        btnNativePrev.setOnClickListener(v -> {
            ensureWebViewMediaResumed();
            runPageJs(
                "if(typeof window.__lantaTvPrevVideo==='function'){return window.__lantaTvPrevVideo();}"
                    + "return 'none';"
            );
        });
        btnNativeRewind.setOnClickListener(v -> {
            ensureWebViewMediaResumed();
            runPageJs(
                "if(typeof window.__lantaTvSeekBy==='function'){return window.__lantaTvSeekBy(-10);}"
                    + "return 'none';"
            );
        });
        btnNativePause.setOnClickListener(v -> toggleNativePlayPause());
        btnNativeForward.setOnClickListener(v -> {
            ensureWebViewMediaResumed();
            runPageJs(
                "if(typeof window.__lantaTvSeekBy==='function'){return window.__lantaTvSeekBy(10);}"
                    + "return 'none';"
            );
        });
        btnNativeNext.setOnClickListener(v -> {
            ensureWebViewMediaResumed();
            runPageJs(
                "if(typeof window.__lantaTvNextVideo==='function'){return window.__lantaTvNextVideo();}"
                    + "var b=document.querySelector('[aria-label=\"Next video\"]');"
                    + "if(b&&!b.disabled){b.click();return 'click';}"
                    + "return 'none';"
            );
        });
    }

    /**
     * Shrinks the WebView above the native bar so video stays truly full-bleed in the free area.
     *
     * @param bottomDp - Bottom inset in density-independent pixels
     */
    private void setWebViewBottomInsetDp(int bottomDp) {
        if (webView == null) {
            return;
        }
        ViewGroup.LayoutParams raw = webView.getLayoutParams();
        if (!(raw instanceof FrameLayout.LayoutParams)) {
            return;
        }
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) raw;
        int px = Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            bottomDp,
            getResources().getDisplayMetrics()
        ));
        if (lp.bottomMargin == px) {
            return;
        }
        lp.bottomMargin = px;
        webView.setLayoutParams(lp);
    }

    /**
     * Toggles HTML5 playback via the page bridge (no WebView freeze — seek/prev/next stay live).
     */
    private void toggleNativePlayPause() {
        if (webView == null) {
            return;
        }

        ensureWebViewMediaResumed();
        runPageJs(
            "if(typeof window.__lantaTvTogglePlay==='function'){return window.__lantaTvTogglePlay();}"
                + "return 'none';"
        );
    }

    private void ensureWebViewMediaResumed() {
        if (webView == null || !webViewMediaPaused) {
            return;
        }
        webView.onResume();
        webViewMediaPaused = false;
    }

    /**
     * Starts playback using the website session API, then hard-navigates if needed.
     * WebView button clicks and Next.js router.push are unreliable on low-end TV boxes.
     */
    private void startWorkoutFromNative() {
        loading.setVisibility(View.VISIBLE);
        Toast.makeText(this, "Starting…", Toast.LENGTH_SHORT).show();

        final String playUrl =
            getString(R.string.base_url) + "/" + currentSlug + "/play/?tv=1";

        String js =
            "(function(){"
                + "try{"
                + "if(typeof window.__lantaTvStartPlay==='function'){"
                + "return window.__lantaTvStartPlay();"
                + "}"
                + "var s=window.__lantaTvSession;"
                + "if(s&&s.userId&&s.videoFileNames&&s.videoFileNames.length){"
                + "sessionStorage.setItem('lanta-tablet-session',JSON.stringify(s));"
                + "sessionStorage.setItem('lanta-tv-mode','1');"
                + "window.__LANTA_TV__=true;"
                + "location.href='" + playUrl + "';"
                + "return 'fallback-nav';"
                + "}"
                + "return 'no-session';"
                + "}catch(e){return String(e)}"
                + "})();";

        webView.evaluateJavascript(js, value -> {
            String result = value == null ? "" : value.replace("\"", "");
            if ("no-user".equals(result) || "no-session".equals(result)) {
                loading.setVisibility(View.GONE);
                Toast.makeText(
                    MainActivity.this,
                    "No user assigned to this tablet yet. Ask your admin.",
                    Toast.LENGTH_LONG
                ).show();
                return;
            }
            if ("no-videos".equals(result)) {
                loading.setVisibility(View.GONE);
                Toast.makeText(
                    MainActivity.this,
                    "No videos assigned. Ask your admin to assign videos.",
                    Toast.LENGTH_LONG
                ).show();
                return;
            }

            // Inline start uses the already-warmed welcome player — do not reload the page.
            if ("inline".equals(result) || "ok".equals(result)) {
                loading.setVisibility(View.GONE);
                showPlayBar();
                return;
            }

            // If SPA start did not navigate, force a full page load (re-save session first).
            handler.postDelayed(() -> {
                if (showingPicker || webView == null) {
                    return;
                }
                String current = webView.getUrl();
                if (current == null || !current.toLowerCase().contains("/play")) {
                    webView.evaluateJavascript(
                        "(function(){"
                            + "var s=window.__lantaTvSession;"
                            + "if(s){sessionStorage.setItem('lanta-tablet-session',JSON.stringify(s));"
                            + "sessionStorage.setItem('lanta-tv-mode','1');window.__LANTA_TV__=true;}"
                            + "})();",
                        ignored -> webView.loadUrl(playUrl)
                    );
                } else {
                    loading.setVisibility(View.GONE);
                    showPlayBar();
                }
            }, 1200);
        });
    }

    private void openTablet(String slug) {
        currentSlug = slug;
        showingPicker = false;
        tabPicker.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        loading.setVisibility(View.VISIBLE);
        hideNativeBars();

        String url = getString(R.string.base_url) + "/" + slug + "/?tv=1";
        webView.loadUrl(url);
    }

    private void showTabPicker() {
        ensureWebViewMediaResumed();
        showingPicker = true;
        loading.setVisibility(View.GONE);
        hideNativeBars();
        webView.stopLoading();
        webView.loadUrl("about:blank");
        webView.setVisibility(View.GONE);
        tabPicker.setVisibility(View.VISIBLE);

        Button tab1 = findViewById(R.id.btn_tab1);
        if (tab1 != null) {
            tab1.requestFocus();
        }
    }

    private void hideNativeBars() {
        nativeWelcomeControls.setVisibility(View.GONE);
        nativePlayControls.setVisibility(View.GONE);
        setWebViewBottomInsetDp(0);
    }

    private void showWelcomeBar() {
        nativePlayControls.setVisibility(View.GONE);
        nativeWelcomeControls.setVisibility(View.VISIBLE);
        // Welcome bar ~120dp tall including padding.
        setWebViewBottomInsetDp(120);
        btnNativePlay.requestFocus();
    }

    private void showPlayBar() {
        nativeWelcomeControls.setVisibility(View.GONE);
        nativePlayControls.setVisibility(View.VISIBLE);
        // Compact 6-button transport bar (~72dp).
        setWebViewBottomInsetDp(72);
        btnNativePause.requestFocus();
    }

    private void updateBarsForUrl(String url) {
        if (url == null || url.startsWith("about:") || showingPicker) {
            hideNativeBars();
            return;
        }
        String lower = url.toLowerCase();
        if (lower.contains("/play")) {
            showPlayBar();
        } else {
            showWelcomeBar();
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
        webView.setFocusable(false);
        webView.setFocusableInTouchMode(false);
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
                ensureWebViewMediaResumed();
                loading.setVisibility(View.GONE);
                if (showingPicker || url == null || url.startsWith("about:")) {
                    return;
                }

                view.evaluateJavascript(getTvStyleScript(), null);
                updateBarsForUrl(url);

                // SPA client navigations may finish before React mounts Play.
                handler.postDelayed(() -> {
                    if (!showingPicker) {
                        updateBarsForUrl(view.getUrl());
                        view.evaluateJavascript(getTvStyleScript(), null);
                    }
                }, 800);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                if (!showingPicker) {
                    updateBarsForUrl(url);
                }
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
     * When native bars are visible, let Android D-pad focus the native buttons.
     * Only intercept media keys.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        boolean nativeBarsVisible =
            nativeWelcomeControls.getVisibility() == View.VISIBLE
                || nativePlayControls.getVisibility() == View.VISIBLE;

        if (showingPicker || nativeBarsVisible) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }

        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                btnNativePause.performClick();
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    /**
     * Runs page JS. Expression must include its own return statements —
     * do not wrap with {@code return <expression>} (that breaks {@code if (...)}).
     *
     * @param expression - JS statements to run inside try/catch
     */
    private void runPageJs(String expression) {
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{" + expression + "}catch(e){return String(e)}})();",
            value -> {
                String result = value == null ? "" : value.replace("\"", "");
                if ("none".equals(result) || result.startsWith("Error") || result.startsWith("SyntaxError")) {
                    android.util.Log.w("LantaTV", "Play control JS result: " + result);
                }
            }
        );
    }

    private String getTvStyleScript() {
        return ""
            + "window.__LANTA_TV__=true;"
            + "try{sessionStorage.setItem('lanta-tv-mode','1');}catch(e){};"
            + "document.documentElement.dataset.tvApp='true';"
            + "document.documentElement.classList.add('tv-app');"
            + "if(!document.getElementById('lanta-tv-inject')){"
            + "var s=document.createElement('style');"
            + "s.id='lanta-tv-inject';"
            + "s.textContent="
            + "'.tv-app [aria-label=\\\"Admin login\\\"]{display:none!important;}"
            + ".tv-app [aria-label=\\\"Change tablet\\\"]{display:none!important;}"
            + "body:not(.tv-playback){padding:max(2rem,4vh) max(3rem,5vw) 7rem!important;}"
            + "body.tv-playback{padding:0!important;margin:0!important;background:#000!important;overflow:hidden!important;}"
            + "';"
            + "document.head.appendChild(s);"
            + "}";
    }

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

        @JavascriptInterface
        public void showPlayControls() {
            runOnUiThread(() -> {
                loading.setVisibility(View.GONE);
                showPlayBar();
            });
        }

        @JavascriptInterface
        public void showWelcomeControls() {
            runOnUiThread(() -> {
                loading.setVisibility(View.GONE);
                showWelcomeBar();
            });
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (!showingPicker && nativePlayControls.getVisibility() == View.VISIBLE) {
            runPageJs(
                "if(typeof window.__lantaTvExitPlay==='function'){return window.__lantaTvExitPlay();}"
                    + "return 'none';"
            );
            handler.postDelayed(() -> {
                if (webView == null) {
                    return;
                }
                String current = webView.getUrl();
                if (current != null && current.toLowerCase().contains("/play")) {
                    String welcomeUrl = getString(R.string.base_url) + "/" + currentSlug + "/?tv=1";
                    webView.loadUrl(welcomeUrl);
                    return;
                }
                showWelcomeBar();
            }, 250);
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
    protected void onResume() {
        super.onResume();
        if (webView == null) {
            return;
        }
        // Keep intentional Play/Pause freeze across Activity resume.
        if (webViewMediaPaused) {
            webView.onPause();
        } else {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
