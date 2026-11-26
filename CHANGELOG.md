# Changelog

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
