package com.lantapilates.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
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
 * Leanback host: native tablet picker, then website in WebView.
 * D-pad is handled entirely in the Activity and applied via linear JS focus —
 * required for Xiaomi / TX98 remotes that never deliver keys into the page.
 */
public class MainActivity extends Activity {
    private WebView webView;
    private ProgressBar loading;
    private LinearLayout tabPicker;
    private boolean showingPicker = true;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int webFocusIndex = 0;

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

    private void openTablet(String slug) {
        showingPicker = false;
        webFocusIndex = 0;
        tabPicker.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        loading.setVisibility(View.VISIBLE);

        String url = getString(R.string.base_url) + "/" + slug + "/?tv=1";
        webView.loadUrl(url);
        webView.requestFocus();
    }

    private void showTabPicker() {
        showingPicker = true;
        webFocusIndex = 0;
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

                webFocusIndex = 0;
                injectTvHelpers();
                view.requestFocus();
                // SPA pages may render after onPageFinished — re-apply focus shortly after.
                handler.postDelayed(() -> {
                    if (!showingPicker) {
                        injectTvHelpers();
                        applyWebFocus(0);
                    }
                }, 600);
                handler.postDelayed(() -> {
                    if (!showingPicker) {
                        applyWebFocus(0);
                    }
                }, 1400);
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

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (showingPicker || webView == null || webView.getVisibility() != View.VISIBLE) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() != KeyEvent.ACTION_DOWN || event.getRepeatCount() > 0) {
            // Still consume UP for D-pad so WebView doesn't also handle it oddly.
            int code = event.getKeyCode();
            if (
                event.getAction() == KeyEvent.ACTION_UP
                    && (
                        code == KeyEvent.KEYCODE_DPAD_UP
                            || code == KeyEvent.KEYCODE_DPAD_DOWN
                            || code == KeyEvent.KEYCODE_DPAD_LEFT
                            || code == KeyEvent.KEYCODE_DPAD_RIGHT
                            || code == KeyEvent.KEYCODE_DPAD_CENTER
                            || code == KeyEvent.KEYCODE_ENTER
                            || code == KeyEvent.KEYCODE_NUMPAD_ENTER
                    )
            ) {
                return true;
            }
            return super.dispatchKeyEvent(event);
        }

        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_NAVIGATE_PREVIOUS:
                moveWebFocus(-1);
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_NAVIGATE_NEXT:
                moveWebFocus(1);
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                moveWebFocus(-1);
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                moveWebFocus(1);
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_SPACE:
                activateWebFocus();
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                runPageJs("__lantaTvMedia('playpause')");
                return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                runPageJs("__lantaTvMedia('rewind')");
                return true;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                runPageJs("__lantaTvMedia('forward')");
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private void moveWebFocus(int delta) {
        webView.requestFocus();
        injectTvHelpers();
        webFocusIndex += delta;
        applyWebFocus(webFocusIndex);
    }

    private void activateWebFocus() {
        webView.requestFocus();
        injectTvHelpers();
        runPageJs("__lantaTvActivate(" + webFocusIndex + ")");
    }

    private void applyWebFocus(int index) {
        runPageJs(
            "(function(){var n=__lantaTvApplyFocus(" + index + ");"
                + "if(typeof n==='number'){LantaTV.setFocusIndex(n);}"
                + "})()"
        );
    }

    private void injectTvHelpers() {
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript(getTvInjectScript(), null);
    }

    private void runPageJs(String expression) {
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{" + expression + "}catch(e){}})();",
            null
        );
    }

    /**
     * Linear focus helpers — always redefining functions so SPA re-renders cannot break remotes.
     */
    private String getTvInjectScript() {
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
            + "body{padding:max(2.5rem,5.5vh) max(3rem,5.5vw)!important;}"
            + "button[aria-label=\\\"Play workout\\\"]{"
            + "height:5.5rem!important;width:5.5rem!important;margin-top:2rem!important;}"
            + ".lanta-tv-focused{"
            + "outline:4px solid #a5917a!important;outline-offset:6px!important;"
            + "box-shadow:0 0 0 8px rgba(165,145,122,.35)!important;}"
            + "';"
            + "document.head.appendChild(s);"
            + "}"
            + "var play=document.querySelector('[aria-label=\"Play workout\"]');"
            + "var change=document.querySelector('[aria-label=\"Change tablet\"]');"
            + "if(play&&change){"
            + "if(change.parentElement!==play.parentElement){play.parentElement.appendChild(change);}"
            + "change.style.position='static';change.style.marginTop='1.25rem';"
            + "change.style.left='auto';change.style.top='auto';"
            + "}"
            + "window.__lantaTvTargets=function(){"
            + "var preferred=["
            + "document.querySelector('[aria-label=\"Play workout\"]'),"
            + "document.querySelector('[aria-label=\"Change tablet\"]'),"
            + "document.querySelector('[aria-label=\"Back to welcome\"]'),"
            + "document.querySelector('[aria-label=\"Previous video\"]'),"
            + "document.querySelector('[aria-label*=\"Back \"]'),"
            + "document.querySelector('[aria-label=\"Pause video\"], [aria-label=\"Play video\"]'),"
            + "document.querySelector('[aria-label*=\"Forward \"]'),"
            + "document.querySelector('[aria-label=\"Next video\"]')"
            + "];"
            + "var seen={},out=[];"
            + "function add(el){"
            + "if(!el||seen[el])return;"
            + "var st=getComputedStyle(el);"
            + "if(st.display==='none'||st.visibility==='hidden'||el.disabled)return;"
            + "var r=el.getBoundingClientRect();"
            + "if(r.width<2||r.height<2)return;"
            + "seen[el]=1;out.push(el);"
            + "}"
            + "preferred.forEach(add);"
            + "Array.prototype.forEach.call("
            + "document.querySelectorAll('button:not([disabled])'),add);"
            + "return out;"
            + "};"
            + "window.__lantaTvApplyFocus=function(index){"
            + "var list=__lantaTvTargets();"
            + "if(!list.length)return 0;"
            + "var i=((index%list.length)+list.length)%list.length;"
            + "list.forEach(function(el){el.classList.remove('lanta-tv-focused');});"
            + "var el=list[i];"
            + "el.classList.add('lanta-tv-focused');"
            + "try{el.focus({preventScroll:false});}catch(e){try{el.focus();}catch(e2){}}"
            + "try{el.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e3){}"
            + "return i;"
            + "};"
            + "window.__lantaTvActivate=function(index){"
            + "var list=__lantaTvTargets();"
            + "if(!list.length)return;"
            + "var i=((index%list.length)+list.length)%list.length;"
            + "__lantaTvApplyFocus(i);"
            + "var el=list[i];"
            + "try{el.click();}catch(e){}"
            + "};"
            + "window.__lantaTvMedia=function(action){"
            + "if(action==='playpause'){"
            + "var btn=document.querySelector('[aria-label=\"Pause video\"], [aria-label=\"Play video\"]');"
            + "if(btn){btn.click();return;}"
            + "var vid=document.querySelector('video');"
            + "if(vid){if(vid.paused)vid.play();else vid.pause();}"
            + "return;}"
            + "if(action==='rewind'){"
            + "var back=document.querySelector('[aria-label*=\"Back \"]');"
            + "if(back){back.click();return;}"
            + "var vid=document.querySelector('video');if(vid)vid.currentTime=Math.max(0,vid.currentTime-10);"
            + "return;}"
            + "if(action==='forward'){"
            + "var fwd=document.querySelector('[aria-label*=\"Forward \"]');"
            + "if(fwd){fwd.click();return;}"
            + "var vid=document.querySelector('video');if(vid)vid.currentTime=vid.currentTime+10;"
            + "}"
            + "};";
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
        public void setFocusIndex(int index) {
            webFocusIndex = index;
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
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
