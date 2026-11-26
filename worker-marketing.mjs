// worker-marketing.mjs — 营销研究/只读模式
const fs = await import("node:fs/promises");
const os = await import("node:os");
const path = await import("node:path");
const JOB = globalThis.__JOB || {};
const T0 = Date.now();
const logs = [];
const log = (...a) => { const s = "[t=" + ((Date.now() - T0) / 1000).toFixed(1) + "s] " + a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "); logs.push(s); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPage(fn, timeoutMs = 15000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await page.waitForTimeout(intervalMs);
  }
  return null;
}
const RECORD_DIR = (JOB.recordRoot || "records").replace(/\\/g, "/").replace(/\/$/, "") + "/" + JOB.shop;
const SPACE_STATE = String(JOB.spaceStatePath || (os.homedir() + "/.pdd-marketing-spaces.json")).replace(/\\/g, "/");
let task = null, page = null;

async function writeResult(obj) {
  const out = { ...obj, shop: JOB.shop, elapsedSec: Number(((Date.now() - T0) / 1000).toFixed(1)) };
  if (JOB.resultPath) { await fs.mkdir(path.dirname(JOB.resultPath), { recursive: true }).catch(() => {}); await fs.writeFile(JOB.resultPath, JSON.stringify(out, null, 1), "utf8").catch(() => {}); }
  if (JOB.logPath) await fs.writeFile(JOB.logPath, logs.join("\n"), "utf8").catch(() => {});
  return out;
}
async function loadState() { try { return JSON.parse(await fs.readFile(SPACE_STATE, "utf8")); } catch (e) { return {}; } }
async function saveState(s) { try { await fs.writeFile(SPACE_STATE, JSON.stringify(s, null, 1), "utf8"); } catch (e) {} }

async function openShop() {
  const ps = await profiles();
  const prof = ps.find((x) => String(x.name || "") === String(JOB.profile || ""));
  if (!prof) throw new Error("shop_not_logged_in:" + JOB.profile);
  const spaces = await listTaskSpaces();
  const state = await loadState();
  const key = String(JOB.profile || "");
  const preferred = state[key] && state[key].name ? String(state[key].name) : "";
  const ours = spaces.filter((s) => /^pdd-marketing-/.test(String(s.name || "")) && String(s.profileName || "") === key);
  let entry = preferred ? ours.find((s) => String(s.name || "") === preferred) : null;
  if (!entry && ours.length) entry = ours[0];
  if (!entry) {
    const name = "pdd-marketing-" + JOB.shop;
    task = await taskSpace(name, { profileId: prof.id });
    state[key] = { name }; await saveState(state); log("space_new", JSON.stringify({ id: task.id, name }));
    page = (await task.pages())[0] || await task.newPage();
  } else {
    task = String(entry.ownership) === "agent" ? await taskSpace(entry.id) : await takeOverTaskSpace(entry.id);
    state[key] = { name: String(entry.name || "") }; await saveState(state);
    log("space", JSON.stringify({ id: entry.id, name: entry.name, ownership: entry.ownership }));
    page = (await task.pages())[0] || await task.newPage();
  }
}

async function clickPageNumber(n) {
  const h = await page.evaluate((n) => {
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const all=[...document.querySelectorAll("[class*=PGT_pagerItem]")].filter((x)=>vis(x)&&!x.children.length&&t(x)===String(n)); const groups=[...new Set(all.map((x)=>x.parentElement))]; const maxPage=(g)=>Math.max(...[...g.querySelectorAll("[class*=PGT_pagerItem]")].map((x)=>Number(t(x)||0)).filter((x)=>Number.isFinite(x)),0); const bottom=groups.sort((a,b)=>maxPage(b)-maxPage(a))[0]; const els=bottom?[...bottom.querySelectorAll("[class*=PGT_pagerItem]")].filter((x)=>vis(x)&&!x.children.length&&t(x)===String(n)) : all;
    const el=els[els.length-1]; if(!el)return null;
    el.scrollIntoView({block:"center",inline:"center"});
    const r=el.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  }, n);
  if (!h) return false;
  await page.mouse.click(h.x, h.y);
  await page.waitForTimeout(2500);
  return true;
}

async function clickMainListNext() {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const vis=(x)=>!!x.offsetParent;
    const items=[...document.querySelectorAll("[class*=PGT_pagerItem]")].filter(vis);
    const groups=[...new Set(items.map((x)=>x.parentElement))];
    for (const g of groups) {
      let n=g; let hasCards=false;
      for(let j=0;j<8&&n;j++){ n=n.parentElement; if(!n)break; if([...n.querySelectorAll("[class*=activity-item_newContainer]")].some(vis)){hasCards=true;break;} }
      if(!hasCards) continue;
      let next=g.querySelector("[class*=PGT_pagerNext]");
      if(!next) next=[...g.querySelectorAll("button,span,div,a")].find((x)=>vis(x)&&(t(x)===">"||t(x)==="下一页"));
      if(!next) continue;
      if(String(next.className).includes("disabled")||next.disabled) continue;
      next.scrollIntoView({block:"center",inline:"center"});
      const r=next.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    }
    return null;
  });
  if (!h) return false;
  await page.mouse.click(h.x,h.y);
  await page.waitForTimeout(2500);
  return true;
}
async function clickMainListPage(n) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const h = await page.evaluate((n) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const onScreen=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.x>=0&&r.x<innerWidth&&r.y>=0&&r.y<innerHeight;};
    const items=[...document.querySelectorAll("[class*=PGT_pagerItem]")].filter(onScreen);
    for (const item of items) {
      if (t(item)!==String(n)) continue;
      const r=item.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    }
    return null;
  }, n);
  if (!h) return false;
  await page.mouse.click(h.x, h.y);
  await page.waitForTimeout(2500);
  return true;
}
async function activityList() {
  await page.goto("https://mms.pinduoduo.com/act/index?SourceType=MMSActicon", { timeout: 60000 });
  await page.waitForTimeout(6000);
  await dismissBlockingModals();
  const all=[]; const seen=new Set();
  for (let p=1;p<=8;p++) {
    const one=await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const vis=(x)=>!!x.offsetParent;
      const cards=[...document.querySelectorAll("[class*=activity-item_newContainer]")].filter(vis).filter((c)=>!c.closest("[class*=activity-list-drawer]"));
      const out=[];
      for(const c of cards){
        const tx=t(c); const m=tx.match(/ID:\s*(\d+)/); if(!m)continue;
        let title="";
        const titleEl=c.querySelector("[class*=activity-item_newActivityName]");
        if(titleEl) title=t(titleEl);
        if(!title){
          const before=tx.split(/\s+ID:/)[0]||"";
          title=before.replace(/^(建议报名|报名成功过|已收藏|收藏)\s*/,"").trim();
        }
        out.push({activityId:m[1],title,text:tx.slice(0,300)});
      }
      return out;
    });
    for(const x of one)if(!seen.has(x.activityId)){seen.add(x.activityId);all.push(x);}
    if(!(await clickMainListPage(p+1)))break;
  }
  return {count:all.length,pages:Math.ceil(all.length/19),activities:all};
}
async function storeActivityClickText(text, exact = true) {
  const pos = await page.evaluate(({ text, exact }) => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    let els = [...document.querySelectorAll("label,div,span,button,a")].filter(x => vis(x) && (exact ? t(x) === text : t(x).includes(text)));
    if (!els.length) return null;
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const el = els[0];
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: t(el).slice(0, 80), cls: String(el.className || "").slice(0, 120) };
  }, { text, exact });
  if (!pos) return null;
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(800);
  return pos;
}

async function storeActivitySetName(name) {
  const pos = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /25个字以内/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), value: i.value };
  });
  if (!pos) throw new Error("store_activity_name_input_missing");
  if (String(name).length > 25) throw new Error("store_activity_name_too_long:" + String(name).length);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(name));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /25个字以内/.test(x.placeholder || ""));
    return i ? i.value : null;
  });
  if (String(after) !== String(name)) throw new Error("store_activity_name_not_applied:" + after);
  return { value: after };
}

async function storeActivityRadioState(text) {
  return page.evaluate((text) => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && t(x) === text);
    if (!els.length) return null;
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const el = els[0];
    const outer = el.closest("[class*=RD_outerWrapper]") || el.parentElement;
    return { cls: String(outer.className || ""), active: /RD_active/.test(String(outer.className || "")) };
  }, text);
}

async function storeActivitySetRadio(text) {
  const pos = await storeActivityClickText(text, true);
  if (!pos) throw new Error("store_activity_option_missing:" + text);
  await page.waitForTimeout(500);
  const st = await storeActivityRadioState(text);
  if (!st || !st.active) throw new Error("store_activity_option_not_selected:" + text);
  return st;
}

async function storeActivitySelectProducts(goodsIds) {
  if (!goodsIds.length) throw new Error("store_activity_items_missing");
  if (goodsIds.length > 30) throw new Error("store_activity_items_over_30:" + goodsIds.length);
  const open = await storeActivityClickText("选择商品", true);
  if (!open) throw new Error("store_activity_select_button_missing");
  await page.waitForTimeout(2000);
  const box = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /输入商品名称或ID/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!box) throw new Error("store_activity_picker_search_missing");
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(goodsIds.join(","));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  for (const id of goodsIds) {
    const row = await page.evaluate((id) => {
      const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
      const tr = [...document.querySelectorAll("tr")].find(x => x.offsetParent && new RegExp("ID: *" + id).test(t(x)));
      if (!tr) return null;
      const i = tr.querySelector("input[type=checkbox]");
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), checked: i.checked, disabled: i.disabled };
    }, id);
    if (!row) throw new Error("store_activity_product_not_found:" + id);
    if (row.disabled) throw new Error("store_activity_product_not_selectable:" + id);
    if (!row.checked) {
      await page.mouse.click(row.x, row.y);
      await page.waitForTimeout(400);
    }
  }
  const confirm = await storeActivityClickText("确认选择", true);
  if (!confirm) throw new Error("store_activity_confirm_select_missing");
  await page.waitForTimeout(2500);
  const count = await page.evaluate(() => {
    const m = (document.body.innerText || "").match(/已选择\s*(\d+)\s*个商品/);
    return m ? Number(m[1]) : null;
  });
  if (count != null && count !== goodsIds.length) throw new Error("store_activity_selected_count_mismatch:" + count);
  return { selectedCount: count };
}

async function storeActivityRowInfo(goodsId) {
  return page.evaluate((id) => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const tr = [...document.querySelectorAll("tr")].find(x => x.offsetParent && new RegExp("ID: *" + id).test(t(x)));
    if (!tr) return { ok: false, error: "row_missing:" + id };
    const inputs = [...tr.querySelectorAll("input")].filter(vis).map((i, idx) => {
      const r = i.getBoundingClientRect();
      return { idx, placeholder: i.placeholder, value: i.value, readOnly: i.readOnly, disabled: i.disabled, cls: String(i.className || "").slice(0, 80), html: i.outerHTML.slice(0, 240), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    const text = t(tr);
    const price = (text.match(/拼单价: *¥([0-9.]+～[0-9.]+)/) || [])[1] || null;
    const activityPrice = (text.match(/活动价: *¥([0-9.]+～[0-9.]+)/) || [])[1] || null;
    const rangeInput = inputs.find(i => /[0-9.]+～[0-9.]+/.test(i.placeholder || ""));
    return { ok: true, goodsId: id, text: text.slice(0, 500), inputs, price, activityPrice, discountRange: rangeInput ? rangeInput.placeholder : null };
  }, goodsId);
}

async function storeActivitySetRowField(goodsId, field, value) {
  const info = await storeActivityRowInfo(goodsId);
  if (!info.ok) throw new Error(info.error);
  const discountByLabel = info.inputs.find(i => /请输入折扣/.test(i.placeholder || ""));
  const discountByRange = info.inputs.find(i => /^[0-9.]+～[0-9.]+$/.test(i.placeholder || ""));
  const inp = field === "discount"
    ? (discountByLabel || discountByRange)
    : info.inputs.find(i => /^1~[0-9]+/.test(i.placeholder || ""));
  if (!inp) throw new Error("store_activity_row_field_missing:" + field + ":" + goodsId);
  if (field === "discount" && info.discountRange) {
    const m = String(info.discountRange).match(/([0-9.]+)～([0-9.]+)/);
    if (m && (Number(value) < Number(m[1]) || Number(value) > Number(m[2]))) {
      throw new Error("store_activity_discount_out_of_range:" + value + ":" + info.discountRange);
    }
  }
  const marked = await page.evaluate(({ goodsId, field }) => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const tr = [...document.querySelectorAll("tr")].find(x => x.offsetParent && new RegExp("ID: *" + goodsId).test(t(x)));
    if (!tr) return null;
    const inputs = [...tr.querySelectorAll("input")].filter(x => x.offsetParent);
    const target = field === "discount"
      ? (inputs.find(i => /请输入折扣/.test(i.placeholder || "")) || inputs.find(i => /^[0-9.]+～[0-9.]+$/.test(i.placeholder || "")))
      : inputs.find(i => /^1~[0-9]+/.test(i.placeholder || ""));
    if (!target) return null;
    target.setAttribute("data-ego-store-field", "1");
    return { placeholder: target.placeholder, value: target.value };
  }, { goodsId, field });
  if (!marked) throw new Error("store_activity_row_field_missing:" + field + ":" + goodsId);
  try { await page.click('css=[data-ego-store-field="1"]', { label: field }); }
  catch (e) { await page.mouse.click(inp.x, inp.y); }
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(value));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  let after = await storeActivityRowInfo(goodsId);
  let got = field === "discount"
    ? (after.inputs.find(i => /请输入折扣/.test(i.placeholder || "")) || after.inputs.find(i => /^[0-9.]+～[0-9.]+$/.test(i.placeholder || "")))
    : after.inputs.find(i => /^1~[0-9]+/.test(i.placeholder || ""));
  if (!got || String(got.value) !== String(value)) {
    await page.evaluate(({ goodsId, field, value }) => {
      const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
      const tr = [...document.querySelectorAll("tr")].find(x => x.offsetParent && new RegExp("ID: *" + goodsId).test(t(x)));
      if (!tr) return;
      const inputs = [...tr.querySelectorAll("input")].filter(x => x.offsetParent);
      const target = field === "discount"
        ? (inputs.find(i => /请输入折扣/.test(i.placeholder || "")) || inputs.find(i => /^[0-9.]+～[0-9.]+$/.test(i.placeholder || "")))
        : inputs.find(i => /^1~[0-9]+/.test(i.placeholder || ""));
      if (!target) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(target, String(value));
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new Event("blur", { bubbles: true }));
    }, { goodsId, field, value: String(value) });
    await page.waitForTimeout(700);
    after = await storeActivityRowInfo(goodsId);
    got = field === "discount"
      ? (after.inputs.find(i => /请输入折扣/.test(i.placeholder || "")) || after.inputs.find(i => /^[0-9.]+～[0-9.]+$/.test(i.placeholder || "")))
      : after.inputs.find(i => /^1~[0-9]+/.test(i.placeholder || ""));
  }
  if (!got || String(got.value) !== String(value)) throw new Error("store_activity_row_field_not_applied:" + field + ":" + goodsId + ":" + JSON.stringify({ before: info.inputs, after: after.inputs }));
  return { field, value: got.value };
}

async function storeActivityCheckExternalNote() {
  const read = () => page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const labels = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && t(x).includes("我已阅读并同意"));
    for (const el of labels) {
      const cb = el.querySelector("input[type=checkbox]") || el.parentElement.querySelector("input[type=checkbox]") || (el.closest("label") ? el.closest("label").querySelector("input[type=checkbox]") : null);
      if (cb) {
        const r = cb.getBoundingClientRect();
        return { found: true, checked: cb.checked, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
    }
    const el = labels.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    })[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { found: true, checked: null, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  let info = await read();
  if (!info) throw new Error("store_activity_external_note_missing");
  if (info.checked !== true) {
    await page.mouse.click(info.x, info.y);
    await page.waitForTimeout(700);
    info = await read();
  }
  if (info && info.checked === true) return { checked: true };
  const checkedClass = await page.evaluate(() => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return [...document.querySelectorAll("[class*=CBX_checked], [class*=RD_active]")].some(vis);
  });
  if (!checkedClass) throw new Error("store_activity_external_note_not_checked");
  return { checked: true };
}

async function storeActivityCreateButton() {
  return page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const b = [...document.querySelectorAll("button")].filter(x => x.offsetParent && t(x) === "创建").pop();
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), disabled: b.disabled };
  });
}

async function storeActivityVerifyList(activityName, goodsIds) {
  await page.goto("https://mms.pinduoduo.com/tool/promotion", { timeout: 60000 });
  await page.waitForTimeout(4000);
  const text = await page.evaluate(() => document.body.innerText || "");
  const rows = text.split("\n").map(x => x.trim()).filter(Boolean).filter(x => x.includes(activityName) || goodsIds.some(id => x.includes(id)));
  const verified = text.includes(activityName) && goodsIds.every(id => text.includes(id));
  return { verified, rows: rows.slice(0, 20) };
}

async function storeActivityConfirmEnd() {
  for (let i = 0; i < 10; i++) {
    const pos = await page.evaluate(() => {
      const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const title = [...document.querySelectorAll("div")].filter(x => vis(x) && t(x).includes("确定结束此活动吗"))[0];
      const btn = [...document.querySelectorAll("button,span,div")].filter(x => vis(x) && t(x) === "确认结束").pop();
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), hasTitle: !!title };
    });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(1500);
      return { clicked: true, ...pos };
    }
    await page.waitForTimeout(500);
  }
  return { clicked: false };
}

async function storeActivityDirectEnd() {
  for (let i = 0; i < 10; i++) {
    const pos = await page.evaluate(() => {
      const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const el = [...document.querySelectorAll("button,span,div")].filter(x => vis(x) && t(x) === "直接结束").pop();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(1500);
      return { clicked: true, ...pos };
    }
    await page.waitForTimeout(500);
  }
  return { clicked: false };
}

async function storeActivityClose() {
  const name = String(JOB.activityName || "").trim();
  if (!name) throw new Error("store_activity_close_name_required");
  const goodsId = String(JOB.goodsId || (JOB.goodsIds || [])[0] || "");
  await page.goto("https://mms.pinduoduo.com/tool/promotion", { timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissCouponNotices();
  let hit = null;
  for (let i = 0; i < 10; i++) {
    hit = await page.evaluate(({ name, goodsId }) => {
      const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const rows = [...document.querySelectorAll("tr")].filter(vis).filter(r => {
        const s = t(r);
        if (!s.includes(name)) return false;
        if (goodsId && !s.includes(goodsId)) return false;
        return true;
      });
      if (rows.length !== 1) return { count: rows.length };
      const b = [...rows[0].querySelectorAll("a")].find(x => vis(x) && t(x) === "结束") || [...rows[0].querySelectorAll("a,button,span,div")].filter(x => vis(x) && t(x) === "结束")[0];
      if (!b) return { count: 1, endButton: false, rowText: t(rows[0]).slice(0, 400) };
      b.setAttribute("data-ego-store-end", "1");
      const r = b.getBoundingClientRect();
      return { count: 1, endButton: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: b.tagName, href: b.getAttribute("href"), rowText: t(rows[0]).slice(0, 400) };
    }, { name, goodsId });
    if (hit && hit.count === 1 && hit.endButton) break;
    if (hit && hit.count > 1) throw new Error("store_activity_close_ambiguous:" + hit.count);
    await page.waitForTimeout(1000);
  }
  if (!hit || hit.count === 0) throw new Error("store_activity_row_not_found:" + name);
  if (!hit.endButton) throw new Error("store_activity_end_button_missing:" + name);
  if (JOB.confirmClose !== true) return { status: "preview", activityName: name, goodsId, rowText: hit.rowText, wouldClose: true, note: "confirmClose!=true: 未结束" };
  try { await page.click('css=[data-ego-store-end="1"]', { label: "结束活动" }); }
  catch (e) { await page.mouse.click(hit.x, hit.y); }
  await page.waitForTimeout(1000);
  let confirm = await storeActivityConfirmEnd();
  if (!confirm.clicked) {
    await page.evaluate(() => { const a = document.querySelector('[data-ego-store-end="1"]'); if (a) a.click(); });
    await page.waitForTimeout(1500);
    confirm = await storeActivityConfirmEnd();
  }
  const directEnd = await storeActivityDirectEnd();
  await page.waitForTimeout(2000);
  const state = await page.evaluate(({ name, goodsId }) => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const rows = [...document.querySelectorAll("tr")].filter(x => x.offsetParent).filter(r => {
      const s = t(r);
      if (!s.includes(name)) return false;
      if (goodsId && !s.includes(goodsId)) return false;
      return true;
    });
    if (!rows.length) return { found: false };
    const s = t(rows[0]);
    const hasEnd = !![...rows[0].querySelectorAll("a,button,span,div")].filter(x => x.offsetParent && t(x) === "结束")[0];
    return { found: true, status: /已结束/.test(s) ? "ended" : /进行中/.test(s) ? "active" : "unknown", hasEnd, rowText: s.slice(0, 300) };
  }, { name, goodsId });
  const closed = !state.found || state.status === "ended" || (state.found && state.hasEnd === false);
  return { status: closed ? "done" : "failed", error: closed ? undefined : "store_activity_close_not_confirmed", activityName: name, goodsId, closed, confirm, directEnd, state, text: (await page.evaluate(() => document.body.innerText || "")).slice(-1200) };
}

async function storeActivityLowPriceWarnings() {
  return page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const modals = [...document.querySelectorAll("div")].filter(x => vis(x) && t(x).includes("低价风险预警") && t(x).includes("券后价"));
    modals.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const m = modals[0];
    if (!m) return [];
    return [...m.querySelectorAll("tr")].filter(vis).map(r => [...r.querySelectorAll("td")].map(x => t(x))).filter(c => c.length >= 4 && c[0] !== "商品信息").map(c => {
      const goods = c[0] || "";
      const id = (goods.match(/ID: *([0-9]+)/) || [])[1] || null;
      const name = goods.replace(/ID: *[0-9]+/, "").trim();
      return { goods, goodsId: id, goodsName: name, price: c[1], activityPrice: c[2], couponPrice: (c[3] || "").replace("查看优惠叠加", "").trim(), reason: c[4] || "" };
    });
  });
}

async function storeActivityConfirmLowPrice() {
  const marked = await page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll("button,div,span,a")].filter(x => vis(x) && t(x).includes("确认低价创建"));
    if (!els.length) return null;
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const el = els[0];
    const target = el.closest("button") || el;
    target.scrollIntoView({ block: "center", inline: "center" });
    const r = target.getBoundingClientRect();
    target.setAttribute("data-ego-activity-lowprice", "1");
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: target.tagName, cls: String(target.className || "").slice(0, 120) };
  });
  if (!marked) return null;
  await page.mouse.click(marked.x, marked.y);
  await page.waitForTimeout(2000);
  return marked;
}

async function storeActivityEnsureTime() {
  const read = () => page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /开始时间/.test(x.placeholder || ""));
    return i ? i.value : "";
  });
  let value = await read();
  if (value) return { value, source: "default" };
  const pos = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /开始时间/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!pos) throw new Error("store_activity_time_input_missing");
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(1500);
  const conf = await page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const b = [...document.querySelectorAll("button,span,div")].filter(x => x.offsetParent && t(x) === "确认").pop();
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (conf) await page.mouse.click(conf.x, conf.y);
  await page.waitForTimeout(1200);
  value = await read();
  if (!value) throw new Error("store_activity_time_not_set");
  return { value, source: "default_confirm" };
}

async function storeActivityDisableDailyWindow() {
  const read = () => page.evaluate(() => {
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const labels = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && t(x).includes("活动在每日指定时间段内生效"));
    labels.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const el = labels[0];
    if (!el) return null;
    const box = el.closest("label[class*=CBX_outerWrapper]") || el.closest("[class*=CBX_outerWrapper]") || el.parentElement;
    const cb = box.querySelector("input[type=checkbox]");
    const checked = box.getAttribute("data-checked") === "true" || (cb ? cb.checked : false) || /CBX_active/.test(String(box.className || ""));
    const target = box.querySelector("[class*=CBX_square]") || box;
    const r = target.getBoundingClientRect();
    return { found: true, checked, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), cls: String(box.className || ""), dataChecked: box.getAttribute("data-checked") };
  });
  let st = await read();
  if (!st) return { found: false };
  if (st.checked) {
    await page.mouse.click(st.x, st.y);
    await page.waitForTimeout(600);
    st = await read();
  }
  if (st && st.checked) throw new Error("store_activity_daily_window_not_disabled:" + JSON.stringify(st));
  return { checked: false, state: st };
}

async function storeActivityCreate() {
  const type = String(JOB.activityType || "");
  if (!["限量促销", "限时促销"].includes(type)) throw new Error("store_activity_type_invalid:" + type);
  const items = (JOB.items || []).map(x => ({
    goodsId: String(x.goodsId || ""),
    discount: x.discount != null ? Number(x.discount) : null,
    stock: x.stock != null ? Number(x.stock) : null
  })).filter(x => x.goodsId);
  if (!items.length) throw new Error("store_activity_items_missing");
  if (items.length > 30) throw new Error("store_activity_items_over_30:" + items.length);
  const ids = items.map(x => x.goodsId);
  if (new Set(ids).size !== ids.length) throw new Error("store_activity_items_duplicate");
  const name = String(JOB.activityName || type);
  const autoCreate = JOB.autoCreate !== false;
  const externalNote = JOB.externalNote !== false;

  await page.goto("https://mms.pinduoduo.com/tool/promotion/create", { timeout: 60000 });
  await page.waitForTimeout(5000);
  await storeActivitySetRadio(type);
  await storeActivitySetName(name);
  if (autoCreate) await storeActivitySetRadio("活动结束后自动创建，提升下单转化");
  else await storeActivitySetRadio("活动结束后不自动创建");
  const select = await storeActivitySelectProducts(ids);
  for (const item of items) {
    if (item.discount != null) await storeActivitySetRowField(item.goodsId, "discount", item.discount);
    if (item.stock != null && type === "限量促销") await storeActivitySetRowField(item.goodsId, "stock", item.stock);
  }
  const confirmSetting = await storeActivityClickText("确认设置", true);
  if (confirmSetting) await page.waitForTimeout(1000);
  if (externalNote) await storeActivityCheckExternalNote();
  const timeApplied = null;
  const rows = [];
  for (const item of items) rows.push(await storeActivityRowInfo(item.goodsId));
  const activityTime = await page.evaluate(() => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inputs = [...document.querySelectorAll("input")].filter(vis);
    const i = inputs.find(x => /开始时间|结束时间/.test(x.placeholder || "")) || inputs.find(x => String(x.value || "").includes("~") && !/25个字/.test(x.placeholder || ""));
    return i ? { placeholder: i.placeholder, value: i.value } : null;
  });
  const selectedCount = await page.evaluate(() => {
    const m = (document.body.innerText || "").match(/已选择\s*(\d+)\s*个商品/);
    return m ? Number(m[1]) : null;
  });
  const btn = await storeActivityCreateButton();
  if (!btn) throw new Error("store_activity_create_button_missing");
  if (btn.disabled) throw new Error("store_activity_create_button_disabled");
  if (selectedCount != null && selectedCount !== items.length) throw new Error("store_activity_selected_count_mismatch:" + selectedCount);

  const preview = {
    status: "preview", activityType: type, activityName: name, autoCreate, externalNote,
    gradient: "统一梯度", selectionMode: "普通添加", activityTime, timeApplied,
    selectedCount, items: rows, createButton: { enabled: !btn.disabled },
    note: JOB.dryRun === true ? "dryRun: 未点击创建" : "confirmCreate!=true: 未点击创建（需显式 confirmCreate:true）"
  };
  if (JOB.dryRun === true || JOB.confirmCreate !== true) return preview;

  await page.mouse.click(btn.x, btn.y);
  let created = false, text = "", lowPriceConfirmed = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    text = await page.evaluate(() => document.body.innerText || "");
    if (/创建成功|提交成功|创建了/.test(text)) { created = true; break; }
    const warnings = await storeActivityLowPriceWarnings();
    const lowPriceText = /低价风险预警|确认低价创建|修改低价商品/.test(text);
    if (warnings.length || lowPriceText) {
      const warningsSummary = warnings.map((w, idx) => `${idx + 1}. ${w.goodsName || w.goods}（ID ${w.goodsId || "-"}）拼单价 ${w.price} / 活动价 ${w.activityPrice} / 券后价 ${w.couponPrice} / ${w.reason}`).join("；");
      const message = warnings.length
        ? `平台提示低价风险，未提交。共 ${warnings.length} 个 SKU：${warningsSummary}。请确认是否继续`
        : "平台提示低价风险，未提交。请查看 warningText 明细后决定是否继续";
      if (JOB.confirmLowPrice !== true) {
        return { ...preview, status: "needs_user_input", error: "store_activity_low_price_warning", message, warnings, warningsSummary, warningText: text.slice(-2500) };
      }
      if (!lowPriceConfirmed) {
        const marked = await storeActivityConfirmLowPrice();
        if (!marked) return { ...preview, status: "failed", error: "store_activity_low_price_button_missing", warnings, warningsSummary, warningText: text.slice(-2500) };
        lowPriceConfirmed = true;
        continue;
      }
    }
  }
  if (!created) return { ...preview, status: "failed", error: "store_activity_create_not_confirmed", text: text.slice(-1500) };
  let verify = null;
  if (JOB.verify !== false) verify = await storeActivityVerifyList(name, ids);
  const success = { status: "done", success: true, activityType: type, activityName: name, autoCreate, externalNote, activityTime, timeApplied, items: rows, selectedCount, text: text.slice(-1500), verified: verify ? verify.verified : null, verifyRows: verify ? verify.rows : null };
  if (verify && !verify.verified) return { ...success, status: "failed", error: "store_activity_verify_failed" };
  return success;
}

async function storeActivityList() {
  await page.goto("https://mms.pinduoduo.com/tool/promotion", { timeout: 60000 });
  await page.waitForTimeout(5000);
  const all = [];
  const seen = new Set();
  for (let p = 1; p <= 5; p++) {
    const one = await page.evaluate(() => {
      const t = (document.body.innerText || "").replace(/\r/g, "");
      const lines = t.split("\n").map((x) => x.trim()).filter(Boolean);
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        if (/ID: (\d+)/.test(lines[i])) out.push({ line: i, text: lines.slice(Math.max(0, i - 4), i + 12).join(" ") });
      }
      return out;
    });
    for (const x of one) if (!seen.has(x.text)) { seen.add(x.text); all.push(x); }
    if (!(await clickPageNumber(p + 1))) break;
  }
  return { count: all.length, rows: all };
}
async function couponTypes() {
  await page.goto("https://mms.pinduoduo.com/tool/coupon/create?chooseType=7", { timeout: 60000 });
  await page.waitForTimeout(5000);
  const open = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const el=[...document.querySelectorAll("button,span,div,a")].filter((x)=>vis(x)&&!x.children.length&&t(x)==="修改优惠券类型").pop();
    if(!el)return false; el.click(); return true;
  });
  await page.waitForTimeout(700);
  if (!open) throw new Error("coupon_type_modal_not_open");
  return page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rs=[...document.querySelectorAll("input[type=radio]")];
    return { count: rs.length, types: rs.map((r,i)=>{
      const arr=[];
      let n=r;
      for(let j=0;j<6&&n;j++){ n=n.parentElement; if(n) arr.push(t(n)); }
      const cand=arr.filter((x)=>x&&x.length<180&&x.includes("券")).sort((a,b)=>a.length-b.length)[0] || arr.find(Boolean) || "";
      return {index:i,text:cand};
    }) };
  });
}

async function expandTargetSkus(goodsIds) {
  for (const id of goodsIds) {
    const clicked = await page.evaluate((id) => {
      const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const labels=[...document.querySelectorAll("button,span,div,a")].filter((x)=>vis(x)&&!x.children.length&&/^展开更多规格/.test(t(x)));
      for (const lab of labels) {
        let n=lab;
        for (let i=0;i<10&&n;i++){ n=n.parentElement; if(!n)break; if(t(n).includes("ID: "+id)||t(n).includes("ID:"+id)){ lab.click(); return true; } }
      }
      return false;
    }, id);
    if (clicked) { log("expanded_skus", id); await page.waitForTimeout(2500); }
  }
}

async function selectedCount() {
  return page.evaluate(() => Number((document.body.innerText.match(/已选商品\s*(\d+)\s*个/) || [])[1] || 0));
}

async function dismissSearchModal() {
  const open = await page.evaluate(() => (document.body.innerText || "").includes("搜索活动商品"));
  if (!open) return false;
  const hit = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const buttons=[...document.querySelectorAll("button")].filter((x)=>x.offsetParent);
    const cancel=buttons.find((b)=>t(b)==="取消");
    if(cancel){ const r=cancel.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; }
    const close=buttons.find((b)=>t(b)==="×"||t(b)==="关闭");
    if(close){ const r=close.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; }
    return null;
  });
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(800); }
  log("dismiss_search_modal", hit ? "closed" : "no_button");
  return true;
}
async function clearSelectedProducts() {
  await dismissSearchModal();  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const header = await page.evaluate(() => {
      const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
      const ths=[...document.querySelectorAll("th")].filter(vis);
      for (const th of ths) {
        const label=th.querySelector("label");
        if (!label) continue;
        label.scrollIntoView({block:"center",inline:"center"});
        const r=label.getBoundingClientRect();
        return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
      }
      return null;
    });
    if (!header) throw new Error("select_all_checkbox_not_found");
    await page.mouse.click(header.x, header.y);
    await page.waitForTimeout(1200);
    const count = await selectedCount();
    log("clear_selected", count);
    if (count === 0) return 0;
  }
  throw new Error("default_selection_not_cleared:" + (await selectedCount()));
}
async function selectTargetProduct(goodsId) {
  await dismissSearchModal();  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const found = await locateProductByScroll(goodsId);
  if (!found) throw new Error("target_product_not_found:" + goodsId);
  const hit = await page.evaluate((id) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const tr=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent).find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
    if(!tr)return null;
    tr.scrollIntoView({block:"center"});
    const inp=tr.querySelector("input[type=checkbox]");
    if(!inp)return null;
    let label=inp;
    for(let i=0;i<5&&label;i++){ label=label.parentElement; if(label&&label.tagName==="LABEL")break; }
    if(!label||label.tagName!=="LABEL")return null;
    const r=label.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),checked:inp.checked};
  }, goodsId);
  if (!hit) throw new Error("target_checkbox_not_found:" + goodsId);
  if (!hit.checked) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(900); }
  return await selectedCount();
}
async function expandTargetProduct(goodsId) {
  const hit = await page.evaluate((id) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rows=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const tr=rows.find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
    if(!tr)return false;
    const table=tr.closest("table");
    if(!table)return false;
    const trs=[...table.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const ti=trs.indexOf(tr);
    for(let i=ti;i<Math.min(trs.length,ti+6);i++){
      const ex=trs[i];
      if(!/展开更多规格/.test(t(ex))) continue;
      const arrow=[...ex.querySelectorAll("span,svg")].filter((x)=>x.offsetParent).pop();
      if(arrow){ arrow.click(); return true; }
    }
    return false;
  }, goodsId);
  await page.waitForTimeout(2500);
  return !!hit;
}
async function markTargetProduct(goodsId) {
  return page.evaluate((id) => {
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const trs=[...document.querySelectorAll("tr")].filter(vis).filter((tr)=>new RegExp("ID[：:]\\s*"+id).test(t(tr)));
    if(!trs.length)return null;
    const tr=trs[0];
    tr.setAttribute("data-mkt-target","1");
    const lines=t(tr).split(" ").filter(Boolean);
    const idx=lines.findIndex((x)=>/ID[：:]\s*/.test(x));
    return {title: idx>0?lines[idx-1]:"", text:t(tr)};
  }, goodsId);
}

async function readTargetAfterExpand(goodsId, title) {
  return page.evaluate(({id,title}) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rows=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const tr=rows.find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
    if(!tr) return "";
    const table=tr.closest("table");
    if(!table) return t(tr);
    const trs=[...table.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const ti=trs.indexOf(tr);
    const parts=[t(tr)];
    for(let i=ti+1;i<trs.length;i++){
      const tx=t(trs[i]);
      if(/ID[：:]\\s*/.test(tx)) break;
      if(/^预览$/.test(tx) || /预览\\s/.test(tx)) break;
      parts.push(tx);
    }
    return parts.join("\n");
  }, {id:goodsId,title});
}
async function platformSearch() {
  const activityId = String(JOB.activityId || "").trim();
  const activityType = String(JOB.activityType || "").trim();
  const goodsId = String((JOB.goodsIds || [])[0] || "").trim();
  if (!activityId || !activityType || !goodsId) throw new Error("search_params_missing");
  const url = "https://mms.pinduoduo.com/act/goods_price/confirm?activityId=" + encodeURIComponent(activityId) + "&activityType=" + encodeURIComponent(activityType) + "&from=all&module=promotion&SourceType=PROMO-OwnHome&SceneType=ActivityCard";
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(6000);
  await dismissBlockingModals();
  const inp = await page.evaluate(() => {
    const i=[...document.querySelectorAll("input")].find((x)=>x.offsetParent&&x.placeholder&&x.placeholder.includes("商品名称或ID"));
    if(!i)return null; const r=i.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  });
  if (!inp) throw new Error("product_search_input_not_found");
  await page.mouse.click(inp.x, inp.y);
  await page.keyboard.press("Control+A").catch(()=>{});
  await page.keyboard.type(goodsId);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  return page.evaluate(({goodsId}) => {
    const body=document.body.innerText||""; const lines=body.split("\n").map((x)=>x.trim()).filter(Boolean);
    const start=lines.findIndex((x)=>x.includes("搜索活动商品"));
    const at=lines.findIndex((x)=>x.includes(goodsId));
    return {text:start>=0?lines.slice(start).join(" "):body.slice(-1500),found:at>=0};
  }, {goodsId});
}

async function loadAllProducts() {
  for (let i = 0; i < 10; i++) {
    const more = await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const b=[...document.querySelectorAll("button,span,div,a")].filter((x)=>x.offsetParent&&!x.children.length&&t(x)==="点击加载更多商品").pop();
      if(!b)return null; b.scrollIntoView({block:"center"});
      const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if (!more) break;
    await page.mouse.click(more.x, more.y);
    await page.waitForTimeout(1200);
  }
}

async function expandAllProducts() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const clicked = await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const rows=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent);
      for (const tr of rows) {
        if (!/展开更多规格/.test(t(tr))) continue;
        const arrow=[...tr.querySelectorAll("span,svg")].filter((x)=>x.offsetParent).pop();
        if (arrow) { arrow.click(); return true; }
      }
      return false;
    });
    if (!clicked) break;
    await page.waitForTimeout(1500);
  }
}

async function collectProductIdsByScroll() {
  const all = new Set();
  let noNew = 0;
  for (let i = 0; i < 300; i++) {
    const sh = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate((y) => window.scrollTo(0, y), Math.min(sh, i * 350));
    await page.waitForTimeout(250);
    const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll("tr")].filter((x)=>x.offsetParent).map((tr)=>((tr.innerText||"").match(/ID[：:]\s*(\d+)/)||[])[1]).filter(Boolean))]);
    const before = all.size;
    for (const id of ids) all.add(id);
    if (all.size === before) noNew++; else noNew = 0;
    const more = await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const b=[...document.querySelectorAll("button,span,div,a")].filter((x)=>x.offsetParent&&!x.children.length&&t(x)==="点击加载更多商品").pop();
      if(!b)return null; b.scrollIntoView({block:"center"});
      const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if (more) { await page.mouse.click(more.x, more.y); await page.waitForTimeout(1200); noNew = 0; }
    if (noNew >= 8) break;
  }
  return [...all];
}

async function scanOneProduct(goodsId) {
  const hit = await page.evaluate((id) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rows=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const tr=rows.find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
    if(!tr)return false;
    const table=tr.closest("table"); if(!table)return false;
    const trs=[...table.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const ti=trs.indexOf(tr);
    tr.scrollIntoView({block:"center"});
    for(let i=ti;i<Math.min(trs.length,ti+6);i++){
      if(!/展开更多规格/.test(t(trs[i]))) continue;
      const arrow=[...trs[i].querySelectorAll("span,svg")].filter((x)=>x.offsetParent).pop();
      if(arrow){ arrow.click(); return true; }
    }
    return false;
  }, goodsId);
  await page.waitForTimeout(1800);
  return page.evaluate((id) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rows=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const tr=rows.find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
    if(!tr)return null;
    const table=tr.closest("table"); if(!table)return null;
    const trs=[...table.querySelectorAll("tr")].filter((x)=>x.offsetParent);
    const ti=trs.indexOf(tr); const texts=[t(tr)];
    for(let i=ti+1;i<trs.length;i++){ const tx=t(trs[i]); if(/ID[：:]\s*/.test(tx)||/^预览$/.test(tx)||/预览\\s/.test(tx)) break; texts.push(tx); }
    const joined=texts.join("\n");
    const skuRows=[];
    for(const line of texts){
      const m=line.match(/(.*?)当前价：¥([0-9.]+).*?线上库存：(\d+)\s+([0-9.]+)(?:\s+(约[0-9.]+折))?/);
      if(!m)continue;
      let spec=(m[1]||"").trim(); const del=spec.lastIndexOf("删除"); if(del>=0)spec=spec.slice(del+2).trim();
      const cp=Number(m[2]), ap=Number(m[4]);
      skuRows.push({spec,currentPrice:m[2],activityPrice:m[4],discount:m[5]||"",priceUp:Number.isFinite(cp)&&Number.isFinite(ap)&&ap>cp});
    }
    const first=texts[0]||"";
    const title=(first.match(/预览\s+(.*?)\s+ID[：:]/)||[])[1]||"";
    const cp=(first.match(/当前价：¥([0-9.]+)/)||[])[1]||"";
    const ap=(first.match(/线上库存：\d+\s+([0-9.]+)(?:\s+约[0-9.]+折)?/)||[])[1]||"";
    const disc=(first.match(/(约[0-9.]+折)/)||[])[1]||"";
    return {id,title,currentPrice:cp,activityPrice:ap,discount:disc,priceUp:Number.isFinite(Number(cp))&&Number.isFinite(Number(ap))&&Number(ap)>Number(cp),skuCount:skuRows.length,skuRows};
  }, goodsId);
}
async function locateProductByScroll(goodsId) {
  for (let i = 0; i < 240; i++) {
    const found = await page.evaluate((id) => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const tr=[...document.querySelectorAll("tr")].filter((x)=>x.offsetParent).find((x)=>new RegExp("ID[：:]\\s*"+id).test(t(x)));
      if(!tr)return false; tr.scrollIntoView({block:"center"}); return true;
    }, goodsId);
    if (found) { await page.waitForTimeout(300); return true; }
    await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const more=[...document.querySelectorAll("button,span,div,a")].filter((x)=>x.offsetParent&&!x.children.length&&t(x)==="点击加载更多商品").pop();
      if (more) { more.click(); return; }
      window.scrollBy(0, 180);
    });
    await page.waitForTimeout(220);
  }
  return false;
}
async function scanAllProducts() {
  const activityId = String(JOB.activityId || "").trim();
  const activityType = String(JOB.activityType || "").trim();
  const url = "https://mms.pinduoduo.com/act/goods_price/confirm?activityId=" + encodeURIComponent(activityId) + "&activityType=" + encodeURIComponent(activityType) + "&from=all&module=promotion&SourceType=PROMO-OwnHome&SceneType=ActivityCard";
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(6000);
  await dismissBlockingModals();
  const seen = new Map();
  let stall = 0;
  for (let i = 0; i < 80; i++) {
    await page.evaluate(() => window.scrollBy(0, 360));
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const out=[];
      for (const tr of [...document.querySelectorAll("tr")].filter((x)=>x.offsetParent)) {
        const tx=t(tr); const m=tx.match(/ID[：:]\s*(\d+)/); if(!m) continue;
        const title=(tx.match(/预览\s+(.*?)\s+ID[：:]/)||[])[1]||"";
        const current=(tx.match(/当前价：¥([0-9.]+)/)||[])[1]||"";
        const activity=(tx.match(/线上库存：\d+\s+([0-9.]+)(?:\s+约[0-9.]+折)?/)||[])[1]||"";
        const discount=(tx.match(/(约[0-9.]+折)/)||[])[1]||"";
        out.push({id:m[1],title,currentPrice:current,activityPrice:activity,discount});
      }
      return out;
    });
    let added = 0;
    for (const r of rows) if (!seen.has(r.id)) { seen.set(r.id, r); added++; }
    if (!added) stall++; else stall = 0;
    const more = await page.evaluate(() => {
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const b=[...document.querySelectorAll("button,span,div,a")].filter((x)=>x.offsetParent&&!x.children.length&&t(x)==="点击加载更多商品").pop();
      if(!b)return false; b.click(); return true;
    });
    if (more) { await page.waitForTimeout(1000); stall = 0; }
    if (stall >= 10) break;
  }
  log("scan_products_total", seen.size);
  return [...seen.values()];
}
async function setTrafficProtection(enabled) {
  const hit = await page.evaluate((enabled) => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const labels=[...document.querySelectorAll("label")].filter((x)=>x.offsetParent&&t(x).includes("开启流量保护"));
    if(!labels.length)return null;
    const label=labels[0];
    const input=label.querySelector("input[type=checkbox]");
    if(!input)return null;
    label.scrollIntoView({block:"center",inline:"center"});
    const r=label.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),checked:input.checked,need:input.checked!==enabled};
  }, enabled);
  if (!hit) return {ok:false,error:"traffic_protection_label_not_found"};
  if (hit.need) { await page.mouse.click(hit.x,hit.y); await page.waitForTimeout(800); }
  const state = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const label=[...document.querySelectorAll("label")].filter((x)=>x.offsetParent&&t(x).includes("开启流量保护"))[0];
    const input=label?label.querySelector("input[type=checkbox]"):null;
    return input?input.checked:null;
  });
  return {ok:true,checked:state};
}

async function readEnrollmentRecord(goodsId) {
  await page.goto("https://mms.pinduoduo.com/act/register_record", { timeout: 60000 });
  await page.waitForTimeout(4000);
  return page.evaluate((goodsId) => {
    const txt=document.body.innerText||""; const lines=txt.split("\n").map((x)=>x.trim()).filter(Boolean);
    const at=lines.findIndex((x)=>x.includes(goodsId));
    if(at<0)return {found:false};
    const around=lines.slice(Math.max(0,at-10),at+12);
    const status=around.find((x)=>/报名成功|报名进行中|审核中|价格暂时失效|活动下线/.test(x))||"";
    const activityPrice=(around.find((x)=>/活动价/.test(x))||"");
    return {found:true,status,activityPrice,around};
  }, goodsId);
}

async function platformRecord() {
  const goodsId=String((JOB.goodsIds||[])[0]||"").trim();
  if(!goodsId)throw new Error("goods_id_missing");
  return {status:"done", record: await readEnrollmentRecord(goodsId)};
}
async function statusLookup(inputIds) {
  const activityId=String(JOB.activityId||"").trim();
  const activityType=String(JOB.activityType||"").trim();
  const ids=(inputIds||[]).map(String);
  if(!activityId||!activityType||!ids.length)throw new Error("status_params_missing");
  const url="https://mms.pinduoduo.com/act/goods_price/confirm?activityId="+encodeURIComponent(activityId)+"&activityType="+encodeURIComponent(activityType)+"&from=all&module=promotion&SourceType=PROMO-OwnHome&SceneType=ActivityCard";
  await page.goto(url,{timeout:60000}); await page.waitForTimeout(6000);
  await dismissBlockingModals();
  const statuses={};
  for(const id of ids){
    const inp=await page.evaluate(()=>{
      const i=[...document.querySelectorAll("input")].find((x)=>x.offsetParent&&x.placeholder&&x.placeholder.includes("商品名称或ID"));
      if(!i)return null; const r=i.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if(!inp)throw new Error("search_input_not_found");
    await page.mouse.click(inp.x,inp.y); await page.waitForTimeout(200);
    await page.keyboard.press("Control+A").catch(()=>{});
    await page.keyboard.type(id); await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
    const res=await page.evaluate((id)=>{
      const txt=document.body.innerText||"";
      const active=/商品已生效当前活动|无需重复报名/.test(txt);
      const ineligible=/不可报名商品/.test(txt)&&txt.includes(id);
      const found=txt.includes(id);
      return {found,active,ineligible,text:txt.slice(-800)};
    },id);
    statuses[id]={...res,status:res.active?"已生效当前活动":res.found?"可报名":"未找到"};
    // close popup if there is a 取消 button
    await page.evaluate(()=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const b=[...document.querySelectorAll("button,span,div,a")].filter((x)=>x.offsetParent&&!x.children.length&&t(x)==="取消").pop();
      if(b)b.click();
    });
    await page.waitForTimeout(500);
  }
  return {status:"done",statuses};
}
async function platformStatus() {
  const ids=(JOB.goodsIds||[]).map(String);
  return {status:"done", ...(await statusLookup(ids))};
}

async function platformInventory() {
  const products=await scanAllProducts();
  const ids=products.map((p)=>p.id);
  const lookup=await statusLookup(ids);
  const merged=products.map((p)=>({...p,status:(lookup.statuses&&lookup.statuses[p.id]&&lookup.statuses[p.id].status)||"未找到"}));
  return {status:"done",products:merged,missingStatus:lookup.missing};
}
async function platformEnroll() {
  const activityId=String(JOB.activityId||"").trim();
  const activityType=String(JOB.activityType||"").trim();
  const goodsIds=(JOB.goodsIds||[]).map(String).filter(Boolean);
  if(!activityId||!activityType||!goodsIds.length)throw new Error("enroll_params_missing");
  const url="https://mms.pinduoduo.com/act/goods_price/confirm?activityId="+encodeURIComponent(activityId)+"&activityType="+encodeURIComponent(activityType)+"&from=all&module=promotion&SourceType=PROMO-OwnHome&SceneType=ActivityCard";
  await page.goto(url,{timeout:60000}); await page.waitForTimeout(6000);
  await requireActivityPreflight();
  let selected = 0;
  for (const goodsId of goodsIds) {
    selected = await selectTargetProduct(goodsId);
  }
  if(selected!==goodsIds.length) throw new Error("target_selection_count_mismatch:"+selected+"/"+goodsIds.length);
  const traffic = await setTrafficProtection(JOB.trafficProtection !== "off");
  const confirmSubmit = JOB.confirmSubmit === true;
  if (!confirmSubmit) {
    return {status:"done", submitted:false, selectedBefore:selected, traffic, message:"prepared_no_submit"};
  }
  const submit = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const b=[...document.querySelectorAll("button")].filter((x)=>x.offsetParent&&t(x)==="确认提交").pop();
    if(!b)return null; b.scrollIntoView({block:"center"});
    const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  });
  if(!submit) throw new Error("submit_button_not_found");
  await page.mouse.click(submit.x,submit.y);
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const txt=document.body.innerText||"";
    return {success:/商品报名成功/.test(txt),text:txt.slice(-1200),selectedAfter:(txt.match(/已选商品\s*(\d+)\s*个/)||[])[0]||""};
  });
  const records=[];
  if(result.success){ for(const goodsId of goodsIds) records.push(await readEnrollmentRecord(goodsId)); }
  return {status:"done", submitted:result.success, selectedBefore:selected, traffic, result, records};
}
async function platformPreview() {
  const activityId = String(JOB.activityId || "").trim();
  const activityType = String(JOB.activityType || "").trim();
  if (!activityId || !activityType) throw new Error("activity_id_or_type_missing");
  const url = "https://mms.pinduoduo.com/act/goods_price/confirm?activityId=" + encodeURIComponent(activityId) + "&activityType=" + encodeURIComponent(activityType) + "&from=all&module=promotion&SourceType=PROMO-OwnHome&SceneType=ActivityCard";
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(6000);
  await requireActivityPreflight();
  if (JOB.selectOnly === true) {
    const goodsId = String((JOB.goodsIds || [])[0] || "");
    if (!goodsId) throw new Error("goods_id_missing");
    const selected = await selectTargetProduct(goodsId);
    log("selected_after_pick", selected);
    if (selected !== 1) throw new Error("target_selection_not_exactly_one:" + selected);
    const meta = await markTargetProduct(goodsId);
    log("target_marked", JSON.stringify({ title: meta && meta.title }));
    await expandTargetProduct(goodsId);
    const targetText = await readTargetAfterExpand(goodsId, meta && meta.title ? meta.title : "");
    log("target_text_len", targetText.length);
    JOB.__targetText = targetText;
  } else if (JOB.expandSkus === true) await expandTargetSkus((JOB.goodsIds || []).map(String));
  const info = await page.evaluate(({ activityId, activityType, goodsIds, targetText }) => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
    const body = targetText || document.body.innerText || "";
    const lines = body.split("\n").map((x) => x.trim()).filter(Boolean);
    const allSkuRows = [];
    for (const line of lines) {
      const m = line.match(/(.*?)当前价：¥([0-9.]+).*?线上库存：(\d+)\s+([0-9.]+)(?:\s+(约[0-9.]+折))?/);
      if (!m) continue;
      let spec = (m[1] || "").trim();
      const mark = spec.lastIndexOf("删除");
      if (mark >= 0) spec = spec.slice(mark + 2).trim();
      allSkuRows.push({ spec, currentPrice: m[2], activityPrice: m[4], discount: m[5] });
    }
    const out = {};
    for (const id of goodsIds) {
      const at = lines.findIndex((x) => new RegExp("ID[：:]\\s*" + id).test(x));
      if (at < 0) { out[id] = { found: false }; continue; }
      const nextPreview = lines.findIndex((x, idx) => idx > at && x === "预览");
      const block = lines.slice(Math.max(0, at - 5), nextPreview > at ? nextPreview : Math.min(lines.length, at + 20));
      const skuRows = [];
      for (let i = 3; i < block.length; i++) {
        if (!/当前价：/.test(block[i])) continue;
        const spec = block[i - 1] || "";
        const cur = (block[i].match(/¥([0-9.]+)/) || [])[1] || "";
        const activityPrice = block[i + 2] || "";
        const disc = block[i + 3] || "";
        if (/[0-9]/.test(activityPrice)) skuRows.push({ spec, currentPrice: cur, activityPrice, discount: disc });
      }
      out[id] = { found: true, lines: block, skuRows };
    }
    return { url: location.href, activityId, activityType, text: body.slice(-4000), products: out, allSkuRows };
  }, { activityId, activityType, goodsIds: (JOB.goodsIds || []).map(String), targetText: JOB.__targetText || "" });
  return { status: "done", preview: info };
}
async function dismissBlockingModals() {
  const info = await page.evaluate(() => {
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const modals=[...document.querySelectorAll("div")].filter(vis).filter((d)=>t(d).includes("不符合活动要求")&&t(d).includes("立即改价"));
    if(!modals.length)return {found:false};
    const modal=modals.sort((a,b)=>t(a).length-t(b).length)[0];
    const rows=[];
    for(const tr of [...modal.querySelectorAll("tr")].filter(vis)){
      const tx=t(tr); const m=tx.match(/ID[：:]\s*(\d+)/); if(m)rows.push({id:m[1],text:tx.slice(0,240)});
    }
    const buttons=[...modal.querySelectorAll("button")].filter(vis).map((b)=>t(b));
    let clicked="";
    const later=[...modal.querySelectorAll("button")].filter(vis).find((b)=>t(b)==="稍后处理");
    if(later){ later.click(); clicked="稍后处理"; }
    else {
      const x=[...modal.querySelectorAll("button,span,div,a")].filter(vis).find((x)=>t(x)==="×"||t(x)==="关闭");
      if(x){ x.click(); clicked="关闭"; }
    }
    return {found:true,rows,buttons,clicked,text:t(modal).slice(0,500)};
  });
  if(info.found){
    log("blocking_modal", JSON.stringify({clicked:info.clicked,rows:info.rows.length}));
    await page.waitForTimeout(1000);
  }
  await page.keyboard.press("Escape").catch(()=>{});
  return info;
}
async function requireActivityPreflight() {
  await dismissSearchModal();
  await loadAllProducts();
  const left = await clearSelectedProducts();
  log("preflight_selected", left);
  if (left !== 0) throw new Error("activity_preflight_clear_failed:" + left);
  return true;
}
async function dismissCouponNotices() {
  const targets = await page.evaluate(() => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const out = [];
    const sels = [".ImportantList_close__d0eKb", "[class*=ImportantList_close]", ".AllMsg_close__2whBQ", "#msg_box_modal [class*=close]"];
    for (const sel of sels) {
      for (const el of [...document.querySelectorAll(sel)].filter(vis)) {
        const r = el.getBoundingClientRect();
        out.push({ sel, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
      }
    }
    return out;
  });
  const clicked = [];
  for (const t of targets) {
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(400);
    clicked.push(t.sel);
  }
  if (clicked.length) await page.waitForTimeout(600);
  return clicked;
}

async function couponGoto(type) {
  const t = String(type || "").toLowerCase();
  const url = t === "product" || t === "商品立减券"
    ? "https://mms.pinduoduo.com/tool/coupon/create?chooseType=7"
    : t === "follow" || t === "店铺关注券"
      ? "https://mms.pinduoduo.com/tool/coupon/create?chooseType=3"
      : t === "surprise" || t === "惊喜券"
        ? "https://mms.pinduoduo.com/tool/surprise-coupon/create"
        : "";
  if (!url) throw new Error("coupon_type_invalid:" + type);
  await page.goto(url, { timeout: 60000 });
  await waitForPage(async () => page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    return !![...document.querySelectorAll("a,button,span,div")].find(x => x.offsetParent && !x.children.length && (t(x) === "选择商品" || t(x) === "创建"));
  }), 15000);
  await dismissCouponNotices();
  return url;
}

async function couponNameInput() {
  return page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    let i = [...document.querySelectorAll("input")].find(x => vis(x) && (x.placeholder || "").includes("该名称将不对买家展示"));
    if (!i) {
      const label = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && !x.children.length && t(x) === "优惠券名称")[0];
      if (label) {
        let n = label;
        for (let k = 0; k < 7 && n; k++) {
          const cand = [...n.querySelectorAll("input")].find(x => vis(x) && x.type === "text");
          if (cand) { i = cand; break; }
          n = n.parentElement;
        }
      }
    }
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), value: i.value, placeholder: i.placeholder };
  });
}

async function couponSetName(name) {
  const value = String(name || "").trim();
  if (!value) return null;
  if (value.length > 20) throw new Error("coupon_name_too_long:" + value.length);
  const input = await couponNameInput();
  if (!input) throw new Error("coupon_name_input_missing");
  await page.mouse.click(input.x, input.y);
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(value);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  const after = await couponNameInput();
  if (!after || after.value !== value) throw new Error("coupon_name_not_applied:" + (after ? after.value : null));
  return after.value;
}

async function couponSetPerPersonLimit(limit) {
  const want = Number(limit);
  if (!Number.isFinite(want) || ![1, 2, 3].includes(want)) throw new Error("coupon_per_person_invalid:" + limit);
  const input = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /请选择每人限领/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), value: i.value };
  });
  if (!input) throw new Error("coupon_per_person_not_supported");
  await page.mouse.click(input.x, input.y);
  await page.waitForTimeout(600);
  const opt = await page.evaluate((want) => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    const el = [...document.querySelectorAll("div,span,li")].filter(x => x.offsetParent && !x.children.length && t(x) === want + "张")[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, want);
  if (!opt) throw new Error("coupon_per_person_option_missing:" + want);
  await page.mouse.click(opt.x, opt.y);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /请选择每人限领/.test(x.placeholder || ""));
    return i ? i.value : null;
  });
  if (String(after) !== want + "张") throw new Error("coupon_per_person_not_applied:" + after);
  return { value: after };
}

async function couponSetUseDays(days) {
  const want = Number(days);
  if (!Number.isFinite(want) || want < 7 || want > 90) throw new Error("coupon_use_days_invalid:" + days);
  const input = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /限7~90/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), value: i.value };
  });
  if (!input) throw new Error("coupon_use_days_not_supported");
  await page.mouse.click(input.x, input.y);
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(want));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /限7~90/.test(x.placeholder || ""));
    return i ? i.value : null;
  });
  if (String(after) !== String(want)) throw new Error("coupon_use_days_not_applied:" + after);
  return { value: after };
}

async function couponSetFollowScope(scope) {
  const raw = String(scope || "").toLowerCase();
  const wantAll = ["all", "全店", "store"].includes(raw);
  const wantProducts = ["products", "指定", "product"].includes(raw);
  if (!wantAll && !wantProducts) throw new Error("coupon_follow_scope_invalid:" + scope);
  const label = wantAll ? "全店商品" : "指定商品";
  const pos = await page.evaluate((label) => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    const el = [...document.querySelectorAll("div,span,label")].filter(x => x.offsetParent && !x.children.length && t(x).includes(label))[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, label);
  if (!pos) throw new Error("coupon_follow_scope_option_missing:" + label);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(1200);
  const hasSelect = await page.evaluate(() => [...document.querySelectorAll("a,button,span,div")].some(x => x.offsetParent && ((x.innerText || x.textContent || "").trim() === "选择商品")));
  if (wantAll && hasSelect) throw new Error("coupon_follow_scope_not_applied:all");
  if (wantProducts && !hasSelect) throw new Error("coupon_follow_scope_not_applied:products");
  return { scope: wantAll ? "all" : "products", hasSelectProduct: hasSelect };
}

async function couponSetClaimDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 1 || n > 365) throw new Error("coupon_claim_days_invalid:" + days);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + n - 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startStr = fmt(start), endStr = fmt(end);
  const input = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /开始时间/.test(x.placeholder || ""));
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!input) throw new Error("coupon_claim_days_not_supported");
  const open = async () => { await page.mouse.click(input.x, input.y); await page.waitForTimeout(900); };
  await open();
  const read = () => page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const heads = [...document.querySelectorAll("[class*=RPR_panelHeader]")].filter(vis).map(x => t(x));
    const years = [...document.querySelectorAll("input")].filter(vis).filter(x => /^20\d\d年$/.test((x.value || "").trim())).map(x => x.value);
    return { heads, years };
  });
  const ensure = async (side, year, month) => {
    for (let i = 0; i < 24; i++) {
      let cal = await read();
      if (!cal.heads.length) { await open(); cal = await read(); }
      if (!cal.heads.length) return false;
      const idx = side === "left" ? 0 : cal.heads.length - 1;
      const cm = parseInt(cal.heads[idx], 10);
      const cy = parseInt((cal.years[idx] || "").replace("年", ""), 10);
      if (cm === month && cy === year) return true;
      const dir = (cy > year || (cy === year && cm > month)) ? "prev" : "next";
      const pos = await page.evaluate(({ side, dir }) => {
        const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const svgs = [...document.querySelectorAll("svg[class*=RPR_iconPrevNext]")].filter(vis).map(x => {
          const r = x.getBoundingClientRect();
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), right: /RPR_right/.test(x.getAttribute("class") || ""), cx: r.x + r.width / 2 };
        });
        const cand = svgs.filter(s => side === "left" ? s.cx < 500 : s.cx > 500).filter(s => dir === "next" ? s.right : !s.right);
        return cand[0] || null;
      }, { side, dir });
      if (!pos) return false;
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(500);
    }
    return false;
  };
  const okL = await ensure("left", start.getFullYear(), start.getMonth() + 1);
  const okR = await ensure("right", end.getFullYear(), end.getMonth() + 1);
  if (!okL || !okR) throw new Error("coupon_claim_days_panel_align_failed");
  const clickDay = async (tableIdx, day) => {
    const pos = await page.evaluate(({ tableIdx, day }) => {
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const tables = [...document.querySelectorAll("table")].filter(t => t.querySelector("td[role=date-cell]"));
      const t = tables[tableIdx];
      if (!t) return null;
      for (const r of [...t.rows]) for (const c of [...r.cells]) {
        const d = c.querySelector('div[class*="RPR_cell"]');
        if (!d || /outOfMonth|disabled/i.test(d.className)) continue;
        if ((c.innerText || "").trim() === String(day)) {
          const rr = c.getBoundingClientRect();
          return { x: Math.round(rr.x + rr.width / 2), y: Math.round(rr.y + rr.height / 2) };
        }
      }
      return null;
    }, { tableIdx, day });
    if (!pos) throw new Error("coupon_claim_day_missing:" + day);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(350);
  };
  await clickDay(0, start.getDate());
  await clickDay(1, end.getDate());
  const conf = await page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    const b = [...document.querySelectorAll("button,span,div")].filter(x => x.offsetParent && !x.children.length && t(x) === "确认").pop();
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (conf) { await page.mouse.click(conf.x, conf.y); await page.waitForTimeout(900); }
  const value = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find(x => x.offsetParent && /开始时间/.test(x.placeholder || ""));
    return i ? i.value : null;
  });
  if (!String(value).includes(startStr) || !String(value).includes(endStr)) throw new Error("coupon_claim_days_not_applied:" + value);
  return { value, start: startStr, end: endStr };
}

async function couponSetStoreWideFields(face, issue) {
  const setField = async (label, value) => {
    const pos = await page.evaluate((label) => {
      const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const lab = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && !x.children.length && t(x) === label)[0];
      if (!lab) return null;
      let n = lab;
      for (let i = 0; i < 6 && n; i++) {
        const inp = [...n.querySelectorAll("input")].find(x => vis(x) && x.type === "text");
        if (inp) { const r = inp.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), value: inp.value }; }
        n = n.parentElement;
      }
      return null;
    }, label);
    if (!pos) throw new Error("coupon_store_wide_field_missing:" + label);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(250);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(value));
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    const after = await page.evaluate((label) => {
      const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const lab = [...document.querySelectorAll("label,div,span")].filter(x => vis(x) && !x.children.length && t(x) === label)[0];
      if (!lab) return null;
      let n = lab;
      for (let i = 0; i < 6 && n; i++) {
        const inp = [...n.querySelectorAll("input")].find(x => vis(x) && x.type === "text");
        if (inp) return inp.value;
        n = n.parentElement;
      }
      return null;
    }, label);
    if (String(after) !== String(value)) throw new Error("coupon_store_wide_field_not_applied:" + label + ":" + after);
    return { label, value: after };
  };
  const f = await setField("券面额", face);
  const i = await setField("发行张数", issue);
  return { face: f, issue: i };
}

async function couponFormInfo() {
  return page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
    const inputByPh = (ph) => [...document.querySelectorAll("input")].find(x => x.offsetParent && (x.placeholder || "").includes(ph));
    let name = inputByPh("该名称将不对买家展示");
    if (!name) {
      const label = [...document.querySelectorAll("label,div,span")].filter(x => x.offsetParent && !x.children.length && t(x) === "优惠券名称")[0];
      if (label) {
        let n = label;
        for (let k = 0; k < 7 && n; k++) {
          const cand = [...n.querySelectorAll("input")].find(x => x.offsetParent && x.type === "text");
          if (cand) { name = cand; break; }
          n = n.parentElement;
        }
      }
    }
    const date = inputByPh("开始时间");
    const use = [...document.querySelectorAll("span")].map(t).find(x => /^领取后.*可用$/.test(x)) || "";
    const row = [...document.querySelectorAll("tr")].find(x => /ID:\s*\d+/.test(t(x)));
    const cells = row ? [...row.querySelectorAll("td")].map(t) : [];
    const ins = row ? [...row.querySelectorAll("input")].filter(x => x.offsetParent && x.type !== "checkbox") : [];
    const perPerson = [...document.querySelectorAll("input")].find(x => x.offsetParent && /请选择每人限领/.test(x.placeholder || ""));
    const useDaysInput = [...document.querySelectorAll("input")].find(x => x.offsetParent && /限7~90/.test(x.placeholder || ""));
    const extra = document.querySelector("#fullSiteMarketingDiscountValue");
    const surprise = document.querySelector("#surpriseCouponDiscountValue");
    const extraAmount = extra ? [...extra.querySelectorAll("input[type=text]")].find(x => x.offsetParent) : null;
    const surpriseAmount = surprise ? [...surprise.querySelectorAll("input[type=text]")].find(x => x.offsetParent) : null;
    const extraBox = document.querySelector("#fullSiteMarketingCheck input[type=checkbox]");
    const surpriseBox = document.querySelector("#surpriseCouponCheck input[type=checkbox]");
    const body = document.body.innerText || "";
    const range = body.match(/建议优惠区间参考[：:]\s*([0-9.]+～[0-9.]+)/);
    const phRange = ins[0] ? (ins[0].placeholder || "").match(/([0-9.]+～[0-9.]+)/) : null;
    return {
      couponName: name ? name.value : null,
      claimRange: date ? date.value : null,
      useTime: use,
      productRow: cells.slice(0, 4),
      faceDefault: ins[0] ? ins[0].value : null,
      issueDefault: ins[1] ? ins[1].value : null,
      facePlaceholder: ins[0] ? ins[0].placeholder : null,
      perPersonDefault: perPerson ? perPerson.value : null,
      useDaysDefault: useDaysInput ? useDaysInput.value : null,
      extraDiscount: { checked: extraBox ? extraBox.checked : null, amount: extraAmount ? extraAmount.value : null },
      surpriseExtraDiscount: { checked: surpriseBox ? surpriseBox.checked : null, amount: surpriseAmount ? surpriseAmount.value : null },
      suggestedRange: range ? range[1] : (phRange ? phRange[1] : "")
    };
  });
}

async function couponSelectProduct(goodsId) {
  const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
  const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
  let btn=null;
  for(let i=0;i<3;i++){
    btn=await page.evaluate(()=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const el=[...document.querySelectorAll("a,button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)==="选择商品")[0];
      if(!el)return null;
      const r=el.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if(btn)break;
    await page.waitForTimeout(800);
  }
  if(!btn)throw new Error("coupon_select_button_missing");
  await page.mouse.click(btn.x, btn.y);
  await waitForPage(async()=>page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length>1),10000);

  let searchUsed=false;
  const searchBox=await page.evaluate(()=>{
    const i=[...document.querySelectorAll("input")].find(x=>x.offsetParent&&/输入商品名称或ID/.test(x.placeholder||""));
    if(!i)return null;
    const r=i.getBoundingClientRect();
    const q=[...document.querySelectorAll("div,span,button")].filter(x=>x.offsetParent&&!x.children.length&&(x.innerText||x.textContent||"").trim()==="查询")[0];
    const qr=q?q.getBoundingClientRect():null;
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),qx:qr?Math.round(qr.x+qr.width/2):null,qy:qr?Math.round(qr.y+qr.height/2):null};
  });
  if(searchBox){
    await page.mouse.click(searchBox.x,searchBox.y);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(goodsId);
    if(searchBox.qx!=null) await page.mouse.click(searchBox.qx,searchBox.qy);
    else await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    searchUsed=true;
  }

  let found=false;
  for(const pageNo of (searchUsed?[1]:[1,2,3,4])) {
    const pb=await page.evaluate((n)=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const el=[...document.querySelectorAll("[class*=PGT_pagerItem]")].filter(x=>x.offsetParent).find(x=>t(x)===String(n));
      if(!el)return null;
      el.scrollIntoView({block:"center",inline:"center"});
      const r=el.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    }, pageNo);
    if(pb){ await page.mouse.click(pb.x,pb.y); await waitForPage(async()=>page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length>1),5000); }
    const hit=await page.evaluate((id)=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const tr=[...document.querySelectorAll("tr")].find(x=>new RegExp("ID:\\s*"+id).test(t(x)));
      if(!tr)return null;
      tr.scrollIntoView({block:"center"});
      const i=tr.querySelector("input[type=checkbox]");
      if(!i)return null;
      const r=i.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),checked:i.checked};
    }, goodsId);
    if(hit){
      if(!hit.checked){ await page.mouse.click(hit.x,hit.y); await page.waitForTimeout(600); }
      found=true; break;
    }
  }
  if(!found)throw new Error("coupon_product_not_found:" + goodsId);
  const ok=await page.evaluate(()=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent&&t(x)==="确认选择").pop();
    if(!b)return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  });
  if(ok){ await page.mouse.click(ok.x,ok.y); await waitForPage(async()=>page.evaluate((id)=>[...document.querySelectorAll("tr")].some(x=>x.offsetParent&&new RegExp("ID:\s*"+id).test((x.innerText||""))),goodsId),8000); }
  return true;
}

async function couponRowInfo(goodsId) {
  return page.evaluate((id) => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
    const tr = [...document.querySelectorAll("tr")].find(x => new RegExp("ID:\\s*" + id).test(t(x)));
    if (!tr) return { ok: false, reason: "row_missing" };
    const ins = [...tr.querySelectorAll("input")].filter(x => x.offsetParent && x.type !== "checkbox");
    const cells = [...tr.querySelectorAll("td")].map(x => t(x));
    return {
      ok: true,
      values: ins.map(x => x.value),
      coords: ins.map(x => { const r = x.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }),
      cells,
      rowText: t(tr).slice(0, 500)
    };
  }, goodsId);
}

async function couponRowInfoRetry(goodsId) {
  for (let i = 0; i < 12; i++) {
    const info = await couponRowInfo(goodsId);
    if (info.ok) return info;
    await page.evaluate(() => {
      const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
      const table = [...document.querySelectorAll("table")].filter(x => x.offsetParent).find(x => /商品信息/.test(t(x)));
      if (table) table.scrollIntoView({ block: "center" });
      else window.scrollBy(0, 400);
    });
    await page.waitForTimeout(500);
  }
  return { ok: false, reason: "row_missing" };
}

async function couponTryFace(goodsId, face, issue) {
  let info = await couponRowInfoRetry(goodsId);
  if (!info.ok) return { error: "row_missing" };
  if (!info.coords || info.coords.length < 2) return { error: "row_inputs_missing" };
  const faceC = info.coords[0];
  const issueC = info.coords[1];
  if (issue != null) {
    await page.mouse.click(issueC.x, issueC.y);
    await page.waitForTimeout(200);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(issue));
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
  }
  await page.mouse.click(faceC.x, faceC.y);
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(face));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(800);
  info = await couponRowInfoRetry(goodsId);
  if (!info.ok) return { error: "row_missing_after_fill" };
  const state = await page.evaluate(() => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").trim() : "");
    const b = [...document.querySelectorAll("button")].filter(x => x.offsetParent && t(x) === "创建").pop();
    const body = document.body.innerText || "";
    const range = body.match(/建议优惠区间参考[：:]\s*([0-9.]+～[0-9.]+)/);
    return { buttonDisabled: b ? !!b.disabled : null, suggestedRange: range ? range[1] : "" };
  });
  return { face, values: info.values, couponPrice: info.cells[3] || "", buttonDisabled: state.buttonDisabled, suggestedRange: state.suggestedRange };
}

async function couponSetFields(goodsId, face, issue, perPerson) {
  if (perPerson != null) throw new Error("coupon_per_person_not_implemented");
  let info = await couponRowInfoRetry(goodsId);
  if (!info.ok) throw new Error("coupon_row_missing:" + goodsId);
  if (!info.coords || info.coords.length < 2) throw new Error("coupon_row_inputs_missing:" + goodsId);
  const faceC = info.coords[0];
  const issueC = info.coords[1];
  await page.mouse.click(faceC.x, faceC.y);
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(face));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  await page.mouse.click(issueC.x, issueC.y);
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(issue));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1000);
  info = await couponRowInfoRetry(goodsId);
  if (!info.ok) throw new Error("coupon_row_missing_after_fill:" + goodsId);
  if (String(info.values[0]) !== String(face) || String(info.values[1]) !== String(issue)) {
    throw new Error("coupon_fields_not_applied:" + JSON.stringify(info.values));
  }
  const couponPrice = info.cells[3] || "";
  if (!couponPrice || couponPrice === "--") {
    const suggestedRange = await page.evaluate(() => {
      const m = (document.body.innerText || "").match(/建议优惠区间参考[：:]\s*([0-9.]+～[0-9.]+)/);
      return m ? m[1] : "";
    });
    const err = new Error("coupon_face_out_of_range");
    err.code = "coupon_face_out_of_range";
    err.details = { goodsId, face, issue, suggestedRange };
    throw err;
  }
  return { values: info.values, couponPrice, rowText: info.rowText };
}

async function couponExtraState(formItemId, checkId) {
  return page.evaluate(({ formItemId, checkId }) => {
    const t = (x) => (x ? (x.innerText || x.textContent || "").replace(/\s+/g, " ").trim() : "");
    const item = document.querySelector(formItemId);
    if (!item) return null;
    const box = document.querySelector(checkId);
    const i = box ? box.querySelector("input[type=checkbox]") : null;
    const amount = [...item.querySelectorAll("input[type=text]")].find(x => x.offsetParent);
    const br = i ? i.getBoundingClientRect() : null;
    const ar = amount ? amount.getBoundingClientRect() : null;
    return {
      checked: i ? i.checked : null,
      amount: amount ? amount.value : null,
      label: t(item).slice(0, 160),
      boxC: br ? { x: Math.round(br.x + br.width / 2), y: Math.round(br.y + br.height / 2) } : null,
      amountC: ar ? { x: Math.round(ar.x + ar.width / 2), y: Math.round(ar.y + ar.height / 2) } : null
    };
  }, { formItemId, checkId });
}

async function couponApplyExtras(extraDiscount, surpriseExtraDiscount) {
  const targets = [
    { key: "extraDiscount", formItemId: "#fullSiteMarketingDiscountValue", checkId: "#fullSiteMarketingCheck", desired: extraDiscount },
    { key: "surpriseExtraDiscount", formItemId: "#surpriseCouponDiscountValue", checkId: "#surpriseCouponCheck", desired: surpriseExtraDiscount }
  ];
  const before = [];
  for (const t of targets) {
    const s = await couponExtraState(t.formItemId, t.checkId);
    before.push({ key: t.key, ...(s || { missing: true, checked: false, amount: null }) });
  }
  for (const t of targets) {
    const desired = t.desired;
    if (desired != null && (!Number.isFinite(desired) || desired < 0)) throw new Error("coupon_extra_amount_invalid:" + t.key);
    let state = await couponExtraState(t.formItemId, t.checkId);
    if (!state) {
      if (desired != null && desired > 0) throw new Error("coupon_extra_section_missing:" + t.key);
      continue;
    }
    const wantOn = desired != null && desired > 0;
    if (wantOn && !state.checked) {
      await page.mouse.click(state.boxC.x, state.boxC.y);
      await page.waitForTimeout(500);
    }
    if (!wantOn && state.checked) {
      await page.mouse.click(state.boxC.x, state.boxC.y);
      await page.waitForTimeout(500);
    }
    if (wantOn) {
      if (desired < 1 || desired > 100) throw new Error("coupon_extra_amount_out_of_range:" + t.key + ":" + desired);
      state = await couponExtraState(t.formItemId, t.checkId);
      await page.mouse.click(state.amountC.x, state.amountC.y);
      await page.waitForTimeout(250);
      await page.keyboard.press("Control+A");
      await page.keyboard.type(String(desired));
      await page.keyboard.press("Tab");
      await page.waitForTimeout(700);
    }
  }
  await page.waitForTimeout(600);
  const after = [];
  for (const t of targets) {
    const s = await couponExtraState(t.formItemId, t.checkId);
    after.push({ key: t.key, desired: t.desired, ...(s || { missing: true, checked: false, amount: null }) });
  }
  const bad = after.filter(x => {
    if (x.missing) return x.desired != null && x.desired > 0;
    const wantOn = x.desired != null && x.desired > 0;
    if (wantOn) return !x.checked || String(x.amount) !== String(x.desired);
    return x.checked;
  });
  if (bad.length) throw new Error("coupon_extras_not_applied:" + JSON.stringify(bad.map(x => ({ key: x.key, checked: x.checked, amount: x.amount, desired: x.desired }))));
  return { before, after };
}

async function couponCreate(){
  const type=String(JOB.couponType||"");
  const rawGoodsIds=(JOB.goodsIds||[]).map(String).filter(Boolean);
  const cfgFace=Number(JOB.faceAmount);
  const cfgIssue=Number(JOB.issueCount);
  const storeWide = type==="店铺关注券" && ["all","全店","store"].includes(String(JOB.followScope||"").toLowerCase());
  const items=Array.isArray(JOB.items)&&JOB.items.length
    ? JOB.items.map(x=>({goodsId:String(x.goodsId||""),faceAmount:Number(x.faceAmount!=null?x.faceAmount:cfgFace),issueCount:Number(x.issueCount!=null?x.issueCount:cfgIssue)})).filter(x=>x.goodsId)
    : rawGoodsIds.map(id=>({goodsId:id,faceAmount:cfgFace,issueCount:cfgIssue}));
  if(!storeWide && !items.length)throw new Error("coupon_goods_ids_missing");
  for(const it of items){
    if(!Number.isFinite(it.faceAmount)||it.faceAmount<=0)throw new Error("coupon_face_missing:"+it.goodsId);
    if(!Number.isFinite(it.issueCount)||it.issueCount<=0)throw new Error("coupon_issue_missing:"+it.goodsId);
  }
  const goodsIds=items.map(x=>x.goodsId);
  const face=items.length?Number(items[0].faceAmount):cfgFace;
  const issue=items.length?Number(items[0].issueCount):cfgIssue;
  await couponGoto(type);
  const nameApplied=await couponSetName(JOB.couponName);
  const perPersonApplied=JOB.perPersonLimit!=null?await couponSetPerPersonLimit(JOB.perPersonLimit):null;
  const useDaysApplied=JOB.useDays!=null?await couponSetUseDays(JOB.useDays):null;
  const followScopeApplied=JOB.followScope!=null?await couponSetFollowScope(JOB.followScope):null;
  const claimDaysApplied=JOB.claimDays!=null?await couponSetClaimDays(JOB.claimDays):null;
  const fields=[];
  if(storeWide){
    const sw=await couponSetStoreWideFields(face,issue);
    fields.push({goodsId:null,faceAmount:face,issueCount:issue,...sw});
  }
  let formDefaults=null;
  for(const item of items){
    if(storeWide)break;
    const id=item.goodsId;
    await couponSelectProduct(id);
    if(!formDefaults) formDefaults=await couponFormInfo();
    try {
      fields.push({ goodsId: id, faceAmount: item.faceAmount, issueCount: item.issueCount, ...(await couponSetFields(id, item.faceAmount, item.issueCount, null)) });
    } catch (e) {
      if (e && e.code === "coupon_face_out_of_range") {
        return {
          status: "needs_user_input",
          error: e.code,
          message: `券面额 ${item.faceAmount} 元不符合平台要求，建议区间 ${e.details.suggestedRange || "未知"}，请确认面额`,
          type, goodsIds, items, face: item.faceAmount, issue: item.issueCount, couponName: nameApplied || (formDefaults && formDefaults.couponName) || null, perPersonApplied, useDaysApplied, followScopeApplied, claimDaysApplied, formDefaults, validRange: e.details.suggestedRange || "", ...e.details
        };
      }
      throw e;
    }
  }
  const extras=await couponApplyExtras(JOB.extraDiscount, JOB.surpriseExtraDiscount);
  const cnt=await page.evaluate(()=>{
    const m=(document.body.innerText||"").match(/已选\s*(\d+)\s*个商品/);
    return m?Number(m[1]):null;
  });
  if(!storeWide && cnt!=null && cnt!==items.length)throw new Error("coupon_selected_count_mismatch:"+cnt);
  const btn=await page.evaluate(()=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent&&t(x)==="创建").pop();
    if(!b)return null;
    if(b.disabled)return {disabled:true};
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),disabled:false};
  });
  if(!btn||btn.disabled)throw new Error("coupon_create_button_disabled");
  if(JOB.dryRun===true || JOB.confirmCreate!==true){
    return {status:"preview", type, goodsIds, items, face, issue, couponName: nameApplied || (formDefaults && formDefaults.couponName) || null, perPersonApplied, useDaysApplied, followScopeApplied, claimDaysApplied, formDefaults, validRange: formDefaults?formDefaults.suggestedRange:"", extras, fields, createButton:{enabled:!btn.disabled}, note:JOB.dryRun===true?"dryRun: 未点击创建":"confirmCreate!=true: 未点击创建（需显式 confirmCreate:true）"};
  }
  await page.mouse.click(btn.x,btn.y);
  let result=null;
  for(let i=0;i<10;i++){
    await page.waitForTimeout(1000);
    result=await page.evaluate(()=>({
      text:(document.body.innerText||"").slice(-1500),
      created:/创建成功|提交成功|创建了/.test(document.body.innerText||""),
      syncTool:/同步设置以下工具|全站营销额外设置/.test(document.body.innerText||"")
    }));
    if(result.created)break;
  }
  if(!result||!result.created){
    const body=result?result.text:"";
    const warnings=await page.evaluate(()=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
      const modals=[...document.querySelectorAll("div")].filter(x=>vis(x)&&t(x).includes("低价风险预警")&&t(x).includes("券后价"));
      modals.sort((a,b)=>{const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return ra.width*ra.height-rb.width*rb.height;});
      const m=modals[0];
      if(!m)return [];
      return [...m.querySelectorAll("tr")].filter(vis).map(r=>[...r.querySelectorAll("td")].map(x=>t(x))).filter(c=>c.length>=4&&c[0]!=="商品信息").map(c=>{
        const goods=c[0]||"";
        const id=(goods.match(/ID: *([0-9]+)/)||[])[1]||null;
        const name=goods.replace(/ID: *[0-9]+/,"").trim();
        const couponPrice=(c[3]||"").replace("查看优惠叠加","").trim();
        return {goods,goodsId:id,goodsName:name,price:c[1],activityPrice:c[2],couponPrice,reason:c[4]||""};
      });
    });
    let marked=false;
    for(let i=0;i<20;i++){
      marked=await page.evaluate(()=>!![...document.querySelectorAll('[data-testid="beast-core-modal-ok-button"]')].find(x=>x.offsetParent&&(x.textContent||'').includes('确认低价创建')));
      if(marked)break;
      await page.waitForTimeout(500);
    }
    const lowPriceButtonInfo=await page.evaluate(()=>{
      const b=[...document.querySelectorAll('[data-testid="beast-core-modal-ok-button"]')].find(x=>x.offsetParent&&(x.textContent||'').includes('确认低价创建'));
      if(!b)return null;
      const r=b.getBoundingClientRect();
      const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      const cbs=[...document.querySelectorAll("input[type=checkbox]")].filter(x=>x.offsetParent).map(x=>({checked:x.checked,disabled:x.disabled,label:(x.closest("label")?x.closest("label").innerText:"").replace(/\s+/g," ").trim().slice(0,100)}));
      return {disabled:b.disabled,ariaDisabled:b.getAttribute("aria-disabled"),atPoint:{tag:el?el.tagName:null,cls:el?String(el.className||"").slice(0,100):null},checkboxes:cbs};
    });
    if(marked){
      if(JOB.confirmLowPrice===true){
        await page.evaluate(()=>{const b=[...document.querySelectorAll('[data-testid="beast-core-modal-ok-button"]')].find(x=>x.offsetParent&&(x.textContent||'').includes('确认低价创建'));if(b)b.click();});
        let foundRow=null;
        for(let i=0;i<6;i++){
          await page.waitForTimeout(2000);
          const prevTab=JOB.couponTab, prevAll=JOB.couponAllPages;
          JOB.couponTab="all"; JOB.couponAllPages=true;
          let list=null;
          try{ list=await couponList(); } finally { JOB.couponTab=prevTab; JOB.couponAllPages=prevAll; }
          const name=nameApplied||(formDefaults&&formDefaults.couponName)||"";
          const faceText=face.toFixed(2)+"元";
          foundRow=list.coupons.find(c=>c.text.includes(name))||list.coupons.find(c=>c.text.includes(faceText)&&(storeWide?c.text.includes("全店商品"):true));
          if(foundRow)break;
        }
        if(!foundRow&&JOB.verifyAfterSec>0){
          await page.waitForTimeout(JOB.verifyAfterSec*1000);
          const prevTab=JOB.couponTab, prevAll=JOB.couponAllPages;
          JOB.couponTab="all"; JOB.couponAllPages=true;
          let list=null;
          try{ list=await couponList(); } finally { JOB.couponTab=prevTab; JOB.couponAllPages=prevAll; }
          const name=nameApplied||(formDefaults&&formDefaults.couponName)||"";
          const faceText=face.toFixed(2)+"元";
          foundRow=list.coupons.find(c=>c.text.includes(name))||list.coupons.find(c=>c.text.includes(faceText)&&(storeWide?c.text.includes("全店商品"):true));
        }
        if(foundRow){
          result={created:true,text:"",syncTool:false,low_price_confirmed:true,warnings,verifyRow:foundRow.text};
        } else {
          result={created:true,text:"",syncTool:false,low_price_confirmed:true,warnings,verified:false,pending_verification:true};
        }
      } else {
        const warningsSummary=warnings.map((w,i)=>`${i+1}. ${w.goodsName}（ID ${w.goodsId||"-"}）拼单价 ${w.price} / 活动价 ${w.activityPrice} / 券后价 ${w.couponPrice} / ${w.reason}`).join("；");
        return {status:"needs_user_input",error:"coupon_low_price_warning",message:`平台提示低价风险，未提交。共 ${warnings.length} 个商品：${warningsSummary}。请确认是否继续`,warningsSummary,warnings,lowPriceButtonInfo,type,goodsIds,items,face,issue,couponName:nameApplied||(formDefaults&&formDefaults.couponName)||null,perPersonApplied,useDaysApplied,followScopeApplied,claimDaysApplied,formDefaults,extras,fields,text:body};
      }
    }
    if(warnings.length){
      result={created:true,text:"",syncTool:false,low_price_confirmed:true,warnings,verified:false,pending_verification:true};
    } else {
          return {status:"failed",error:"coupon_create_not_confirmed",warnings,type,goodsIds,items,face,issue,couponName:nameApplied||(formDefaults&&formDefaults.couponName)||null,perPersonApplied,useDaysApplied,followScopeApplied,claimDaysApplied,formDefaults,extras,fields,text:body};
    }
  }
  const successResult={status:"done", type, goodsIds, items, face, issue, couponName: nameApplied || (formDefaults && formDefaults.couponName) || null, perPersonApplied, useDaysApplied, followScopeApplied, claimDaysApplied, formDefaults, extras, fields, success:true, extra_setting:result.syncTool, low_price_confirmed:result.low_price_confirmed===true, pending_verification:result.pending_verification===true, verified:result.pending_verification===true?false:undefined, display_name:storeWide?"全店商品店铺关注券":undefined, custom_name_ignored:storeWide&&!!JOB.couponName, low_price_warnings:result.warnings||[], extras_requested:(JOB.extraDiscount>0||JOB.surpriseExtraDiscount>0), extras_verified:result.pending_verification===true?false:((JOB.extraDiscount>0||JOB.surpriseExtraDiscount>0)?/全站营销额外设置|额外优惠/.test(result.text||""):true), redirect_url:result.url||null, text:result.text};
  if(JOB.verify===true && result.pending_verification!==true){
    const prevTab=JOB.couponTab, prevAll=JOB.couponAllPages;
    JOB.couponTab="all"; JOB.couponAllPages=true;
    let list=null;
    try{ list=await couponList(); } finally { JOB.couponTab=prevTab; JOB.couponAllPages=prevAll; }
    const name=nameApplied || (formDefaults && formDefaults.couponName) || "";
    const faceText=face.toFixed(2)+"元";
    const row=list.coupons.find(c=>c.text.includes(name))||list.coupons.find(c=>c.text.includes(faceText)&&(!goodsIds.length||c.text.includes(goodsIds[0])))||(storeWide?list.coupons.find(c=>c.text.includes(faceText)&&c.text.includes("全店商品")&&c.text.includes("店铺关注券")):null);
    successResult.verified=!!row;
    successResult.verifyRow=row?row.text:null;
    successResult.verifyCount=list.count;
    if(!row) return {...successResult,status:"failed",error:"coupon_verify_failed"};
  }
  return successResult;
}

async function couponClickPage(n){
  const pos=await page.evaluate((n)=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const el=[...document.querySelectorAll("[class*=PGT_pagerItem]")].filter(x=>x.offsetParent).find(x=>t(x)===String(n));
    if(!el)return null;
    el.scrollIntoView({block:"center",inline:"center"});
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  },n);
  if(!pos)return false;
  await page.mouse.click(pos.x,pos.y);
  await page.waitForTimeout(1200);
  return true;
}

async function couponList(){
  if(JOB.couponNoReload===true){
    await page.waitForTimeout(500);
  } else {
    await page.goto("https://mms.pinduoduo.com/tool/coupon?tab=1",{timeout:60000});
    await waitForPage(async()=>page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length>1),15000);
  }
  const notices=await dismissCouponNotices();
  const tab=String(JOB.couponTab||"").trim();
  if(tab){
    const label=tab==="ended"||tab==="已结束"?"已结束":tab==="active"||tab==="生效中"?"生效中":tab==="all"||tab==="全部"?"全部":tab==="pending"||tab==="待激活"?"待激活":"";
    if(label){
      const pos=await page.evaluate((label)=>{
        const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
        const el=[...document.querySelectorAll("[class*=TAB_capsuleLabel], [role=tab], button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)===label)[0];
        if(!el)return null;
        const r=el.getBoundingClientRect();
        return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
      },label);
      if(pos){ await page.mouse.click(pos.x,pos.y); await page.waitForTimeout(2000); }
    }
  }
  let last=-1,stable=0;
  for(let i=0;i<10;i++){
    await page.waitForTimeout(800);
    const n=await page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length);
    if(n===last)stable++; else { stable=0; last=n; }
    if(stable>=2&&n>1)break;
  }
  const readPage=()=>page.evaluate(()=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
    const rows=[...document.querySelectorAll("tr")].filter(x=>x.offsetParent);
    const coupons=rows.filter(r=>/商品立减券|店铺关注券|关注店铺商品券|关注店铺券|惊喜券|场景专属券/.test(t(r))).map(r=>{
      const text=t(r);
      const cells=[...r.querySelectorAll("td")].map(x=>t(x).slice(0,120));
      const claim=(cells[6]||"").split(" 至 ");
      const issueM=text.match(/([0-9]+) *[(]已领取 *([0-9]+)张，剩余 *([0-9]+)张[)]/);
      const perM=text.match(/[)] *([0-9]+) +([^ ]+) +(领取中|已结束|待激活|已失效|审核中)/);
      return {
        text:text.slice(0,300),
        cells,
        type:(text.match(/商品立减券|店铺关注券|关注店铺商品券|关注店铺券|惊喜券|场景专属券/)||[])[0]||null,
        goodsId:(text.match(/ID:\s*(\d+)/)||[])[1]||null,
        face:(text.match(/([0-9.]+)元/)||[])[1]||null,
        claimStart:claim[0]||null,
        claimEnd:claim[1]||null,
        useTime:cells[7]||null,
        issue:issueM?Number(issueM[1]):null,
        claimed:issueM?Number(issueM[2]):null,
        remaining:issueM?Number(issueM[3]):null,
        perPerson:perM?Number(perM[1]):null,
        scope:perM?perM[2]:null,
        status:(text.match(/领取中|已结束|待激活|已失效|审核中/)||[])[0]||null,
        buttons:[...r.querySelectorAll("button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&["结束","增加发行量","数据"].includes(t(x))).map(x=>t(x))
      };
    });
    return {count:coupons.length,coupons};
  });
  const maxPages=JOB.couponAllPages===true?100:1;
  const all=[];
  let pages=0;
  for(let n=1;n<=maxPages;n++){
    if(n>1){
      const ok=await couponClickPage(n);
      if(!ok)break;
      await page.waitForTimeout(600);
    }
    const d=await readPage();
    all.push(...d.coupons);
    pages=n;
  }
  const statusCounts={};
  for(const c of all){ const k=c.status||"unknown"; statusCounts[k]=(statusCounts[k]||0)+1; }
  return {count:all.length,coupons:all,pages,statusCounts,tab:tab||"current",notices};
}

async function couponCloseAllRows(couponName,typeAliases,face){
  return page.evaluate(({couponName,typeAliases,face})=>{
    const t=(x)=>x?String(x.innerText||x.textContent||"").trim():"";
    return [...document.querySelectorAll("tr")].filter(r=>{
      if(!r.offsetParent)return false;
      const cells=[...r.querySelectorAll("td")].map(t);
      if((cells[0]||"")!==couponName)return false;
      const s=t(r);
      if(typeAliases.length&&!typeAliases.some(a=>s.includes(a)))return false;
      if(face!=null&&!new RegExp(face.toFixed(2)+"元").test(s))return false;
      return !![...r.querySelectorAll("a,button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)==="结束")[0];
    }).map(r=>t(r).slice(0,300));
  },{couponName,typeAliases,face});
}

async function couponCloseAllPages(couponName,typeAliases,face){
  const out=[];
  for(let n=1;n<=100;n++){
    if(n>1){
      const ok=await couponClickPage(n);
      if(!ok)break;
      await page.waitForTimeout(600);
    }
    const rows=await couponCloseAllRows(couponName,typeAliases,face);
    if(rows.length)out.push({page:n,rows});
  }
  return out;
}

async function couponCloseAll(goodsId,typeAliases,face,couponName){
  if(!couponName)throw new Error("coupon_close_all_name_required");
  await page.goto("https://mms.pinduoduo.com/tool/coupon?tab=1",{timeout:60000});
  await waitForPage(async()=>page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length>1),15000);
  await dismissCouponNotices();
  const closeTab=String(JOB.couponTab||"active");
  const tabLabel=closeTab==="ended"||closeTab==="已结束"?"已结束":closeTab==="all"||closeTab==="全部"?"全部":closeTab==="pending"||closeTab==="待激活"?"待激活":"生效中";
  const tabPos=await page.evaluate((label)=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const el=[...document.querySelectorAll("[class*=TAB_capsuleLabel], [role=tab], button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)===label)[0];
    if(!el)return null; const r=el.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  },tabLabel);
  if(tabPos){await page.mouse.click(tabPos.x,tabPos.y);await page.waitForTimeout(1800);}
  const pageRows=await couponCloseAllPages(couponName,typeAliases,face);
  const rows=pageRows.flatMap(x=>x.rows);
  if(JOB.expectedCount!=null&&rows.length!==JOB.expectedCount){
    return {status:"needs_user_input",error:"coupon_close_count_mismatch",expected:JOB.expectedCount,actual:rows.length,rows,couponName};
  }
  if(JOB.confirmClose!==true){
    return {status:"preview",couponName,rows,count:rows.length,pages:pageRows.map(x=>({page:x.page,count:x.rows.length})),wouldClose:true,note:"confirmClose!=true: 未结束"};
  }
  let closedCount=0;
  for(const pr of pageRows){
    const pageOk=await couponClickPage(pr.page);
    if(!pageOk)continue;
    await page.waitForTimeout(600);
    for(let round=0;round<100;round++){
    const hit=await page.evaluate(({couponName,typeAliases,face})=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
      const rows=[...document.querySelectorAll("tr")].filter(r=>{if(!r.offsetParent)return false;const cells=[...r.querySelectorAll("td")].map(t);return (cells[0]||"")===couponName;}).filter(r=>{
        const s=t(r);
        if(typeAliases.length&&!typeAliases.some(a=>s.includes(a)))return false;
        if(face!=null&&!new RegExp(face.toFixed(2)+"元").test(s))return false;
        return !![...r.querySelectorAll("a,button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)==="结束")[0];
      });
      if(!rows.length)return {count:0};
      const r=rows[0];
      const b=[...r.querySelectorAll("a,button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)==="结束")[0];
      const rr=b.getBoundingClientRect();
      return {count:rows.length,x:Math.round(rr.x+rr.width/2),y:Math.round(rr.y+rr.height/2),rowText:t(r).slice(0,300)};
    },{couponName,typeAliases,face});
    if(!hit||hit.count===0)break;
    await page.mouse.click(hit.x,hit.y);
    await page.waitForTimeout(1200);
    const clickExact=async(label)=>{
      const ok=await page.evaluate((label)=>{
        const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
        const b=[...document.querySelectorAll("button,div,span")].filter(x=>x.offsetParent&&t(x)===label).pop();
        if(!b)return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
      },label);
      if(!ok)return false; await page.mouse.click(ok.x,ok.y); await page.waitForTimeout(1200); return true;
    };
    const first=await clickExact("确认结束")||await clickExact("确认");
    if(first) await clickExact("直接结束");
    await page.waitForTimeout(1000);
    const text=(await page.evaluate(()=>document.body.innerText||"")).slice(-700);
    if(/成功停止该优惠券发行/.test(text)) closedCount++;
    else return {status:"failed",error:"coupon_close_all_not_confirmed",couponName,closedCount,text};
    await page.waitForTimeout(800);
    }
  }
  return {status:"done",couponName,closedCount,closed:true,remaining:0};
}

async function couponClose(){
  const goodsId=String((JOB.goodsIds||[])[0]||JOB.goodsId||"");
  const couponName=String(JOB.couponName||"").trim();
  if(!goodsId&&!couponName)throw new Error("coupon_close_goods_id_missing");
  const type=String(JOB.couponType||"").trim();
  const typeAliases=type?(type==="店铺关注券"?["店铺关注券","关注店铺商品券","关注店铺券"]:[type]):[];
  const face=JOB.faceAmount!=null&&JOB.faceAmount!==""?Number(JOB.faceAmount):null;
  if(JOB.closeAll===true) return await couponCloseAll(goodsId,typeAliases,face,couponName);
  await page.goto("https://mms.pinduoduo.com/tool/coupon?tab=1",{timeout:60000});
  await waitForPage(async()=>page.evaluate(()=>[...document.querySelectorAll("tr")].filter(x=>x.offsetParent).length>1),15000);
  await dismissCouponNotices();
  const closeTab=String(JOB.couponTab||"active");
  const tabLabel=closeTab==="ended"||closeTab==="已结束"?"已结束":closeTab==="all"||closeTab==="全部"?"全部":closeTab==="pending"||closeTab==="待激活"?"待激活":"生效中";
  const tabPos=await page.evaluate((label)=>{
    const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const el=[...document.querySelectorAll("[class*=TAB_capsuleLabel], [role=tab], button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)===label)[0];
    if(!el)return null;
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  },tabLabel);
  if(tabPos){ await page.mouse.click(tabPos.x,tabPos.y); await page.waitForTimeout(2000); }
  let hit=null;
  for(let n=1;n<=20;n++){
    if(n>1){
      const ok=await couponClickPage(n);
      if(!ok)break;
      await page.waitForTimeout(800);
    }
    for(let i=0;i<3;i++){
      hit=await page.evaluate(({id,typeAliases,face,couponName})=>{
        const t=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():"");
        const rows=[...document.querySelectorAll("tr")].filter(r=>r.offsetParent&&(!id||t(r).includes(id))).filter(r=>{
          const s=t(r);
          if(typeAliases.length&&!typeAliases.some(a=>s.includes(a)))return false;
          if(face!=null&&!new RegExp(face.toFixed(2)+"元").test(s))return false;
          return true;
        });
        if(rows.length!==1)return {count:rows.length};
        const b=[...rows[0].querySelectorAll("a,button,span,div")].filter(x=>x.offsetParent&&!x.children.length&&t(x)==="结束")[0];
        if(!b)return {count:1,endButton:false,rowText:t(rows[0]).slice(0,400)};
        const r=b.getBoundingClientRect();
        return {count:1,endButton:true,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),rowText:t(rows[0]).slice(0,400)};
      },{id:goodsId,typeAliases,face,couponName});
      if(hit && hit.count===1 && hit.endButton)break;
      if(hit && hit.count>1)throw new Error("coupon_close_ambiguous:"+hit.count);
      await page.waitForTimeout(800);
    }
    if(hit && hit.count===1 && hit.endButton)break;
  }
  if(!hit||hit.count===0)throw new Error("coupon_row_not_found:"+goodsId+(type?":"+type:"")+(face!=null?":"+face:""));
  if(!hit.endButton)throw new Error("coupon_end_button_missing:"+goodsId);
  if(JOB.confirmClose!==true || JOB.dryRun===true){
    return {status:"preview", goodsId, couponType:type||null, face, rowText:hit.rowText||"", wouldClose:true, note:JOB.dryRun===true?"dryRun: 未点击结束":"confirmClose!=true: 未点击结束（需显式 confirmClose:true）"};
  }
  await page.mouse.click(hit.x,hit.y);
  await page.waitForTimeout(1200);
  const clickExact=async(label)=>{
    const ok=await page.evaluate((label)=>{
      const t=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
      const b=[...document.querySelectorAll("button,div,span")].filter(x=>x.offsetParent&&t(x)===label).pop();
      if(!b)return null;
      const r=b.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    },label);
    if(!ok)return false;
    await page.mouse.click(ok.x,ok.y);
    await page.waitForTimeout(1200);
    return true;
  };
  const first=await clickExact("确认结束")||await clickExact("确认");
  if(first) await clickExact("直接结束");
  await page.waitForTimeout(1000);
  const text=(await page.evaluate(()=>document.body.innerText||"")).slice(-800);
  const closed=/成功停止该优惠券发行/.test(text);
  return {status:closed?"done":"failed", error:closed?undefined:"coupon_close_not_confirmed", goodsId, couponType:type||null, face, closed, text};
}

async function couponAudit() {
  const types = (Array.isArray(JOB.couponTypes) && JOB.couponTypes.length ? JOB.couponTypes : ["商品立减券", "店铺关注券", "惊喜券"]).map(String);
  const goodsIds = (JOB.goodsIds || []).map(String).filter(Boolean);
  if (!goodsIds.length && JOB.goodsId) goodsIds.push(String(JOB.goodsId));
  const probeRange = JOB.probeRange === true;
  const list = {};
  const prevAllPages = JOB.couponAllPages;
  JOB.couponAllPages = true;
  let firstTab = true;
  for (const tab of ["active", "ended", "pending", "all"]) {
    JOB.couponTab = tab;
    JOB.couponNoReload = !firstTab;
    firstTab = false;
    const d = await couponList();
    list[tab] = { count: d.count, pages: d.pages, statusCounts: d.statusCounts, coupons: d.coupons.map(c => c.text) };
  }
  JOB.couponAllPages = prevAllPages;
  JOB.couponNoReload = false;
  JOB.couponTab = null;
  const typesOut = {};
  for (const type of types) {
    const item = { type, products: {} };
    try {
      const ids = goodsIds.length ? goodsIds : [null];
      for (const gid of ids) {
        await couponGoto(type);
        if (!gid) {
          item.products["none"] = { status: "skipped", error: "goods_id_missing" };
          continue;
        }
        await couponSelectProduct(gid);
        const form = await couponFormInfo();
        const rangeTests = [];
        if (probeRange && form.facePlaceholder) {
          const parts = String(form.facePlaceholder).split("～");
          const min = Number(String(parts[0] || "").replace(/[^0-9.]/g, ""));
          const max = Number(String(parts[1] || "").replace(/[^0-9.]/g, ""));
          if (Number.isFinite(min) && Number.isFinite(max)) {
            const values = [...new Set([min - 1, min, max, max + 1].filter(x => x > 0))];
            let first = true;
            for (const face of values) {
              const r = await couponTryFace(gid, face, first ? 100 : null);
              first = false;
              rangeTests.push(r);
            }
          }
        }
        item.products[gid] = { form, rangeTests };
        if(!item.options){
          item.options={
            perPerson:form.perPersonDefault?["1","2","3"]:null,
            useDays:form.useDaysDefault?{default:form.useDaysDefault,range:"7~90"}:null,
            claimRange:form.claimRange,
            followScope:type==="店铺关注券"?(form.productRow?"products":"unknown"):null,
            extraDiscount:form.extraDiscount,
            surpriseExtraDiscount:form.surpriseExtraDiscount
          };
        }
        if (!item.form) { item.form = form; item.rangeTests = rangeTests; }
      }
      item.status = "done";
    } catch (e) {
      item.status = "failed";
      item.error = String(e && e.message || e);
    }
    typesOut[type] = item;
  }
  return { status: "done", list, types: typesOut, goodsIds };

}

async function main() {

  await openShop();
  const mode = String(JOB.mode || "");
  if (mode === "activity-list") return { status: "done", ...(await activityList()) };
  if (mode === "store-activity-list") return { status: "done", ...(await storeActivityList()) };
  if (mode === "store-activity-create") return await storeActivityCreate();
  if (mode === "store-activity-close") return await storeActivityClose();
  if (mode === "coupon-types") return { status: "done", ...(await couponTypes()) };
  if (mode === "coupon-audit") return await couponAudit();
  if (mode === "coupon-create") return await couponCreate();
  if (mode === "coupon-list") return { status: "done", ...(await couponList()) };
  if (mode === "coupon-close") return await couponClose();
  if (mode === "platform-preview") return { status: "done", ...(await platformPreview()) };
  if (mode === "platform-search") return { status: "done", ...(await platformSearch()) };
  if (mode === "platform-scan") return { status: "done", scan: await scanAllProducts() };
  if (mode === "platform-enroll") return await platformEnroll();
  if (mode === "platform-record") return await platformRecord();
  if (mode === "platform-status") return await platformStatus();
  if (mode === "platform-inventory") return await platformInventory();
  throw new Error("mode_unsupported:" + mode);
}
let result;
try { result=await main(); await writeResult({ok:true,...result}); }
catch(e){ const msg=String(e.message||e); log("ERROR",msg); result={status:"failed",error:msg}; await writeResult({ok:false,...result}); }
finally { try{ if(task) { const mode=String(JOB.mode||""); const keepByDefault=["activity-list","store-activity-list","coupon-types","coupon-audit","coupon-list","platform-preview","platform-search","platform-scan","platform-enroll","platform-record","platform-status","platform-inventory"].includes(mode); const keep=JOB.keepOpen===true||(JOB.keepOpen!==false&&keepByDefault); if(keep) await task.handOff(); else await task.finish({keep:[]}); } }catch(e){} }
console.log("WORKER_RESULT="+JSON.stringify({shop:JOB.shop,status:result&&result.status,error:result&&result.error}));
