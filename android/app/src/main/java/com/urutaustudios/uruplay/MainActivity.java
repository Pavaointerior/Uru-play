package com.urutaustudios.uruplay;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.KeyEvent;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.EditText;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/**
 * Casca do app: uma WebView que serve a interface guardada em assets/www.
 *
 * A origem é https://appassets.androidplatform.net (domínio reservado, não
 * usa rede), então as chamadas para a API do YouTube funcionam.
 *
 * O WebChromeClient é obrigatório: sem ele, alert(), confirm() e prompt()
 * não fazem nada (o app usa os três para playlists e para a chave).
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

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setPositiveButton("OK", (d, w) -> r.confirm())
                        .setCancelable(false)
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setPositiveButton("OK", (d, w) -> r.confirm())
                        .setNegativeButton("Cancelar", (d, w) -> r.cancel())
                        .setCancelable(false)
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView v, String url, String msg, String padrao,
                                      final JsPromptResult r) {
                final EditText campo = new EditText(MainActivity.this);
                campo.setInputType(InputType.TYPE_CLASS_TEXT);
                if (padrao != null) campo.setText(padrao);

                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setView(campo)
                        .setPositiveButton("OK", (d, w) -> r.confirm(campo.getText().toString()))
                        .setNegativeButton("Cancelar", (d, w) -> r.cancel())
                        .setCancelable(false)
                        .show();
                return true;
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
