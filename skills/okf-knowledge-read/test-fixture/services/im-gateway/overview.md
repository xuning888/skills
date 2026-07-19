---
type: Service
title: IM Gateway
description: 即时通讯网关服务，负责客户端长连接管理、消息路由和协议转换
resource: https://github.com/example/im-gateway
tags: [gateway, service, im]
timestamp: 2026-07-19T00:00:00+08:00
---

IM Gateway 是 IM 系统的接入层网关服务，负责管理客户端长连接和消息路由。

## 端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 8080 | HTTP | REST API 管理接口 |
| 9000 | WebSocket | 客户端长连接 |
| 9001 | gRPC | 内部服务间通信 |

## 核心职责

### 连接管理

维护客户端 WebSocket 长连接，处理连接建立、心跳保活、断线重连。

### 消息路由

将客户端发来的消息路由到下游消息处理服务，并推送消息到目标客户端。

### 协议转换

将 WebSocket 协议转换为内部 gRPC 协议。

## 关键架构决策

- [ADR-001](../../decisions/adr-001-connection-model.md) — 选择 WebSocket 作为长连接方案

## gRPC/API 接口

```protobuf
// gateway.proto
service IMessageway {
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
  rpc BatchPush(BatchPushRequest) returns (BatchPushResponse);
}
```

## 依赖

- [MySQL](../../infrastructure/mysql.md) — 存储连接状态和离线消息
- [User](../../domain/entities/user.md) — 用户身份验证

## 引用

[1] [IM Gateway 设计文档](https://example.com/gateway)
