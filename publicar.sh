#!/data/data/com.termux/files/usr/bin/bash
# Publica a árvore Uru-play no GitHub. Uso:
#   bash publicar.sh https://github.com/SEU_USUARIO/Uru-play.git
set -e

REPO="$1"
if [ -z "$REPO" ]; then
  echo "Uso: bash publicar.sh https://github.com/SEU_USUARIO/Uru-play.git"
  exit 1
fi

cd "$(dirname "$0")"

if ! command -v git > /dev/null 2>&1; then
  echo "git não está instalado. Rode: pkg install git"
  exit 1
fi

if [ ! -d .git ]; then
  git init -b main
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git add -A

if git diff --cached --quiet; then
  echo "Nada novo para commitar."
else
  git commit -m "fase 0: esqueleto do APK e build no GitHub Actions"
fi

if git push -u origin main; then
  echo
  echo "Enviado. Abra: ${REPO%.git}/actions"
else
  echo
  echo "O GitHub recusou o envio."
  echo "Causa comum: o repositório já tem arquivos (README, licença)."
  echo "Se quiser substituir o que está lá por esta árvore:"
  echo
  echo "    git push -u --force origin main"
fi
