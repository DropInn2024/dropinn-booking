# 雫旅 Drop Inn 設計系統 2026 定案
## CSS 變數（所有頁面 :root 統一）
:root {
  --bg:       #f5f1ec;   /* 頁面底色，暖沙白 */
  --ink:      #1a1210;   /* 主要文字 */
  --muted:    #6b5f56;   /* 輔助文字 */
  --accent:   #b8795a;   /* 強調色、週六日、hover */
  --border:   rgba(181, 171, 160, 0.3);
  --past:     #d2cbc3;   /* 過去日期 */
  --pending:  #e8e1d7;   /* 洽談中底色 */
  --cross:    #b8b0a6;   /* 叉叉顏色 */
  --blocked:  rgba(181, 171, 160, 0.35);
  --has-room: rgba(184, 121, 90, 0.12);
}
## 按鈕
border-radius: 12px
background: var(--ink)
color: var(--bg)
hover: background: #2e2018
outline 按鈕：
border: 1px solid rgba(181, 171, 160, 0.45)
border-radius: 12px
background: transparent
hover: border-color: var(--ink)
## 日曆規則
### 頁面與日曆
- body background: var(--bg)
- 日曆直接長在頁面上，不包卡片容器
- 不要有 box-shadow、border-radius 在日曆外層容器
### 格子
- background: transparent
- border: none
- hover（非 past/booked）: background: rgba(181, 171, 160, 0.15); border-radius: 4px
### 週六日
- color: var(--accent)
### 狀態
- 洽談中: background: var(--pending); color: #5a4a3a
- 已付訂/已預訂/關房 → 叉叉：
    color: transparent !important
    position: relative
    ::before, ::after:
      content: ''
      position: absolute
      left: 50%; top: 50%
      width: 52%; height: 1.5px
      background: var(--cross)
      border-radius: 1px
    ::before: transform: translate(-50%,-50%) rotate(45deg)
    ::after:  transform: translate(-50%,-50%) rotate(-45deg)
- 過去日期: color: var(--past); opacity: 0.7
### 箭頭
- all: unset
- color: var(--muted)
- cursor: pointer
- outline: none
- -webkit-tap-highlight-color: transparent
- transition: color 0.2s
- hover/focus: color: var(--ink); outline: none
- 不要有 border、background、box-shadow
### 月份導覽列
- display: flex; align-items: center; justify-content: space-between
- 左箭頭靠左、月份 flex:1 置中、右箭頭靠右
- 月份字體: Cormorant Garamond, serif; font-weight: 300; letter-spacing: 6px
- 年份: font-size: 10px; letter-spacing: 3px; color: var(--muted)
## 字體
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Noto+Serif+TC:wght@300;400&display=swap" rel="stylesheet"/>
- 標題、月份、英文副標 → Cormorant Garamond, serif
- 內文、按鈕 → Noto Serif TC, serif
## 標題格式
中文在上，英文在下，全部置中：
  font-size: 22-28px; font-weight: 300; letter-spacing: 0.2-0.3em; color: var(--ink)
  英文副標: font-size: 10-11px; letter-spacing: 0.4em; color: var(--muted); text-transform: uppercase
## 各頁面日曆文字對照（不可更改）
| 頁面 | 中文標題 | 英文副標 | 圖例 |
|---|---|---|---|
| handshake/index.html | 空下來的日子 | Still Yours | 島嶼還在等你 / 洽談中 / 你慢了一步 |
| notforyou/home/index.html | 雫旅的日子 | NOT YOUR HOLIDAY | 空白→留白 / 淡色→洽談中 / 叉叉→已付訂 |
| handshake/dashboard/index.html | （各視角保留原有文字） | — | 空房/關房 / 可包棟/部分可提供 |
| website/index.html | 空下來的日子 | STILL YOURS | — |
| restoretheblank.html | （房務日曆，保留原有文字） | — | — |
## 禁止事項
- 不可改 JS 邏輯
- 不可改 API 呼叫
- 不可在日曆外層加 box-shadow 或 card 容器
- 不可用純白 #ffffff 或 white 作為日曆或頁面底色
- 不可改以上文字對照表的任何文字
