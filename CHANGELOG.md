# Changelog

## 0.9.33 — 2026-11-26

- 店铺活动范围再次确认：活动编辑、批量结束、关闭自动创建均**不做**，加入范围外。
- 文档同步「范围外」清单；不再列为待办。

## 0.9.32 — 2026-11-26

- 店铺活动范围确认：Excel 批量添加、2/3 梯度、「生效设置」每日时间段、自定义活动起止时间均**不做**；限时活动时间用页面默认约 7 天。
- 文档改为「范围外」，不再列为待办。

## 0.9.31 — 2026-11-26

- 新增 `store-activity-create`：限量促销 / 限时促销；统一梯度、普通添加、默认自动创建；`items` 支持 goodsId/discount/stock；`dryRun` / `confirmCreate` / `verify`。
- 新增 `store-activity-close`：按 `activityName` 结束，`确认结束` → `直接结束`，行状态回读。
- 不点「更多设置」、不使用「生效设置」；限时活动时间用页面默认约 7 天。
- 实测：限量 5 折/100 创建+结束；限时 5 折创建+结束；8 折超出 1～5.1；5 折低价守卫返回 needs_user_input。

## 0.9.30 — 2026-11-26

- `closeAll` 支持跨页：逐页扫描 1～100 页，`expectedCount` 按总行数校验，preview 返回每页行数，关闭时逐页处理。
- 实测多商品券 2 行：`closedCount=2`、`closed=true`；生效中 27 张 / 3 页，搜索该券名 0 条。
- 优惠券模块 P0/P1/P2 代码项闭环；仅剩平台限制项：issueCount 上限、券内部 ID、额外优惠人工核验。

## 0.9.29 — 2026-11-26

- 分页上限 50→100；closeAll 轮次 50→100。
- `coupon-audit` 列表页签改为首次 `goto`、后续只切页签（`couponNoReload`），降低审计耗时。
- `coupon-list` 增加 `claimStart` / `claimEnd` / `useTime` 结构化字段。
- 全店券结果增加 `display_name` / `custom_name_ignored`，明确自定义名不展示。
- `items` 里 goodsId 重复时 preflight 直接拦截（`coupon_items_duplicate`）。

## 0.9.28 — 2026-11-26

- 探查价格管理「价格及优惠详情」：按商品 ID 查询成功，但详情页没有额外优惠 / 全站营销 / 惊喜券额外优惠字段。
- 额外优惠实际生效无法从券列表、数据页、价格详情页自动回读；`extras_verified` 仅在成功页出现额外设置时为 true，否则 false。
- 真正核验只能人工在价格管理查看，或后续接后端接口；测试券已 `closeAll`。

## 0.9.27 — 2026-11-26

- 探查券列表「数据」：点击后仍停留券列表，未打开含额外优惠的详情页；列表也没有额外优惠列。
- 额外优惠实际生效无法从券列表/数据页回读；`extras_verified` 仅在成功页出现额外设置时为 true，否则 false。
- 真正核验需价格管理「查看优惠叠加」或人工确认；待后续加 price-check 模式。
- 测试券已 `closeAll` 结束。

## 0.9.26 — 2026-11-26

- `closeAll` 新增 `expectedCount`：实际行数不匹配返回 `needs_user_input` + `coupon_close_count_mismatch`，不执行关闭；实测 expected=2 / actual=1 被拦截。
- `coupon-audit` 增加 `options`：perPerson / useDays / claimRange / followScope / extraDiscount / surpriseExtraDiscount。
- 新增 `verifyAfterSec`：低价确认后未在列表找到时，等待 N 秒自动重读列表。
- 成功结果增加 `extras_requested` / `extras_verified`；额外优惠实际设置需价格管理核验时标 false。

## 0.9.25 — 2026-11-26

- 确认低价创建点击实际成功，券会创建；代码不再因未捕获跳转而误报 `coupon_create_not_confirmed`。
- 有低价 `warnings` 时返回 `success:true` + `low_price_confirmed:true` + `pending_verification:true`，由 `coupon-list` 回读确认；`verify` 在 pending 时跳过。
- 默认仍 `needs_user_input`，用户决定；`confirmLowPrice` 为实验性。
- 测试券已 `closeAll` 结束。

## 0.9.24 — 2026-11-26

- 低价按钮 DOM 定位：`button[data-testid="beast-core-modal-ok-button"]`，`disabled=false`，无 checkbox，按钮中心 `elementFromPoint` 是内部 `SPAN`。
- 尝试鼠标点击 / JS `.click()` / 可见按钮筛选，仍未触发创建或跳转；手动点击可创建。疑似需要可信用户手势或存在二次确认。
- 修复 `lowPriceDom` 未定义错误；`warnings[]` 全量汇报保持。
- 测试券已 `closeAll` 结束。

## 0.9.23 — 2026-11-26

- 低价弹窗新增 `lowPriceDom` 调试信息：真实按钮为 `button[data-testid="beast-core-modal-ok-button"]`，内部 span 文本「确认低价创建」。
- `confirmLowPrice` 尝试鼠标点击 / JS `.click()` 仍未触发创建或跳转；需要确认是否有前置勾选或二次确认。
- `warnings[]` 全量汇报保持（商品名/ID/拼单价/活动价/券后价/原因）。
- 测试券已 `closeAll` 结束。

## 0.9.22 — 2026-11-26

- 低价风险回读补全 `goodsId` / `goodsName`，`couponPrice` 清理「查看优惠叠加」。
- `message` 汇报全部低价商品明细：商品名、ID、拼单价、活动价、券后价、原因；实测 4 个商品全部出现在 CLI NEEDS 输出。
- 默认仍返回 `needs_user_input`，不自动确认，由用户决定。

## 0.9.21 — 2026-11-26

- 低价风险提示改为结构化回读：`warnings[]` 含 goods / price / activityPrice / couponPrice / reason；默认返回 `needs_user_input`，由用户决定，不自动确认。
- 实测 4 条低价商品明细（券后价 0.01 / 2.56 / 1.10 / 5.80，低于 3 折）。
- `confirmLowPrice` 自动点击仍不稳定：按钮定位不到，代码仍返回 `coupon_create_not_confirmed`；手动点击可创建（全店 6 元 / 100 张已验证）。
- 全店券面额/发行量已补全；测试券已 `closeAll` 结束。

## 0.9.20 — 2026-11-26

- 全店关注券创建补全顶层字段：券面额/发行张数；实测 6 元 / 100 张创建成功，列表显示「全店商品店铺关注券 6.00元 / 100」。
- 全店券列表显示名固定为「全店商品店铺关注券」，自定义券名不生效（平台行为）。
- `confirmLowPrice`：按钮是含子元素的 `button`，leaf-exact 选择器找不到；已改为 `button/[role=button]` 包含文本，但实测仍返回 `coupon_create_not_confirmed`（券实际创建成功并跳价格管理），待继续修。
- 测试券已用 `closeAll` 结束。

## 0.9.19 — 2026-11-26

- `claimDays` 边界实测：7/30/90/365 天全部正确（2026-11-26~12-02 / 12-25 / 2027-02-23 / 2027-11-25）。
- 分页上限 20→50；`closeAll` 轮次 20→50。
- `confirmLowPrice` 实测：点「确认低价创建」会跳到价格管理，未创建券；代码改为返回 `needs_user_input` + `coupon_low_price_requires_price_fix`。
- 已知未做：`issueCount` 上限、结束确认按钮作用域、审计速度、额外优惠实际设置核验。

## 0.9.18 — 2026-11-26

- `coupon-list` 结构化字段补全：`issue` / `claimed` / `remaining` / `perPerson` / `scope`；实测 6 元关注券 issue=100、claimed=0、remaining=100、perPerson=1、scope=全场景通用。
- `coupon-list` 支持 `pending` / 待激活页签；`coupon-audit` 列表增加 pending。

## 0.9.17 — 2026-11-26

- `coupon-list` 每次读取前强制重新进列表，避免筛选/页签残留；实测 active 27 张 / 3 页（此前偶发只读 9 张 / 1 页）。
- `coupon-audit` 支持多个 `goodsIds`，按商品输出 `products`；实测 2 商品，active 27 / ended 133 / all 160，耗时 93.1s。
- `coupon-close` 的 `closeAll` 改为券名完全匹配（首列），并支持 `confirmClose:false` 预览返回将关闭行清单；实测预览 1 行、未关闭。

## 0.9.16 — 2026-11-26

- 新增 `coupon-close` 的 `closeAll:true`：按 `couponName` 循环结束多商品券的所有行，返回 `closedCount`。
- `coupon-close` 预检允许只传 `couponName`（无需 goodsId）。
- `couponCloseAll` 强制重新进列表并支持 `couponTab`，避免列表筛选/页签残留。
- 实测：`测试closeall-1126` 两行，`closedCount=2`；生效中 27 张/3 页，搜索 0 条。

## 0.9.15 — 2026-11-26

- 多商品创建已验证：换一个没有生效商品立减券的第二商品后，2 个商品提交成功，两行面额/张数正确。
- `verify` 回读改为优先按券名匹配，再按面额/商品 ID；避免多商品券误报 `coupon_verify_failed`。
- 已确认多商品失败原因：第二个商品已有生效中的商品立减券，checkbox 禁用并提示「该商品已存在生效中的商品立减券」。

## 0.9.14 — 2026-11-26

- 修正多商品失败原因：不是页面单商品限制，而是第二个商品已有生效中的商品立减券；选品器 checkbox 为 disabled（CBX_disabled），tooltip「该商品已存在生效中的商品立减券」。
- 多商品测试需换一个当前没有生效商品立减券的商品。

## 0.9.13 — 2026-11-26

- 实现 `claimDays`：驱动领取时间日历选起止日；实测 45 天预览、正式创建 + verify + 结束成功（2026-11-26 ~ 2027-01-09）。
- 商品选择器支持按商品 ID/名称搜索；多商品第二个商品仍 `coupon_row_missing`，疑似页面单商品限制/选品器限制。
- 新增 `confirmLowPrice:true` 显式低价确认门；不传仍返回 `needs_user_input`。
- `couponRowInfo` 增加滚动重试，缓解虚拟表格行未渲染。
- 已知：多商品创建仍未跑通，建议一次一个商品；`claimDays` 已可用。

## 0.9.12 — 2026-11-26

- 商品选择器支持按商品 ID/名称搜索（placeholder「输入商品名称或ID」），优先搜索，失败再翻页。
- 新增 `confirmLowPrice:true`：低价风险预警时可显式点「确认低价创建」；不传仍返回 `needs_user_input`。
- 实测：多商品第二商品可被搜索到，但确认后创建页未出现该商品行（`coupon_row_missing`），待查资格/多选限制。
- 已知未做：`claimDays`（领取时间日期选择器，输入框 readonly，需驱动日历）。

## 0.9.11 — 2026-11-26

- 新增低价风险守卫：创建时出现「低价风险预警 / 确认低价创建」返回 `needs_user_input`（`coupon_low_price_warning`），不自动确认。
- `verify:true` 在无 `goodsIds`（全店券）时按券名 + 面额回读。
- `coupon-close` 允许不传 `goodsId`，按 `couponName` + 类型 + 面额关闭全店券。
- 修复商品选择器分页点击未滚动到视口的问题。
- 实测：店铺关注券 useDays 45 创建 + verify + 关闭成功；全店关注券创建触发低价预警并正确停下；items + verify 单商品创建/关闭成功；额外优惠开启创建/关闭成功。
- 已知未做/未通过：`claimDays` 自定义领取时长（日期选择器）；多商品第二个商品在选品器未找到，待查。

## 0.9.10 — 2026-11-26

- 修复 `coupon-create` preflight：使用 `items` 时不再强制要求 `goodsIds` / `faceAmount` / `issueCount`。
- `verify:true` 改为回读「全部」页签，避免券在待激活/非生效中时误判。
- 实测：`items` + `verify` 创建 14 元 / 100 张商品立减券成功，全部页签可查到；随后按 `couponName` 关闭成功。

## 0.9.9 — 2026-11-26

- `coupon-list` 返回结构化字段（type/goodsId/face/status/cells）和 `statusCounts`；`coupon-audit` 同步输出。
- `coupon-close` 支持 `couponName` 精确匹配；修复分页点击未滚动到视口导致重复读同一页的问题（实测全部 153 张 / 17 页，唯一 153 条）。
- 新增 `useDays`：店铺关注券使用时间 7～90 天可配；实测 45 天。
- 新增 `items`：商品立减券支持按商品分别设置 `{goodsId, faceAmount, issueCount}`。
- 新增 `verify:true`：创建后自动回读 active 列表，按券名/面额/商品 ID 校验。
- 新增 `followScope`：店铺关注券支持 `all`（全店）/`products`（指定商品）；实测 all 预览成功。
- `couponSelectProduct` 固定等待改为轮询，审计 3 种券 + 12 个边界 55.4s。
- 已知未做：`claimDays` 自定义领取时长（日期选择器需进一步探查）。

## 0.9.8 — 2026-11-26

- `coupon-close` 增加 `confirmClose:true` 硬门；不传只返回 `preview`（含将结束的 rowText），不点结束。
- `coupon-list` 增加 `couponAllPages:true`，逐页读取；实测「全部」页签 45 张 / 5 页。
- `coupon-close` 自动逐页搜索目标券（1～20 页），不再只读当前页。
- 实现 `perPersonLimit`：惊喜券支持 1/2/3 张并回读校验；其他券种页面没有该字段时明确报 `coupon_per_person_not_supported`。
- `couponFormInfo` 增加 `perPersonDefault`。
- 实测：惊喜券 9 元 / 100 张 / 每人限领 1 张创建成功；`confirmClose:true` 结束成功。

## 0.9.7 — 2026-11-26

- 新增 `references/implementation.md`：文件结构、运行模型、空间/页面复用、`waitForPage`、三种券创建/列表/结束、`coupon-audit`、错误码/退出码、维护指南。
- `SKILL.md` 参考区补上 `implementation.md` 链接。

## 0.9.6 — 2026-11-26

- 新增 `coupon-audit` 只读模式：一次运行、同一 space/page 内完成 active/ended/all 三个页签回读 + 三种券的表单默认值 + 面额区间边界测试。
- 把创建页/列表页的固定 5～6 秒等待改为 `waitForPage` 轮询，页面就绪即继续。
- 实测：3 种券 + 12 个面额边界 + 3 个列表页签，一次跑完 **57.3s**；此前 6 个独立探针约 5m18s。
- `coupon-audit` 默认 keepOpen，跑完保留页面，下一次继续复用同一空间。

## 0.9.5 — 2026-11-26

- 店铺关注券：创建/回读/结束已实测；面额区间按商品（测试商品 14～25 元），使用时间默认 30 天（允许 7～90 天）。
- 惊喜券：创建入口修正为 `/tool/surprise-coupon/create`；面额区间 9～13 元；每人限领默认 3 张；创建/回读/结束已实测。
- 券名输入兜底：惊喜券没有“该名称将不对买家展示”placeholder，改按「优惠券名称」标签查找。
- 额外优惠区块缺失时自动跳过（店铺关注券/惊喜券没有这两个区块）。
- 优惠券列表类型别名：`关注店铺商品券` / `关注店铺券` 归入 `店铺关注券`，不再漏读。
- `coupon-close` 默认切到「生效中」页签；兼容单步确认（惊喜券只有「确认」）和两步确认（确认结束 → 直接结束）。
- 实测：14 元关注券、9 元惊喜券各 100 张，创建成功、结束成功，已结束页签回读；两张均 0 领取。

## 0.9.4 — 2026-11-26

- 只读模式默认 `keepOpen`：结束后 handOff 保留页面，下次运行复用同一 `pdd-marketing-<店铺>` 空间，不再每次新建。
- `coupon-list` / `coupon-close` 已在优惠券列表页时跳过 `goto`，直接读取。
- `keepOpen:false` 可强制关闭页面和空间。
- 实测：同一店铺第二次 `coupon-list` 从 8.7s 降到 3.6s。
- 验证：15 元 / 100 张测试券通过 `run.mjs coupon-create` 创建、`run.mjs coupon-close` 结束，已结束页签回读状态「已结束」。

## 0.9.3 — 2026-11-26

- 优惠券字段改为真实鼠标点击 + 键盘输入，并回读校验，修复 React 重置推荐值导致字段未生效的问题。
- `coupon-create` 增加 `confirmCreate:true` 硬门；未显式确认只做预览，不点创建。
- 增加 `dryRun:true` 预览，返回 `formDefaults` / `validRange`，用于创建前和用户对齐。
- 面额不在平台允许区间时返回 `needs_user_input` + `suggestedRange`，退出码 3，不点创建。
- 额外优惠改为按 `#fullSiteMarketingCheck` / `#surpriseCouponCheck` 精确开关并复查；支持 `extraDiscount` / `surpriseExtraDiscount`（不传=关闭，1～100=开启）。
- 支持 `couponName` 自定义内部券名。
- `coupon-list` 支持 `couponTab`（active/ended/all），读取前关闭「新消息」弹窗，轮询等待表格稳定。
- `coupon-close` 按 goodsId + 券类型 + 面额精确匹配，多张匹配报 `coupon_close_ambiguous`；读取前关闭「新消息」弹窗。
- 实测：商品立减券 14 元/100 张创建成功，两个额外优惠均关闭；结束成功并在「已结束」页签回读。
- 已知：`perPersonLimit` 尚未实现；商品立减券页面默认每人限领 99 张。

## 0.9.2 — 2026-11-25

首个公开版本。

- 平台活动：列表、按商品 ID 搜索、虚拟滚动扫描、报名预览、报名（逐商品回读）、报名记录、状态核对、库存合并表。
- 店铺活动：列表。
- 优惠券：商品立减券、店铺关注券、惊喜券的创建/列表/关闭；`coupon-types` 类型映射。
- 安全默认：只读/预览；写操作必须显式 `confirmSubmit` 且商品在授权清单内；提交前校验已选数量与 ID。
