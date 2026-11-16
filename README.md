# Uru Play

App do Urutau Studios (player de música), empacotado como APK Android.

## Estado: Fase 1

Funciona:

- busca no YouTube (música e "outros vídeos");
- descobertas: da biblioteca, novidades dos artistas, em alta, temas;
- curtir, descurtir, playlists — tudo guardado no próprio aparelho;
- player pelo YouTube (vídeo do topo, capa, título, barra de progresso);
- botão voltar do Android funciona tela por tela.

Ainda não existe:

- **download para ouvir offline** (fase 2) — por enquanto, ao tocar uma
  curtida, o áudio local não existe e o app toca pelo YouTube;
- release assinado e ícone definitivo (fase 3).

## A chave do YouTube

Na primeira busca o app pede a chave da API do YouTube (Google Cloud).
Ela fica guardada só no aparelho, em `localStorage`. Para trocar:
abra o console da WebView e rode `uruTrocarChave()`.

## Gerar o APK

```bash
cd ~/Uru-play
git add -A
git commit -m "fase 1"
git push
```

GitHub → **Actions → APK → Artifacts → uru-play-debug**.

## Estrutura

```
web/                 a interface (index + api.js + 6 módulos)
android/             o projeto Android
  app/src/main/java/.../MainActivity.java   WebView, diálogos, voltar
  app/src/main/assets/www/                   cópia de web/ (gerada no build)
.github/workflows/android.yml                a esteira que monta o APK
publicar.sh          script que inicializa e envia pro GitHub
```

## Como o servidor.py foi substituído

| antes (servidor.py) | agora (api.js) |
|---|---|
| `/buscar` | chamada direta à API do YouTube |
| `/descobertas` | chamada direta (+ cache de 12 h) |
| `/biblioteca` | `localStorage` |
| `dados.json` | importado uma vez do pacote |
| `yt-dlp` | fase 2 |

`api.js` intercepta as rotas antigas: os 6 módulos continuam iguais.
