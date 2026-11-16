package com.urutaustudios.uruplay;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/**
 * Fase 0: uma WebView que abre a interface guardada dentro do APK.
 *
 * A interface é servida por https://appassets.androidplatform.net (domínio
 * reservado, não precisa de internet). Isso dá uma origem "https" de verdade,
 * então na fase 1 as chamadas para a API do YouTube vão funcionar sem CORS.
 */
public class MainActivity extends Activity {

    private static final String BASE = "https://appassets.androidplatform.net/assets/www/";

    private WebView web;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFitsSystemWindows(true);

        WebSettings cfg = web.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setMediaPlaybackRequiresUserGesture(false);
        cfg.setAllowFileAccess(false);
        cfg.setAllowContentAccess(false);

        setContentView(web);

        final WebViewAssetLoader carregador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest pedido) {
                return carregador.shouldInterceptRequest(pedido.getUrl());
            }
        });

        if (estado == null) {
            web.loadUrl(BASE + "index.html");
        } else {
            web.restoreState(estado);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    public boolean onKeyDown(int codigo, KeyEvent evento) {
        if (codigo == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(codigo, evento);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
