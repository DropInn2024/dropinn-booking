#!/usr/bin/env node
/**
 * 欄位對應稽核 — 找出「前端送出、但後端從未讀取」的欄位（＝靜默丟棄）
 *
 * 起因（2026-08）：訂單編輯視窗把 rebateAmount／complimentaryAmount／otherCost／
 * addonCost／costNote 送到 PATCH /api/orders/:id，但這些欄位屬於 cost_rows 表、
 * 不在 orders 的白名單裡 → 後端跳過、仍回 success、前端顯示「已更新」，
 * 資料卻沒寫進去。招待費與退傭因此長期存不進去而無人察覺。
 *
 * 用法：node scripts/audit/field-mapping.mjs
 *
 * 判讀：「後端未讀取」不一定是 bug（可能是前端計算用的中間值，或後端刻意自行推導），
 *       但每一筆都要能說出「為什麼可以不讀」。說不出來，就是漏接。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routeDir = path.join(ROOT, 'worker/src/routes');

/* ── 1) 後端：每個 handler 實際讀取的欄位 ───────────────────── */
const wlists = {};
for (const f of fs.readdirSync(routeDir)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(routeDir, f), 'utf8');
  for (const x of src.matchAll(/const\s+([A-Z][A-Z_0-9]+)\s*=\s*\[([\s\S]*?)\];/g)) {
    wlists[x[1]] = [...x[2].matchAll(/'([A-Za-z0-9_]+)'/g)].map((k) => k[1]);
  }
}

const PROP = /([A-Za-z_$][\w$]*)\.([A-Za-z0-9_]+)/g;
const IDX = /([A-Za-z_$][\w$]*)\['([^']+)'\]/g;
const JSONVAR = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+request\.json\(\)/g;
const DESTRUCT = /\{([^}]*)\}\s*=\s*(?:await request\.json\(\)|[A-Za-z_$][\w$]*)\s*;/g;

const backend = {};
for (const f of fs.readdirSync(routeDir)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(routeDir, f), 'utf8');
  const marks = [];
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    marks.push({ name: m[1], start: m.index });
  }
  marks.forEach((mk, i) => {
    const seg = src.slice(mk.start, i + 1 < marks.length ? marks[i + 1].start : src.length);
    const vars = new Set(['body', 'b']);
    for (const x of seg.matchAll(JSONVAR)) vars.add(x[1]);
    const fields = new Set();
    for (const x of seg.matchAll(PROP)) if (vars.has(x[1])) fields.add(x[2]);
    for (const x of seg.matchAll(IDX)) if (vars.has(x[1])) fields.add(x[2]);
    for (const x of seg.matchAll(DESTRUCT)) {
      x[1].split(',').forEach((p) => {
        const k = p.split(':')[0].split('=')[0].trim();
        if (/^[A-Za-z0-9_]+$/.test(k)) fields.add(k);
      });
    }
    // 白名單陣列＝「接受」清單才算有處理；拒絕清單（如 COST_ROW_FIELDS 這種
    // 明確擋下並回錯的）不能算，否則防呆機制反而會遮蔽偵測。
    const REJECT_LISTS = ["COST_ROW_FIELDS"];
    for (const name of Object.keys(wlists)) {
      if (REJECT_LISTS.includes(name)) continue;
      if (seg.includes(name)) wlists[name].forEach((k) => fields.add(k));
    }
    backend[mk.name] = { file: f, fields };
  });
}

/* ── 2) 路由：靜態與動態 ─────────────────────────────────────── */
const idx = fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8');
const routes = [];
for (const m of idx.matchAll(/path === '([^']+)'[^\n]*request\.method === '([A-Z]+)'\)\s*\r?\n\s*return c\(await ([A-Za-z0-9_]+)/g)) {
  routes.push({ path: m[1], method: m[2], handler: m[3] });
}
const dynRoutes = [];
const lines = idx.split('\n');
lines.forEach((ln, i) => {
  const m = ln.match(/path\.match\((\/[^;]+\/)\)/);
  if (!m) return;
  // 一條動態路由底下可能有多個 method 分支（GET/PUT/DELETE…），
  // 必須把 method 與其後最近的 handler 成對抓出，否則 PUT 會被配到 GET 的 handler。
  const win = lines.slice(i, i + 16);
  let pendingMethod = null;
  for (const w of win) {
    const mm = w.match(/request\.method === '([A-Z]+)'/);
    if (mm) pendingMethod = mm[1];
    const hm = w.match(/await ([A-Za-z0-9_]+)\(request, env/);
    if (hm) {
      dynRoutes.push({ re: m[1], handler: hm[1], method: pendingMethod });
      pendingMethod = null;
    }
  }
});

/* ── 3) 前端：每個帶 body 的呼叫送出哪些欄位 ─────────────────── */
const FILES = [
  'notforyou/home/app.js', 'notforyou/tours/app.js', 'notforyou/home/drift-admin.js',
  'notforyou/home/tours-admin.js', 'js/app.js', 'handshake/app.js', 'handshake/dashboard/app.js',
  'handshake/login/app.js', 'restoretheblank/app.js', 'drift/app.js', 'drift/locallove.js',
  'explore/assets/trips-page.js', 'explore/assets/rental-page.js', 'explore/assets/ferry-page.js',
  'gallery/app.js', 'website/itinerary.js',
];

function topKeys(src, from) {
  const i = src.indexOf('{', from);
  if (i < 0 || i - from > 260) return null;
  let d = 0, end = -1;
  for (let j = i; j < src.length && j < i + 5000; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { end = j; break; } }
  }
  if (end < 0) return null;
  const inner = src.slice(i + 1, end);
  const keys = new Set();
  let depth = 0;
  let ternary = 0;                    // 追蹤同層的 ?：三元的冒號不是物件鍵（會誤收 .value 之類）
  for (let j = 0; j < inner.length; j++) {
    const ch = inner[j];
    if ('{(['.includes(ch)) depth++;
    else if ('})]'.includes(ch)) depth--;
    else if (ch === '?' && depth === 0) ternary++;
    else if (ch === ':' && depth === 0 && ternary > 0) ternary--;
    else if (ch === ':' && depth === 0) {
      const mm = inner.slice(Math.max(0, j - 40), j).match(/([A-Za-z0-9_]+)\s*$/);
      if (mm) keys.add(mm[1]);
    }
  }
  for (const p of inner.split(',')) {
    const t = p.trim();
    if (/^[A-Za-z0-9_]+$/.test(t)) keys.add(t);
  }
  return [...keys];
}


/* payload 若是變數（例：var updates = {...}; _nfyFetch(..., updates)），
   必須回頭找出該變數的物件字面值，以及後續的 x.field = 指派——否則整個呼叫掃不到。
   2026-08 的招待費 bug 正是這種形狀，所以這段是本工具的核心，別為了簡化拿掉。 */
function keysOfVariable(src, callIdx, varName) {
  const head = src.slice(0, callIdx);
  let declAt = -1;
  for (const kw of ['var ', 'let ', 'const ']) {
    const at = head.lastIndexOf(kw + varName + ' = {');
    if (at > declAt) declAt = at;
  }
  if (declAt < 0) return null;
  const keys = topKeys(src, declAt) || [];
  const tail = head.slice(declAt);
  let p = 0;
  for (;;) {
    const at = tail.indexOf(varName + '.', p);
    if (at < 0) break;
    p = at + varName.length + 1;
    let e = p;
    while (e < tail.length && /[A-Za-z0-9_]/.test(tail[e])) e++;
    const field = tail.slice(p, e);
    const after = tail.slice(e).match(/^\s*=([^=])/);
    if (field && after) keys.push(field);
  }
  return [...new Set(keys)];
}

const calls = [];
for (const rel of FILES) {
  let src;
  try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  const re = /(?:_nfyFetch|api)\(\s*'(POST|PUT|PATCH|DELETE)'\s*,\s*'([^']+)'\s*(,|\+)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, method, rawPath, sep] = m;
    const isDyn = sep === '+';
    let from = m.index + m[0].length;
    let pathParts = [rawPath];
    if (isDyn) {
      let d = 0, j = from;
      for (; j < src.length; j++) {
        const ch = src[j];
        if ('(['.includes(ch) || ch === '{') d++;
        else if (')]'.includes(ch) || ch === '}') { if (d === 0) break; d--; }
        else if (ch === ',' && d === 0) break;
      }
      const expr = src.slice(from, j);           // 路徑運算式（id 與後綴都在裡面）
      for (const lit of expr.matchAll(/'([^']*)'/g)) if (lit[1]) pathParts.push(lit[1]);
      from = j + 1;
    }
    let keys = topKeys(src, from);
    if (!keys || !keys.length) {
      // payload 不是字面值 → 可能是變數名，回頭解析其宣告
      const idm = src.slice(from, from + 60).match(/^\s*([A-Za-z_$][\w$]*)\s*\)/);
      if (idm) keys = keysOfVariable(src, m.index, idm[1]);
    }
    if (!keys || !keys.length) continue;
    const p = rawPath.replace(/\?.*$/, '');
    let handler = null;
    const st = routes.find((r) => r.method === method && (r.path === p || r.path === p.replace(/\/$/, '')));
    if (st) handler = st.handler;
    else {
      const cand = dynRoutes.filter((d) => (!d.method || d.method === method) && pathParts.every((seg) => d.re.includes(seg.split('/').join(String.fromCharCode(92) + '/'))));
      if (cand.length === 1) handler = cand[0].handler;
    }
    calls.push({ file: rel, line: src.slice(0, m.index).split('\n').length, method, path: p + (isDyn ? ':id' : ''), keys, handler });
  }
}


/* 已知良性：前端計算用的中間值，或後端刻意自行推導（不採信前端）。
   新增項目時務必附理由——說不出理由的就是漏接。 */
const EXPECTED_UNREAD = {
  'POST /api/admin/orders': {
    adminManual: '僅為前端標記，後端不需要',
    timestamp: '後端以伺服器時間為準，不採信前端',
    nights: '前端試算中間值，後端由日期自行計算',
    packagePrice: '同上',
    extraBedPrice: '同上',
    remainingBalance: '後端一律以「總價−訂金」推導，不採信前端（防不一致）',
  },
};


/* 已人工驗證、但自動解析對不到 handler 的呼叫（路由前綴重疊所致）。
   列在這裡代表「查過、沒問題」；若未來出現不在此清單的項目，代表是新的、要查。 */
const VERIFIED_MANUAL = {
  'PATCH /api/admin/agency/groups/:id': 'addGroupMember 有讀 body.agencyId（notforyouAdmin.js）',
  'PATCH /api/orders/:id': '只送 housekeepingNote，在 ORDER_UPDATABLE_FIELDS 白名單內',
};

/* ── 4) 比對輸出 ─────────────────────────────────────────────── */
console.log('欄位對應稽核｜掃到帶 body 的 API 呼叫 ' + calls.length + ' 筆\n');
let bad = 0, manual = 0, verified = 0;
for (const c of calls) {
  if (!c.handler || !backend[c.handler]) {
    const key = c.method + ' ' + c.path;
    if (VERIFIED_MANUAL[key]) { verified++; continue; }
    manual++;
    console.log('? 待人工核（新的、動態路由對不到 handler）：' + key + '  ' + c.file + ':' + c.line);
    continue;
  }
  const known = backend[c.handler].fields;
  const exp = EXPECTED_UNREAD[c.method + ' ' + c.path] || {};
  const ghost = c.keys.filter((k) => !known.has(k) && !exp[k]);
  if (ghost.length) {
    bad++;
    console.log('✗ ' + c.method + ' ' + c.path + '  → ' + c.handler);
    console.log('   ' + c.file + ':' + c.line);
    console.log('   後端未讀取：' + ghost.join(', ') + '\n');
  }
}
console.log('---');
console.log('可疑 ' + bad + ' 處｜待人工核 ' + manual + ' 處｜已人工驗證 ' + verified + ' 處｜自動確認正常 ' + (calls.length - bad - manual - verified) + ' 處');
process.exit(bad > 0 ? 1 : 0);
