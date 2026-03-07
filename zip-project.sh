#!/bin/bash

##############################################
# 雫旅訂房系統 - 專案壓縮工具
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

# 壓縮專案（排除不必要的檔案）
zip -r "$FILENAME" . \
  -x "*.DS_Store" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "*.zip" \
  -x "*.old" \
  -x "*.backup" \
  -x ".clasp.json" \
  -x "config.gs" \
  -x "config.js"

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
