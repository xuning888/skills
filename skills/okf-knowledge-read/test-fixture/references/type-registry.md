---
type: Reference
title: Type Registry
description: 本项目使用的所有 OKF 文档 type 及其含义
resource: skills/okf-knowledge-gen/templates/
tags: [meta, reference]
timestamp: 2026-07-19T00:00:00+08:00
---

此文件定义 OKF 知识库中所有文档类型的分类标准。

## Type 定义

| type | 含义 | 适用场景 | frontmatter 特有字段 |
|------|------|---------|-------------------|
| BusinessEntity | 业务实体 | 领域模型中的核心对象 | — |
| BusinessConcept | 业务概念 | 跨实体的通用概念 | — |
| Service | 微服务 | 项目的每个服务模块 | resource |
| DataFlow | 数据/消息流 | 跨服务的交互链路 | — |
| Infrastructure | 基础设施 | 依赖的中间件 | — |
| ArchitectureDecision | 架构决策记录 | 重要技术决策 | — |
| Reference | 外部引用 | 客户端、部署、指南、元文档 | resource |

## 使用说明

- 所有文档必须在其 frontmatter 中声明 `type` 字段
- `title` 字段必须简洁且唯一
- `description` 字段用于索引和目录预览
