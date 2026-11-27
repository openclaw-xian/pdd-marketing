// 查询店铺运营日志：node record-query.mjs --goods <id> [--skill pdd-marketing|营销活动] [--shop <店铺>] [--root <店铺运营日志>] [--days 90] [--action ...] [--all] [--json]
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveLedgerRoot, skillFolder } from "./record.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    const v = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
    args[k] = v;
  }
}
if (args.help || (!args.goods && !args.shop)) {
  console.log("用法: node record-query.mjs --goods <商品ID> [--skill pdd-marketing|营销活动] [--shop <店铺>] [--root <店铺运营日志>] [--days 90] [--action platform-enroll] [--all] [--json]");
  process.exit(0);
}
const root = String(args.root || process.env.PDD_LEDGER_ROOT || resolveLedgerRoot({})).replace(/\\/g, "/");
const days = Number(args.days || 90);
const since = Date.now() - days * 86400000;
const skillDirs = args.skill ? [skillFolder(String(args.skill))] : (await fs.readdir(root, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);

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
const rows = [];
for (const skill of skillDirs) {
  const shops = args.shop ? [String(args.shop)] : (await fs.readdir(path.join(root, skill), { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory() && e.name !== "商品历史").map((e) => e.name);
  for (const shop of shops) {
    const files = (await walkFiles(path.join(root, skill, shop))).filter((f) => /操作记录(?:-\d+)?\.jsonl$/.test(f));
    for (const file of files) {
      let text = ""; try { text = await fs.readFile(file, "utf8"); } catch { continue; }
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        try {
          const r = JSON.parse(line);
          if (Date.parse(r.time) < since) continue;
          if (args.goods && String(r.goodsId) !== String(args.goods)) continue;
          if (args.action && r.action !== args.action) continue;
          rows.push({ skill, ...r });
        } catch {}
      }
    }
  }
}
rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
if (args.json) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  console.log(`店铺运营日志: ${root}`);
  console.log(`记录: ${rows.length} 条（最近 ${days} 天）`);
  for (const r of rows) {
    console.log(`${r.timeLocal || r.time} | ${r.skill} | ${r.shop} | ${r.action} | ${r.goodsId} | ${r.target || r.targetId || ""} | ${r.before ?? ""} → ${r.after ?? ""} | ${r.result}`);
  }
  if (args.goods && args.shop && args.skill) {
    const mdFiles = (await walkFiles(path.join(root, skillFolder(String(args.skill)), String(args.shop), "商品历史"))).filter((f) => f.endsWith(String(args.goods) + ".md"));
    if (mdFiles.length) console.log(`商品历史: ${mdFiles.sort().pop()}`);
  }
}
