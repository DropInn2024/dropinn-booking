# Google Apps Script 腳本功能與使用說明

專案部署到 GAS 後，可在 **指令碼編輯器** 上方選「函式」下拉選單執行，或由網頁／觸發器自動呼叫。以下依用途分類。

---

## 一、對外 API（由網頁呼叫，不要手動執行）

| 觸發方式      | 說明                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| **doGet(e)**  | 訂房首頁／後台／房務頁載入、查空房、取得已訂日期等，用 **GET** 請求時會執行。 |
| **doPost(e)** | 送出訂單、後台儲存訂單、日曆管理、發送通知等，用 **POST** 請求時會執行。      |

平常由「訂房網頁」與「後台／房務頁」的 `fetch` 呼叫，**不需要**在編輯器裡選這兩個執行。

---

## 二、日常使用：系統設定與初始化

在編輯器選函式 → **執行**。

| 函式                             | 檔案                | 用途                                                                                        | 使用時機                             |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| **setupSystem()**                | setup.js            | 日常初始化：檢查 Properties、日曆連線、**建立／補齊今年訂單表**（呼叫 initializeYearSheet）、設定自動清理觸發器、訂單狀態統一 | 每次部署後跑一次，或換試算表／日曆後 |
| **runStatusMigration()**         | setup.js            | 試算表狀態統一：已付訂/已預訂/已成立→預定中，退房日已過→已完成                              | 想單獨重跑狀態統一時                 |
| **initializeYearSheet(year)**    | setup.js | **統一用此函式**：建立指定年份的訂單表（不傳參數＝今年）；若表已存在則自動補齊缺少的欄位 | 建表或補欄時執行，例如 `initializeYearSheet()` 今年、`initializeYearSheet(2024)` 指定年 |
| **initializeMultipleYears()**    | setup.js | 預先建立 2026～2028 的訂單表                                                                | 想預建未來幾年表時                   |
| **checkYearSheets()**            | setup.js | 列出試算表內所有工作表名稱與列數                                                            | 檢查目前有哪些訂單表                 |

---

## 三、第一次使用（會建立新日曆）

**只在第一次部署、且要讓系統幫你建立日曆時使用。**

| 函式                  | 檔案     | 用途                                                                                                                  |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| **setupEverything()** | setup.js | 建立公開日曆與房務日曆、寫入 Script Properties 範本、**建立今年訂單表**（呼叫 initializeYearSheet，與 schema 一致）。**會建立新日曆**，之後通常只跑 setupSystem()。 |

---

## 四、觸發器設定（自動排程）

這些函式會**建立或刪除**「時間驅動」觸發器，讓系統定時自動跑。

| 函式                          | 檔案                 | 做的事                                                   | 觸發器建立後                                            |
| ----------------------------- | -------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **setupEmailTriggers()**      | Emailtriggers.js     | 刪除舊的 checkStatusChanges 觸發器，再建立「每小時」執行 | 每小時檢查試算表：訂單從待確認→預定中時自動發確認信     |
| **deleteAllTriggers()**       | Emailtriggers.js     | 刪除所有 checkStatusChanges 觸發器                       | 關閉自動發確認信                                        |
| **setupReminderTrigger()**    | reminders.js         | 建立「每小時」執行 checkPendingOrders                    | 每小時檢查：待確認訂單滿 8h 發提醒、滿 48h 自動取消     |
| **listReminderTriggers()**    | reminders.js         | 列出目前與提醒相關的觸發器                               | 檢查用                                                  |
| **setupTravelGuideTrigger()** | travelGuideSender.js | 建立「每天」執行 checkAndSendTravelGuides                | 每天檢查：入住前 7 天的預定中訂單，自動發旅遊手冊 Email |

**setupSystem()** 會建立 **cleanupOldYearEvents** 觸發器（每天凌晨 3 點，僅在 2 月執行清理去年日曆事件）。

---

## 五、由觸發器自動執行的函式（勿手動常駐執行）

這些由上面設定的觸發器呼叫，必要時可手動執行一次測試。

| 函式                           | 檔案                 | 觸發頻率                | 功能                                             |
| ------------------------------ | -------------------- | ----------------------- | ------------------------------------------------ |
| **checkStatusChanges()**       | Emailtriggers.js     | 每小時                  | 偵測訂單狀態改為「預定中」後，自動寄確認信給客人 |
| **checkPendingOrders()**       | reminders.js         | 每小時                  | 待確認訂單：滿 8h 發 40h 提醒、滿 48h 自動取消   |
| **checkAndSendTravelGuides()** | travelGuideSender.js | 每天                    | 找出「7 天後入住」的預定中訂單，寄旅遊手冊       |
| **cleanupOldYearEvents()**     | calendarSync.js      | 每天 03:00，僅 2 月執行 | 刪除「去年」的日曆事件，保持日曆乾淨             |

---

## 六、檢查與維護工具

在編輯器選函式 → **執行**，看日誌結果。

| 函式                           | 檔案             | 用途                                           |
| ------------------------------ | ---------------- | ---------------------------------------------- |
| **quickCheck()**               | setup.js         | 檢查 Properties、日曆、試算表、觸發器是否正常  |
| **checkTriggerCount()**        | setup.js         | 檢查 cleanupOldYearEvents 觸發器數量（應為 1） |
| **cleanupDuplicateTriggers()** | setup.js         | 刪除重複的 cleanupOldYearEvents，只留一個      |
| **listAllCalendars()**         | setup.js         | 列出 Google 帳號下的日曆名稱與 ID              |
| **deleteOldCalendars()**       | setup.js         | 刪除名稱符合舊規則的重複日曆（慎用）           |
| **listAllTriggers()**          | Emailtriggers.js | 列出專案內所有觸發器                           |

---

## 七、日曆相關（多數由後台按鈕或 API 呼叫）

| 函式                                           | 檔案            | 使用方式                           | 用途                                   |
| ---------------------------------------------- | --------------- | ---------------------------------- | -------------------------------------- |
| **CalendarManager.rebuildAllCalendars()**      | calendarSync.js | 後台「重建日曆」按鈕 或 編輯器執行 | 清空日曆後，依試算表「預定中」訂單重建 |
| **CalendarManager.clearAllCalendars()**        | calendarSync.js | 後台「清空日曆」或 編輯器          | 清空公開＋房務日曆事件（危險操作）     |
| **CalendarManager.setupAutoCleanupTrigger()**  | calendarSync.js | 編輯器執行                         | 建立 cleanupOldYearEvents 觸發器       |
| **CalendarManager.removeAutoCleanupTrigger()** | calendarSync.js | 編輯器執行                         | 移除 cleanupOldYearEvents 觸發器       |

後台「查看統計、重建日曆、清空日曆、清理去年、打開日曆」都是透過 **doPost** 呼叫 main.js 的 action，再由 main.js 呼叫 calendarSync 的邏輯。

---

## 八、測試用（可選執行）

僅用於除錯或驗證，不影響正式流程。

| 函式                                | 檔案                 | 用途                                                 |
| ----------------------------------- | -------------------- | ---------------------------------------------------- |
| **testReminderSystem()**            | reminders.js         | 用假訂單測試 40h 提醒寄信                            |
| **testTravelGuideEmail(testEmail)** | travelGuideSender.js | 傳入一個 Email，測試旅遊手冊寄送（需在編輯器傳參數） |
| **quickTest()**                     | setup.js             | 測試日曆同步（假訂單寫入日曆）                       |
| **testDoGet()**                     | main.js              | 模擬 doGet 請求，測 API                              |
| **testCalendarAPIs()**              | main.js              | 測日曆相關 API                                       |

---

## 九、建議執行順序（部署後第一次）

1. **setupSystem()** — 檢查設定、建立今年訂單表、狀態統一、建立每日清理觸發器
2. （選用）**setupEmailTriggers()** — 每小時檢查狀態並發確認信
3. （選用）**setupReminderTrigger()** — 每小時檢查待確認訂單提醒／自動取消
4. （選用）**setupTravelGuideTrigger()** — 每天檢查並發旅遊手冊

之後日常只需在「後台」操作；觸發器會自動跑。若日曆異常，可從後台用「重建日曆」或執行 **CalendarManager.rebuildAllCalendars()**。

---

## 十、平常可以完全不用理它們的函式（給工程師除錯用）

若你只是日常操作／維護，不需要碰下面這些函式；真的壞掉再請工程師看就好：

- **測試／模擬用**
  - `testReminderSystem()`、`testTravelGuideEmail()`、`quickTest()`、`testDoGet()`、`testCalendarAPIs()`
- **觸發器與日曆維護工具**
  - `listAllCalendars()`、`deleteOldCalendars()`、`checkTriggerCount()`、`cleanupDuplicateTriggers()`、`listAllTriggers()`
  - `CalendarManager.setupAutoCleanupTrigger()`、`CalendarManager.removeAutoCleanupTrigger()`

日常只要記得：「部署後跑一次 `setupSystem()`，其餘時間在後台操作即可」，就足夠。
