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

#### 分享後台／房務網址（不需另設網址）

後台與房務頁由 **GAS 直接提供**，設定會自動注入，**不需要自訂網域**。把下面兩個連結分享給管理員／房務即可：

- **後台**：`你的 Admin API 部署網址?page=admin`  
  例：`https://script.google.com/macros/s/你的Admin部署ID/exec?page=admin`
- **房務**：`你的 Admin API 部署網址?page=housekeeping`  
  例：`https://script.google.com/macros/s/你的Admin部署ID/exec?page=housekeeping`

在 GAS「管理部署作業」裡複製 **Admin API** 的「網頁應用程式」網址，後面加上 `?page=admin` 或 `?page=housekeeping` 就是可分享的連結。

**為什麼要兩個 API（Public / Admin）？**

- **Public API**：給**訂房首頁**用（客人查空房、送出訂單）。部署設為「任何人」才能讓 GitHub Pages 上的訂房頁順利打 API。
- **Admin API**：給**後台／房務頁**用（管理員看訂單、日曆）。分開的好處是：訂房流量與管理操作分開；權限可單獨設（見下方「後台一直載入」）。

**後台或房務頁一直載入、轉圈？**

多半是 **Admin API 部署**的「誰可以存取」設成**僅限自己**，導致頁面裡的 JavaScript 打 `getAllOrders` / `getCalendarStats` 時被擋或拿到登入頁而非 JSON，畫面就卡住。

- **作法**：在 GAS「管理部署作業」點開 **Admin API** 部署 → 編輯 → **誰可以存取**改為 **「任何人」** → 儲存。  
  安全靠 **ADMIN_API_KEY**（沒帶正確金鑰的請求會回「未授權」），不必靠「僅限自己」。
- 若仍卡住：用瀏覽器 **F12 → Console / 網路** 看是否有紅色錯誤或 API 請求失敗，把錯誤訊息記下再排查。

#### 部署前端（訂房首頁，例如 GitHub Pages）

```bash
git add .
git commit -m "Initial commit (safe version)"
git push
```

---

## 📋 日常上傳流程（改完程式後要做的）

本專案有 **兩個要更新的地方**：GitHub（程式碼＋訂房首頁）與 GAS（後台／房務／API）。改完程式依下面做。

### 1. 上傳到 GitHub（SSH，此專案用 DropInn2024）

此 repo 已設定用 **SSH** 推送到 `DropInn2024/dropinn-booking`，不需要每次輸入 token。

```bash
cd /Users/hsueh/Documents/GitHub/dropinn-booking-system   # 或你的專案路徑
git add .
git commit -m "簡短說明你改了什麼"
git push
```

- 若訂房首頁用 **GitHub Pages**，push 完後網站會自動更新（或等一兩分鐘）。
- **注意**：若你同時有另一個 GitHub 帳號（例如 Hsueh0706）的專案，此專案已用 `~/.ssh/config` 的 `github.com-dropinn` 對應 DropInn2024 金鑰，不要改 remote 成 `github.com`，否則會推到錯的帳號。

### 2. 上傳到 GAS（後台、房務、API 才會更新）

只要改過 **後端或後台／房務頁**（例如 `main.js`、`admin.html`、`housekeeping.html`、`.gs` 等），都要再推送到 GAS，部署的網址才會跑新程式。

```bash
clasp push
```

- 若 GAS 部署時選的是「**標題**」或「**新版本**」，push 完通常就生效。
- 若部署是綁定某個「**版本**」，要到 GAS「部署」→「管理部署作業」→ 編輯該部署 → 版本改選「新版本」→ 儲存，新程式才會上線。

**只改訂房首頁（index.html / config.public.js）且用 GitHub Pages 託管時**：只做步驟 1 即可，不必 `clasp push`。

---

## 🔐 Admin 部署「僅限自己」vs「任何人」

| 設定 | 優點 | 風險／注意 |
|------|------|------------|
| **僅限自己** | 只有登入「部署用的 Google 帳號」的人能打開後台／房務頁；連結外流也沒人打得開。 | 家人或別台裝置沒登入該帳號就看不到；若只有你會用後台，建議改回這個。 |
| **任何人** | 知道連結就能開，不用登入 Google，方便分享給家人看訂房一覽。 | 連結若外流，別人也能開後台（訂單一覽、日曆管理）。安全靠「不把網址給外人」＋可選的 ADMIN_API_KEY。 |

**建議：**

- **只有你自己會開後台**：在 GAS「管理部署作業」→ Admin API → 編輯 → **誰可以存取**改回 **「僅限自己」**。你本機要開時用同一個 Google 帳號登入瀏覽器即可。
- **要給家人看訂房一覽（不給他們你的 Google 帳號）**：維持 **「任何人」**，但**不要把後台網址貼到公開場合**，也不要傳給不信任的人；可考慮只把連結放在自己手機或信任裝置的書籤。

**為何「僅限自己」還是會擋住我？**

GAS 網頁應用程式在「僅限自己」時，**第一次**打開網址會驗證你的 Google 登入並給你 HTML；但同一頁裡的 JavaScript 用 `fetch` 再打同一個網址（例如 `?action=getAllOrders`）時，這**第二次請求**有時不會被當成同一個人，GAS 就回傳登入頁或 403，後台就卡在「載入訂單失敗」。這是 GAS 的設計限制，不是網址或帳號設錯。因此實務上建議 **Admin 部署維持「任何人」**，安全改由「不把後台網址外流」＋可選的 ADMIN_API_KEY 來控管。

---

## 🌐 網址一覽（GitHub Pages + 轉址）

若你已開啟 **GitHub Pages**（repo 的 Settings → Pages → 來源選 main），則可用下面網址。請把 `dropinn2024`、`dropinn-booking` 換成你的 **GitHub 帳號**（小寫）與 **repo 名稱**（若不同）。

| 用途 | 網址 |
|------|------|
| **訂房首頁** | `https://dropinn2024.github.io/dropinn-booking/` |
| **後台（轉址）** | `https://dropinn2024.github.io/dropinn-booking/admin/` |
| **房務（轉址）** | `https://dropinn2024.github.io/dropinn-booking/housekeeping/` |

- 首頁：直接對應 repo 根目錄的 `index.html`。
- 後台／房務：會開啟 `admin/index.html`、`housekeeping/index.html`，**自動跳轉**到你的 GAS 後台／房務頁。  
- **第一次使用轉址前**：請編輯專案根目錄的 **`redirect-config.js`**，把 `YOUR_DEPLOYMENT_ID` 換成你 GAS「管理部署作業」裡 **Admin 部署** 的網址中間那段 ID（`https://script.google.com/macros/s/這裡是ID/exec`），存檔後 `git push`，轉址才會跳到正確的 GAS。

**未來買網域／空間的話？**

- **目前用 GitHub Pages 就夠用**：訂房首頁流量不大時，免費、穩定，且程式碼與網站同一個 repo 好維護。
- **之後若買網域**：可把網域指向 GitHub Pages（在 repo Settings → Pages 可綁定自訂網域），不用換主機，首頁網址就變成例如 `https://www.你的網域.com`；後台／房務轉址仍可繼續用 GitHub 的 `/admin/`、`/housekeeping/`，或改為用同一網域下的路徑（例如 `https://www.你的網域.com/admin/`）再導向 GAS。不一定要買虛擬主機，除非你有其他需求（例如要用 PHP、資料庫等）。

---

## 📌 GitHub 與 GAS 對應確認（避免連錯專案）

- **GitHub**（repo：`dropinn-booking-system`）= 程式碼庫。訂房首頁若用 GitHub Pages，就是從這裡發布。
- **GAS**（Google Apps Script）= 實際跑的後端。**同一個 GAS 專案**會同時提供：公開 API（給首頁訂房）、Admin API（給後台／房務頁）。
- **對應關係**：本機專案目錄裡的 `.clasp.json` 有一個 **scriptId**。`clasp push` 會把程式推送到「那個 scriptId 的 GAS 專案」。所以：**你現在編輯的這個 repo + 你本機的 .clasp.json = 某一個 GAS 專案**。

**如何確認「雫旅的 GAS 專案」是對的那一個？**

1. 看本機 `.clasp.json` 的 `scriptId`（例如：`1sogL2gUjS3uRj7X...`）。
2. 打開 [script.google.com](https://script.google.com)，在「我的專案」裡找到**專案網址含有這個 scriptId** 的那一個（或執行 `clasp open` 會直接打開該專案）。
3. 確認那個 GAS 專案的名稱／試算表是你預期的「雫旅」用的，且「部署」裡的網址就是你在首頁 config 用的 API 網址。

首頁能正常訂房代表：**公開 API 的部署與網址是對的**。後台載入訂單失敗通常是同一支 GAS 的 **Admin 部署網址** 或 **開啟方式**（要用 `?page=admin`）問題，而不是「連到另一個帳號的 GAS」。

---

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
