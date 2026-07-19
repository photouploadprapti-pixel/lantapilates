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

                view.evaluateJavascript(getTvInjectScript(), null);
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
     * Injects TV mode flags, safe-area CSS, and D-pad spatial navigation into the page.
     */
    private String getTvInjectScript() {
        return ""
            + "window.__LANTA_TV__=true;"
            + "try{sessionStorage.setItem('lanta-tv-mode','1');}catch(e){};"
            + "document.documentElement.dataset.tvApp='true';"
            + "document.documentElement.classList.add('tv-app');"
            + "(function(){"
            + "if(!document.getElementById('lanta-tv-inject')){"
            + "var s=document.createElement('style');"
            + "s.id='lanta-tv-inject';"
            + "s.textContent="
            + "'html.tv-app body{box-sizing:border-box;}"
            + ".tv-app [aria-label=\\\"Admin login\\\"]{display:none!important;}"
            + "body{padding:max(2.5rem,5.5vh) max(3rem,5.5vw)!important;}"
            + "button[aria-label=\\\"Play workout\\\"]{"
            + "height:5.5rem!important;width:5.5rem!important;margin-top:2rem!important;}"
            + ".tv-app button:focus,.tv-app a:focus{"
            + "outline:3px solid #a5917a!important;outline-offset:4px!important;}"
            + "';"
            + "document.head.appendChild(s);"
            + "}"
            + "var play=document.querySelector('[aria-label=\"Play workout\"]');"
            + "var change=document.querySelector('[aria-label=\"Change tablet\"]');"
            + "if(play&&change&&change.parentElement!==play.parentElement){"
            + "play.parentElement.appendChild(change);"
            + "change.style.position='static';"
            + "change.style.marginTop='1.25rem';"
            + "change.style.left='auto';"
            + "change.style.top='auto';"
            + "}"
            + "if(!window.__LANTA_TV_NAV__){"
            + "window.__LANTA_TV_NAV__=true;"
            + "function focusables(){"
            + "return Array.prototype.slice.call(document.querySelectorAll("
            + "'button:not([disabled]),a[href],[tabindex]:not([tabindex=\\\"-1\\\"])'"
            + ")).filter(function(el){"
            + "var st=getComputedStyle(el);"
            + "if(st.display==='none'||st.visibility==='hidden'||st.pointerEvents==='none')return false;"
            + "var r=el.getBoundingClientRect();"
            + "return r.width>2&&r.height>2;"
            + "});"
            + "}"
            + "function nearest(cur,dir){"
            + "var cr=cur.getBoundingClientRect();"
            + "var ox=cr.left+cr.width/2,oy=cr.top+cr.height/2;"
            + "var best=null,bestScore=1e15;"
            + "focusables().forEach(function(el){"
            + "if(el===cur)return;"
            + "var r=el.getBoundingClientRect();"
            + "var tx=r.left+r.width/2,ty=r.top+r.height/2;"
            + "var dx=tx-ox,dy=ty-oy;"
            + "if(dir==='down'&&dy<=12)return;"
            + "if(dir==='up'&&dy>=-12)return;"
            + "if(dir==='right'&&dx<=12)return;"
            + "if(dir==='left'&&dx>=-12)return;"
            + "var primary=(dir==='up'||dir==='down')?Math.abs(dy):Math.abs(dx);"
            + "var secondary=(dir==='up'||dir==='down')?Math.abs(dx):Math.abs(dy);"
            + "if(secondary>primary*3&&secondary>160)return;"
            + "var score=primary+secondary*0.4;"
            + "if(score<bestScore){bestScore=score;best=el;}"
            + "});"
            + "return best;"
            + "}"
            + "document.addEventListener('keydown',function(e){"
            + "var map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};"
            + "var dir=map[e.key];"
            + "if(!dir)return;"
            + "var t=e.target;"
            + "if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'))return;"
            + "var list=focusables();"
            + "if(!list.length)return;"
            + "var cur=(document.activeElement&&list.indexOf(document.activeElement)>=0)"
            + "?document.activeElement:list[0];"
            + "var next=nearest(cur,dir);"
            + "if(!next){if(document.activeElement!==cur){e.preventDefault();cur.focus();}return;}"
            + "e.preventDefault();e.stopPropagation();next.focus();"
            + "},true);"
            + "setTimeout(function(){"
            + "var preferred=document.querySelector('[data-tv-autofocus]')"
            + "||document.querySelector('[aria-label=\"Play workout\"]')"
            + "||document.querySelector('[aria-label=\"Pause video\"]')"
            + "||document.querySelector('[aria-label=\"Play video\"]')"
            + "||focusables()[0];"
            + "if(preferred)preferred.focus();"
            + "},200);"
            + "}"
            + "})();";
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
