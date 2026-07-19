---
type: Infrastructure
title: MySQL
description: 主数据库，存储用户、消息、会话等核心业务数据
tags: [mysql, database, infrastructure]
timestamp: 2026-07-19T00:00:00+08:00
---

MySQL 在 IM 系统中承担核心数据存储职责。

## 用途

### 用户数据存储

- **Key**: user:{userId}
- **Value**: 用户基本信息（username, phone, email, status）
- **Ops**: CRUD，支持按 userId、username 查询

### 消息存储

- **Key**: message:{messageId}
- **Value**: 消息内容、类型、状态、发送时间
- **Ops**: 写入、查询历史消息、更新消息状态

## 数据流

```
Message Service → INSERT message → MySQL
Query Service → SELECT * FROM message WHERE ... → MySQL
```

## 部署

```yaml
# docker-compose.yml
mysql:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    MYSQL_DATABASE: im_db
  ports:
    - "3306:3306"
  volumes:
    - mysql_data:/var/lib/mysql
```

## 引用

[1] [MySQL 8.0 文档](https://dev.mysql.com/doc/)
