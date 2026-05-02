# Google Sheets → D1 資料搬遷工具

把舊 GAS 後端用的 Google Sheets 內容轉成 SQL，灌進 Cloudflare D1 (`dropinn-db`)。

## 重要：個資保護

`csv/` 與 `output/` 兩個資料夾**含有客戶手機、Email、姓名等個資**，已透過 `.gitignore` 排除，**禁止 commit 到公開 repo**。

## 使用流程

### 1. 從 Google Sheets 匯出 CSV

打開試算表 → `檔案` → `下載` → 各分頁分別下載 `.csv` → 放進 `scripts/sheets-import/csv/`，檔名保持原樣：

```
DropInn-Booking - 訂單_2026.csv
DropInn-Booking - AgencyAccounts.csv
DropInn-Booking - AgencyProperties.csv
DropInn-Booking - AgencyBlocks.csv
DropInn-Booking - AgencyGroups.csv
DropInn-Booking - 支出_2026.csv
DropInn-Booking - 月費_2026.csv
DropInn-Booking - 折扣碼.csv
DropInn-Booking - 推薦記錄.csv
DropInn-Booking - 系統計數器.csv
DropInn-Booking - 旅遊景點.csv
DropInn-Booking - DriftReviews.csv
DropInn-Booking - DriftUsers.csv
DropInn-Booking - SystemLogs.csv
```

### 2. 跑轉換腳本

```bash
node scripts/sheets-import/transform.mjs
```

產出：`scripts/sheets-import/output/0007_data_migration.sql`，會印出每張表的筆數。

### 3. 灌進 D1

```bash
cd worker
npx wrangler d1 execute dropinn-db --remote \
  --file=../scripts/sheets-import/output/0007_data_migration.sql --yes
```

### 4. 驗證筆數

```bash
cd worker
npx wrangler d1 execute dropinn-db --remote \
  --command="SELECT 'orders' as t, COUNT(*) n FROM orders;"
```

## 轉換邏輯

- **日期正規化**：`2026/4/3` → `2026-04-03`（ISO 格式）
- **布林轉整數**：`TRUE`/`FALSE` → `1`/`0`
- **空字串轉預設值**：例如 `extraBeds` 空字串 → `0`
- **SQL escape**：單引號 `'` → `''`，跨行字串保留換行
- **預設覆寫**：`status` 空 → `洽談中`、`sourceType` 空 → `自家`

每張表的 INSERT 前會先 `DELETE FROM`，所以**重複跑不會產生重複資料**（同 ID 會被新值覆蓋）。
