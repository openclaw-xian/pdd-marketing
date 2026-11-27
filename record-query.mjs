// 查询商品主档：node record-query.mjs --shop <店铺> [--goods <商品ID>] [--root <店铺运营日志>] [--days 90] [--action ...] [--skill ...] [--json]
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
  console.log("用法: node record-query.mjs --shop <店铺> [--goods <商品ID>] [--root <店铺运营日志>] [--days 90] [--action platform-enroll] [--skill pdd-marketing] [--json]");
  process.exit(0);
}
const rootArg = String(args.root || process.env.PDD_LEDGER_ROOT || "").replace(/\\/g, "/");
if (!rootArg) { console.error("请指定 --root <店铺运营日志目录>，不要默认 C 盘"); process.exit(2); }
const root = rootArg;
const days = Number(args.days || 90);
const since = Date.now() - days * 86400000;
const shop = args.shop ? String(args.shop) : null;
const productRoot = path.join(root, "商品");
const shops = shop ? [shop] : (await fs.readdir(productRoot, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name);
const rows = [];
const states = [];
for (const s of shops) {
  const goodsIds = args.goods ? [String(args.goods)] : (await fs.readdir(path.join(productRoot, s), { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const g of goodsIds) {
    const dir = path.join(productRoot, s, g);
    try { states.push(JSON.parse(await fs.readFile(path.join(dir, "商品档案.json"), "utf8"))); } catch {}
    let text = ""; try { text = await fs.readFile(path.join(dir, "操作记录.jsonl"), "utf8"); } catch { continue; }
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      try {
        const r = JSON.parse(line);
        if (Date.parse(r.time) < since) continue;
        if (args.action && r.action !== args.action) continue;
        if (args.skill && r.skill !== args.skill) continue;
        rows.push({ shop: s, ...r });
      } catch {}
    }
  }
}
rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
if (args.json) console.log(JSON.stringify({ states, rows }, null, 1));
else {
  console.log(`店铺运营日志: ${root}`);
  for (const st of states) console.log(`商品 ${st.shop}/${st.goodsId} ${st.goodsName || ""} | 状态=${st.lifecycleStatus} | 活动=${(st.activeActivities || []).map((x) => `${x.activityId}:${x.status}`).join(",") || "-"} | 最后=${st.lastTime || "-"}`);
  console.log(`记录: ${rows.length} 条（最近 ${days} 天）`);
  for (const r of rows) console.log(`${r.timeLocal || r.time} | ${r.shop} | ${r.goodsId} | ${r.skill} | ${r.action} | ${r.target || r.targetId || ""} | ${r.phase}/${r.result}`);
}
