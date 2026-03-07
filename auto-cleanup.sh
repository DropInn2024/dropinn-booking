#!/bin/bash

##############################################
# 雫旅訂房系統 - 自動清理並上傳
##############################################

set -e  # 遇到錯誤立即停止

echo ""
echo "======================================"
echo "🧹 雫旅訂房系統 - 檔案清理"
echo "======================================"
echo ""

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CLEANED=0

# ==========================================
# Step 1: 刪除備份和舊檔案
# ==========================================
echo -e "${BLUE}[1/5] 刪除備份和舊檔案...${NC}"

FILES_TO_DELETE=(
    "calendarSync.gs.old"
    "config.gs.backup"
    "config.gs.backup.backup"
    ".clasp.json.backup"
    "dropinn-project-v2.zip"
    "dropinn-project.zip"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✅ 刪除: $file"
        CLEANED=$((CLEANED + 1))
    fi
done

if [ $CLEANED -eq 0 ]; then
    echo "  ✅ 沒有需要清理的備份檔"
fi

echo ""

# ==========================================
# Step 2: 檢查 CalendarManager 重複
# ==========================================
echo -e "${BLUE}[2/5] 檢查 CalendarManager 重複...${NC}"

# 搜尋所有宣告 CalendarManager 的 .gs 檔案
CALENDAR_FILES=$(grep -l "const CalendarManager" *.gs 2>/dev/null || true)

if [ -z "$CALENDAR_FILES" ]; then
    echo -e "${RED}  ❌ 找不到 CalendarManager 宣告！${NC}"
    echo "  請確認 calendarSync.gs 存在"
    exit 1
fi

# 計算數量
COUNT=$(echo "$CALENDAR_FILES" | wc -l | tr -d ' ')

if [ "$COUNT" -gt 1 ]; then
    echo -e "${RED}  ❌ 發現多個檔案宣告 CalendarManager：${NC}"
    echo "$CALENDAR_FILES"
    echo ""
    echo -e "${YELLOW}  請手動刪除多餘的檔案，只保留 calendarSync.gs${NC}"
    exit 1
else
    echo -e "${GREEN}  ✅ 只有 calendarSync.gs 宣告 CalendarManager${NC}"
fi

echo ""

# ==========================================
# Step 3: 確認必要檔案存在
# ==========================================
echo -e "${BLUE}[3/5] 確認必要檔案...${NC}"

REQUIRED_FILES=(
    "calendarSync.gs"
    "dataStore.js"
    "main.js"
    "setup.gs"
    "config-template.gs"
    "config.template.js"
)

MISSING=0

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo -e "  ${RED}❌ $file (缺少)${NC}"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo ""
    echo -e "${RED}缺少 $MISSING 個必要檔案！${NC}"
    exit 1
fi

echo ""

# ==========================================
# Step 4: 檢查 .claspignore
# ==========================================
echo -e "${BLUE}[4/5] 檢查 .claspignore...${NC}"

if [ ! -f ".claspignore" ]; then
    echo -e "${YELLOW}  ⚠️  .claspignore 不存在，建立中...${NC}"
    
    cat > .claspignore << 'EOF'
# 不要上傳的檔案
config.gs
config.js
*.backup
*.old
.git/**
node_modules/**
*.md
*.sh
*.zip
.DS_Store
.gitignore
package.json
package-lock.json
conflict.test.js
EOF
    
    echo "  ✅ .claspignore 已建立"
else
    # 檢查是否包含必要的排除項目
    if grep -q "config.gs" .claspignore && grep -q "config.js" .claspignore; then
        echo "  ✅ .claspignore 設定正確"
    else
        echo -e "${YELLOW}  ⚠️  .claspignore 可能不完整${NC}"
    fi
fi

echo ""

# ==========================================
# Step 5: 顯示將要上傳的檔案
# ==========================================
echo -e "${BLUE}[5/5] 將要上傳的檔案：${NC}"
echo ""

GS_FILES=$(ls -1 *.gs 2>/dev/null | grep -v "config.gs" || true)
JS_FILES=$(ls -1 *.js 2>/dev/null | grep -v "config.js\|conflict.test.js" || true)

echo "  .gs 檔案："
echo "$GS_FILES" | while read file; do
    echo "    - $file"
done

echo ""
echo "  .js 檔案："
echo "$JS_FILES" | while read file; do
    echo "    - $file"
done

echo ""

# ==========================================
# 完成提示
# ==========================================
echo "======================================"
echo "✅ 清理完成！"
echo "======================================"
echo ""
echo "接下來請執行："
echo ""
echo -e "${GREEN}  clasp push --force${NC}"
echo ""
echo "這會："
echo "  1. 刪除 GAS 上的所有舊檔案"
echo "  2. 重新上傳所有檔案"
echo "  3. 解決 CalendarManager 重複的問題"
echo ""
echo -e "${YELLOW}⚠️  注意：這不會刪除 Properties 和 Triggers${NC}"
echo ""