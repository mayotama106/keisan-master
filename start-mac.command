#!/bin/bash
# めざせ、計算マスター！ — macOS ワンクリック起動
# ダブルクリックするとローカルサーバーを立ち上げ、ブラウザでアプリを開きます。
cd "$(dirname "$0")" || exit 1

PORT=8000
# 使用中なら空きポートを探す
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done

URL="http://localhost:$PORT/index.html"
echo "めざせ、計算マスター！ を起動します..."
echo "URL: $URL"
echo "（このウィンドウを閉じると終了します）"

# 1秒後にブラウザを開く
( sleep 1; open "$URL" ) &

# Python の簡易サーバーを起動
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer "$PORT"
else
  echo "Python が見つかりませんでした。代わりに index.html を直接開きます。"
  open "index.html"
fi
