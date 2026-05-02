#!/usr/bin/env node
/**
 * 把 Google Sheets 匯出的 CSV 轉成 D1 可吃的 SQL INSERT。
 *
 * 用法：
 *   node scripts/sheets-import/transform.mjs
 *
 * 產出：
 *   worker/migrations/0007_data_migration.sql
 *
 * 同時在 console 印出每張表插入的筆數，方便核對。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(__dirname, 'csv');
// 含客戶個資；放在 scripts/sheets-import/output/，由 .gitignore 排除，不會推上 GitHub
const OUT_FILE = join(__dirname, 'output', '0007_data_migration.sql');

// ── RFC 4180 CSV 解析（支援雙引號、跨行）─────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
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
  // 過濾完全空白列
  return rows.filter(r => r.some(v => v !== ''));
}

function readCSV(name) {
  const text = readFileSync(join(CSV_DIR, name), 'utf-8');
  const rows = parseCSV(text);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(h => h.trim());
  const records = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, records };
}

// ── 值正規化 ────────────────────────────────────────────────────
function normDate(s) {
  if (!s) return '';
  // 接受 2026-04-03 / 2026/4/3 / 2026/04/03
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return s; // 看不懂就原樣
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function toInt(v, def = 0) {
  if (v === '' || v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function toBool(v, def = 0) {
  if (v === '' || v == null) return def;
  const s = String(v).trim().toUpperCase();
  if (s === 'TRUE' || s === '1' || s === 'YES') return 1;
  if (s === 'FALSE' || s === '0' || s === 'NO') return 0;
  return def;
}

function sqlStr(v) {
  if (v == null) return "''";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) { return String(v); }

// ── INSERT 語句產生器 ────────────────────────────────────────────
function buildInsert(table, columns, records, valuesFn) {
  if (!records.length) return `-- ${table}: (空)\n`;
  const colList = columns.join(', ');
  const lines = [];
  lines.push(`-- ${table}: ${records.length} 筆`);
  lines.push(`DELETE FROM ${table};`);
  // 每 50 筆切一個 INSERT，避免單句過長
  const CHUNK = 50;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const valuesSql = chunk.map(r => '  (' + valuesFn(r).join(', ') + ')').join(',\n');
    lines.push(`INSERT INTO ${table} (${colList}) VALUES\n${valuesSql};`);
  }
  return lines.join('\n') + '\n';
}

// ── 開始轉換 ────────────────────────────────────────────────────
const sqlChunks = [];
sqlChunks.push('-- ============================================================');
sqlChunks.push('-- 0007: 從 Google Sheets 搬遷既有資料到 D1');
sqlChunks.push('-- 由 scripts/sheets-import/transform.mjs 自動產生，請勿手動編輯');
sqlChunks.push('-- ============================================================\n');

const counts = {};

// ── agency_accounts ──
{
  const { records } = readCSV('DropInn-Booking - AgencyAccounts.csv');
  const cols = ['agencyId','loginId','passwordHash','displayName','createdAt','updatedAt','isActive','adminNote','approvalStatus','visiblePartners'];
  const sql = buildInsert('agency_accounts', cols, records, r => [
    sqlStr(r.agencyId),
    sqlStr(r.loginId),
    sqlStr(r.passwordHash),
    sqlStr(r.displayName),
    sqlStr(r.createdAt || ''),
    sqlStr(r.createdAt || ''),
    sqlNum(toBool(r.isActive, 1)),
    sqlStr(r.adminNote || ''),
    sqlStr(r.approvalStatus || 'approved'),
    sqlStr(r.visiblePartners || '[]'),
  ]);
  sqlChunks.push(sql);
  counts.agency_accounts = records.length;
}

// ── agency_properties ──
{
  const { records } = readCSV('DropInn-Booking - AgencyProperties.csv');
  const cols = ['propertyId','agencyId','propertyName','sortOrder','isActive','colorKey'];
  const sql = buildInsert('agency_properties', cols, records, r => [
    sqlStr(r.propertyId),
    sqlStr(r.agencyId),
    sqlStr(r.propertyName),
    sqlNum(toInt(r.sortOrder, 1)),
    sqlNum(toBool(r.isActive, 1)),
    sqlStr(r.colorKey || 'A'),
  ]);
  sqlChunks.push(sql);
  counts.agency_properties = records.length;
}

// ── agency_blocks ──
{
  const { records } = readCSV('DropInn-Booking - AgencyBlocks.csv');
  const cols = ['propertyId','date','createdAt','updatedAt','source'];
  const sql = buildInsert('agency_blocks', cols, records, r => [
    sqlStr(r.propertyId),
    sqlStr(normDate(r.date)),
    sqlStr(r.createdAt || ''),
    sqlStr(r.updatedAt || r.createdAt || ''),
    sqlStr(r.source || 'agency'),
  ]);
  sqlChunks.push(sql);
  counts.agency_blocks = records.length;
}

// ── agency_groups ──
{
  const { records } = readCSV('DropInn-Booking - AgencyGroups.csv');
  const cols = ['groupId','groupName','members','createdAt'];
  const sql = buildInsert('agency_groups', cols, records, r => [
    sqlStr(r.groupId),
    sqlStr(r.groupName),
    sqlStr(r.members || '[]'),
    sqlStr(r.createdAt || ''),
  ]);
  sqlChunks.push(sql);
  counts.agency_groups = records.length;
}

// ── orders（最重要）──
{
  const { records } = readCSV('DropInn-Booking - 訂單_2026.csv');
  // 過濾掉空白 orderID 的列
  const valid = records.filter(r => r.orderID && r.orderID.startsWith('DROP-'));
  const cols = [
    'orderID','name','phone','email',
    'checkIn','checkOut','rooms','extraBeds',
    'originalTotal','totalPrice','paidDeposit','remainingBalance',
    'discountCode','discountType','discountValue','discountAmount',
    'isReturningGuest','complimentaryNote',
    'sourceType','agencyName','addonAmount','extraIncome',
    'notes','internalNotes','housekeepingNote','hasCarRental',
    'status','cancelReason',
    'emailSent','reminderSent','travelGuideSent','travelGuideSentAt',
    'publicCalendarEventID','housekeepingCalendarEventID',
    'lastCalendarSync','calendarSyncStatus','calendarSyncNote',
    'lastUpdated','updatedBy','timestamp',
  ];
  const sql = buildInsert('orders', cols, valid, r => [
    sqlStr(r.orderID),
    sqlStr(r.name),
    sqlStr(r.phone),
    sqlStr(r.email),
    sqlStr(normDate(r.checkIn)),
    sqlStr(normDate(r.checkOut)),
    sqlNum(toInt(r.rooms, 1)),
    sqlNum(toInt(r.extraBeds, 0)),
    sqlNum(toInt(r.originalTotal, 0)),
    sqlNum(toInt(r.totalPrice, 0)),
    sqlNum(toInt(r.paidDeposit, 0)),
    sqlNum(toInt(r.remainingBalance, 0)),
    sqlStr(r.discountCode),
    sqlStr(r.discountType),
    sqlStr(r.discountValue),
    sqlNum(toInt(r.discountAmount, 0)),
    sqlNum(toBool(r.isReturningGuest, 0)),
    sqlStr(r.complimentaryNote),
    sqlStr(r.sourceType || '自家'),
    sqlStr(r.agencyName),
    sqlNum(toInt(r.addonAmount, 0)),
    sqlNum(toInt(r.extraIncome, 0)),
    sqlStr(r.notes),
    sqlStr(r.internalNotes),
    sqlStr(r.housekeepingNote),
    sqlNum(toBool(r.hasCarRental, 0)),
    sqlStr(r.status || '洽談中'),
    sqlStr(r.cancelReason),
    sqlNum(toBool(r.emailSent, 0)),
    sqlNum(toBool(r.reminderSent, 0)),
    sqlNum(toBool(r.travelGuideSent, 0)),
    sqlStr(r.travelGuideSentAt),
    sqlStr(r.publicCalendarEventID),
    sqlStr(r.housekeepingCalendarEventID),
    sqlStr(r.lastCalendarSync),
    sqlStr(r.calendarSyncStatus),
    sqlStr(r.calendarSyncNote),
    sqlStr(r.lastUpdated),
    sqlStr(r.updatedBy),
    sqlStr(r.timestamp || r.lastUpdated || ''),
  ]);
  sqlChunks.push(sql);
  counts.orders = valid.length;
}

// ── cost_rows（訂單支出）──
{
  const { records } = readCSV('DropInn-Booking - 支出_2026.csv');
  const valid = records.filter(r => r.orderID && r.orderID.startsWith('DROP-'));
  const cols = ['orderID','name','checkIn','rebateAmount','complimentaryAmount','otherCost','addonCost','note'];
  const sql = buildInsert('cost_rows', cols, valid, r => [
    sqlStr(r.orderID),
    sqlStr(r.name),
    sqlStr(normDate(r.checkIn)),
    sqlNum(toInt(r.rebateAmount, 0)),
    sqlNum(toInt(r.complimentaryAmount, 0)),
    sqlNum(toInt(r.otherCost, 0)),
    sqlNum(toInt(r.addonCost, 0)),
    sqlStr(r.note),
  ]);
  sqlChunks.push(sql);
  counts.cost_rows = valid.length;
}

// ── system_counters（訂單流水號）──
{
  const { records } = readCSV('DropInn-Booking - 系統計數器.csv');
  const valid = records.filter(r => r.DatePrefix);
  const cols = ['datePrefix','currentCount'];
  const sql = buildInsert('system_counters', cols, valid, r => [
    sqlStr(r.DatePrefix),
    sqlNum(toInt(r.CurrentCount, 0)),
  ]);
  sqlChunks.push(sql);
  counts.system_counters = valid.length;
}

// ── spots（旅遊景點）──
{
  const { records } = readCSV('DropInn-Booking - 旅遊景點.csv');
  const valid = records.filter(r => r.id);
  const cols = ['id','type','cat','route','name','area','rating','price','note','feature','tags','lat','lng','nearby','status','noLoc'];
  const sql = buildInsert('spots', cols, valid, r => [
    sqlStr(r.id),
    sqlStr(r.type),
    sqlStr(r.cat),
    sqlStr(r.route),
    sqlStr(r.name),
    sqlStr(r.area),
    sqlNum(toInt(r.rating, 0)),
    sqlStr(r.price),
    sqlStr(r.note),
    sqlStr(r.feature),
    sqlStr(r.tags),
    sqlNum(parseFloat(r.lat) || 0),
    sqlNum(parseFloat(r.lng) || 0),
    sqlNum(toBool(r.nearby, 0)),
    sqlStr(r.status || 'open'),
    sqlNum(toBool(r.noLoc, 0)),
  ]);
  sqlChunks.push(sql);
  counts.spots = valid.length;
}

// ── coupons（折扣碼，目前只有欄位說明，無資料）──
{
  const { records } = readCSV('DropInn-Booking - 折扣碼.csv');
  // 第一列其實是說明文字，不是資料；過濾 type 必須是 fixed/percent/per_night_fixed
  const valid = records.filter(r => ['fixed','percent','per_night_fixed'].includes(String(r.type || '').trim()));
  const cols = ['code','type','value','description','useLimit','usedCount','validFrom','validTo','active'];
  const sql = buildInsert('coupons', cols, valid, r => [
    sqlStr(r.code),
    sqlStr(r.type),
    sqlNum(parseFloat(r.value) || 0),
    sqlStr(r.description),
    sqlNum(toInt(r.useLimit, 0)),
    sqlNum(toInt(r.usedCount, 0)),
    sqlStr(normDate(r.validFrom)),
    sqlStr(normDate(r.validTo)),
    1,
  ]);
  sqlChunks.push(sql);
  counts.coupons = valid.length;
}

// ── monthly_expenses（月費，目前空表，仍輸出 DELETE 清空）──
{
  const { records } = readCSV('DropInn-Booking - 月費_2026.csv');
  const valid = records.filter(r => r.yearMonth);
  const cols = ['yearMonth','laundry','water','electricity','internet','platformFee','landTax','insurance','other','note'];
  const sql = buildInsert('monthly_expenses', cols, valid, r => [
    sqlStr(r.yearMonth),
    sqlNum(toInt(r.laundry, 0)),
    sqlNum(toInt(r.water, 0)),
    sqlNum(toInt(r.electricity, 0)),
    sqlNum(toInt(r.internet, 0)),
    sqlNum(toInt(r.platformFee, 0)),
    sqlNum(toInt(r.landTax, 0)),
    sqlNum(toInt(r.insurance, 0)),
    sqlNum(toInt(r.other, 0)),
    sqlStr(r.note),
  ]);
  sqlChunks.push(sql);
  counts.monthly_expenses = valid.length;
}

// ── 推薦記錄（目前空表）──
{
  const { records } = readCSV('DropInn-Booking - 推薦記錄.csv');
  const valid = records.filter(r => r.recordID);
  const cols = ['recordID','date','agencyName','rebateAmount','notes'];
  const sql = buildInsert('referral_records', cols, valid, r => [
    sqlStr(r.recordID),
    sqlStr(normDate(r.date)),
    sqlStr(r.agencyName),
    sqlNum(toInt(r.rebateAmount, 0)),
    sqlStr(r.notes),
  ]);
  sqlChunks.push(sql);
  counts.referral_records = valid.length;
}

// ── 寫檔 ────────────────────────────────────────────────────
writeFileSync(OUT_FILE, sqlChunks.join('\n'));
console.log('✅ Generated:', OUT_FILE);
console.log('📊 筆數：');
for (const [k, v] of Object.entries(counts)) {
  console.log(`   ${k.padEnd(22)} ${v}`);
}
