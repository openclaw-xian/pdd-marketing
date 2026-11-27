// 查询操作账本：node record-query.mjs --goods <id> [--skill pdd-marketing] [--shop <店铺>] [--root <目录>] [--days 90] [--action ...] [--all] [--json]
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

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
  console.log("用法: node record-query.mjs --goods <商品ID> [--skill pdd-marketing] [--shop <店铺>] [--root <账本根目录>] [--days 90] [--action platform-enroll] [--all] [--json]");
  process.exit(0);
}
const root = String(args.root || process.env.PDD_LEDGER_ROOT || path.join(process.env.USERPROFILE || os.homedir(), "pdd-records")).replace(/\\/g, "/");
const days = Number(args.days || 90);
const since = Date.now() - days * 86400000;
const skillNames = args.skill ? [String(args.skill)] : (await fs.readdir(root).catch(() => [])).filter((x) => !x.startsWith("_"));
const rows = [];
for (const skill of skillNames) {
  const shops = args.shop ? [String(args.shop)] : (await fs.readdir(path.join(root, skill)).catch(() => [])).filter((x) => !x.startsWith("_") && x !== "products");
  for (const shop of shops) {
    let text = "";
    try { text = await fs.readFile(path.join(root, skill, shop, "operations.jsonl"), "utf8"); } catch { continue; }
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
rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
if (args.json) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  console.log(`账本根目录: ${root}`);
  console.log(`记录: ${rows.length} 条（最近 ${days} 天）`);
  for (const r of rows) {
    console.log(`${r.timeLocal || r.time} | ${r.skill} | ${r.shop} | ${r.action} | ${r.goodsId} | ${r.target || r.targetId || ""} | ${r.before ?? ""} → ${r.after ?? ""} | ${r.result}`);
  }
  if (args.goods && args.shop && args.skill) console.log(`商品历史: ${path.join(root, String(args.skill), String(args.shop), "products", String(args.goods) + ".md")}`);
}
