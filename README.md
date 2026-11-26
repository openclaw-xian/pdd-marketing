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