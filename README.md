# Uru Play

App do Urutau Studios (player de música), empacotado como APK Android.

## Estado: Fase 0

O que já funciona:

- projeto Android nativo (WebView) montado à mão, sem Capacitor e sem npm;
- GitHub Actions gera o APK a cada `push` na `main`;
- o APK instala e abre a tela de teste.

O que **ainda não** existe (vem nas próximas fases):

- o app de verdade (fase 1);
- download de música para ouvir offline (fase 2);
- ícone definitivo, splash, release assinado (fase 3).

## Como gerar o APK

```bash
cd ~/Uru-play
git add -A
git commit -m "fase 0"
git push
```

Depois, no GitHub: **Actions → APK → run mais recente → Artifacts → uru-play-debug**.

## Estrutura

```
web/                 a interface (hoje só a tela de teste)
android/             o projeto Android
  app/src/main/
    java/.../MainActivity.java   WebView + leitura dos arquivos locais
    assets/www/                  cópia de web/ (gerada no build)
.github/workflows/android.yml    a "esteira" que monta o APK
publicar.sh          script que inicializa e envia pro GitHub
```

## Por que não Capacitor

O Capacitor geraria a mesma coisa (WebView), mas exige npm no Termux e um
template que varia de versão. O projeto nativo faz o mesmo trabalho com
menos peças e o build fica 100% no GitHub.
