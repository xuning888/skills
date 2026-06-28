---
type: Reference
title: Type Registry
description: 本项目 Bundle 使用的所有自定义 type 及其含义
resource: <!-- 项目文档根目录 -->
tags: [meta, reference]
timestamp: <!-- ISO 8601 -->
---

<!-- 此文件由 Phase 2 Plan Agent 自动生成，人可后续编辑。-->

## Type 定义

| type | 含义 | 适用场景 | frontmatter 特有字段 |
|------|------|---------|-------------------|
| BusinessEntity | 业务实体 — 有名词、有状态、有唯一标识 | 领域模型中的核心对象 | — |
| BusinessConcept | 业务概念 — 抽象规则、机制、策略 | 跨实体的通用概念 | — |
| Service | 微服务 — 独立部署的运行单元 | 项目的每个服务模块 | resource（代码仓库 URL） |
| DataFlow | 数据 / 消息流 — 跨服务的交互链路 | 消息流程、请求链路 | — |
| Infrastructure | 基础设施 — 中间件、数据库、配置中心 | 依赖的中间件 | — |
| ArchitectureDecision | 架构决策记录 | 重要技术决策 | — |
| Reference | 外部引用 | 客户端、部署、指南、元文档 | resource（外部 URL） |

## 使用说明

- 所有文档必须在其 frontmatter 中声明 `type` 字段，取值取自上表
- `title` 字段必须简洁且唯一
- `description` 字段用于索引和目录预览
- 各 type 对应的模板文件参见 `templates/` 目录
