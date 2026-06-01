#!/usr/bin/env bash
# 依類型分包給 Gemini 做死碼／架構審查（不含圖片、node_modules）
# 用法：npm run export:gemini
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT}/_exports"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$(mktemp -d)"

mkdir -p "$OUT_DIR"

pack() {
  local label="$1"
  local dest="${STAGE}/${label}"
  mkdir -p "$dest"
  shift
  for rel in "$@"; do
    local src="${ROOT}/${rel}"
    if [[ -e "$src" ]]; then
      local parent
      parent="$(dirname "${dest}/${rel}")"
      mkdir -p "$parent"
      if [[ -d "$src" ]]; then
        rsync -a --exclude='node_modules' --exclude='.wrangler' "$src/" "${dest}/${rel}/"
      else
        cp "$src" "${dest}/${rel}"
      fi
    fi
  done
  local zip="${OUT_DIR}/gemini-review-${label}-${STAMP}.zip"
  (cd "$STAGE" && zip -rq "$zip" "$label")
  rm -rf "${STAGE}/${label}"
  echo "✓ ${zip}"
}

cat > "${STAGE}/README-GEMINI.txt" << 'EOF'
Drop Inn — Gemini 審查包說明
============================

請依壓縮檔名稱選擇領域：
- gemini-review-frontend-*   → 訂房前台 + 後台 UI（vanilla JS，無 bundler）
- gemini-review-backend-*  → Cloudflare Worker API
- gemini-review-database-* → D1 migrations / seed

審查時請注意：
1. 函式可能透過 onclick、data-action 委派、window.xxx、addEventListener 觸發，勿僅搜尋 funcName()。
2. 同一檔案內可能重複定義 function（後者覆蓋前者）。
3. 只做標記，勿自動重構。
EOF

pack "frontend" \
  "js/app.js" \
  "notforyou/app.js" \
  "notforyou/home/app.js" \
  "notforyou/home/drift-admin.js" \
  "notforyou/home/index.html" \
  "notforyou/index.html" \
  "index.html" \
  "config.public.js" \
  "css/raindrop.css" \
  "_redirects"

pack "backend" \
  "worker/src" \
  "worker/wrangler.toml" \
  "worker/package.json"

pack "database" \
  "worker/migrations" \
  "worker/seed"

cp "${STAGE}/README-GEMINI.txt" "${OUT_DIR}/gemini-review-README-${STAMP}.txt"
rm -rf "$STAGE"

echo ""
echo "說明檔：${OUT_DIR}/gemini-review-README-${STAMP}.txt"
echo "上傳三個 gemini-review-*.zip 至 Gemini 即可。"
