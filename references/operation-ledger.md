# 商品主档与店铺运营日志

## 目的

所有 skill 不靠会话记忆，靠同一份商品档案知道商品当前状态，避免“已下架还去报名/编辑”。

## 目录

```text
<用户指定目录>/店铺运营日志/
  商品/
    鱼越贴饰/
      1027533959945/
        商品档案.json      # 当前状态
        操作记录.jsonl     # 所有 skill 的商品事件
        商品历史.md        # 给人看的时间线
  店铺/
    鱼越贴饰/
      物流设置/
      账单导出/
      订单导出/
      客服绩效/
  索引/
    商品索引.json
```

商品事件统一写 `商品/<店铺>/<商品ID>/`，每条带 `skill` 字段，不再按 skill 拆商品账本。

## 商品档案

```json
{
  "schemaVersion": 1,
  "shop": "鱼越贴饰",
  "goodsId": "1027533959945",
  "goodsName": "商品名",
  "lifecycleStatus": "在售",
  "activeActivities": [
    { "type": "platform", "activityId": "20981", "status": "审核中" }
  ],
  "lastPrice": 29.90,
  "stock": 9999,
  "lastVerifiedAt": "2026-11-27 14:10:00",
  "stale": false,
  "lastAction": "platform-enroll",
  "lastTime": "2026-11-27 14:10:00"
}
```

状态不是单一字段：生命周期、活动状态、价格库存、数据新鲜度分开。

## 操作前必须 assertCan

```js
assertCan({ root, shop, goodsId, action: "platform-enroll", targetId: "20981" })
```

返回：

- `allowed`
- `blocked: product_delisted`
- `blocked: duplicate_operation`
- `blocked: already_delisted`
- `warnings: ["state_stale", "activity_active"]`

规则：

- `已下架` + 报名/编辑/建券 → 阻止
- `已下架` + 再下架 → 阻止
- 已报名同活动 + 再报名 → 阻止
- 有进行中活动 + 下架 → 警告

## 两阶段记录

操作前写 `intent`，操作后写 `result`：

```text
phase=intent, result=pending
phase=result, result=success|failed|unknown
```

如果看到长时间 `pending`，先回读平台，不能直接重做。网络超时记 `unknown`，必须核实。

## 查询

```bash
node record-query.mjs --root "<用户指定目录>/店铺运营日志" --shop <店铺> --goods <商品ID>
```

## 店铺级操作

物流、账单、订单、客服不是商品级，放 `店铺/<店铺>/`；不要硬塞 `goodsId`。

## 上架语义

- `pdd-ego-listing` 是**新链接上架**：上架前没有 `goodsId`，状态是“未上架/不存在”；成功后创建商品档案，状态为“审核中/在售”。
- 已下架商品重新上架是 `relist`，不是 `listing-new`；`relist` 允许从“已下架”恢复。
- `product_delisted` 只拦报名/编辑/建券，不拦新上架。
