#!/bin/bash

##############################################
# 雫旅訂房系統 - 安全檢查腳本
# 
# 功能：
# 1. 檢查機密資訊是否外洩
# 2. 驗證 .gitignore 設定
# 3. 檢查 Git 狀態
# 4. 掃描硬編碼的機密
##############################################

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 計數器
ERRORS=0
WARNINGS=0
PASSED=0

echo ""
echo "======================================"
echo "🔒 雫旅訂房系統 - 安全檢查"
echo "======================================"
echo ""

##############################################
# 檢查 1: Git 狀態
##############################################
echo "📋 檢查 1: Git 狀態"
echo "--------------------------------------"

# 檢查是否在 Git 倉庫中
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠️  不在 Git 倉庫中${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    # 檢查 config.js 是否被追蹤
    if git ls-files --error-unmatch config.js > /dev/null 2>&1; then
        echo -e "${RED}❌ config.js 被 Git 追蹤！${NC}"
        echo "   修復方法：git rm --cached config.js"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ config.js 未被 Git 追蹤${NC}"
        PASSED=$((PASSED + 1))
    fi
    
    # 檢查 config.gs 是否被追蹤
    if git ls-files --error-unmatch config.gs > /dev/null 2>&1; then
        echo -e "${RED}❌ config.gs 被 Git 追蹤！${NC}"
        echo "   修復方法：git rm --cached config.gs"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ config.gs 未被 Git 追蹤${NC}"
        PASSED=$((PASSED + 1))
    fi
    
    # 檢查 .clasp.json 是否被追蹤
    if git ls-files --error-unmatch .clasp.json > /dev/null 2>&1; then
        echo -e "${RED}❌ .clasp.json 被 Git 追蹤！${NC}"
        echo "   修復方法：git rm --cached .clasp.json"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ .clasp.json 未被 Git 追蹤${NC}"
        PASSED=$((PASSED + 1))
    fi
fi

echo ""

##############################################
# 檢查 2: .gitignore 設定
##############################################
echo "📋 檢查 2: .gitignore 設定"
echo "--------------------------------------"

if [ ! -f .gitignore ]; then
    echo -e "${RED}❌ .gitignore 不存在！${NC}"
    ERRORS=$((ERRORS + 1))
else
    # 檢查必要的排除項目
    declare -a required=("config.js" "config.gs" ".clasp.json" "*.backup")
    
    for item in "${required[@]}"; do
        if grep -q "$item" .gitignore; then
            echo -e "${GREEN}✅ .gitignore 包含：$item${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}❌ .gitignore 缺少：$item${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

echo ""

##############################################
# 檢查 3: 掃描硬編碼的機密資訊
##############################################
echo "📋 檢查 3: 掃描硬編碼的機密資訊"
echo "--------------------------------------"

# 定義要排除的檔案
EXCLUDE_FILES="config.js|config.gs|.*backup.*|node_modules"

# 掃描 GAS API URL
echo "🔍 掃描 GAS API URL..."
GAS_URLS=$(grep -r "script.google.com/macros/s/AKfycb" --include="*.html" --include="*.js" --include="*.gs" . 2>/dev/null | grep -Ev "$EXCLUDE_FILES")

if [ -n "$GAS_URLS" ]; then
    echo -e "${RED}❌ 發現硬編碼的 GAS API URL！${NC}"
    echo "$GAS_URLS"
    echo ""
    echo "   ⚠️  這些 URL 應該只存在於 config.js 中"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 未發現硬編碼的 GAS API URL${NC}"
    PASSED=$((PASSED + 1))
fi

# 掃描 reCAPTCHA Key
echo "🔍 掃描 reCAPTCHA Key..."
RECAPTCHA_KEYS=$(grep -r "6Ld[a-zA-Z0-9_-]*AAAA" --include="*.html" --include="*.js" --include="*.gs" . 2>/dev/null | grep -Ev "$EXCLUDE_FILES")

if [ -n "$RECAPTCHA_KEYS" ]; then
    echo -e "${YELLOW}⚠️  發現 reCAPTCHA Site Key（前端可見，屬正常）${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ 未發現 reCAPTCHA Key${NC}"
    PASSED=$((PASSED + 1))
fi

# 掃描 Calendar ID
echo "🔍 掃描 Calendar ID..."
CALENDAR_IDS=$(grep -r "@group.calendar.google.com" --include="*.js" --include="*.gs" . 2>/dev/null | grep -Ev "$EXCLUDE_FILES")

if [ -n "$CALENDAR_IDS" ]; then
    echo -e "${RED}❌ 發現硬編碼的 Calendar ID！${NC}"
    echo "$CALENDAR_IDS"
    echo ""
    echo "   ⚠️  Calendar ID 應該存在 Properties Service 中"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 未發現硬編碼的 Calendar ID${NC}"
    PASSED=$((PASSED + 1))
fi

echo ""

##############################################
# 檢查 4: 檔案存在性
##############################################
echo "📋 檢查 4: 必要檔案"
echo "--------------------------------------"

# 檢查範本檔案是否存在
if [ -f "config-template.gs" ]; then
    echo -e "${GREEN}✅ config-template.gs 存在${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ config-template.gs 不存在！${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "config.template.js" ]; then
    echo -e "${GREEN}✅ config.template.js 存在${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ config.template.js 不存在！${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 檢查真實設定檔是否存在（但不應上傳）
if [ -f "config.js" ]; then
    echo -e "${GREEN}✅ config.js 存在（本地使用）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  config.js 不存在（可能尚未設定）${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "config.gs" ]; then
    echo -e "${GREEN}✅ config.gs 存在（本地使用）${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  config.gs 不存在（可能尚未設定）${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

##############################################
# 檢查 5: .claspignore 設定
##############################################
echo "📋 檢查 5: .claspignore 設定"
echo "--------------------------------------"

if [ ! -f .claspignore ]; then
    echo -e "${YELLOW}⚠️  .claspignore 不存在${NC}"
    echo "   建議建立 .claspignore 避免上傳機密到 GAS"
    WARNINGS=$((WARNINGS + 1))
else
    # 檢查是否排除 config.js 和 config.gs
    if grep -q "config.js" .claspignore && grep -q "config.gs" .claspignore; then
        echo -e "${GREEN}✅ .claspignore 已設定排除 config 檔案${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  .claspignore 未完整設定${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

##############################################
# 檢查 6: config.js 內容檢查（如果存在）
##############################################
if [ -f "config.js" ]; then
    echo "📋 檢查 6: config.js 內容"
    echo "--------------------------------------"
    
    # 檢查是否有真實的 API URL
    if grep -q "script.google.com/macros/s/AKfycb" config.js; then
        echo -e "${YELLOW}⚠️  config.js 包含真實 API URL（正常，但不應上傳）${NC}"
        WARNINGS=$((WARNINGS + 1))
        
        # 再次確認沒有被 Git 追蹤
        if git ls-files --error-unmatch config.js > /dev/null 2>&1; then
            echo -e "${RED}   ❌ 但是這個檔案被 Git 追蹤了！危險！${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    echo ""
fi

##############################################
# 總結報告
##############################################
echo "======================================"
echo "📊 檢查總結"
echo "======================================"
echo ""
echo -e "${GREEN}✅ 通過：$PASSED 項${NC}"
echo -e "${YELLOW}⚠️  警告：$WARNINGS 項${NC}"
echo -e "${RED}❌ 錯誤：$ERRORS 項${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}🚨 發現嚴重問題！請立即修復！${NC}"
    echo ""
    echo "📚 修復指南："
    echo "1. 查看上方錯誤訊息"
    echo "2. 參考 SECURITY_CHECKLIST.md"
    echo "3. 執行建議的修復指令"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  有警告項目，建議檢查${NC}"
    echo ""
    exit 0
else
    echo -e "${GREEN}🎉 所有檢查通過！專案安全性良好！${NC}"
    echo ""
    exit 0
fi