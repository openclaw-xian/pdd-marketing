// 操作账本：一行一次实际操作；商品历史单独生成 Markdown。
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export function resolveLedgerRoot(cfg = {}) {
  return String(cfg.ledgerRoot || process.env.PDD_LEDGER_ROOT || path.join(process.env.USERPROFILE || os.homedir(), "pdd-records")).replace(/\\/g, "/").replace(/\/$/, "");
}

function safeName(s) {
  return String(s || "unknown").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

export async function appendOperation({ root, shop, action, goodsId, goodsName, targetId, target, before, after, result, runId, evidence, repeatOf }) {
  const time = new Date().toISOString();
  const record = {
    recordId: `${runId || "run"}-${goodsId || "goods"}-${Date.now()}`,
    time, timeLocal, shop, action, goodsId: String(goodsId || ""), goodsName: goodsName || "",
    targetId: targetId ? String(targetId) : "", target: target || "",
    before: before ?? null, after: after ?? null, result: result || "unknown",
    runId: runId || "", evidence: evidence || "", repeatOf: repeatOf || null,
  };
  const dir = path.join(root, safeName(shop));
  await fs.mkdir(path.join(dir, "products"), { recursive: true });
  await fs.appendFile(path.join(dir, "operations.jsonl"), JSON.stringify(record) + "\n", "utf8");
  const md = path.join(dir, "products", safeName(goodsId) + ".md");
  const exists = await fs.access(md).then(() => true).catch(() => false);
  if (!exists) await fs.writeFile(md, `# ${goodsName || goodsId}\n\n商品 ID：${goodsId}\n\n| 时间 | 动作 | 对象 | 变化 | 结果 |\n|---|---|---|---|---|\n`, "utf8");
  const line = `| ${timeLocal} | ${action} | ${target || targetId || ""} | ${before ?? ""} → ${after ?? ""} | ${result} |\n`;
  await fs.appendFile(md, line, "utf8");
  return record;
}

export async function findRecent({ root, shop, goodsId, action, targetId, sinceDays = 90 }) {
  const file = path.join(root, safeName(shop), "operations.jsonl");
  let text = "";
  try { text = await fs.readFile(file, "utf8"); } catch { return null; }
  const since = Date.now() - Number(sinceDays) * 86400000;
  const rows = text.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return rows.filter((r) => String(r.goodsId) === String(goodsId) && (!action || r.action === action) && (!targetId || String(r.targetId) === String(targetId)) && Date.parse(r.time) >= since).pop() || null;
}
