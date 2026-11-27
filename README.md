# pdd-marketing

拼多多多店铺营销活动 + 优惠券 skill。

**状态：定稿 0.9.31（2026-11-26）。**

## 当前模式

只读/预览：
- `activity-list`：平台活动列表
- `store-activity-list`：店铺活动列表
- `coupon-types`：优惠券类型映射（10 个 radio，排除后 6 种）
- `platform-search`：按商品 ID 搜索活动商品
- `platform-preview`：指定商品，清空/只选、展开全部 SKU、逐行读价
- `platform-scan`：虚拟滚动扫描活动全部商品摘要，含加载更多
- `platform-record`：按商品 ID 回读报名记录
- `platform-status`：按活动页搜索核对商品是已生效/可报名/未找到
- `platform-inventory`：商品摘要 + 报名状态合并总表（可报名商品一次列出）

写操作（必须显式授权）：
- `platform-enroll`：支持多个 `goodsIds`，只选授权商品 + 流量保护开关 + 可选提交 + 逐商品回读
- `platform-cancel`：按活动名/activityId + goodsIds 取消报名；`confirmCancel:true` 才执行
  - `confirmSubmit` 必须为 `true` 才提交
  - `trafficProtection` 可设为 `on` / `off`
  - 未授权时只准备页面，不提交

店铺活动：
- `store-activity-create`：限量促销 / 限时促销；统一梯度、普通添加、默认自动创建；`dryRun` / `confirmCreate` / `verify`
- `store-activity-close`：按 `activityName` 结束；`confirmClose`；确认结束 → 直接结束

优惠券：
- `coupon-create`：商品立减券 / 店铺关注券 / 惊喜券；`dryRun` / `confirmCreate` / `verify` / `verifyAfterSec`
- `coupon-list`：`active` / `ended` / `pending` / `all`；`couponAllPages`；结构化字段
- `coupon-close`：`confirmClose`；`couponName` 精确匹配；`closeAll` 跨页；`expectedCount`
- `coupon-audit`：一次跑三页签 + 三券种 + 面额边界 + options

```bash
node run.mjs marketing-config.json
```

示例配置见 [examples/marketing-config.example.json](examples/marketing-config.example.json)。

平台活动报名完整操作与踩坑见 [references/platform-enrollment.md](references/platform-enrollment.md)。

范围与红线见 [SKILL.md](SKILL.md)。
## 操作账本

`record.mjs` 只记录实际操作，按 skill 一个账本，目录为 `<ledgerRoot>/<中文分类>/<店铺>/<YYYY-MM>/`，生成 `operations.jsonl` 和 `products/<商品ID>.md`；报名前查重，防止重复报名。默认目录 `%USERPROFILE%/店铺运营日志`，可用 `ledgerRoot` 配置。

## 新会话交接

任何 agent 使用本 skill 前先读 `references/operation-ledger.md`，用 `record-query.mjs` 查目标商品历史；操作完成后必须写账本。新会话不靠记忆，账本是唯一事实来源。

## 商品主档

商品事件统一写 `店铺运营日志/商品/<店铺>/<商品ID>/`，所有 skill 共享商品档案；下架商品会被 `assertCan` 阻止报名/编辑。操作前写 intent，操作后写 result。
