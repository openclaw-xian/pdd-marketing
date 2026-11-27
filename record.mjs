// 店铺运营日志：一 skill 一账本，按月分、超量自动拆、商品历史按年。
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const SKILL_DIRS = {
  "pdd-marketing": "营销活动",
  "pdd-edit-goods": "商品编辑",
  "pdd-ego-listing": "商品上架",
  "pdd-delist": "商品下架",
  "pdd-logistics": "物流设置",
  "pdd-bills": "账单导出",
  "pdd-order-export": "订单导出",
  "pdd-kefu-performance": "客服绩效",
  "pdd-bookkeeping": "记账总控",
};
const DEFAULT_SKILL = "pdd-marketing";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINES = 5000;

export function resolveLedgerRoot(cfg = {}) {
  return String(cfg.ledgerRoot || process.env.PDD_LEDGER_ROOT || path.join(process.env.USERPROFILE || os.homedir(), "店铺运营日志")).replace(/\\/g, "/").replace(/\/$/, "");
}
export function skillFolder(skill) { return SKILL_DIRS[skill] || String(skill || DEFAULT_SKILL); }
function safeName(s) { return String(s || "unknown").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_"); }
function pad(n) { return String(n).padStart(2, "0"); }
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function yearKey(d) { return String(d.getFullYear()); }
function localTime(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

async function walkFiles(dir) {
  const out = [];
  let ents = [];
  try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkFiles(p));
    else out.push(p);
  }
  return out;
}

async function pickLedgerFile(monthDir) {
  await fs.mkdir(monthDir, { recursive: true });
  const files = (await fs.readdir(monthDir)).filter((x) => /^操作记录(?:-\d+)?\.jsonl$/.test(x)).sort();
  if (!files.length) return path.join(monthDir, "操作记录.jsonl");
  const last = path.join(monthDir, files[files.length - 1]);
  const st = await fs.stat(last).catch(() => null);
  if (!st) return path.join(monthDir, "操作记录.jsonl");
  let lines = 0;
  if (st.size < MAX_BYTES) {
    const text = await fs.readFile(last, "utf8");
    lines = text.split(/\r?\n/).filter(Boolean).length;
  }
  if (st.size < MAX_BYTES && lines < MAX_LINES) return last;
  return path.join(monthDir, `操作记录-${pad(files.length + 1)}.jsonl`);
}

async function updateIndex(root, entry) {
  const indexFile = path.join(root, "索引.json");
  let index = { updatedAt: "", entries: [] };
  try { index = JSON.parse(await fs.readFile(indexFile, "utf8")); } catch {}
  if (!Array.isArray(index.entries)) index.entries = [];
  const hit = index.entries.find((x) => x.skill === entry.skill && x.shop === entry.shop && x.month === entry.month && x.file === entry.file);
  if (hit) { hit.count = (hit.count || 0) + 1; hit.lastTime = entry.lastTime; }
  else index.entries.push({ ...entry, count: 1 });
  index.updatedAt = new Date().toISOString();
  await fs.writeFile(indexFile, JSON.stringify(index, null, 1), "utf8");
  const lines = ["# 店铺运营日志总览", "", `更新时间：${localTime(new Date())}`, "", "| 分类 | 店铺 | 月份 | 账本 | 条数 | 最后操作 |", "|---|---|---|---|---:|---|", ...index.entries.map((x) => `| ${x.skill} | ${x.shop} | ${x.month} | ${x.file} | ${x.count} | ${x.lastTime || ""} |`)];
  await fs.writeFile(path.join(root, "总览.md"), lines.join("\n") + "\n", "utf8");
}

export async function appendOperation({ root, skill = DEFAULT_SKILL, shop, action, goodsId, goodsName, targetId, target, before, after, result, runId, evidence, repeatOf }) {
  const now = new Date();
  const time = now.toISOString();
  const timeLocal = localTime(now);
  const month = monthKey(now);
  const year = yearKey(now);
  const base = path.join(root, skillFolder(skill), safeName(shop));
  const monthDir = path.join(base, month);
  const file = await pickLedgerFile(monthDir);
  const record = {
    recordId: `${runId || "run"}-${goodsId || "goods"}-${Date.now()}`,
    time, timeLocal, shop, action, goodsId: String(goodsId || ""), goodsName: goodsName || "",
    targetId: targetId ? String(targetId) : "", target: target || "",
    before: before ?? null, after: after ?? null, result: result || "unknown",
    runId: runId || "", evidence: evidence || "", repeatOf: repeatOf || null,
  };
  await fs.appendFile(file, JSON.stringify(record) + "\n", "utf8");
  const mdDir = path.join(base, "商品历史", year);
  await fs.mkdir(mdDir, { recursive: true });
  const md = path.join(mdDir, safeName(goodsId) + ".md");
  const exists = await fs.access(md).then(() => true).catch(() => false);
  if (!exists) await fs.writeFile(md, `# ${goodsName || goodsId}\n\n商品 ID：${goodsId}\n\n| 时间 | 动作 | 对象 | 变化 | 结果 |\n|---|---|---|---|---|\n`, "utf8");
  await fs.appendFile(md, `| ${timeLocal} | ${action} | ${target || targetId || ""} | ${before ?? ""} → ${after ?? ""} | ${result} |\n`, "utf8");
  await updateIndex(root, { skill: skillFolder(skill), shop, month, file: path.basename(file), lastTime: timeLocal });
  return record;
}

export async function findRecent({ root, skill = DEFAULT_SKILL, shop, goodsId, action, targetId, sinceDays = 90 }) {
  const base = path.join(root, skillFolder(skill), safeName(shop));
  const files = (await walkFiles(base)).filter((f) => /操作记录(?:-\d+)?\.jsonl$/.test(f));
  const since = Date.now() - Number(sinceDays) * 86400000;
  const rows = [];
  for (const file of files) {
    let text = ""; try { text = await fs.readFile(file, "utf8"); } catch { continue; }
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      try {
        const r = JSON.parse(line);
        if (String(r.goodsId) !== String(goodsId) || (action && r.action !== action) || (targetId && String(r.targetId) !== String(targetId)) || Date.parse(r.time) < since) continue;
        rows.push(r);
      } catch {}
    }
  }
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return rows.pop() || null;
}
