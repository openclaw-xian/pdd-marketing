# pdd-marketing 实现说明

> 维护前必读。本文写的是**代码怎么实现**，不是操作步骤；操作步骤和页面坑见 `coupons.md` / `platform-enrollment.md`。
> 所有示例用 `<店铺>` / `<商品ID>` 占位，不写真实店铺、商品 ID、本机路径。

## 1. 文件结构

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 使用规则、红线、执行铁律 |
| `run.mjs` | 调度器：读 config、preflight、spawn ego worker、收集 report |
| `worker-marketing.mjs` | ego 页面执行层：所有页面操作都在这里 |
| `references/coupons.md` | 优惠券操作步骤/默认值/坑 |
| `references/platform-enrollment.md` | 平台活动报名操作步骤/坑 |
| `references/cancel-enrollment.md` | 取消报名 |
| `references/implementation.md` | 本文件 |
| `examples/marketing-config.example.json` | 配置示例 |
| `VERSION` / `CHANGELOG.md` | 版本与变更 |

## 2. 运行模型

```
node run.mjs <config.json>
  ├─ preflight：mode / shops / recordRoot / activityId / goodsIds 等
  ├─ 生成 _runs/marketing-<时间>/{results,logs}
  ├─ 每个店铺写一个 wrapper：globalThis.__JOB = {...}; import(worker)
  ├─ spawn ego-browser nodejs -e "await import(wrapper)"
  ├─ 轮询 resultPath，读 worker 结果
  └─ 写 report.json，按状态退出
```

- `JOB` 里带：`shop`、`profile`、`mode`、`activityId`、`activityType`、`goodsIds`、`couponType`、`couponTypes`、`faceAmount`、`issueCount`、`couponName`、`couponTab`、`extraDiscount`、`surpriseExtraDiscount`、`dryRun`、`confirmCreate`、`keepOpen`、`probeRange`、`recordRoot`、`resultPath`、`logPath`。
- 退出码：
  - `0`：done / preview
  - `3`：preflight `needs_user_input`，或 worker 返回 `needs_user_input`
  - `5`：failed
- 报告：`_runs/marketing-<id>/report.json`，每个店铺的 `results/<店铺>.json` 是 worker 原始结果。

## 3. 空间与页面复用

`openShop()`：

1. `profiles()` 按 **profile 名字** 找店铺，找不到报 `shop_not_logged_in:<profile>`。
2. `listTaskSpaces()` 找 `pdd-marketing-*` 且 `profileName` 匹配的空间。
3. 状态文件 `~/.pdd-marketing-spaces.json` 记录 profile → 空间名；空间被删会自动新建 `pdd-marketing-<店铺>`。
4. `ownership === "agent"` 用 `taskSpace(id)`；`agentDelegatedToUser` 用 `takeOverTaskSpace(id)`。
5. 页面复用：`task.pages()[0]`，没有才 `newPage()`。

`finally` 的保留策略：

- 只读模式默认 `keepOpen`：`handOff()` 保留页面，下次直接复用同一空间。
  - `activity-list`、`store-activity-list`、`coupon-types`、`coupon-audit`、`coupon-list`、`platform-preview/search/scan/enroll/record/status/inventory`
- 写模式默认关闭：`coupon-create`、`coupon-close` 结束 `finish({keep:[]})`。
- `keepOpen:true` 可强制保留；`keepOpen:false` 可强制关闭。

`couponList()` / `couponClose()` 如果当前 URL 已经在 `/tool/coupon?tab=1`，跳过 `goto`，直接读。

## 4. 等待策略

- `waitForPage(fn, timeoutMs=15000, intervalMs=400)`：轮询到条件成立就继续，替代固定 5～6 秒等待。
- `couponGoto()`：`goto` 后轮询「选择商品」或「创建」按钮出现。
- `couponList()` / `couponClose()`：`goto` 后轮询表格行 > 1；列表读取前再轮询行数稳定（2 次相同）。
- `couponClose()`：按页 1～20 搜索，每页最多 3 次 × 0.8 秒轮询，避免只读当前页或列表未渲染。
- 创建成功后轮询 10 次 × 1 秒确认「创建成功」，没确认返回 `failed`。

## 5. 优惠券创建

### 5.1 入口

`couponGoto(type)`：

| 类型 | URL |
|---|---|
| 商品立减券 / `product` | `/tool/coupon/create?chooseType=7` |
| 店铺关注券 / `follow` | `/tool/coupon/create?chooseType=3` |
| 惊喜券 / `surprise` | `/tool/surprise-coupon/create` |

> `/tool/surprise-coupon` 是**列表页**，不是创建页；用错会看不到表单。

### 5.2 券名

`couponSetName(name)`：

- 先找 placeholder 含「该名称将不对买家展示」的输入框。
- 找不到时（惊喜券），按「优惠券名称」标签向上找同容器内的 text input。
- 最大 20 字；写入后回读校验，不一致报 `coupon_name_not_applied`。

### 5.3 选品

`couponSelectProduct(goodsId)`：

1. 点「选择商品」。
2. 翻页 1～4，找行内 `ID:\s*<id>`。
3. 点该行 checkbox。
4. 点「确认选择」。

### 5.4 读表单/行

- `couponRowInfo(goodsId)`：返回行内输入框值、坐标、单元格文本、行文本。
- `couponFormInfo()`：返回券名、领取时间、使用时间、面额默认值、发行张数默认值、面额 placeholder、额外优惠状态、建议区间。
- `couponSetFields(goodsId, face, issue, perPerson)`：
  - 用真实鼠标点击 + `Ctrl+A` + 键盘输入（原生 setter 会被 React 重置）。
  - 回读值必须等于 face/issue，否则 `coupon_fields_not_applied`。
  - `券后价` 为 `--` 时抛 `coupon_face_out_of_range`，带 `suggestedRange`。
  - `perPersonLimit`：惊喜券支持 1/2/3 张（`couponSetPerPersonLimit`），其他券种页面没有该字段时报 `coupon_per_person_not_supported`。

### 5.5 额外优惠

`couponApplyExtras(extraDiscount, surpriseExtraDiscount)`：

- 两个区块：
  - `#fullSiteMarketingDiscountValue` / `#fullSiteMarketingCheck`：额外优惠
  - `#surpriseCouponDiscountValue` / `#surpriseCouponCheck`：惊喜券额外优惠
- `null` / 0 = 关闭；1～100 = 开启并写入金额。
- 区块不存在时（店铺关注券/惊喜券）：desired 为空则跳过；desired > 0 才报 `coupon_extra_section_missing`。
- 结束后复查 checked/amount，不一致报 `coupon_extras_not_applied`。

### 5.6 创建

`couponCreate()`：

1. 校验 type/goodsIds/face/issue。
2. `couponGoto` → `couponSetName` → 选品 → 读默认值 → `couponSetFields`。
3. `couponApplyExtras`。
4. 校验「已选 N 个商品」= goodsIds 数量。
5. 校验创建按钮可用。
6. `dryRun:true` 或 `confirmCreate !== true` → 返回 `preview`，不点创建。
7. 点一次「创建」→ 轮询成功 → 返回 `done`；没确认返回 `failed`。
8. 成功页出现「全站营销额外设置」→ `extra_setting:true`，要告诉用户。

### 5.7 审计

`couponAudit()`：

- 先在同一列表页切 `active` / `ended` / `all`，读各自券列表。
- 再依次进入三种券创建页，选同一个商品，读 `couponFormInfo`。
- `probeRange:true` 时按 `facePlaceholder` 测 `min-1 / min / max / max+1`，用 `couponTryFace`，不抛错、不创建。
- 返回 `{list, types, goodsId}`；默认 keepOpen。

## 6. 优惠券列表

`couponList()`：

- 已在列表页则跳过 `goto`。
- `dismissCouponNotices()` 关闭右上角「新消息」弹窗（`ImportantList_close__d0eKb` / `AllMsg_close`）。
- `couponTab`：`active` / `ended` / `all`（也接受中文）。
- 轮询行数稳定后读取。
- 类型过滤包含：`商品立减券`、`店铺关注券`、`关注店铺商品券`、`关注店铺券`、`惊喜券`、`场景专属券`。
- `couponAllPages:true` 时逐页读取（1～20 页），返回 `pages`；实测「全部」45 张 / 5 页。
- 返回 `count`、`coupons`、`pages`、`tab`、`notices`。

## 7. 优惠券结束

`couponClose()`：

1. 默认切到「生效中」页签（`couponTab` 可改）。
2. 关闭「新消息」弹窗。
3. **必须显式 `confirmClose:true` 才点结束**；否则返回 `preview`（含 rowText），不点结束。
4. 按 `goodsId` + 类型别名 + 面额（`xx.00元`）精确匹配；0 行报 `coupon_row_not_found`，多行报 `coupon_close_ambiguous`。
5. 自动逐页搜索目标券（1～20 页），每页最多 3 次 × 0.8 秒轮询。
6. 点行内「结束」。
7. 兼容两种确认：
   - 单步（惊喜券）：`确认`
   - 两步（商品立减券/店铺关注券）：`确认结束` → `直接结束`
8. 校验「成功停止该优惠券发行」，否则 `coupon_close_not_confirmed`。

## 8. 错误码 / 退出码

| 错误码 | 含义 | 退出码 |
|---|---|---|
| `mode_invalid` | 模式不支持 | 3（preflight） |
| `shop_not_logged_in:<profile>` | profile 找不到/未登录 | 5 |
| `coupon_type_invalid:<type>` | 券类型不支持 | 5 |
| `coupon_face_out_of_range` | 面额不在允许区间 | 3（needs_user_input） |
| `coupon_face_invalid:<price>` | 券后价 `--` | 5 |
| `coupon_fields_not_applied:<values>` | 输入框回读不一致 | 5 |
| `coupon_extras_not_applied:<detail>` | 额外优惠状态不一致 | 5 |
| `coupon_create_not_confirmed` | 没看到创建成功 | 5 |
| `coupon_row_not_found:<id>:<type>:<face>` | 列表找不到券 | 5 |
| `coupon_close_ambiguous:<n>` | 匹配到多张券 | 5 |
| `coupon_close_not_confirmed` | 没看到结束成功 | 5 |
| `coupon_extra_section_missing:<key>` | 想开额外优惠但页面没有区块 | 5 |
| `coupon_name_too_long:<n>` | 券名超过 20 字 | 5 |
| `coupon_per_person_invalid` / `not_supported` / `option_missing` / `not_applied` | 每人限领设置失败 | 5 |

## 9. 维护指南

- **页面改版**：优先改 `couponRowInfo`、`couponSelectProduct`、`couponFormInfo`、`couponList` 的选择器；改完先跑 `coupon-audit` 验证三种券。
- **新增券类型**：
  1. `couponGoto` 加 URL；
  2. `couponList` 类型正则加别名；
  3. `couponClose` 类型别名加映射；
  4. 跑 `coupon-audit` + `coupon-create` dryRun + `coupon-create` confirmCreate + `coupon-close`。
- **速度**：优先用 `coupon-audit` 一次跑完；只读模式默认 keepOpen，不要每次新建空间；列表/结束已在列表页时跳过 goto。
- **脱敏**：公开仓库不写真实店铺名、profile、商品 ID、本机路径、手机号、验证码、cookie/token。
- **验证命令**：

```bash
node --check worker-marketing.mjs
node --check run.mjs
node run.mjs coupon-audit.json          # 只读审计
node run.mjs coupon-list.json           # 列表
node run.mjs coupon-create-dryrun.json  # 预览，不创建
node run.mjs coupon-create.json         # confirmCreate:true 才创建
node run.mjs coupon-close.json          # 结束
```

## 10. 0.9.9 补充

- `couponList` 返回 `type` / `goodsId` / `face` / `status` / `cells` 结构化字段和 `statusCounts`；`couponAllPages:true` 逐页读取。
- 分页修复：点击分页器前必须 `scrollIntoView`，否则点击落在视口外，会重复读同一页。
- `couponClose` 支持 `couponName` 精确匹配，避免同商品同面额多张券误关。
- `useDays`：店铺关注券使用时间 7～90 天。
- `items`：商品立减券按商品分别设置 `{goodsId, faceAmount, issueCount}`。
- `verify:true`：创建后自动回读 active 列表，按券名/面额/商品 ID 校验。
- `followScope`：店铺关注券 `all`（全店）/`products`（指定商品）；全店模式不选商品。
- `couponSelectProduct` 的固定等待改为轮询。
- `claimDays` 已实现（0.9.13）。

## 11. 0.9.11 补充

- 低价风险守卫：点创建后若出现「低价风险预警 / 确认低价创建 / 修改低价商品」，返回 `needs_user_input`（`coupon_low_price_warning`），不自动确认。
- `verify:true` 无 goodsIds（全店券）时按券名 + 面额回读。
- `coupon-close` 允许不传 goodsId，按 `couponName` + 类型 + 面额关闭全店券。
- 商品选择器分页点击也加 `scrollIntoView`，避免点击视口外。
- 多商品创建已验证：第二商品需无生效中的商品立减券；`verify` 优先按券名回读。

## 12. 0.9.13 补充

- `claimDays`：点击领取时间输入框，驱动 RPR 双月日历选起止日，确认后回读日期；实测 45 天。
- 商品选择器优先按商品 ID/名称搜索，失败再翻页。
- `confirmLowPrice:true`：低价风险预警时显式点「确认低价创建」；不传返回 `needs_user_input`。
- `couponRowInfo` 增加滚动重试。
- 多商品创建已验证：第二商品需无生效中的商品立减券；`verify` 优先按券名回读。

## 13. 0.9.16 补充

- `coupon-close` 新增 `closeAll:true`：按 `couponName` 循环结束多商品券所有行，返回 `closedCount`。
- 预检允许只传 `couponName`；`couponCloseAll` 强制重新进列表并支持 `couponTab`。

## 14. 0.9.17 补充

- `couponList` 每次强制 `goto` 列表，重置筛选/页签。
- `couponAudit` 支持多个 `goodsIds`，输出 `types[type].products[goodsId]`。
- `closeAll` 券名按首列完全匹配；`confirmClose:false` 返回 preview 行清单。

## 15. 0.9.18 补充

- `couponList` 结构化字段增加 issue/claimed/remaining/perPerson/scope。
- `couponTab` 增加 pending/待激活；audit 列表含 pending。
