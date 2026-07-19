---
type: DataFlow
title: C2C Message Send
description: C2C 单聊消息发送完整链路：客户端 → IM Gateway → 消息服务 → 存储 → 推送
tags: [c2c, message, flow]
timestamp: 2026-07-19T00:00:00+08:00
---

C2C 单聊消息发送是 IM 系统最核心的业务链路，涉及消息的发送、存储、推送全流程。

## 完整链路

```
Client(A) → IM Gateway → Message Service → MySQL(存储) → IM Gateway → Client(B)
                                                          ↓
                                                     Push Service
```

## 各环节职责

| 环节编号 | 服务 | 关键操作 |
|----------|------|----------|
| 1 | IM Gateway | 接收客户端 WebSocket 消息，验证连接有效性 |
| 2 | Message Service | 校验消息内容，生成 messageId，写入 MySQL |
| 3 | IM Gateway | 查询目标用户连接状态，推送消息或存储为离线消息 |

## 投递语义

- 采用 At-Least-Once 投递语义
- 客户端通过 messageId 去重
- 发送失败时自动重试 3 次

## 实现断言

| 断言内容 | 验证状态 | 代码证据位置 |
|----------|----------|--------------|
| 消息写入 MySQL 后返回 messageId | 已验证 | message-service/handler.go:42 |
| 离线消息在用户重连后批量推送 | 已验证 | im-gateway/reconnect.go:78 |

## 相关文档

- [IM Gateway](../services/im-gateway/overview.md) — 消息接入网关服务
- [User](../domain/entities/user.md) — 消息发送和接收方实体
- [Message](../domain/entities/message.md) — 消息实体定义
- [MySQL](../infrastructure/mysql.md) — 消息持久化存储

## 引用

[1] [IM 消息链路设计](https://example.com/message-flow)
