# GAS 健檢：能不開就不開

> 目標：日常操作盡量在**後台（admin）**完成，減少開啟 GAS 指令碼編輯器的次數。

---

## 一、已整合到後台（不需開 GAS）

以下功能皆可從 **後台** 操作，透過 doPost / doGet API 由 GAS 執行，**無需在編輯器選函式執行**。

| 功能 | 後台位置 | 對應 API / 說明 |
|------|----------|------------------|
| 訂單列表、編輯、儲存、同步日曆 | 訂單一覽 | getAllOrders, getOrderByID, updateOrder, updateOrderAndSync |
| 建立訂單（手動新增） | 新增訂單 | createBooking (ADMIN_BYPASS) |
| 標記已完成、發送通知（Email / LINE 文案） | 訂單編輯 | markCompletedOrders, sendNotificationEmail, generateNotification |
| 財務總覽、詳細報表、同業退佣、訂單明細 | 財務總覽／詳細報表 | getFinanceStats, getDetailedFinanceReport, getCostForOrder |
| 折扣碼查詢與儲存 | 後台（若已做 CRUD UI） | getCoupons, saveCoupon |
| 日曆：查看統計、重建、清空、清理去年 | 日曆管理 | getCalendarStats, rebuildCalendars, clearCalendars, cleanupOldYear |
| **系統設定**：一鍵日常初始化、建立／補齊今年訂單表、檢查系統狀態 | 系統設定區塊 | adminRunSetupSystem, adminInitializeYearSheet, adminQuickCheck |
| **後台設定**：檢視與編輯 Script Properties（試算表 ID、日曆 ID、API 金鑰等） | 系統設定區塊內「後台設定」 | adminGetSettings, adminSetSettings |
| **推薦記錄**：列表、新增（我推薦給同業的案子） | 推薦記錄區塊 | getRecommendationRecords, addRecommendationRecord |

**結論**：日常建表、補欄、檢查狀態、**設定值編輯**、訂單與推薦記錄維護、日曆與報表，全部可在後台完成。

---

## 二、仍須在 GAS 執行的情境

| 情境 | 建議做法 |
|------|----------|
| **第一次部署**：建立新日曆、寫入 Script Properties 範本 | 在編輯器執行 `setupEverything()`（僅一次） |
| **修改 Script Properties**（如 SHEET_ID、日曆 ID、ADMIN_API_KEY、RECAPTCHA_SECRET） | 建議：後台「系統設定」→「後台設定」→ 載入目前設定 → 填寫新值 → 儲存。僅在無法登入後台時才進 GAS 專案設定手動編輯。 |
| **觸發器壞掉或想重設** | 後台「一鍵日常初始化」會跑 setupSystem()，會設定觸發器；若仍異常再進編輯器執行 setupEmailTriggers()、setupReminderTrigger()、setupTravelGuideTrigger() |
| **單獨跑狀態統一（已付訂/已預訂→預定中等）** | 編輯器執行 `runStatusMigration()`，或依主文件改為後台 API |
| **預建多年度訂單表（如 2026～2028）** | 編輯器執行 `initializeMultipleYears()`，或後台重複按「建立／補齊今年訂單表」並改年份（若後台有年份參數） |
| **檢查／除錯**：看 Logger、觸發器列表、日曆列表 | 編輯器執行 quickCheck()、listAllTriggers()、listAllCalendars() 等 |

---

## 三、試算表（Sheet）一覽與後台對應

| Sheet 名稱 | 用途 | 後台／API |
|------------|------|-----------|
| 訂單_YYYY | 每年一表，訂單主檔（含 sourceType、agencyName） | 訂單列表、編輯、報表 |
| 支出_YYYY | 退佣、招待、其他成本 | 訂單編輯成本區、詳細報表 |
| 折扣碼 | 優惠碼 | getCoupons / saveCoupon |
| 推薦記錄 | 我推薦給同業的案子（無客人個資） | 後台「推薦記錄」區塊 |
| AgencyAccounts, AgencyProperties, AgencyBlocks | 同業帳號與日曆 | 同業日曆區塊、agency.html |
| 系統計數器 | 訂單編號序號 | 建立訂單時自動寫入 |

欄位擴充時：訂單表由 `ensureOrderSheetSchema()` 自動補欄（sourceType、agencyName、addonAmount、extraIncome）；新年度表由後台「建立／補齊今年訂單表」或 `initializeYearSheet(year)` 建立。

---

## 四、建議日常流程

1. **每日**：開後台看訂單、財務、推薦記錄即可；必要時「檢查系統狀態」。
2. **部署或換試算表／日曆後**：後台按「一鍵日常初始化」＋「建立／補齊今年訂單表」。
3. **僅在** 第一次部署、改 Properties、觸發器異常或除錯時，才開 GAS 編輯器。

這樣可達到 **「能不開 GAS 就不開」** 的目標。
