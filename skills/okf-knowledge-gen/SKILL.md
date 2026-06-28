---
name: okf-knowledge-gen
description: 从代码仓库自动生成 OKF 知识库。支持 20 万行级单仓库的全量生成和增量更新。基于多阶段 Workflow Pipeline：Discover → Plan → Generate → Verify。
---

# OKF 知识库生成 Skill

从代码仓库自动生成 OKF (Open Knowledge Format) 知识库。通过多阶段 Workflow Pipeline 扫描代码结构、提取领域概念、追踪业务流程、识别基础设施依赖，最终生成结构化的 Markdown 知识库。

## 什么时候用

- 新项目需要建立知识库
- 已有知识库需要对齐最新代码（增量更新）
- 代码重构后需要更新知识库中的实现细节

## 前置准备

### 1. 填写 project-profile.md

在目标代码仓库根目录创建 `project-profile.md`，提供 Agent 无法从代码推断的先验知识：

```markdown
# 项目概览

## 基本信息
- 项目名称：helloIm
- 项目简介（一句话）：即时通讯服务端
- 主要业务领域：IM / 消息推送
- 架构范式：微服务

## 核心概念
- User | 用户实体，IM 的核心身份标识 | 微信用户
- Message | 消息实体 | 微信消息
- Session | 会话实体 | 微信聊天列表

## 模块职责
- helloim-gateway | 长连接网关，管理 WS/TCP 连接 | 对外暴露 WebSocket
- helloim-dispatch | 消息路由分发 | 对内 gRPC
- helloim-message | 消息持久化和历史查询 | 对内 gRPC

## 关键业务流程（可选）
- C2C 消息发送 | gateway → dispatch → message → delivery → gateway | ...

## 术语表
- serverSeq | 服务端分配的消息序列号 | 严格递增
- clientSeq | 客户端消息序列号 | 用于去重
```

### 2. 确保 git 仓库干净

```bash
git status  # 确认没有未提交的变更
```

## 运行

### 全量生成

```
/okf-knowledge-gen:full
```

执行 4 个 Phase：
1. **Discover** — 4 个并行 agent 扫描代码仓库（模块结构、领域实体、业务流程、基础设施）
2. **Plan** — 合成概念清单 + Type 分配 + 链接预案
3. **Generate** — 按优先级分层 pipeline 生成 OKF 文档
4. **Verify** — 断链检测、一致性校验、实现断言复验、index 生成

**预计耗时**：20 万行仓库约 20-40 分钟。

### 增量更新

```
/okf-knowledge-gen:incremental --since HEAD~5
```

只重新生成自指定 commit 以来受影响的文档。基于 `git diff` 计算影响面。

**预计耗时**：通常 5-10 分钟（取决于变更量）。

## 生成后检查清单

- [ ] 查看 verification-report 中的 `corrected_assertions`（Phase 4 V3 纠正的错误断言）
- [ ] 查看 `uncertain_assertions`（无法确认的推断，需人工判断）
- [ ] 检查 cross_check_results（Phase 2 发现的盲区）
- [ ] 检查 profile_diff（project-profile.md 声明但代码未发现的概念）
- [ ] 运行 `git diff` 查看生成的文档变更

## 目录结构

生成的知识库结构：

```
<project>-knowledge-catalog/
├── index.md                  # 根索引
├── log.md                    # 变更日志
├── domain/
│   ├── entities/             # BusinessEntity 文档
│   └── concepts/             # BusinessConcept 文档
├── services/                 # Service 概述文档
├── flows/                    # DataFlow 文档
├── infrastructure/           # Infrastructure 文档
├── decisions/                # ArchitectureDecision 文档
└── references/               # Reference + type-registry
```

## 常见问题

### 准确率不够高？

1. 检查 Phase 4 V3 的 assertion 验证报告
2. 完善 project-profile.md 中的术语表和核心概念
3. 对 DataFlow 类型的文档特别关注——这类文档偏差风险最高
4. 手动审查标注为"推断"的断言

### 增量更新漏了某些变更？

增量影响面计算依赖 plan.json（全量生成时产出）。如果模块结构有重大变化（新增/删除模块），建议重新全量生成。

### 大型仓库优化

- 20 万行以上：考虑拆分为多个独立 Bundle（按模块/领域拆分）
- LSP 不可用：Skill 会自动回退到 grep 方法名追踪，准确率可能略降
- 多语言混合仓库：当前优先支持 Java/Go/Python，其他语言部分概念提取可能不够精准

## 模板文件

Skill 包含以下模板文件，可在 Skill 安装目录找到：

| 模板 | 路径 | 用途 |
|------|------|------|
| project-profile | templates/project-profile.md | 人填写的项目先验知识 |
| BusinessEntity | templates/business-entity.md | 实体文档章节约定 |
| BusinessConcept | templates/business-concept.md | 概念文档章节约定 |
| Service | templates/service-overview.md | 服务概述章节约定 |
| DataFlow | templates/data-flow.md | 流程文档章节约定 |
| Infrastructure | templates/infrastructure.md | 基础设施文档章节约定 |
| ArchitectureDecision | templates/architecture-decision.md | 架构决策章节约定 |
| Reference | templates/reference.md | 引用文档章节约定 |
| index.md | templates/index.md | 目录索引约定 |
| log.md | templates/log.md | 变更日志约定 |
| type-registry | templates/type-registry.md | Type 声明约定 |
