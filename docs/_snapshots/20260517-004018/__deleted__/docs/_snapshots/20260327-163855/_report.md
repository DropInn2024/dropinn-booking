# 雫旅 Drop Inn — 設計系統稽核報告
> 掃描日期：2026-03-27　　對象：10 個 HTML 檔案

---

## 目錄
1. [website/index.html](#1-websiteindexhtml)
2. [handshake/index.html](#2-handshakeindexhtml)
3. [handshake/login/index.html](#3-handshakeloginindexhtml)
4. [handshake/dashboard/index.html](#4-handshakedashboardindexhtml)
5. [notforyou/index.html](#5-notforyouindexhtml)
6. [notforyou/home/index.html](#6-notforyouhomeindexhtml)
7. [restoretheblank.html](#7-restorethecblankhtml)
8. [ourpinkypromise.html](#8-ourpinkypromisehtml)
9. [howtogetlost.html](#9-howtogetlosthtml)
10. [untilnexttime.html](#10-untilnexttimehtml)
11. [總結與待修清單](#總結與待修清單)

---

## 1. `website/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.btn-submit` border-radius | `12px` | ✅ |
| 按鈕 background | `var(--card)` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 月份導覽 outline | `outline: none`（`all: unset` + 明確宣告）| ✅ |
| 星期標題 | CSS `::after` content 日一二三四五六 | ✅ |
| 日期格子 font-size | `19px`（Cormorant Garamond 300）| ✅ |
| 年份 font-size | `month-main: 26px` / `month-year: 13px` | ✅ |
| 選取色 `.cal-day.selected` | `rgba(210, 195, 165, 0.5)` | ✅ |
| 叉叉顏色 | `var(--cross)` → `#b8b0a6` | ✅ |
| 日曆容器卡片 | `background: var(--card)` + `border-radius: 24px` + `box-shadow` | ✅ |
| 圖例 HTML | ✅ 有：島嶼還在等你 / 洽談中 / 你慢了一步 | ✅ |

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |
| 英文副標 font-size | `13px` | ✅ |
| 英文副標 letter-spacing | `0.5em` | ✅ |

---

## 2. `handshake/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.btn` border-radius | `12px` | ✅ |
| 按鈕 background | `var(--card)` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 月份導覽 outline | `outline: none` | ✅ |
| 星期標題 | CSS `::after` content 日一二三四五六 | ✅ |
| 日期格子 font-size | `19px` | ✅ |
| 年份 font-size | `.month-title: 26px` | ✅ |
| 選取色 | `var(--select)` | ✅ |
| 叉叉顏色 | `var(--cross)` | ✅ |
| 日曆容器卡片 | `background: var(--card)` + `border-radius: 24px` + `box-shadow` | ✅ |
| 圖例 HTML | ⚠️ 使用 **inline style**（無 `.cal-legend` class），只顯示圖示無文字說明 | ⚠️ |

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |
| 英文副標 font-size | `13px` | ✅ |
| 英文副標 letter-spacing | `0.5em` | ✅ |

---

## 3. `handshake/login/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.btn` border-radius | `12px` | ✅ |
| 按鈕 background | `var(--card)` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】無日曆 — 跳過

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |
| 英文副標 font-size | `13px` | ✅ |
| 英文副標 letter-spacing | `0.5em` | ✅ |

---

## 4. `handshake/dashboard/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| `.and-day-popover` background | `background: white`（第 772 行）| ❌ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.fab-btn` border-radius | `12px` | ✅ |
| 按鈕 background | `transparent` / `rgba(...)` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 月份導覽 outline | `outline: none`（`all: unset` + 明確宣告）| ✅ |
| 星期標題 | CSS `::after` content 日一二三四五六 | ✅ |
| 日期格子 font-size | `.cal-cell: 18px` | ✅ |
| 年份 font-size | `.month-year: 13px` | ✅ |
| 選取色 `.cal-cell.selected` | `var(--select)` | ✅ |
| 叉叉顏色 | `var(--cross)` | ✅ |
| 日曆容器卡片 | ⚠️ 無獨立 card 容器（`view-container` 無背景/圓角/陰影）| ⚠️ |
| 圖例 HTML | ❌ CSS 定義了 `.legend-box` / `.legend-item` 但 HTML body 中**無圖例**| ❌ |

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上 | ✅ | ✅ |
| 英文副標 font-size | `13px`（月份年份）| ✅ |

---

## 5. `notforyou/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.btn` border-radius | `12px` | ✅ |
| 按鈕 background | `var(--card)` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】無日曆 — 跳過

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |
| 英文副標 font-size | `13px` | ✅ |
| 英文副標 letter-spacing | `0.5em` | ✅ |

---

## 6. `notforyou/home/index.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| `.card` background | `var(--card)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `.btn-primary` border-radius | `12px` | ✅ |
| `.btn-outline` border-radius | `12px` | ✅ |
| 按鈕 background | `var(--card)` / `transparent` | ✅ |
| 按鈕 color | `var(--ink)` | ✅ |

### 【日曆】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 月份導覽 outline | `outline: none` | ✅ |
| 星期標題 | HTML 靜態標籤：`<div class="cal-weekday">日</div>` 等 | ✅ |
| 日期格子 font-size | `18px`（Cormorant Garamond 300）| ✅ |
| 年份 font-size | `.month-year: 13px` | ✅ |
| 選取色 | 無客人選取態（此為房務管理頁）| — |
| 叉叉顏色 | `var(--cross)` → `#b8b0a6` | ✅ |
| 日曆容器卡片 | `.booking-cal-wrap`: `background: var(--card)` + `border-radius: 24px` + `box-shadow` | ✅ |
| 圖例 HTML | ✅ `.booking-cal-wrap .cal-legend` + 叉叉 cross-icon | ✅ |

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |
| 英文副標 font-size | `13px` | ✅ |

---

## 7. `restoretheblank.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | `var(--card)` | ✅ |

### 【按鈕】無主要按鈕 — 跳過

### 【日曆】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 月份導覽 outline | `outline: none`（`all: unset` + 明確宣告）| ✅ |
| 星期標題 | JS `weekdays.map()` 動態插入中文（日一二三四五六）| ✅ |
| 日期格子 font-size | `18px` | ✅ |
| 年份 font-size | `.month-year: 13px` | ✅ |
| 選取色 | 無客人選取態（日程管理頁）| — |
| 叉叉顏色 | `var(--cross)` | ✅ |
| 日曆容器卡片 | 無獨立 card 容器（日程頁整體為列表卡片，非獨立日曆卡）| ⚠️ |
| 圖例 HTML | ✅ `.legend` 存在（使用 dot 樣式，符合日程頁語境）| ✅ |

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上英文在下 | ✅ | ✅ |

---

## 8. `ourpinkypromise.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】無主要按鈕 — 跳過
### 【日曆】無日曆 — 跳過

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上（`.logo-zh`）英文在下（`.logo-en`）| ✅ | ✅ |
| `.logo-en` font-size | `13px` | ✅ |
| `.logo-en` letter-spacing | `0.5em` | ✅ |

---

## 9. `howtogetlost.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| `@media print { body { background: #fff } }` | 僅列印用途，不影響螢幕顯示 | ⚠️ |

### 【按鈕】無主要按鈕 — 跳過
### 【日曆】無日曆 — 跳過

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上（`.logo-zh`）英文在下（`.logo-en`）| ✅ | ✅ |
| `.logo-en` font-size | `13px` | ✅ |
| `.logo-en` letter-spacing | `0.5em` | ✅ |

---

## 10. `untilnexttime.html`

### 【配色】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| `--bg` | `#ece8e1` | ✅ |
| `--card` | `#f8f5ef` | ✅ |
| `--ink` | `#1a1210` | ✅ |
| `--muted` | `#8a7a6a` | ✅ |
| `--accent` | `#b8795a` | ✅ |
| `--select` | `rgba(210, 195, 165, 0.5)` | ✅ |
| `body background` | `var(--bg)` | ✅ |
| 卡片容器 | 無 `white` / `#fff` | ✅ |

### 【按鈕】無主要按鈕 — 跳過
### 【日曆】無日曆 — 跳過

### 【標題】
| 項目 | 目前值 | 符合 |
|------|--------|------|
| 中文在上（`.title-main`）英文在下（`.title-sub`）| ✅ | ✅ |
| `.title-sub` font-size | `13px` | ✅ |
| `.title-sub` letter-spacing | `0.5em` | ✅ |

---

## 總結與待修清單

### 整體狀況
- **配色系統**：10/10 檔案完全統一 ✅
- **按鈕樣式**：所有含按鈕的檔案均符合 ✅
- **標題排版**：10/10 檔案符合 ✅

---

### ❌ 必須修改（2 項）

| # | 檔案 | 位置 | 問題 | 修正方式 |
|---|------|------|------|---------|
| 1 | `handshake/dashboard/index.html` | 第 772 行 `.and-day-popover` | `background: white` | 改為 `background: var(--card)` |
| 2 | `handshake/dashboard/index.html` | body 中三個日曆下方 | 無圖例 HTML | 在 `#grid-you`、`#grid-and`、`#grid-me` 下方加入 `.legend` HTML |

---

### ⚠️ 建議修改（2 項）

| # | 檔案 | 位置 | 問題 | 建議 |
|---|------|------|------|------|
| 3 | `handshake/index.html` | 日曆下方圖例 | 圖例使用 inline style，無文字說明 | 改用 `.cal-legend` class + 加文字（島嶼還在等你 / 洽談中 / 你慢了一步）|
| 4 | `handshake/dashboard/index.html` | `.view-container` | 日曆區無 card 容器（無背景/圓角/陰影）| 可選擇包一層 card wrapper |

---

### ℹ️ 可接受差異（無需修改）

| 檔案 | 說明 |
|------|------|
| `howtogetlost.html` | `@media print { body { background: #fff } }` — 列印樣式，不影響螢幕 |
| `restoretheblank.html` | 日曆圖例使用 dot 圓點樣式 — 符合日程管理頁的語境，非訂房頁不需要叉叉圖例 |
| `notforyou/home/index.html` | 日曆無選取色 — 房務管理頁不需要客人選取邏輯 |
