#!/bin/bash

##############################################
#
# 雫旅訂房系統 - 專案壓縮工具
# 可複用在任何專案目錄下使用
# 只會排除「版本控管、依賴套件、機密設定、現有 zip」
#
# ❌ 一律不打包（避免外流或檔案太大）
# - .git/           ：Git 版本歷史
# - node_modules/   ：依賴套件，體積過大，Claude 不需要
# - *.zip           ：舊的壓縮檔，避免嵌套
# - *.old / *.backup：暫存備份
# - .env / .env.*   ：環境變數與機密設定
# - config.js       ：專案機密設定（含 API 金鑰等）
# - config.local.js / config.secret.js：各種本機／機密 config
# - config.gs       ：GAS 專案本地設定（含 SHEET_ID 等）
# - .clasp.json     ：GAS 專案綁定資訊（scriptId）
# - *.pem / *.key / *.p12：金鑰與憑證檔
#
# ✅ 其餘所有原始碼、HTML、文件、rules、腳本都會被打包
#
##############################################

echo "📦 開始壓縮專案..."
echo ""

# 顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 生成時間戳記
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="dropinn-project_${TIMESTAMP}.zip"

# 壓縮專案（排除不必要與機密檔案）
zip -r "$FILENAME" . \
  -x "*.DS_Store" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "*.zip" \
  -x "*.old" \
  -x "*.backup" \
  -x ".env" \
  -x ".env.*" \
  -x "config.js" \
  -x "config.local.js" \
  -x "config.secret.js" \
  -x "config.gs" \
  -x ".clasp.json" \
  -x "*.pem" \
  -x "*.key" \
  -x "*.p12"

# 檢查壓縮結果
if [ -f "$FILENAME" ]; then
    SIZE=$(du -h "$FILENAME" | cut -f1)
    echo ""
    echo -e "${GREEN}✅ 壓縮完成！${NC}"
    echo ""
    echo -e "${BLUE}檔案名稱：${NC}$FILENAME"
    echo -e "${BLUE}檔案大小：${NC}$SIZE"
    echo ""
    echo "📍 檔案位置："
    echo "   $(pwd)/$FILENAME"
    echo ""
    echo "📋 壓縮內容："
    unzip -l "$FILENAME" | head -20
    echo "   ..."
    echo ""
    echo "🎯 下一步："
    echo "   1. 上傳到雲端或傳給 Claude"
    echo "   2. 與 Claude 對話時附上這個檔案"
    echo ""
else
    echo "❌ 壓縮失敗"
    exit 1
fi
