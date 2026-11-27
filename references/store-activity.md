# 店铺活动（限时限量购）操作与实现

> 只覆盖店铺自建活动：限量促销 / 限时促销。
> 当前范围：统一梯度、普通添加、默认自动创建；不做 Excel 批量、不做 2/3 梯度。

## 1. 入口

- 列表：`https://mms.pinduoduo.com/tool/promotion`
- 创建：`https://mms.pinduoduo.com/tool/promotion/create`

列表页签：活动中 / 待开始 / 已结束 / 全部。
列表支持商品名称/ID 搜索、活动类型筛选、批量修改、行操作（数据 / 详情 / 结束 / 关闭自动创建）。

## 2. 创建模式

```json
{
  "mode": "store-activity-create",
  "activityType": "限量促销",
  "activityName": "<活动名，最多25字>",
  "items": [
    { "goodsId": "<商品ID>", "discount": 5.0, "stock": 100 }
  ],
  "autoCreate": true,
  "externalNote": true,
  "gradient": "统一梯度",
  "selectionMode": "普通添加",
  "dryRun": true,
  "confirmCreate": false
}
```

- `activityType`：`限量促销` / `限时促销`
- `items`：最多 30 个，`goodsId` 必填；`discount` **必填，由用户决定**，不自动用页面推荐值；`stock` 只对限量促销生效
- `autoCreate`：默认 `true`，显式点「活动结束后自动创建，提升下单转化」
- `externalNote`：默认 `true`，勾选《外场活动说明》
- `gradient` / `selectionMode`：固定 `统一梯度` / `普通添加`
- `dryRun:true` 只填不创建；`confirmCreate:true` 才点创建
- 创建后默认 `verify:true`，回读列表按活动名 + 商品 ID 校验

## 3. 页面默认与实测

- 活动类型默认「限量促销」；限时促销有默认活动时间，约 7 天
- **不点「更多设置」**：统一梯度、普通添加、库存扣减都是页面默认，展开反而容易触发重渲染
- **不使用「生效设置」**：不勾选“活动在每日指定时间段内生效”，也不需要填生效时间
- 自动创建页面默认是「不自动创建」，必须显式点「活动结束后自动创建」
- 选品器：商品名称/ID 搜索，最多 30 个，可选/不可选，确认选择/取消
- 选中商品后行内：
  - 活动库存：`1~库存`
  - 促销维度：商品级（默认）
  - 折扣：`请输入折扣` 或范围 placeholder（如 `1～5.1`）
  - 活动价：推荐值，如 5 折时 13.95～45.00
  - 按钮：批量设置 / 确认设置
- 没传 `discount`：返回 `needs_user_input` + `store_activity_discount_required`，`message` 和 `items[]` 带商品名/ID、推荐折扣、允许范围、活动价，不创建
- 折扣超出商品范围：返回 `needs_user_input` + `store_activity_discount_out_of_range`，带请求值、允许范围、推荐值、活动价，不创建
- 8 折在 `1～5.1` 的商品上会直接拒绝

## 4. 低价风险

创建时会弹出「低价风险预警」，SKU 级明细。

- 默认返回 `needs_user_input` + `store_activity_low_price_warning`
- `warnings[]` 包含：`goods` / `goodsId` / `goodsName` / `price` / `activityPrice` / `couponPrice` / `reason`
- `message` 会把全部 SKU 明细列出来
- 只有显式 `confirmLowPrice:true` 才会点「确认低价创建」
- 低价确认后活动会创建，平台还会提示该商品存在超低价资损风险

## 5. 结束模式

```json
{
  "mode": "store-activity-close",
  "activityName": "<活动名>",
  "confirmClose": true
}
```

流程：

1. 进列表，关闭右上角「新消息」弹窗（否则会盖住行操作）
2. 按活动名（可选 goodsId）精确找行
3. 点行内「结束」的 `<a>`（不是外层 div）
4. 第一步弹窗「确定结束此活动吗？」→「确认结束」
5. 第二步弹窗「建议设置活动恢复时间」→「直接结束」
6. 回读行状态：行消失或「已结束」/无「结束」按钮才算成功

`confirmClose:false` 只返回 preview（rowText / wouldClose），不结束。

## 6. 实测记录

- 限量促销 dryRun：5 折 / 100 库存，活动价 13.95～45.00，选中 1，自动创建/外场说明均正确
- 限量促销真实创建：5 折 / 100，`success=true`、`verified=true`；平台提示超低价资损风险；随后结束成功
- 限量促销 5 折未确认低价：返回 `needs_user_input`，未创建
- 限量促销结束：`确认结束` → `直接结束`，`closed=true`、列表 `found=false`
- 限时促销 dryRun：不点「更多设置」，默认活动时间 `2026-11-26 00:00:00 ~ 2026-12-02 23:59:59`，选中 1
- 限时促销真实创建：5 折，`success=true`、`verified=true`；随后结束成功
- 8 折：商品允许范围 `1～5.1`，返回 needs_user_input
- 不传折扣：返回 needs_user_input，消息包含商品名/ID、推荐 1.5 / 范围 1～5.1 / 活动价 4.18～13.50
- 5.0 折：dryRun 成功，活动价 13.95～45.00，库存 100
- 5 商品真实创建：`selectedCount=5`、`verified=true`；库存不传时全部使用页面默认最大值（728735 / 499950×3 / 39996），结果标记 `stockDefaulted=true`
- 5 商品 verify：列表只展示部分商品 ID，`verified` 按活动名判定，同时返回 `verifyFoundGoodsIds` / `verifyMissingGoodsIds`
- 5 商品结束：按活动名命中 4 行报 ambiguous；逐个 goodsId 结束 4 行；列表搜索无该活动名（16 条，0 命中）
- close preview 安全门：`confirmClose:false` 找到「全站营销20261126 / ID 996118183928」，返回 `status=preview`、`wouldClose=true`、`note=未结束`，未点结束
- 创建确认门：`dryRun:false + confirmCreate:false` 返回 `status=preview`、`selectedCount=1`、创建按钮可用、`note=未点击创建`；列表搜索 `测试确认门-1127` 0 条

## 7. 已知边界

- 不做 Excel 批量添加
- 不做 2/3 梯度
- 不做「生效设置」每日时间段
- 活动时间使用页面默认（限时约 7 天），暂不支持自定义起止时间
- 自动创建开启后，平台可能后续自动生成活动，需要“关闭自动创建”时另处理
