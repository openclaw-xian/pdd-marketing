// run.mjs — pdd-marketing 只读研究版
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const CFG_PATH = process.argv[2];
if (!CFG_PATH) { console.error("用法: node run.mjs marketing-config.json"); process.exit(2); }
const CFG = JSON.parse(await fs.readFile(CFG_PATH, "utf8"));
const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER = String(CFG.worker || path.join(SELF_DIR, "worker-marketing.mjs")).replace(/\\/g, "/");
const EGO = String(CFG.ego || path.join(os.homedir(), ".local", "share", "ego", "active_version_dir", "ego-browser.exe")).replace(/\\/g, "/");
const RECORD_ROOT = String(CFG.recordRoot || "").replace(/\\/g, "/").replace(/\/$/, "");
const RUN_ID = "marketing-" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const RUN_DIR = path.join(RECORD_ROOT || ".", "_runs", RUN_ID);
const RESULT_DIR = path.join(RUN_DIR, "results");
const LOG_DIR = path.join(RUN_DIR, "logs");
const RUNTIME = path.join(os.tmpdir(), "pdd-marketing-runtime", RUN_ID);
const mode = String(CFG.mode || "");
const shops = (CFG.shops || []).map((s) => typeof s === "string" ? { shop: s } : s).filter((s) => s && s.shop);
const issues = [];
const addIssue = (code, q) => issues.push({ code, question: q });

if (!["activity-list", "store-activity-list", "coupon-types", "coupon-audit", "coupon-create", "coupon-list", "coupon-close", "platform-preview", "platform-search", "platform-scan", "platform-enroll", "platform-record", "platform-status", "platform-inventory"].includes(mode)) addIssue("mode_invalid", "当前只读模式：activity-list / store-activity-list / coupon-types / coupon-audit / platform-preview");
if (!shops.length) addIssue("shops_missing", "config 需要 shops");
if (!CFG.recordRoot) addIssue("record_root_missing", "config 需要 recordRoot");
if (mode === "platform-preview" || mode === "platform-search" || mode === "platform-scan" || mode === "platform-enroll" || mode === "platform-inventory") {
  if (!CFG.activityId) addIssue("activity_id_missing", "需要 activityId");
  if (!CFG.activityType) addIssue("activity_type_missing", "需要 activityType");
  if ((mode === "platform-preview" || mode === "platform-search" || mode === "platform-enroll") && (!Array.isArray(CFG.goodsIds) || !CFG.goodsIds.length)) addIssue("goods_ids_missing", "platform-preview/platform-search 需要 goodsIds");
}
if (mode === "coupon-create") {
  if (!CFG.couponType) addIssue("coupon_type_missing", "coupon-create 需要 couponType");
  const storeWide = CFG.couponType === "店铺关注券" && ["all", "全店", "store"].includes(String(CFG.followScope || "").toLowerCase());
  const hasItems = Array.isArray(CFG.items) && CFG.items.length;
  if (!storeWide && !hasItems && (!Array.isArray(CFG.goodsIds) || !CFG.goodsIds.length)) addIssue("coupon_goods_ids_missing", "coupon-create 需要 goodsIds 或 items（全店关注券可传 followScope:all）");
  if (!hasItems && !Number.isFinite(Number(CFG.faceAmount))) addIssue("coupon_face_missing", "coupon-create 需要 faceAmount 或 items[].faceAmount");
  if (!hasItems && !Number.isFinite(Number(CFG.issueCount))) addIssue("coupon_issue_missing", "coupon-create 需要 issueCount 或 items[].issueCount");
}
if (mode === "coupon-close") {
  if (!CFG.goodsId && (!Array.isArray(CFG.goodsIds) || !CFG.goodsIds.length)) addIssue("coupon_close_goods_id_missing", "coupon-close 需要 goodsId 或 goodsIds");
}
if (!existsSync(EGO)) addIssue("ego_not_found", "ego-browser 不可用");
if (issues.length) { console.log("PREFLIGHT=needs_user_input"); console.log(JSON.stringify({ status: "needs_user_input", issues }, null, 1)); process.exit(3); }

await fs.mkdir(RESULT_DIR, { recursive: true });
await fs.mkdir(LOG_DIR, { recursive: true });
await fs.mkdir(RUNTIME, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOne(store, i) {
  const job = {
    shop: store.shop, profile: store.profile || null, mode,
    activityId: CFG.activityId,
    activityType: CFG.activityType,
    goodsIds: CFG.goodsIds,
    goodsId: CFG.goodsId,
    couponType: CFG.couponType,
    couponTypes: CFG.couponTypes || null,
    probeRange: CFG.probeRange === true,
    items: CFG.items || null,
    verify: CFG.verify === true,
    useDays: CFG.useDays != null ? Number(CFG.useDays) : null,
    followScope: CFG.followScope || null,
    faceAmount: CFG.faceAmount,
    issueCount: CFG.issueCount,
    perPersonLimit: CFG.perPersonLimit,
    couponName: CFG.couponName,
    couponTab: CFG.couponTab || null,
    couponAllPages: CFG.couponAllPages === true,
    keepOpen: CFG.keepOpen == null ? null : CFG.keepOpen === true,
    extraDiscount: CFG.extraDiscount != null ? Number(CFG.extraDiscount) : null,
    surpriseExtraDiscount: CFG.surpriseExtraDiscount != null ? Number(CFG.surpriseExtraDiscount) : null,
    dryRun: CFG.dryRun === true,
    confirmCreate: CFG.confirmCreate === true,
    confirmClose: CFG.confirmClose === true,
    confirmLowPrice: CFG.confirmLowPrice === true,
    selectOnly: CFG.selectOnly === true,
    expandSkus: CFG.expandSkus === true,
    confirmSubmit: CFG.confirmSubmit === true,
    trafficProtection: CFG.trafficProtection || "on",
    recordRoot: CFG.recordRoot,
    resultPath: path.join(RESULT_DIR, store.shop + ".json"),
    logPath: path.join(LOG_DIR, store.shop + ".log"),
  };
  const wrapper = path.join(RUNTIME, "job-" + i + ".mjs");
  await fs.writeFile(wrapper, "globalThis.__JOB = " + JSON.stringify(job) + ";\nawait import('file:///" + WORKER + "');\n", "utf8");
  const started = Date.now();
  const child = spawn(EGO, ["nodejs", "-e", "await import('file:///" + wrapper.replace(/\\/g, "/") + "')"], { stdio: "inherit", windowsHide: true });
  let result = null;
  const deadline = started + Number(CFG.jobTimeoutSec || 300) * 1000;
  while (!result && Date.now() < deadline) { try { result = JSON.parse(await fs.readFile(job.resultPath, "utf8")); } catch (e) { await sleep(500); } }
  if (!result) result = { ok: false, status: "failed", error: "no_result_file" };
  try { if (!child.killed) child.kill(); } catch (e) {}
  try { await fs.rm(wrapper, { force: true }); } catch (e) {}
  return { shop: store.shop, result, wallSec: Number(((Date.now() - started) / 1000).toFixed(1)) };
}
const done = [];
for (let i = 0; i < shops.length; i++) {
  const r = await runOne(shops[i], i); done.push(r);
  console.log("DONE " + r.shop + " status=" + (r.result.status || "?") + " wall=" + r.wallSec + "s" + (r.result.error ? " err=" + r.result.error : ""));
}
const report = { runId: RUN_ID, mode, recordRoot: RECORD_ROOT, stores: done.map((d) => ({ shop: d.shop, wallSec: d.wallSec, ...d.result })) };
await fs.writeFile(path.join(RUN_DIR, "report.json"), JSON.stringify(report, null, 1), "utf8");
console.log("REPORT=" + path.join(RUN_DIR, "report.json"));
const needs = report.stores.filter((s) => s.status === "needs_user_input");
if (needs.length) {
  console.log("NEEDS_USER_INPUT");
  for (const s of needs) console.log("NEEDS " + s.shop + ": " + (s.message || s.error));
  process.exit(3);
}
if (report.stores.some((s) => s.status === "failed")) process.exit(5);
