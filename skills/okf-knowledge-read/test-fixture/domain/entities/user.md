---
type: BusinessEntity
title: User
description: 用户实体，系统核心领域对象，代表一个注册用户
tags: [user, domain, entity]
timestamp: 2026-07-19T00:00:00+08:00
---

User 是 IM 系统中代表注册用户的核心实体。

## 核心规则

- 每个 User 有唯一 userId，由系统自动生成
- 用户状态包括 ACTIVE、INACTIVE、BANNED
- 用户名全局唯一，创建后不可修改

## 关键属性

| 属性 | 类型 | 说明 |
|------|------|------|
| userId | string | 用户唯一标识 |
| username | string | 用户名，全局唯一 |
| phone | string | 绑定手机号 |
| email | string | 绑定邮箱 |
| status | enum | 用户状态：ACTIVE/INACTIVE/BANNED |
| createdAt | timestamp | 创建时间 |

## 相关概念

- User 通过 [Message](message.md) 进行 C2C 通信
- User 通过 [IM Gateway](../../services/im-gateway/overview.md) 建立长连接

## Proto/接口定义

```protobuf
// user.proto
message User {
  string user_id = 1;
  string username = 2;
  string phone = 3;
  string email = 4;
  UserStatus status = 5;
  int64 created_at = 6;
}
```

## 引用

[1] [IM 系统架构设计](https://example.com/architecture)
