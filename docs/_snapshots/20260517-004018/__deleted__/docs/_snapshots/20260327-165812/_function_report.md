# 雫旅 Drop Inn — 後台功能串接稽核報告
> 掃描日期：2026-03-27　　方式：靜態程式碼邏輯分析

---

## 目錄
1. [公開訂房流程 website/index.html](#1-公開訂房流程-websiteindexhtml)
2. [同業登入 handshake/login/index.html](#2-同業登入-handshakeloginindexhtml)
3. [同業後台 handshake/dashboard/index.html](#3-同業後台-handshakedashboardindexhtml)
4. [後台登入 notforyou/index.html](#4-後台登入-notforyouindexhtml)
5. [後台主頁 notforyou/home/index.html](#5-後台主頁-notforyouhomeindexhtml)
6. [房務頁 restoretheblank.html](#6-房務頁-restorethecblankhtml)
7. [config.public.js](#7-configpublicjs)
8. [總結與待修清單](#總結與待修清單)

---

## 1. 公開訂房流程 `website/index.html`

### ⚠️ 重大問題：`config.public.js` 未載入
`index.html`（根目錄，Cloudflare 實際服務的檔案）與 `website/index.html` 的 `<head>` 中**均無** `<script src="/config.public.js">` 標籤。
→ `FRONTEND_CONFIG` 為 `undefined`，所有 API 呼叫的 `apiUrl` 均為空字串，函式在 `if (!apiUrl) return` 直接結束。
→ **日曆上的已訂日期在正式環境中完全無法顯示。**

---

| 項目 | 現況 | 結論 |
|------|------|------|
| `getBookedDates` 是否呼叫 | `fetchBookedDates()` 在頁面載入時呼叫，使用 `GET ?action=getBookedDates`，並將結果填入 `bookedDates[]` / `pendingDates[]` 陣列，再呼叫 `renderCalendar()` | ⚠️ 邏輯正確，但因 `config.public.js` 未載入，**實際上不會執行** |
| `checkAvailability` 是否呼叫 | 未定義、未呼叫。選取日期只做前端檢查（兩晚最低限制、已訂日期衝突判斷） | ❌ 未串接 |
| `createBooking` 是否呼叫 | `submitBooking()` 驗證姓名 + 電話 + 日期後，用 `setTimeout` 顯示「預約申請已送出」畫面。**完全沒有 fetch / API 呼叫，資料不會送到後端** | ❌ 未串接（目前為假送出） |
| reCAPTCHA 驗證 | `config.public.js` 有 `RECAPTCHA_SITE_KEY`，但 HTML 中無 `<script src="recaptcha/api.js">`，且程式碼中無任何 `grecaptcha.execute()` 或 `grecaptcha.getResponse()` 呼叫 | ❌ 未串接 |
| `checkCoupon` 優惠碼驗證 | 表單有 `id="couponCode"` 輸入框，但無對應的 API 呼叫或驗證邏輯 | ❌ 未串接 |

---

## 2. 同業登入 `handshake/login/index.html`

✅ 正確載入 `/config.public.js`

| 項目 | 現況 | 結論 |
|------|------|------|
| `agencyLogin` 是否呼叫 | `fetch(API_URL, { body: JSON.stringify({ action: 'agencyLogin', loginId, password }) })` 在登入按鈕點擊後呼叫 | ✅ |
| `agencyRegister` 是否呼叫 | `fetch(API_URL, { body: JSON.stringify({ action: 'agencyRegister', loginId, password, displayName }) })` 在註冊送出時呼叫 | ✅ |
| `pending` 狀態處理 | `if (data.pending === true)` → 顯示「申請仍在審核中，請稍候通知」 | ✅ |
| `rejected` 狀態處理 | `if (data.rejected === true)` → 顯示「申請未通過，請聯絡雫旅」 | ✅ |
| 登入成功後跳轉 | `data.success` → `sessionStorage.setItem('agency_token', data.token)` → `window.location.replace('/handshake/dashboard')` | ✅ |

---

## 3. 同業後台 `handshake/dashboard/index.html`

✅ 正確載入 `/config.public.js`
Token 傳遞方式：`{ action, token: sessionStorage.getItem('agency_token'), ...params }`
無 token 時自動導向 `/handshake/login`

| 項目 | 現況 | 結論 |
|------|------|------|
| `agencyGetProperties` | `initYou()` 啟動時呼叫，取得棟別清單填入下拉選單 | ✅ |
| `agencyGetBlocks` | 切換棟別時呼叫 `loadYouBlocks(propId)`，取得封鎖日期 | ✅ |
| `agencySetBlock` | 選取日期後按 FAB「封鎖」或「解封」按鈕，逐一呼叫 | ✅ |
| `agencyGetPartnerCalendar`（& 視角）| `initAnd()` 啟動時呼叫，資料緩存於 `andData`。顯示合作民宿可包棟狀況 | ✅ |
| `agencyGetPartnerCalendar`（ME 視角）| `initMe()` 呼叫**同一個** action，從回傳的 `shizukuBooked` / `shizukuPending` 提取雫旅訂房資料 | ✅ |
| `agencyGetAllBlocks` | **此 action 名稱在前端完全未使用**。ME 視角改用 `agencyGetPartnerCalendar` 的子集 | ⚠️ 前端未呼叫此名稱，但功能由 `agencyGetPartnerCalendar` 涵蓋 |
| token 傳入 | 每次 `apiPost(action, params)` 均自動帶入 `token` | ✅ |

---

## 4. 後台登入 `notforyou/index.html`

✅ 正確載入 `/config.public.js`

| 項目 | 現況 | 結論 |
|------|------|------|
| `adminLogin` 是否呼叫 | `fetch(API_URL, { body: JSON.stringify({ action: 'adminLogin', loginId, password }) })` | ✅ |
| 登入成功後 token 存入 sessionStorage | `sessionStorage.setItem('admin_key', data.token)` | ✅ |
| 跳轉到 `/notforyou/home` | `window.location.replace('/notforyou/home')` | ✅ |
| 已有 token 自動跳轉 | 頁面載入時若 `admin_key` 已存在，直接跳轉 | ✅ |

---

## 5. 後台主頁 `notforyou/home/index.html`

✅ 正確載入 `/config.public.js`
Token 傳遞方式：所有請求透過 `_callPostWithAdminRetry_(action, payload)` → body 加入 `adminKey: sessionStorage.getItem('admin_key')`。Token 過期時自動重讀 sessionStorage 重試一次。

| 項目 | 現況 | 結論 |
|------|------|------|
| `getAllOrders` | `adminGetAllOrders()` → action `getAllOrders`，頁面載入後呼叫 | ✅ |
| `updateOrderAndSync` | 儲存訂單編輯時呼叫，傳入 `{ orderID, updates }` | ✅ |
| `getFinanceStats` | 財務面板切換時呼叫，傳入 `{ year, month }` | ✅ |
| `agencyGetPendingList` | 切換到「待審同業」面板時呼叫 | ✅ |
| `agencyApprove` | 每筆待審記錄有「核准」按鈕，呼叫 `agencyApprove({ targetLoginId })` | ✅ |
| `agencyReject` | 每筆待審記錄有「拒絕」按鈕，呼叫 `agencyReject({ targetLoginId })` | ✅ |
| `agencyGroupList` | 切換到「合作群組」面板時呼叫 | ✅ |
| `agencyGroupCreate` | 新增群組表單送出時呼叫 | ✅ |
| `agencyGroupAddMember` | 新增群組成員時呼叫 | ✅ |
| `agencyGroupRemoveMember` | 移除群組成員時呼叫 | ✅ |
| `agencyGetAllBlocks`（ME 視角）| **此 action 名稱在前端未使用**。同業日曆面板改呼叫 `adminGetAllAgencyData`，取得所有同業+棟別+封鎖資料 | ⚠️ 功能存在但 action 名稱不同 |
| admin token 傳入每個呼叫 | 透過 `_callPostWithAdminRetry_` 統一帶入，且有 retry 機制 | ✅ |

---

## 6. 房務頁 `restoretheblank.html`

✅ 正確載入 `/config.public.js`

| 項目 | 現況 | 結論 |
|------|------|------|
| 是否呼叫 GAS 取得清潔資料 | ✅ 使用 `google.script.run.adminGetAllOrders()` | ✅ |
| GAS 環境呼叫方式 | 偵測到 `google.script.run` 存在時使用原生 GAS 呼叫 | ✅ |
| 靜態站 fallback | `google.script.run` 不存在時，自動切換為 `fetch(API_URL_ADMIN, { body: { action: 'getAllOrders', adminKey } })` | ✅ |
| 呼叫的 action 名稱 | **`getAllOrders`**（透過 `adminGetAllOrders()` 方法包裝） | ✅ |
| 資料過濾邏輯 | 篩選 `status === '洽談中'` 或 `status === '已付訂'`，以今日為基準計算退房清潔任務 | ✅ |

---

## 7. `config.public.js`

| 項目 | 目前值 | 結論 |
|------|--------|------|
| `API_URL_PUBLIC` | `https://script.google.com/macros/s/AKfyc...VmAofXTRF9YCyQ/exec`（與 `API_URL` 相同）| ✅ |
| `API_URL_ADMIN` | `https://script.google.com/macros/s/AKfyc...6ILw8w/exec`（獨立 admin 部署）| ✅ |
| `RECAPTCHA_SITE_KEY` | `6LdTR2wsAAAAAI9fy5CuyD42lZ6hGk4ed0bJbqIW` | ✅ 有值，但前端未使用 |
| 前端讀取設定檔 | `<script src="/config.public.js">` 有載入的頁面：`handshake/login`、`handshake/dashboard`、`notforyou/index`、`notforyou/home`、`restoretheblank` | ✅ |
| ❌ **未載入的頁面** | `index.html`（根目錄）、`website/index.html`，導致訂房首頁 API 呼叫全部失效 | ❌ |

---

## 總結與待修清單

### ❌ 必須修復（影響核心功能）

| # | 檔案 | 問題 | 修正方式 |
|---|------|------|---------|
| 1 | `index.html` + `website/index.html` | **未載入 `config.public.js`**，`FRONTEND_CONFIG` 為 undefined，`fetchBookedDates()` 直接 return，日曆上的已訂日期完全不顯示 | 在兩個檔案的 `<head>` 加入 `<script src="/config.public.js"></script>` |
| 2 | `website/index.html` | `submitBooking()` 為假送出，只顯示感謝畫面，**資料完全不傳到後端** | 實作 `createBooking` API 呼叫，送出 `{ action: 'createBooking', name, phone, checkIn, checkOut, ... }` |

### ⚠️ 建議補完（功能缺口）

| # | 檔案 | 問題 | 建議 |
|---|------|------|------|
| 3 | `website/index.html` | `checkAvailability` 未實作，選日期時不會即時驗證後端是否還有空 | 在選擇日期後呼叫 `?action=checkAvailability&checkIn=...&checkOut=...` |
| 4 | `website/index.html` | `checkCoupon` 未實作，優惠碼輸入框是裝飾性的 | 在 `submitBooking()` 前加入優惠碼驗證邏輯 |
| 5 | `website/index.html` | reCAPTCHA 未串接，`RECAPTCHA_SITE_KEY` 有設定但未使用 | 載入 reCAPTCHA v3 script，在 `submitBooking()` 呼叫 `grecaptcha.execute()` 取得 token，一併送出 |

### ℹ️ 命名差異說明（非 bug，但需知道對應關係）

| 報告中的名稱 | 前端實際呼叫的 action | 說明 |
|-------------|---------------------|------|
| `agencyGetAllBlocks` | `agencyGetPartnerCalendar`（dashboard）/ `adminGetAllAgencyData`（home）| dashboard ME 視角 + 管理後台的同業日曆均已涵蓋此功能，但 action 名稱不同 |
| `createBooking` | — | 前端 `submitBooking()` 尚未實作 API 呼叫 |
