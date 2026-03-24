# 安全說明

## 🔐 機密檔案

以下檔案包含機密資訊，**絕對不能上傳到 GitHub**：

- `config.gs` - 後端設定（Sheet ID, Calendar ID, reCAPTCHA Secret）
- `config.js` - 前端設定（API URL, reCAPTCHA Site Key）
- `.clasp.json` - Clasp 設定（Script ID）
- `*.backup` - 備份檔案

這些檔案已加入 `.gitignore`。

## 📋 檔案用途

### 可以上傳的檔案

- `config-template.gs` - 後端設定範本（公開）
- `config.template.js` - 前端設定範本（公開）
- 所有其他 `.gs`, `.js`, `.html` 檔案（不含機密資訊）

### 不能上傳的檔案

- `config.gs` - 包含真實機密資訊
- `config.js` - 包含真實機密資訊
- `.clasp.json` - 包含 Script ID

## ✅ 驗證方法

```bash
# 確認機密檔案被忽略
git check-ignore -v config.gs config.js .clasp.json

# 查看將要上傳的檔案
git status

# 確認沒有機密檔案被追蹤
git ls-files | grep -E "config\.gs|config\.js|\.clasp"
```

## 🚨 如果不小心上傳了機密

1. **立即刪除 Repository**
2. **更換所有金鑰**：
   - 重新申請 reCAPTCHA
   - 重新部署 GAS（產生新的 Script ID）
3. **按照本文件重新設定**
