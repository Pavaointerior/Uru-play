package com.urutaustudios.uruplay;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
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

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Casca do app: uma WebView que serve a interface guardada em assets/www.
 *
 * Download offline: o JavaScript chama UruNativo.baixar(id); o yt-dlp (biblioteca
 * youtubedl-android) grava o .m4a em files/acervo, e o endereço /acervo/ID.m4a
 * entrega esse arquivo ao player (com suporte a Range, para a barra de progresso).
 */
public class MainActivity extends Activity {

    private static final String TAG = "UruPlay";
    private static final String BASE = "https://appassets.androidplatform.net/assets/www/";
    private static final String HOST = "appassets.androidplatform.net";
    private static final Pattern ID_OK = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final Pattern NOME_OK = Pattern.compile("[A-Za-z0-9_-]{11}\\.m4a");

    private WebView web;
    private File acervo;

    // Uma fila só: primeiro inicia o yt-dlp, depois baixa uma música por vez.
    private final ExecutorService fila = Executors.newSingleThreadExecutor();
    private final Set<String> pendentes = new HashSet<>();
    private volatile boolean ytPronto = false;
    private volatile String erroInit = "";

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        acervo = new File(getFilesDir(), "acervo");
        //noinspection ResultOfMethodCallIgnored
        acervo.mkdirs();

        fila.execute(() -> {
            try {
                YoutubeDL.getInstance().init(getApplication());
                FFmpeg.getInstance().init(getApplication());
                ytPronto = true;
            } catch (Exception e) {
                erroInit = String.valueOf(e);
                Log.e(TAG, "yt-dlp não iniciou", e);
            }
        });

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFitsSystemWindows(true);

        WebSettings cfg = web.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setMediaPlaybackRequiresUserGesture(false);
        cfg.setAllowFileAccess(false);
        cfg.setAllowContentAccess(false);

        // Sem estas três, o WebView ignora o <meta viewport> e usa uma
        // largura fixa (~980px), esticando tudo para caber na tela.
        cfg.setUseWideViewPort(true);
        cfg.setLoadWithOverviewMode(true);
        cfg.setSupportZoom(false);
        cfg.setBuiltInZoomControls(false);
        cfg.setDisplayZoomControls(false);
        cfg.setTextZoom(100);

        web.addJavascriptInterface(new Ponte(), "UruNativo");

        setContentView(web);

        final WebViewAssetLoader carregador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest pedido) {
                Uri u = pedido.getUrl();
                String caminho = u.getPath();
                if (HOST.equals(u.getHost()) && caminho != null && caminho.startsWith("/acervo/")) {
                    return servirAcervo(pedido, caminho);
                }
                return carregador.shouldInterceptRequest(u);
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

    /** Entrega /acervo/ID.m4a com suporte a Range (necessário para pular na barra). */
    private WebResourceResponse servirAcervo(WebResourceRequest pedido, String caminho) {
        String nome = caminho.substring("/acervo/".length());
        File arq = NOME_OK.matcher(nome).matches() ? new File(acervo, nome) : null;
        if (arq == null || !arq.isFile() || arq.length() == 0) {
            return resposta(404, "Not Found", new HashMap<String, String>());
        }
        long total = arq.length();
        Map<String, String> cab = pedido.getRequestHeaders();
        String range = cab.get("Range");
        if (range == null) range = cab.get("range");
        Faixa f = Faixa.ler(range, total);
        Map<String, String> h = new HashMap<>();
        if (f == null) {
            h.put("Content-Range", "bytes */" + total);
            return resposta(416, "Range Not Satisfiable", h);
        }
        try {
            h.put("Accept-Ranges", "bytes");
            h.put("Content-Length", String.valueOf(f.tamanho()));
            if (f.parcial) h.put("Content-Range", "bytes " + f.ini + "-" + f.fim + "/" + total);
            return new WebResourceResponse("audio/mp4", null,
                    f.parcial ? 206 : 200, f.parcial ? "Partial Content" : "OK",
                    h, f.abrir(arq));
        } catch (IOException e) {
            Log.e(TAG, "falha ao abrir " + nome, e);
            return resposta(500, "Internal Error", new HashMap<String, String>());
        }
    }

    private WebResourceResponse resposta(int codigo, String motivo, Map<String, String> h) {
        return new WebResourceResponse("text/plain", "utf-8", codigo, motivo, h,
                new ByteArrayInputStream(new byte[0]));
    }

    private void baixarAgora(String id) {
        boolean ok = false;
        String erro = "";
        try {
            File alvo = new File(acervo, id + ".m4a");
            if (alvo.isFile() && alvo.length() > 0) {
                ok = true;
            } else if (ytPronto) {
                YoutubeDLRequest req = new YoutubeDLRequest("https://www.youtube.com/watch?v=" + id);
                req.addOption("--no-playlist");
                req.addOption("-f", "bestaudio[ext=m4a]/bestaudio");
                req.addOption("-x");
                req.addOption("--audio-format", "m4a");
                req.addOption("-o", acervo.getAbsolutePath() + "/%(id)s.%(ext)s");
                YoutubeDL.getInstance().execute(req);
                ok = alvo.isFile() && alvo.length() > 0;
                if (!ok) erro = "o arquivo m4a não foi criado";
            } else {
                erro = "yt-dlp não iniciou: " + erroInit;
            }
        } catch (Exception e) {
            erro = String.valueOf(e.getMessage());
            Log.e(TAG, "download falhou: " + id, e);
        }
        if (erro.length() > 500) erro = erro.substring(0, 500);
        synchronized (pendentes) {
            pendentes.remove(id);
        }
        final String js = "window.uruBaixou && uruBaixou('" + id + "'," + ok + "," + JSONObject.quote(erro) + ")";
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    /** Funções que o JavaScript enxerga como UruNativo.xxx(). */
    private class Ponte {
        @JavascriptInterface
        public String listar() {
            JSONArray a = new JSONArray();
            File[] arqs = acervo.listFiles();
            if (arqs != null) {
                for (File f : arqs) {
                    String n = f.getName();
                    if (NOME_OK.matcher(n).matches() && f.length() > 0) a.put(n.substring(0, 11));
                }
            }
            return a.toString();
        }

        @JavascriptInterface
        public void baixar(String id) {
            if (id == null || !ID_OK.matcher(id).matches()) return;
            synchronized (pendentes) {
                if (!pendentes.add(id)) return;
            }
            final String vid = id;
            fila.execute(() -> baixarAgora(vid));
        }

        @JavascriptInterface
        public void apagar(String id) {
            if (id == null || !ID_OK.matcher(id).matches()) return;
            //noinspection ResultOfMethodCallIgnored
            new File(acervo, id + ".m4a").delete();
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
