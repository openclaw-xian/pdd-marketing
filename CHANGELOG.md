# Changelog

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
