---
type: BusinessEntity
title: Message
description: 消息实体，C2C 单聊消息的核心载体
tags: [message, domain, entity]
timestamp: 2026-07-19T00:00:00+08:00
---

Message 是 IM 系统中单聊消息的核心实体。

## 核心规则

- 每条 Message 有唯一 messageId
- 消息状态包括 SENDING、SENT、DELIVERED、READ
- 消息内容支持 text、image、video、file 四种类型
- 消息发送后不可修改，仅可撤回

## 关键属性

| 属性 | 类型 | 说明 |
|------|------|------|
| messageId | string | 消息唯一标识 |
| fromUserId | string | 发送方 userId |
| toUserId | string | 接收方 userId |
| content | string | 消息内容 |
| type | enum | 消息类型：TEXT/IMAGE/VIDEO/FILE |
| status | enum | 消息状态：SENDING/SENT/DELIVERED/READ |
| sentAt | timestamp | 发送时间 |

## 相关概念

- Message 由 [User](user.md) 发送和接收
- Message 通过 [C2C Message Send](../../flows/c2c-message-send.md) 流程投递
- Message 持久化存储在 [MySQL](../../infrastructure/mysql.md) 中

## Proto/接口定义

```protobuf
// message.proto
message Message {
  string message_id = 1;
  string from_user_id = 2;
  string to_user_id = 3;
  string content = 4;
  MessageType type = 5;
  MessageStatus status = 6;
  int64 sent_at = 7;
}
```

## 引用

[1] [IM 消息系统设计](https://example.com/message-design)
