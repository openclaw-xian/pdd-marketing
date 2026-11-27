// 商品主档：所有 skill 的商品事件都写到 商品/<店铺>/<商品ID>/。
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SCHEMA_VERSION = 1;
const DEFAULT_SKILL = "pdd-marketing";
export function resolveLedgerRoot(cfg = {}) {
  return String(cfg.ledgerRoot || process.env.PDD_LEDGER_ROOT || path.join(process.env.USERPROFILE || os.homedir(), "店铺运营日志")).replace(/\\/g, "/").replace(/\/$/, "");
}
function safeName(s) { return String(s || "unknown").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_"); }
function pad(n) { return String(n).padStart(2, "0"); }
function localTime(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
export function productDir(root, shop, goodsId) { return path.join(root, "商品", safeName(shop), safeName(goodsId)); }
export function statePath(root, shop, goodsId) { return path.join(productDir(root, shop, goodsId), "商品档案.json"); }
export function eventsPath(root, shop, goodsId) { return path.join(productDir(root, shop, goodsId), "操作记录.jsonl"); }

export async function readState(root, shop, goodsId) {
  try { return JSON.parse(await fs.readFile(statePath(root, shop, goodsId), "utf8")); }
  catch { return { schemaVersion: SCHEMA_VERSION, shop, goodsId, goodsName: "", lifecycleStatus: "未知", activeActivities: [], lastPrice: null, stock: null, lastVerifiedAt: null, stale: true, lastAction: null, lastTime: null }; }
}
async function writeState(root, state) {
  await fs.mkdir(productDir(root, state.shop, state.goodsId), { recursive: true });
  state.schemaVersion = SCHEMA_VERSION;
  state.updatedAt = new Date().toISOString();
  await fs.writeFile(statePath(root, state.shop, state.goodsId), JSON.stringify(state, null, 1), "utf8");
}
export async function readEvents(root, shop, goodsId) {
  let text = ""; try { text = await fs.readFile(eventsPath(root, shop, goodsId), "utf8"); } catch { return []; }
  return text.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
async function updateIndex(root, state, event) {
  const dir = path.join(root, "索引"); await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "商品索引.json");
  let index = { updatedAt: "", entries: [] };
  try { index = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
  if (!Array.isArray(index.entries)) index.entries = [];
  const hit = index.entries.find((x) => x.shop === state.shop && String(x.goodsId) === String(state.goodsId));
  const entry = { shop: state.shop, goodsId: String(state.goodsId), goodsName: state.goodsName || "", lifecycleStatus: state.lifecycleStatus, lastAction: event.action, lastTime: event.timeLocal, activeActivities: (state.activeActivities || []).length };
  if (hit) Object.assign(hit, entry); else index.entries.push(entry);
  index.updatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(index, null, 1), "utf8");
}
async function appendEvent(root, event) {
  const dir = productDir(root, event.shop, event.goodsId);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(eventsPath(root, event.shop, event.goodsId), JSON.stringify(event) + "\n", "utf8");
  const md = path.join(dir, "商品历史.md");
  const exists = await fs.access(md).then(() => true).catch(() => false);
  if (!exists) await fs.writeFile(md, `# ${event.goodsName || event.goodsId}\n\n商品 ID：${event.goodsId}\n\n| 时间 | 来源 | 动作 | 对象 | 结果 |\n|---|---|---|---|---|\n`, "utf8");
  await fs.appendFile(md, `| ${event.timeLocal} | ${event.skill} | ${event.action} | ${event.target || event.targetId || ""} | ${event.phase}/${event.result} |\n`, "utf8");
  return event;
}

export async function recordIntent({ root, skill = DEFAULT_SKILL, shop, goodsId, goodsName, action, targetId, target, before, confirmation, runId, evidence }) {
  const now = new Date();
  const event = { schemaVersion: SCHEMA_VERSION, eventId: `${runId || "run"}-${goodsId}-${Date.now()}-intent`, phase: "intent", time: now.toISOString(), timeLocal: localTime(now), skill, shop, goodsId: String(goodsId), goodsName: goodsName || "", action, targetId: targetId ? String(targetId) : "", target: target || "", before: before ?? null, after: null, result: "pending", confirmation: confirmation || {}, runId: runId || "", evidence: evidence || "" };
  return appendEvent(root, event);
}

export async function recordResult({ root, skill = DEFAULT_SKILL, shop, goodsId, goodsName, action, targetId, target, before, after, result, confirmation, runId, evidence }) {
  const now = new Date();
  const event = { schemaVersion: SCHEMA_VERSION, eventId: `${runId || "run"}-${goodsId}-${Date.now()}-result`, phase: "result", time: now.toISOString(), timeLocal: localTime(now), skill, shop, goodsId: String(goodsId), goodsName: goodsName || "", action, targetId: targetId ? String(targetId) : "", target: target || "", before: before ?? null, after: after ?? null, result: result || "unknown", confirmation: confirmation || {}, runId: runId || "", evidence: evidence || "" };
  const state = await readState(root, shop, goodsId);
  if (goodsName) state.goodsName = goodsName;
  if (after && after.price != null) state.lastPrice = after.price;
  if (after && after.stock != null) state.stock = after.stock;
  if (after && after.lifecycleStatus) state.lifecycleStatus = after.lifecycleStatus;
  if (action === "delist" && result === "success") state.lifecycleStatus = (after && after.lifecycleStatus) || "已下架";
  if ((action === "listing" || action === "ego-listing") && result === "success") state.lifecycleStatus = (after && after.lifecycleStatus) || "审核中";
  if (action === "platform-enroll" && result === "success") {
    state.activeActivities = Array.isArray(state.activeActivities) ? state.activeActivities : [];
    const hit = state.activeActivities.find((x) => String(x.activityId) === String(targetId));
    if (hit) hit.status = (after && after.status) || "审核中";
    else state.activeActivities.push({ type: "platform", activityId: String(targetId), name: target || "", status: (after && after.status) || "审核中" });
  }
  if (action === "platform-cancel" && result === "success") {
    state.activeActivities = (state.activeActivities || []).map((x) => String(x.activityId) === String(targetId) ? { ...x, status: "已取消" } : x);
  }
  if (after && after.verified) { state.lastVerifiedAt = event.timeLocal; state.stale = false; }
  state.lastAction = action; state.lastTime = event.timeLocal; state.lastEventId = event.eventId;
  await writeState(root, state);
  await appendEvent(root, event);
  await updateIndex(root, state, event);
  return { event, state };
}

export async function assertCan({ root, skill = DEFAULT_SKILL, shop, goodsId, action, targetId }) {
  const state = await readState(root, shop, goodsId);
  const events = await readEvents(root, shop, goodsId);
  const warnings = [];
  let blocked = null;
  if (state.lifecycleStatus === "已下架" && (action === "platform-enroll" || action.startsWith("edit-goods") || action === "coupon-create")) blocked = "product_delisted";
  if (action === "delist" && state.lifecycleStatus === "已下架") blocked = "already_delisted";
  if (action === "platform-enroll" && targetId) {
    const enroll = events.filter((e) => e.phase === "result" && e.action === "platform-enroll" && e.result === "success" && String(e.targetId) === String(targetId)).pop();
    const cancel = events.filter((e) => e.phase === "result" && e.action === "platform-cancel" && e.result === "success" && String(e.targetId) === String(targetId)).pop();
    if (enroll && (!cancel || String(cancel.time) < String(enroll.time))) blocked = "duplicate_operation";
  }
  if (state.stale) warnings.push("state_stale");
  if (action === "delist" && Array.isArray(state.activeActivities) && state.activeActivities.some((x) => !["已取消", "已结束"].includes(x.status))) warnings.push("activity_active");
  return { allowed: !blocked, blocked, warnings, state };
}
