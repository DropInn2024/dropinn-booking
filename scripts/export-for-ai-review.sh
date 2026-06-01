#!/usr/bin/env bash
# 一鍵打包：給其他 AI 檢視用（前端 / Worker 後端 / D1 遷移 / 必要文件）
#
# 用法：
#   npm run export:ai              單一 zip
#   npm run export:ai:split        每包最多 5 個檔案，拆成多個 zip
#   bash scripts/export-for-ai-review.sh [--split N]
#
# 環境變數（可選）：
#   FILES_PER_ZIP=5   等同 --split 5
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT}/_exports"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$(mktemp -d)"
DEST="${STAGE}/dropinn-booking-system"
FILES_PER_ZIP="${EXPORT_FILES_PER_ZIP:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --split)
      FILES_PER_ZIP="${2:-5}"
      shift 2
      ;;
    --split=*)
      FILES_PER_ZIP="${1#*=}"
      shift
      ;;
    -h | --help)
      echo "用法: $0 [--split N]"
      echo "  不加參數：產生單一 zip"
      echo "  --split N：每個 zip 最多 N 個檔案（預設 N=5）"
      exit 0
      ;;
    *)
      echo "未知參數: $1（可用 --help）" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${FILES_PER_ZIP:-}" && "$FILES_PER_ZIP" == "0" ]]; then
  FILES_PER_ZIP=0
fi

mkdir -p "$OUT_DIR" "$DEST"

rsync -a \
  --exclude='.git/' \
  --exclude='.cursor/' \
  --exclude='.vscode/' \
  --exclude='node_modules/' \
  --exclude='worker/node_modules/' \
  --exclude='worker/.wrangler/' \
  --exclude='.netlify/' \
  --exclude='.claude/' \
  --exclude='_exports/' \
  --exclude='_archive_local/' \
  --exclude='_gas_archive/' \
  --exclude='mockup/' \
  --exclude='docs/_snapshots/' \
  --exclude='docs/_tour-data/' \
  --exclude='scripts/sheets-import/csv/' \
  --exclude='scripts/sheets-import/output/' \
  --exclude='雫旅同業/' \
  --exclude='雫旅客報/' \
  --exclude='歷史軌跡/' \
  --exclude='gallery/img/' \
  --exclude='website/images/' \
  --exclude='*.jpg' \
  --exclude='*.jpeg' \
  --exclude='*.png' \
  --exclude='*.webp' \
  --exclude='*.gif' \
  --exclude='*.svg' \
  --exclude='*.ico' \
  --exclude='*.pdf' \
  --exclude='*.xlsx' \
  --exclude='*.zip' \
  --exclude='*.backup' \
  --exclude='*.backup.html' \
  --exclude='.DS_Store' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.clasp.json' \
  --exclude='config.gs' \
  --exclude='config.js' \
  --exclude='backend/config.gs' \
  --exclude='frontend/config.js' \
  --exclude='_*mock*.html' \
  --exclude='_*preview*.html' \
  --exclude='worker/_cleanup_*.backup' \
  "$ROOT/" "$DEST/"

find "$DEST" -type d -empty -delete 2>/dev/null || true

FILE_COUNT="$(find "$DEST" -type f | wc -l | tr -d ' ')"
TOTAL_KB="$(du -sk "$DEST" | cut -f1)"

write_readme() {
  local target="$1"
  local split_note="${2:-}"

  cat > "$target" << EOF
# Drop Inn 專案 — AI 檢視包

產生時間：${STAMP}  
檔案數：${FILE_COUNT}  
約略大小：${TOTAL_KB} KB（未含圖片）  
${split_note}

## 架構速覽

| 區塊 | 路徑 | 說明 |
|------|------|------|
| 訂房前端 | \`index.html\`、\`js/\`、\`css/\` | 官網訂房 UI（根目錄入口） |
| 靜態頁 | \`ourpinkypromise/\`、\`howtogetlost/\`、\`handshake/\`、\`untilnexttime.html\` 等 | 約定、旅遊手冊、握手禮等 |
| 後台前端 | \`notforyou/\`、\`restoretheblank/\` | 管理後台、房務 |
| 漂流等 | \`drift/\` | 在地推薦相關 |
| Worker 後端 | \`worker/src/\` | Cloudflare Workers API |
| 資料庫 | \`worker/migrations/*.sql\`、\`worker/seed/\` | D1 schema 與種子資料 |
| 路由 | \`_redirects\`、\`404.html\` | Cloudflare Pages 語意化路徑 |
| 部署文件 | \`DEPLOYMENT.md\`、\`SECURITY.md\` | 上線與安全說明 |
| 設計 | \`dropinn-design-system.md\`、\`docs/_design-system.md\` | 視覺規範 |

## 刻意未打包（請勿要求還原）

- \`node_modules/\`、\`.git/\`、本機 \`.env\` / \`.clasp.json\` / \`config.gs\`
- \`gallery/img/\`、\`website/images/\` 等圖片 binary
- \`docs/_snapshots/\` 歷史快照、\`*_mock*.html\` 設計稿
- 同業價 / 客報等商業敏感目錄

## 建議檢視順序

1. \`DEPLOYMENT.md\` — 部署與 GAS / GitHub / Cloudflare 關係  
2. \`worker/wrangler.toml\` + \`worker/src/index.js\` — API 入口  
3. \`worker/migrations/\` — 資料表演進  
4. \`index.html\` + \`js/app.js\` — 訂房流程  
5. \`_redirects\` — 公開 URL 對應

## 給 AI 的提示

此包為**程式碼與 schema 摘要**，不含真實客戶資料。若需完整 UI 截圖或圖片資產，請另行索取。
EOF
}

copy_file_preserve_path() {
  local src="$1"
  local part_root="$2"
  local rel="${src#$DEST/}"
  local target="${part_root}/${rel}"
  mkdir -p "$(dirname "$target")"
  cp "$src" "$target"
}

if [[ "$FILES_PER_ZIP" -gt 0 ]]; then
  ALL_FILES=()
  while IFS= read -r line; do
    ALL_FILES+=("$line")
  done < <(find "$DEST" -type f | LC_ALL=C sort)
  PART_TOTAL=$(( (FILE_COUNT + FILES_PER_ZIP - 1) / FILES_PER_ZIP ))
  MANIFEST="${OUT_DIR}/dropinn-ai-review-${STAMP}-MANIFEST.txt"
  PART_PAD="${#PART_TOTAL}"

  {
    echo "Drop Inn AI 檢視包 — 拆分清單"
    echo "產生時間: ${STAMP}"
    echo "總檔案數: ${FILE_COUNT}"
    echo "每包上限: ${FILES_PER_ZIP} 個檔案"
    echo "分包數量: ${PART_TOTAL}"
    echo ""
  } > "$MANIFEST"

  echo ""
  echo "拆分模式：每包最多 ${FILES_PER_ZIP} 個檔案，共 ${PART_TOTAL} 包"
  echo ""

  part=0
  idx=0
  while [[ "$idx" -lt "$FILE_COUNT" ]]; do
    part=$((part + 1))
    part_label="$(printf "%0${PART_PAD}d" "$part")"
    part_stage="$(mktemp -d)"
    part_root="${part_stage}/dropinn-booking-system"
    mkdir -p "$part_root"
    chunk_limit="$FILES_PER_ZIP"

    if [[ "$part" -eq 1 ]]; then
      write_readme "${part_root}/AI_REVIEW_README.md" "分包模式：Part ${part}/${PART_TOTAL}（完整清單見 EXPORT_MANIFEST.txt）"
      cp "$MANIFEST" "${part_root}/EXPORT_MANIFEST.txt"
      chunk_limit=$((FILES_PER_ZIP - 2))
      [[ "$chunk_limit" -lt 1 ]] && chunk_limit=1
    fi

    chunk_end=$((idx + chunk_limit))
    [[ "$chunk_end" -gt "$FILE_COUNT" ]] && chunk_end=$FILE_COUNT

    {
      echo "=== Part ${part}/${PART_TOTAL} ==="
      echo "檔案: dropinn-ai-review-${STAMP}-part${part_label}-of${PART_TOTAL}.zip"
      echo ""
    } >> "$MANIFEST"

    chunk_count=0
    while [[ "$idx" -lt "$chunk_end" ]]; do
      src="${ALL_FILES[$idx]}"
      rel="${src#$DEST/}"
      copy_file_preserve_path "$src" "$part_root"
      echo "  ${rel}" >> "$MANIFEST"
      idx=$((idx + 1))
      chunk_count=$((chunk_count + 1))
    done

    zip_path="${OUT_DIR}/dropinn-ai-review-${STAMP}-part${part_label}-of${PART_TOTAL}.zip"
    part_files="$(find "$part_root" -type f | wc -l | tr -d ' ')"
    (
      cd "$part_stage"
      zip -rq "$zip_path" dropinn-booking-system
    )
    rm -rf "$part_stage"

    zip_kb="$(du -sk "$zip_path" | cut -f1)"
    echo "✓ Part ${part}/${PART_TOTAL}  ${part_files} 個檔案  ~${zip_kb} KB"
    echo "  ${zip_path}"
    echo "" >> "$MANIFEST"
  done

  echo ""
  echo "清單：${MANIFEST}"
  echo "共 ${PART_TOTAL} 個 zip，上傳時請依 part 順序或一次全給 AI。"
  echo ""
else
  write_readme "${DEST}/AI_REVIEW_README.md" ""
  ZIP="${OUT_DIR}/dropinn-ai-review-${STAMP}.zip"
  (
    cd "$STAGE"
    zip -rq "$ZIP" dropinn-booking-system
  )
  echo ""
  echo "✓ 已產生：${ZIP}"
  echo "  檔案數：${FILE_COUNT}  │  約 ${TOTAL_KB} KB"
  echo "  上傳此 zip 給其他 AI 即可（內含 AI_REVIEW_README.md）"
  echo ""
fi

rm -rf "$STAGE"
