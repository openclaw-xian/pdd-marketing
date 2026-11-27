# 操作账本：新会话交接协议

## 目的

agent 不靠会话记忆，靠账本知道“谁在什么时候对哪个商品做了什么”。新开会话、换 agent、换机器，只要账本在，就能接着干，不会重复报名/重复上架。

## 任何 agent 开始前必做

1. 读 `SKILL.md` 和本文件。
2. 确定账本目录 `ledgerRoot`：配置 > `PDD_LEDGER_ROOT` > `%USERPROFILE%/pdd-records`。
3. 查目标商品历史：

```bash
node record-query.mjs --skill pdd-marketing --shop <店铺> --goods <商品ID> --days 90
```

4. 查同店铺 + 同商品 + 同动作 + 同活动/券是否已经成功做过。
5. 有成功记录：先告诉用户“已于某时间做过”，确认后才重复；配置 `allowRepeat:true` 才允许。
6. 操作完成后必须落账，不能只回复聊天。

## 只记什么

只记实际操作：

- 平台活动报名/取消
- 店铺活动创建/结束
- 优惠券创建/结束
- 商品编辑/改价/改库存/换图/提交
- 上架/下架
- 物流地址/模板修改

预览、只读查询不记；但预览后真的提交，要把提交前价格一并记入。

## 记录结构

```text
<ledgerRoot>/<店铺>/
  operations.jsonl          # 一行一次操作，只追加
  products/<商品ID>.md      # 商品历史，给人看
```

`operations.jsonl` 字段：

- `time` / `timeLocal`
- `shop`
- `action`
- `goodsId` / `goodsName`
- `targetId` / `target`（activityId、券名、活动名等）
- `before` / `after`
- `result`（success/failed/cancelled）
- `runId`
- `evidence`（报告/截图路径）
- `repeatOf`（重复操作时指向原记录）

## 查询

```bash
node record-query.mjs --shop <店铺> --goods <商品ID>
node record-query.mjs --skill pdd-marketing --shop <店铺> --days 7
node record-query.mjs --goods <商品ID> --action platform-enroll --all --json
```

## 汇报

操作结束给用户的摘要必须包含：

- 时间
- 店铺
- 动作
- 商品 ID / 商品名
- 活动/券/对象
- before → after
- 成功/失败
- 账本记录路径

## 隐私

账本只放用户数据目录，不进公开仓库；公开文档用 `<店铺>`、`<商品ID>`、`<profile>` 占位。
