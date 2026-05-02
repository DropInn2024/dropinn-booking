#!/usr/bin/env node
/**
 * 把 csv/ 裡的來源 CSV 與遠端 D1 逐表比對。
 *
 * 用法：
 *   node scripts/sheets-import/verify.mjs
 *
 * 邏輯：
 *   1. 對每張表，比對「筆數」
 *   2. 比對「主鍵集合」（CSV 的主鍵 vs D1 的主鍵），列出兩邊缺/多的 ID
 *   3. 抽樣比對關鍵欄位（金額、日期、姓名等），列出不一致
 *
 * 注意：此腳本「只讀不寫」，不會改 D1 任何資料。
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(__dirname, 'csv');
const WORKER_DIR = join(__dirname, '..', '..', 'worker');

// ── CSV parser（與 transform.mjs 一致）─────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}
function readCSV(name) {
  const text = readFileSync(join(CSV_DIR, name), 'utf-8');
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

// ── D1 查詢 ───────────────────────────────────────────
function d1(sql) {
  const out = execSync(
    `npx wrangler d1 execute dropinn-db --remote --json --command ${JSON.stringify(sql)} 2>/dev/null`,
    { cwd: WORKER_DIR, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );
  try {
    const j = JSON.parse(out);
    return j[0].results || [];
  } catch (e) {
    console.error('D1 parse error for SQL:', sql);
    console.error(out.slice(0, 500));
    return [];
  }
}

// ── 比對工具 ──────────────────────────────────────────
const DIFFS = [];
function rec(table, kind, msg) {
  DIFFS.push({ table, kind, msg });
  console.log(`  ${kind === 'OK' ? '✓' : kind === 'WARN' ? '⚠' : '✗'} [${kind}] ${msg}`);
}

function normDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return String(s);
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}
function num(v) {
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function check(table, csvRows, d1Rows, keyField, sampleFields = []) {
  console.log(`\n── ${table} ──`);
  if (csvRows.length === d1Rows.length) {
    rec(table, 'OK', `筆數一致（${csvRows.length}）`);
  } else {
    rec(table, 'FAIL', `筆數不一致：CSV=${csvRows.length}，D1=${d1Rows.length}`);
  }

  // 主鍵集合對比
  const csvKeys = new Set(csvRows.map(r => String(r[keyField] || '').trim()).filter(Boolean));
  const d1Keys  = new Set(d1Rows.map(r => String(r[keyField] || '').trim()).filter(Boolean));
  const onlyCSV = [...csvKeys].filter(k => !d1Keys.has(k));
  const onlyD1  = [...d1Keys].filter(k => !csvKeys.has(k));
  if (!onlyCSV.length && !onlyD1.length) {
    rec(table, 'OK', `主鍵集合完全一致`);
  } else {
    if (onlyCSV.length) rec(table, 'FAIL', `CSV 有但 D1 沒有：${onlyCSV.slice(0,5).join(', ')}${onlyCSV.length>5?` …+${onlyCSV.length-5}`:''}`);
    if (onlyD1.length)  rec(table, 'FAIL', `D1 有但 CSV 沒有：${onlyD1.slice(0,5).join(', ')}${onlyD1.length>5?` …+${onlyD1.length-5}`:''}`);
  }

  // 抽樣欄位比對
  const d1ById = new Map(d1Rows.map(r => [String(r[keyField] || '').trim(), r]));
  let mismatchSample = [];
  for (const cr of csvRows) {
    const k = String(cr[keyField] || '').trim();
    const dr = d1ById.get(k);
    if (!dr) continue;
    for (const f of sampleFields) {
      const cv = (f.transform || ((x) => String(x ?? '').trim()))(cr[f.csv]);
      const dv = (f.transform || ((x) => String(x ?? '').trim()))(dr[f.d1]);
      if (cv !== dv && !(f.numeric && num(cv) === num(dv))) {
        mismatchSample.push(`${k} ${f.label}: CSV="${cv}" vs D1="${dv}"`);
      }
    }
  }
  if (!mismatchSample.length) {
    rec(table, 'OK', `欄位抽樣全部一致（${sampleFields.map(f=>f.label).join('、')}）`);
  } else {
    mismatchSample.slice(0, 5).forEach(m => rec(table, 'FAIL', m));
    if (mismatchSample.length > 5) rec(table, 'WARN', `…還有 ${mismatchSample.length - 5} 筆不一致未列出`);
  }
}

// ── 開跑 ──────────────────────────────────────────────
console.log('🔍 雫旅 Sheets ↔ D1 一致性檢查\n');

// 1. 訂單
check(
  'orders',
  readCSV('DropInn-Booking - 訂單_2026.csv'),
  d1('SELECT * FROM orders'),
  'orderID',
  [
    { label: '姓名',   csv: 'name',         d1: 'name' },
    { label: '入住',   csv: 'checkIn',      d1: 'checkIn',  transform: normDate },
    { label: '退房',   csv: 'checkOut',     d1: 'checkOut', transform: normDate },
    { label: '電話',   csv: 'phone',        d1: 'phone' },
    { label: '狀態',   csv: 'status',       d1: 'status' },
    { label: '總金額', csv: 'totalPrice',   d1: 'totalPrice', numeric: true },
  ]
);

// 2. 支出
check(
  'cost_rows',
  readCSV('DropInn-Booking - 支出_2026.csv'),
  d1('SELECT * FROM cost_rows'),
  'orderID',
  [
    { label: '退佣',     csv: 'rebateAmount',         d1: 'rebateAmount',         numeric: true },
    { label: '招待金',   csv: 'complimentaryAmount',  d1: 'complimentaryAmount',  numeric: true },
    { label: '其他成本', csv: 'otherCost',            d1: 'otherCost',            numeric: true },
    { label: '加購成本', csv: 'addonCost',            d1: 'addonCost',            numeric: true },
  ]
);

// 3. 同業帳號
check(
  'agency_accounts',
  readCSV('DropInn-Booking - AgencyAccounts.csv'),
  d1('SELECT * FROM agency_accounts'),
  'agencyId',
  [
    { label: 'loginId',    csv: 'loginId',      d1: 'loginId' },
    { label: '顯示名稱',   csv: 'displayName',  d1: 'displayName' },
    { label: '密碼 hash',  csv: 'passwordHash', d1: 'passwordHash' },
  ]
);

// 4. 同業民宿
check(
  'agency_properties',
  readCSV('DropInn-Booking - AgencyProperties.csv'),
  d1('SELECT * FROM agency_properties'),
  'propertyId',
  [
    { label: 'agencyId',     csv: 'agencyId',     d1: 'agencyId' },
    { label: '名稱',         csv: 'propertyName', d1: 'propertyName' },
  ]
);

// 5. 同業關房（複合主鍵：propertyId + date）
{
  const csvBlocks = readCSV('DropInn-Booking - AgencyBlocks.csv')
    .map(r => ({ ...r, _key: `${r.propertyId}|${normDate(r.date)}` }));
  const d1Blocks = d1('SELECT * FROM agency_blocks')
    .map(r => ({ ...r, _key: `${r.propertyId}|${normDate(r.date)}` }));
  check('agency_blocks', csvBlocks, d1Blocks, '_key',
    [{ label: '來源', csv: 'source', d1: 'source' }]);
}

// 6. 同業群組
check(
  'agency_groups',
  readCSV('DropInn-Booking - AgencyGroups.csv'),
  d1('SELECT * FROM agency_groups'),
  'groupId',
  [{ label: '群組名稱', csv: 'groupName', d1: 'groupName' }]
);

// 7. 系統計數器（CSV 欄位 DatePrefix/CurrentCount，D1 改成 datePrefix/currentCount）
{
  const csv = readCSV('DropInn-Booking - 系統計數器.csv').map(r => ({
    datePrefix: r.DatePrefix,
    currentCount: r.CurrentCount,
  }));
  check(
    'system_counters', csv,
    d1('SELECT * FROM system_counters'),
    'datePrefix',
    [{ label: '值', csv: 'currentCount', d1: 'currentCount', numeric: true }]
  );
}

// 8. 景點
check(
  'spots',
  readCSV('DropInn-Booking - 旅遊景點.csv'),
  d1('SELECT * FROM spots'),
  'id',
  [
    { label: '名稱', csv: 'name', d1: 'name' },
    { label: '地區', csv: 'area', d1: 'area' },
    { label: '類別', csv: 'cat',  d1: 'cat'  },
  ]
);

// 9. drift_reviews（reviewId 為主鍵）
{
  const csv = readCSV('DropInn-Booking - DriftReviews.csv');
  const d1Rows = d1('SELECT * FROM drift_reviews');
  if (csv.length === 0 && d1Rows.length === 0) {
    console.log('\n── drift_reviews ──');
    rec('drift_reviews', 'OK', '兩邊皆空');
  } else {
    check('drift_reviews', csv, d1Rows, 'reviewId',
      [{ label: '景點 id', csv: 'spotId', d1: 'spotId' }]);
  }
}

// ── 結果摘要 ──────────────────────────────────────────
console.log('\n═══════════════════════════════════════');
const fails = DIFFS.filter(d => d.kind === 'FAIL');
const warns = DIFFS.filter(d => d.kind === 'WARN');
const oks   = DIFFS.filter(d => d.kind === 'OK');
console.log(`✅ 通過 ${oks.length}　⚠️ 警告 ${warns.length}　❌ 失敗 ${fails.length}`);
if (fails.length) {
  console.log('\n以下需要修正：');
  fails.forEach(f => console.log(`  • [${f.table}] ${f.msg}`));
  process.exit(1);
} else {
  console.log('\n🎉 所有檢查項目通過，Sheets → D1 資料一致。');
}
