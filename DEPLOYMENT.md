# 雫旅訂房系統 - 部署指南

## 🚀 快速開始

### 步驟 1：設定前端

1. 複製範本：

   ```bash
   cp config.template.js config.js
   ```

2. 編輯 `config.js`，填入：
   - `API_URL`：Google Apps Script 部署後的網址
   - `RECAPTCHA_SITE_KEY`：從 https://www.google.com/recaptcha/admin 取得

3. 在 `index.html` 的 `<body>` 結束前加入：
   ```html
   <script src="config.js"></script>
   ```

### 步驟 2：設定後端

1. 複製範本：

   ```bash
   cp config-template.gs config.gs
   ```

2. 編輯 `config.gs`，填入所有真實資訊

3. 修改其他 `.gs` 檔案，把硬編碼的值改成讀取 `CONFIG`：

   ```javascript
   // 原本
   const SHEET_ID = '1a2b3c...';

   // 改成
   const SHEET_ID = CONFIG.SHEET_ID;
   ```

### 步驟 3：連結 Google 帳號（後端部署必做）

後端要上傳到 **Google Apps Script**，必須用 **clasp** 連結你的 Google 帳號：

1. 若還沒裝 clasp（需 Node.js）：
   ```bash
   npm install -g @google/clasp
   ```

2. 登入 Google 帳號（會開瀏覽器）：
   ```bash
   clasp login
   ```

3. 建立或連結專案：
   - **第一次**：在 [Google Apps Script 後台](https://script.google.com/) 新增專案，再在專案裡「專案設定」取得 **指令碼 ID**。
   - 在專案目錄建立 `.clasp.json`（此檔已在 .gitignore，不會上傳到 GitHub）：
     ```json
     { "scriptId": "你的指令碼ID" }
     ```

4. 之後要更新後端時就執行：
   ```bash
   clasp push
   clasp deploy
   ```

**會上傳到 GAS 的**：所有 `.gs`、後端用到的 `.js`（如 main.js、bookingService.js）、以及 **admin.html、housekeeping.html**（後台／房務頁由 GAS 提供）。**index.html（訂房首頁）** 目前設計是放在別的地方（例如 GitHub Pages），不從 GAS 提供。

### 步驟 4：部署

#### 部署後端（Google Apps Script）

```bash
clasp push
clasp deploy
```

部署完成後，在 GAS 後台「部署」>「新增部署」> 類型選「網頁應用程式」，取得 **部署網址**，把這個網址填進前端的 `config.js` 的 `API_URL`。

#### 部署前端（訂房首頁，例如 GitHub Pages）

```bash
git add .
git commit -m "Initial commit (safe version)"
git push
```

## 🔒 安全檢查清單

上傳前必須確認：

- [ ] `config.gs` 不在 Git 中
- [ ] `config.js` 不在 Git 中
- [ ] `.clasp.json` 不在 Git 中
- [ ] `index.html` 載入了 `config.js`
- [ ] 所有 `.gs` 檔案都改成讀取 `CONFIG`（本專案已改用 configLoader.gs + Script Properties）

驗證指令：

```bash
git status
git check-ignore -v config.gs config.js .clasp.json
```

## 🔑 後台通關碼（ADMIN_API_KEY）要去哪裡看／設？

這是登入後台用的金鑰，**要兩邊一致**才會通過：

### 後端（Google Apps Script）— 在這裡「看」或「設」值

1. 打開 [Google Apps Script](https://script.google.com/) → 進入你的訂房系統專案。
2. 左側點 **齒輪圖示「專案設定」**。
3. 捲到 **「指令碼內容」**（Script properties）。
4. 找屬性 **`ADMIN_API_KEY`**：
   - **已有**：右邊那串就是通關碼，複製起來。
   - **沒有**：按「新增指令碼內容」→ 屬性填 `ADMIN_API_KEY`，值填一組只有你知道的英文+數字 → 儲存後複製那串。

### 前端（本機）— 把「同一組字串」填進 config.js

1. 開啟專案裡的 **`config.js`**（此檔在 .gitignore，不會被上傳）。
2. 找到 **`ADMIN_API_KEY: ''`**。
3. 在引號裡貼上你在 GAS 複製的那串，例如：`ADMIN_API_KEY: '你複製的通關碼',`。
4. 存檔。之後開後台／房務頁時，前端會自動帶這組金鑰，後端比對通過才會接受。

**注意**：通關碼是機密，請勿貼到聊天室、Issue 或任何會上傳到 GitHub 的檔案（例如不要寫進 `config.template.js`）。

## ✅ 上線前最後檢查

### 本機／Git

- [ ] `git check-ignore -v config.gs config.js .clasp.json` 三個都顯示被忽略
- [ ] `config.template.js` 裡沒有真實金鑰或網址（只有 `YOUR_*_HERE` 等佔位）
- [ ] 訂房首頁的託管處（例如 GitHub Pages）有放 `config.js`，且 `index.html` 有 `<script src="config.js"></script>`

### 前端 config.js（你本機，不會上傳）

- [ ] `API_URL_PUBLIC`、`API_URL_ADMIN` 已填 GAS 部署網址
- [ ] `RECAPTCHA_SITE_KEY` 已填 reCAPTCHA 前台金鑰
- [ ] `ADMIN_API_KEY` 已填（與 GAS 指令碼內容一致）

### GAS 後端（Script Properties）

在 GAS 專案「專案設定」>「指令碼內容」確認有這些屬性（名稱須一致）：

- [ ] `SHEET_ID` — 試算表 ID
- [ ] `RECAPTCHA_SECRET` — reCAPTCHA 後台密鑰
- [ ] `ADMIN_EMAIL` — 收訂單通知的信箱
- [ ] `PUBLIC_CALENDAR_ID` — 公開日曆 ID（可選，若有用日曆）
- [ ] `HOUSEKEEPING_CALENDAR_ID` — 房務日曆 ID（可選）
- [ ] `ADMIN_API_KEY` — 後台通關碼（建議設）

### GAS 部署權限

- [ ] **Public API** 部署：「誰可以存取」建議設為「任何人」，訂房頁才能查空房、送單
- [ ] **Admin API** 部署：可設「僅限自己」或搭配 `ADMIN_API_KEY` 保護

### 程式

- [ ] `configLoader.gs` 裡 `verifyRecaptcha` 的 `TEST_MODE` 為 `false`（已設為 false 即可上線）

## 📞 問題回報

有問題請聯繫：[你的聯絡資訊]
