# 雫旅 Drop Inn · Design System

> 最後更新 2026-05-29
> 用途：copy-paste 給新對話作為設計參考

---

## 1 · 品牌定位

- **品牌名**：雫旅 Drop Inn / Drift（澎湖民宿 + 在地推薦 + 訂房系統）
- **意象**：水滴（雫）、海島、沉靜
- **美學調性**：莫蘭迪低彩度 × 日式留白 × 輕奢手感

---

## 2 · Color Palette

### 2.1 基底色（每頁 `:root` 都有）

```css
:root {
  --bg:        #f5f1ec;                       /* 主背景 warm cream */
  --card:      #f8f5ef;                       /* 卡片底 / login 按鈕底 */
  --ink:       #1a1210;                       /* 主文字 dark warm black */
  --muted:     #6b5f56;                       /* 次文字 warm grey */
  --border:    rgba(181, 171, 160, 0.3);      /* 邊框 warm grey */
  --pending:   #e8e1d7;                       /* 中性 pending tint */
  --has-room:  rgba(184, 121, 90, 0.12);      /* hover/active tint */

  /* 雙軌 accent system */
  --accent:    #6a5a45;                       /* 深奶茶 — 一般 highlight */
  --highlight: #a55a4f;                       /* 茜・適中 — 警示 / 待辦 / 重要 */
}
```

**`--accent` 用在**：連結、數字、subtle 強調、icon
**`--highlight` 用在**：「待收款項」「未填」「逾期」「警示 badge」

### 2.2 按鈕系統（三款）

| 用途 | 樣式 | 寫法 |
|---|---|---|
| 詳情兩顆並排 / 中性無主次 | 奶白底 + 暗邊 | `background: #f8f5ef; border: 1px solid rgba(181,171,160,0.45); color: #1a1210;` |
| Primary CTA | 中奶茶灰 | `background: #a89684; color: #f8f5ef;` |
| 加重款（總結 / 月結 / mode-active） | 偏咖啡灰 | `background: #8a7868; color: #f8f5ef;` |

**禁用**：純黑 `#1a1210` 大面積按鈕、純橘磚紅 `#b8795a` 按鈕

### 2.3 日曆色（莫蘭迪三色 + 過渡）

```css
入住:    rgba(219, 217, 210, 0.90)  border rgba(160, 155, 145, 0.55)  text #3a3028  /* 暖灰 */
退房:    rgba(164, 181, 197, 0.70)  border rgba(164, 181, 197, 0.90)  text #1a2e40  /* 灰藍 */
入住中:  rgba(200, 200, 190, 0.35)  border rgba(181, 171, 160, 0.40)  text #3a3028  /* 灰綠（在努力一下下）淡淡的不搶 */
退＋入:  rgba(230, 124, 115, 0.60)  border rgba(230, 124, 115, 0.85)  text #2a0a08  /* 暖紅 */
洽談中:  rgba(238, 205, 205, 0.60)  border rgba(238, 205, 205, 0.85)  text #5a2828  /* 淡桃 */
```

### 2.4 水滴 / 漣漪（品牌意象）

**莫蘭迪灰藍** `rgba(120, 145, 165, 0.55–0.70)`
- 用在 `.hero-divider-v` 等垂直裝飾線
- 首頁類：drop falls + 雙側水花（splash）
- 內頁類：drop falls + bounce 反彈消失（循環）
- 共用 CSS：`/css/raindrop.css` 的 `.rain-line.splash` 跟 `.rain-line.bounce`

### 2.5 狀態色

```
success / 正利:  #5a7a5a
error   / 警告:  #a55a4f (= --highlight)
info    / 灰藍:  #2a4258
pending / 待辦:  #7a3030 + rgba(230,124,115,0.15) bg
settled / 已結算: rgba(164,181,197,0.20) bg + #2a4258 text
```

---

## 3 · Typography

### 3.1 字型載入（每頁 `<head>`）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Noto+Serif+TC:wght@300;400;500&display=swap" rel="stylesheet">
```

### 3.2 字型角色分工

| 字型 | 角色 | 場景 |
|---|---|---|
| **Cormorant Garamond** | 英文 serif，優雅 | 大數字（NT$）、品牌標題、英文 label（UPPERCASE 0.3em letter-spacing）、Chapter heading |
| **Noto Serif TC** | 中文 serif，閱讀 | 中文 body、中文 heading、UI label、按鈕文字 |

### 3.3 NT$ 數字統一規則 ⭐

```css
.garamond, .num {
  font-family: 'Cormorant Garamond', serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

**所有 NT$ 顯示一律加 `.garamond` 或 `.num` class**
→ 數字 0–9 同寬、列表對齊不抖動

### 3.4 字級系統

| 用途 | size | weight | letter-spacing | font |
|---|---|---|---|---|
| Hero number / 淨利 | 32px | 300 | 0.04em | Cormorant |
| Section heading | 20–22px | 300 | 0.25em | Cormorant |
| Card heading h2 | 18px | 300 | 0.2em | Cormorant |
| 中文標題 | 20px | 400 | 0.25em | Noto Serif TC |
| Body text | 13–14px | 300/400 | 0.06em | Noto Serif TC |
| Number medium | 16–20px | 300 | 0.04em tnum | Cormorant |
| Label uppercase | 10–11px | 400 | 0.2–0.3em UPPERCASE | Cormorant |
| Small note | 11px | 300 | 0.05em | Noto Serif TC |
| Calendar day num | 17–22px | 300 | 0.04em | Cormorant |
| Calendar names | 9–11px | 500 | 0.02em | Noto Serif TC |

### 3.5 月份命名規則

- 全站日曆月份用中文：「一月、二月、…、十二月」
- 年份用阿拉伯數字 Cormorant Garamond：「2026」
- 排版：月份大字（Noto Serif TC 20px）→ 年份小字（Cormorant 13px）緊貼下方 margin-top: 4px

---

## 4 · Spacing & Radius

### 4.1 圓角

| 元素 | radius |
|---|---|
| Modal / 大卡片 | 16–22px |
| 一般卡片 / button | 10–14px |
| Badge / chip | 99–100px (pill) |
| Input | 6–8px |
| 色塊 swatch | 3–6px |

### 4.2 陰影

```css
/* 卡片 (subtle) */
box-shadow: 0 4px 18px rgba(26, 18, 16, 0.04);

/* 卡片 (中) */
box-shadow: 0 6px 32px rgba(26, 18, 16, 0.07);

/* Modal */
box-shadow: 0 20px 60px rgba(74, 63, 53, 0.12);

/* Popover */
box-shadow: 0 20px 60px rgba(74, 63, 53, 0.25);
```

### 4.3 Padding 慣例

- 桌機 card：`28–36px`
- 手機 card：`18–22px`（用 `@media (max-width: 640px)`）
- 極小螢幕：`14–16px`（`@media (max-width: 380px)`）
- Modal 內距：`28–32px`
- Section spacing：`mb-5` (20px) / `mt-6` (24px)

### 4.4 Responsive 慣例 ⭐

每個有 `.card` 的頁面都要加：

```css
@media (max-width: 640px) {
  .card { padding: 18px 16px; }
  table, th, td { word-break: break-word; overflow-wrap: anywhere; }
}
@media (max-width: 380px) {
  .card { padding: 14px 12px; }
}
```

**核心**：任何卡片內含長字串（email / URL / 訂單編號）都要加 `overflow-wrap: anywhere` 防止溢出

---

## 5 · 動畫

- 通用 transition：`0.18s ease` 或 `0.32s cubic-bezier(0.32, 0.72, 0, 1)`
- Popover 出場：`opacity + scale(0.95→1)` over 0.18s
- 水滴：`4.2s ease infinite`（首頁含 splash）/ `4.5s ease infinite`（內頁 bounce）

---

## 6 · 元件範例

### 6.1 按鈕

```html
<!-- 中性（無主次）-->
<button style="background:#f8f5ef;border:1px solid rgba(181,171,160,0.45);color:#1a1210;border-radius:14px;padding:13px 22px;font-family:'Noto Serif TC',serif;font-size:13px;letter-spacing:0.2em;">
  進入
</button>

<!-- Primary CTA -->
<button style="background:#a89684;color:#f8f5ef;border:none;border-radius:10px;padding:12px 28px;font-family:'Noto Serif TC',serif;font-size:13px;letter-spacing:0.15em;">
  送出
</button>

<!-- 加重款 -->
<button style="background:#8a7868;color:#f8f5ef;border:none;border-radius:14px;padding:6px 14px;font-family:inherit;font-size:11px;letter-spacing:0.12em;">
  結算此月
</button>
```

### 6.2 數字顯示

```html
<!-- 普通數字 -->
<strong class="garamond" style="font-size:18px;font-weight:300;color:var(--accent);">
  NT$ 167,000
</strong>

<!-- 警示數字 -->
<strong class="num" style="font-size:18px;font-weight:300;color:var(--highlight);">
  NT$ 44,000
</strong>
```

### 6.3 Label (UPPERCASE)

```html
<span style="font-size:10px;letter-spacing:0.3em;color:var(--muted);text-transform:uppercase;font-family:'Cormorant Garamond',serif;">
  RESTORETHEBLANK
</span>
```

### 6.4 Section Heading (中＋英並列)

```html
<div>
  <h2 style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;letter-spacing:0.2em;color:#4a3f35;">
    收支梳理
  </h2>
  <div style="font-size:10px;letter-spacing:0.3em;color:#8a7a6a;text-transform:uppercase;">
    FINANCIAL SUMMARY
  </div>
</div>
```

### 6.5 Badge / Chip

```html
<!-- 中性 chip -->
<span style="background:rgba(26,18,16,0.06);color:var(--muted);font-size:11px;padding:3px 10px;border-radius:100px;letter-spacing:0.05em;">
  早餐
</span>

<!-- accent chip -->
<span style="background:rgba(106,90,69,0.12);color:var(--accent);font-size:11px;padding:3px 10px;border-radius:100px;letter-spacing:0.05em;">
  熱門
</span>

<!-- 警示 badge -->
<span style="background:rgba(165,90,79,0.13);color:var(--highlight);font-size:11px;padding:2px 9px;border-radius:99px;letter-spacing:0.08em;">
  未填
</span>
```

---

## 7 · 已建立可重用資源

| 路徑 | 內容 |
|---|---|
| `/css/raindrop.css` | 水滴動畫共用 — `.rain-line.splash` (首頁) / `.rain-line.bounce` (內頁) |
| 各頁 `:root` | 統一 `--accent` `--highlight` 雙軌變數 |
| 各頁 `.garamond` / `.num` | NT$ 數字統一 Cormorant + tnum |

---

## 8 · 設計禁忌（這些不要做）

- ❌ 大面積純黑 `#1a1210` 按鈕（用奶白 + 暗邊 或 B 中奶茶灰替代）
- ❌ 純橘磚紅 `#b8795a`（已淘汰，改深奶茶 + 茜・適中雙軌）
- ❌ 一頁五六種 accent 色混用（嚴守 accent + highlight 兩支）
- ❌ NT$ 數字用 Noto Serif TC（中文襯線跑出來會很怪，一律 Cormorant + tnum）
- ❌ 卡片固定 padding 不收緊手機（手機文字必溢出）
- ❌ 莫蘭迪粉 #c89788 當警示（太淡看不到）
- ❌ 軍綠 #5a6e4a 當 accent（太跳，跟雫旅冷靜調性衝突）
- ❌ 過彩度紅 `#c9282e`（kurenai 太鮮，雫旅安靜場域不適）

---

## 9 · 參考頁面實作

可直接 reference 的 production 頁面：

| 頁面 | 路徑 | 觀察重點 |
|---|---|---|
| 訂房首頁 | `/` | hero 水滴+水花、響應式 |
| Drift 雫旅推薦 | `/drift/` | carousel 卡片、地圖 marker `#8a7868`、底部 itinerary drawer |
| 房務 RTB | `/restoretheblank/` | login 奶白按鈕、結算 banner、莫蘭迪日曆 |
| 後台 | `/notforyou/home/` | 收支梳理、modal 範例、修改密碼、訂單管理 |
| 須知 | `/ourpinkypromise/` | divider-v 水滴反彈、響應式卡片 |
| 退房感謝 | `/untilnexttime.html` | 簡潔靜態頁 + 水滴 |

---

> **以上是 2026-05-29 的雫旅 design system 快照。**
> 給新對話的開頭可貼：
> ```
> 雫旅 Drop Inn 的設計系統如下，後續任何 UI 都要符合：
> [貼上上面整段]
> ```
