---
name: okf-knowledge-read
description: 从 OKF 知识库中检索并注入上下文。基于核心 5 步 Pipeline：发现知识库 → 匹配概念 → 加载文档 → 追踪链接 → 注入上下文，帮助 Agent 理解项目架构和领域知识。触发场景：- 新项目需要了解架构、- 追踪某个业务流程的完整链路、- 查找特定领域概念的定义和关联、- 代码分析时需要领域模型和架构决策作为参考
---

# OKF 知识库读取 Skill

从 OKF (Open Knowledge Format) 知识库中根据用户问题检索相关文档，提取领域概念、追踪文档链接，最终将结构化上下文注入当前会话。

## 什么时候用

- **新项目需要了解架构**：首次接触项目时，通过知识库快速获取领域模型、服务划分、核心流程等高层次架构信息
- **追踪某个业务流程的完整链路**：需要理解某个业务场景的端到端数据流（如"用户下单到支付完成的完整链路"），自动追踪跨文档引用
- **查找特定领域概念的定义和关联**：需要了解某个实体、服务或概念的准确定义及其在系统中的关联关系
- **代码分析时需要领域知识作为参考**：在阅读或修改代码时，需要对照领域模型理解业务意图

## 前置准备

### 1. 确保知识库目录有效

目标路径必须是一个有效的 OKF 知识库目录，至少包含 `index.md` 文件。

```
<knowledge-catalog>/
├── index.md                  # 根索引（必需，六分组结构）
├── references/
│   └── type-registry.md      # Type 定义注册表
├── domain/
│   ├── entities/             # BusinessEntity 文档
│   └── concepts/             # BusinessConcept 文档
├── services/                 # Service 概述文档
├── flows/                    # DataFlow 文档
├── infrastructure/           # Infrastructure 文档
└── decisions/                # ArchitectureDecision 文档
```

### 2. 确保知识库为最新

建议在使用前确认知识库已与最新代码对齐：

```bash
/okf-knowledge-gen:incremental repo=/path/to/project
```

## 运行

### 输入参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `kb` | 知识库目录路径（绝对路径） | 无（必填） | `kb=/path/to/knowledge-catalog` |

### 路径验证（两级检查）

在执行任何检索操作之前，必须通过以下两级验证，任一步失败立即终止并报错：

**第一级：目录存在性**
```bash
ls <kb>
```
若目录不存在 → 立即终止，报错：`"<kb> 不是有效的 OKF 知识库目录：目录不存在"`

**第二级：index.md 存在且非空**
```
Read <kb>/index.md
```
若文件不存在或内容为空 → 立即终止，报错：`"<kb> 不是有效的 OKF 知识库目录：缺少 index.md"`

### 使用方式

```
/okf-knowledge-read kb=/path/to/knowledge-catalog
```

用户问题由会话上下文隐式提供（当前对话中的用户问题即为检索目标）。

## 核心流程

执行以下 5 个步骤，从知识库中检索并注入上下文。每步均明确工具名称、参数模式、决策阈值和失败回退策略。

### 处理范围声明

以下目录/文件纳入处理范围，其余文件（如 `plan.json`、`log.md`、`.work/` 等生成阶段内部文件）不纳入处理，避免读取无关文件浪费 token：

**纳入处理**：
- `<kb>/index.md` — 根索引
- `<kb>/references/type-registry.md` — Type 定义注册表
- `<kb>/domain/entities/` — BusinessEntity 文档目录
- `<kb>/domain/concepts/` — BusinessConcept 文档目录
- `<kb>/services/` — Service 概述文档目录
- `<kb>/flows/` — DataFlow 文档目录
- `<kb>/infrastructure/` — Infrastructure 文档目录
- `<kb>/decisions/` — ArchitectureDecision 文档目录
- `<kb>/references/` — Reference 文档目录（type-registry.md 除外）

**不纳入处理**：
- `plan.json`、`log.md`、`.work/`、`*.tmp`、`*.draft` 等生成阶段内部文件
- `.git/`、`node_modules/` 等版本控制和依赖目录

---

### Step 1：发现知识库（Discover）

**目标**：加载知识库索引和 Type 注册表，建立知识库全局视图。

**工具与参数**：
| 步骤 | 工具 | 参数 | 说明 |
|------|------|------|------|
| 1a | `ls` | `ls <kb>` | 确认目录存在（已在路径验证中完成） |
| 1b | `Read` | `Read <kb>/index.md` | 读取根索引，获取六分组结构和所有条目列表 |
| 1c | `Read` | `Read <kb>/references/type-registry.md` | 读取 Type 定义注册表 |

**index.md 格式参考**：`skills/okf-knowledge-gen/templates/index.md` 的六分组结构：
1. `# 业务领域` — 包含 `domain/entities/` 和 `domain/concepts/` 的条目
2. `# 服务` — `services/` 下所有 Service
3. `# 消息 / 数据流` — `flows/` 下所有 DataFlow
4. `# 基础设施` — `infrastructure/` 下所有 Infrastructure 组件
5. `# 架构决策` — `decisions/` 下所有 ArchitectureDecision
6. `# 引用` — `references/` 下所有 Reference 文档

**决策阈值**：
- index.md 中至少存在 1 个分组章节 → 知识库有效，继续
- index.md 中无任何分组章节 → 输出警告"index.md 无有效分组，知识库可能为空"，仍继续执行（后续步骤自然无匹配结果）

**失败回退**：
- `Read <kb>/references/type-registry.md` 失败（文件不存在）→ 不中断流程，回退到内置 Type 定义（见 `## 内置 Type 定义`），在最终输出末尾标注 `"未找到 type-registry.md，已使用内置 Type 定义"`

---

### Step 2：匹配概念（Match）

**目标**：从用户问题中提取关键词，在知识库中匹配相关文档。

**工具与参数**：

| 步骤 | 工具 | 参数 | 说明 |
|------|------|------|------|
| 2a | 关键词提取 | 从用户问题中提取实体名、服务名、流程名、概念名 | 提取所有可能的关键词 |
| 2b | `Bash` | `grep -i "<关键词>" <kb>/index.md` | 在 index.md 中搜索每个关键词 |
| 2c | 语义精筛 | 对 2b 的候选结果进行语义相关性判断 | 排除仅字面匹配但语义不相关的条目 |

**决策阈值**：
- 关键词匹配数 ≥ 1 → 该条目列为候选
- 关键词匹配数 = 0 → 对所有关键词均无匹配时，触发回退

**失败回退（grep 无结果时）**：
1. 回退到 `ls` 遍历所有纳入处理的目录，列出全部可用文档路径
2. 将全部文档路径作为候选，进入 Step 3 逐文档读取摘要判断相关性
3. 若仍无法匹配（所有文档摘要均不相关），返回知识库概述（列出 index.md 中所有分组和条目名称），并向用户请求更具体的问题

**匹配优先级**：
- 精确匹配（关键词与 index.md 条目名称完全一致）> 部分匹配（条目名称包含关键词）> 模糊匹配（条目描述包含关键词）

---

### Step 3：加载文档（Load）

**目标**：读取匹配到的文档内容，采用"摘要优先 → 全文"策略，避免一次性加载过多无关内容。

**工具与参数**：

| 步骤 | 工具 | 参数 | 说明 |
|------|------|------|------|
| 3a | `Read` | `Read <kb>/<文档路径>` | 先读取文档 frontmatter + 核心章节（摘要阶段） |
| 3b | 相关性判断 | 人工/Agent 判断 | 基于摘要判断文档是否与用户问题相关 |
| 3c | `Read` | `Read <kb>/<文档路径>` | 确认相关后，读取完整文档（全文阶段） |

**摘要阶段优先提取内容**（按优先级）：
1. **frontmatter**（`---...---`）：`type`、`title`、`description` 字段
2. **核心章节**（根据 type 不同）：
   - `BusinessEntity` → `## 关键属性` + `## 核心规则`
   - `BusinessConcept` → `## 核心规则`
   - `Service` → `## 核心职责和依赖`、`## 端口`
   - `DataFlow` → `## 完整链路` 和 `## 各环节职责` 表
   - `Infrastructure` → `## 配置`、`## 依赖`
   - `ArchitectureDecision` → `## 决策`、`## 理由`
   - `Reference` → `## 摘要`

**文档章节结构参考**：`skills/okf-knowledge-gen/templates/` 下各类型模板文件。

**决策阈值**：
- 摘要内容与用户问题关键词匹配 ≥ 1 → 确认相关，加载全文
- 摘要内容与用户问题关键词匹配 = 0 → 判定不相关，跳过该文档

**失败回退**：
- `Read` 目标文档失败（文件不存在/权限错误）→ 尝试相对路径变体（如去掉前缀 `<kb>/`、尝试 `./` 前缀），仍失败则跳过该文档，记录警告 `"无法读取文档: <文档路径>"`

---

### Step 4：追踪链接（Trace）

**目标**：追踪已加载文档中的交叉引用链接，构建完整的上下文图。

**工具与参数**：

| 步骤 | 工具 | 参数 | 说明 |
|------|------|------|------|
| 4a | 文本提取 | 从已加载文档中提取 Markdown 链接 | 匹配 `[text](path.md)` 和 `[text](<相对路径>)` 格式 |
| 4b | `Read` | `Read <kb>/<链接目标路径>` | 尝试读取每个链接目标文档 |
| 4c | 结果合并 | 将链接目标内容合并到上下文中 | 仅合并 frontmatter + 首段描述（避免上下文膨胀） |

**决策阈值**：
- **一跳链接**：仅追踪一层（从直接匹配的文档出发，追踪其直接引用的文档），不递归追踪更深层次的链接
- 单个文档链接数 > 10 → 仅追踪 type 为 `BusinessEntity`、`Service`、`DataFlow` 的链接（高价值链接优先）

**失败回退（断链处理）**：
- 链接指向不存在的文档 → 跳过该链接，不阻塞流程
- 收集所有断链，在最终输出中标注 `"以下链接已失效:"` 列表
- 链接目标超出知识库目录范围 → 跳过该链接，标注为外部引用

---

### Step 5：注入上下文（Inject）

**目标**：将收集到的所有文档内容按 Type 分组，结构化注入到当前会话上下文。

**工具与参数**：

| 步骤 | 工具 | 参数 | 说明 |
|------|------|------|------|
| 5a | 分组 | 按文档 `type` 字段分组 | Entity / Concept / Service / DataFlow / Infrastructure / Decision / Reference |
| 5b | 格式化 | 按输出格式模板组织 | 见下方输出格式 |
| 5c | 注入 | 直接输出到会话 | Agent 将结果作为上下文理解并回答用户问题 |

**分组顺序**（固定）：
1. `### BusinessEntity:` — 业务实体
2. `### BusinessConcept:` — 业务概念
3. `### Service:` — 服务
4. `### DataFlow:` — 数据/消息流
5. `### Infrastructure:` — 基础设施
6. `### ArchitectureDecision:` — 架构决策
7. `### Reference:` — 引用

**决策阈值**：
- 某 type 下无匹配文档 → 跳过该分组（不输出空分组标题）

**注入内容包含**：
- 每个文档的 `title`、`description`（来自 frontmatter）
- type 标签和来源路径（`来源：<文档路径>`）
- 全文核心章节内容（来自 Step 3 加载）
- 一跳链接追踪结果（来自 Step 4）

---

## 内置 Type 定义

当知识库中缺少 `references/type-registry.md` 时，使用以下内置 Type 定义作为兜底。完整定义请参见 `skills/okf-knowledge-gen/templates/type-registry.md`（权威来源）。

**合并策略**：若知识库的 `type-registry.md` 定义了额外的自定义 Type，agent 应将该自定义 Type 与内置 Type **合并使用**——不会因未知 Type 而报错或跳过文档。自定义 Type 的文档可归入 `### Other:` 分组或按其 type 值单独分组。内置 Type 始终作为基础兜底，知识库自定义 Type 在此基础上扩展。

| type | 含义 | 适用场景 | frontmatter 特有字段 |
|------|------|---------|-------------------|
| BusinessEntity | 业务实体 — 有名词、有状态、有唯一标识 | 领域模型中的核心对象（识别特征：在 index.md 的 `# 业务领域` 分组下，文档路径通常为 `domain/entities/xxx.md`，重点关注 `## 关键属性` 和 `## 核心规则` 章节） | — |
| BusinessConcept | 业务概念 — 抽象规则、机制、策略 | 跨实体的通用概念（识别特征：在 index.md 的 `# 业务领域` 分组下，文档路径通常为 `domain/concepts/xxx.md`，区别于 BusinessEntity：无唯一标识、无生命周期，重点关注 `## 核心规则` 章节） | — |
| Service | 微服务 — 独立部署的运行单元 | 项目的每个服务模块（识别特征：在 index.md 的 `# 服务` 分组下，文档路径通常为 `services/xxx.md`，重点关注 `## 核心职责和依赖` 和 `## 端口` 章节） | resource（代码仓库 URL） |
| DataFlow | 数据 / 消息流 — 跨服务的交互链路 | 消息流程、请求链路（识别特征：在 index.md 的 `# 消息 / 数据流` 分组下，文档路径通常为 `flows/xxx.md`，重点关注 `## 完整链路` 和 `## 各环节职责` 表，是链接追踪的重点目标） | — |
| Infrastructure | 基础设施 — 中间件、数据库、配置中心 | 依赖的中间件（识别特征：在 index.md 的 `# 基础设施` 分组下，文档路径通常为 `infrastructure/xxx.md`，重点关注 `## 配置` 和 `## 依赖` 章节） | — |
| ArchitectureDecision | 架构决策记录 | 重要技术决策（识别特征：在 index.md 的 `# 架构决策` 分组下，文档路径通常为 `decisions/xxx.md`，重点关注 `## 决策` 和 `## 理由` 章节） | — |
| Reference | 外部引用 | 客户端、部署、指南、元文档（识别特征：在 index.md 的 `# 引用` 分组下，文档路径通常为 `references/xxx.md`，重点关注 `## 摘要` 章节。**注意**：`type-registry.md` 本身也是 Reference 类型，但在 Step 1 中单独加载，不重复处理） | resource（外部 URL） |

### 回退触发条件

内置 Type 定义在以下场景激活：

1. **type-registry.md 缺失**：`Read <kb>/references/type-registry.md` 失败 → 使用本表全部 7 种 Type，在最终输出末尾标注 `"未找到 type-registry.md，已使用内置 Type 定义"`
2. **type-registry.md 含自定义 Type**：知识库定义了额外的 Type（如 `CustomComponent`）→ 合并内置 Type + 自定义 Type，自定义 Type 的文档正常加载和分组，不报错、不跳过

## 使用示例

> **注意**：以下示例假设存在 `example-kb` 知识库（位于 `/path/to/example-kb`），实际使用时替换为你的知识库路径。

### 场景一：理解项目整体架构

**用户输入**：
```
我刚接手这个项目，帮我理解一下整体架构：有哪些服务、核心业务实体是什么、用了哪些基础设施
```

**Agent 执行过程**：

**Step 1 — 发现知识库**：
```
Read /path/to/example-kb/index.md
Read /path/to/example-kb/references/type-registry.md
```
→ 获取六分组结构：业务领域（15 个实体/概念）、服务（8 个）、数据流（6 个）、基础设施（4 个）、架构决策（3 个）、引用（2 个）

**Step 2 — 匹配概念**：
```
grep -i "服务\|service" /path/to/example-kb/index.md
grep -i "实体\|entity\|基础设施\|infrastructure\|架构" /path/to/example-kb/index.md
```
→ 匹配到 8 个 Service 条目、15 个实体/概念条目、4 个 Infrastructure 条目

**Step 3 — 加载文档**（摘要优先）：
```
Read /path/to/example-kb/services/user-service.md      → Service, 用户服务
Read /path/to/example-kb/services/order-service.md     → Service, 订单服务
Read /path/to/example-kb/domain/entities/user.md       → BusinessEntity, User
Read /path/to/example-kb/infrastructure/mysql.md       → Infrastructure, MySQL
Read /path/to/example-kb/infrastructure/redis.md       → Infrastructure, Redis
Read /path/to/example-kb/infrastructure/kafka.md       → Infrastructure, Kafka
```

**Step 4 — 追踪链接**：从 user-service.md 发现引用 `[order-service.md]` 和 `[user.md]` → 读取链接目标文档

**Step 5 — 注入上下文**（按 Type 分组）：

```
### BusinessEntity:
- **User**（来源：domain/entities/user.md:## 关键属性）
  用户实体，核心标识为 userId，关联属性：phone、email、status
  ...

### Service:
- **user-service**（来源：services/user-service.md:## 核心职责和依赖）
  用户服务，负责用户注册/登录/信息管理，依赖 MySQL、Redis
  ...

### Infrastructure:
- **MySQL**（来源：infrastructure/mysql.md:## 配置）
  主数据库，存储用户、订单等核心数据
  ...
```

Agent 据此回答用户："项目包含 8 个微服务，核心业务实体是 User 和 Order，基础设施使用 MySQL + Redis + Kafka，架构决策见 decisions/ 目录..."

---

### 场景二：追踪某个业务流程

**用户输入**：
```
帮我追踪"用户下单"这个业务流程的完整链路，从 API 入口到消息队列消费
```

**Agent 执行过程**：

**Step 1 — 发现知识库**：同场景一，加载 index.md 和 type-registry.md

**Step 2 — 匹配概念**：
```
grep -i "下单\|order\|create.*order\|订单" /path/to/example-kb/index.md
```
→ 匹配到 `flows/order-creation-flow.md`（DataFlow）、`services/order-service.md`（Service）、`domain/entities/order.md`（BusinessEntity）

**Step 3 — 加载文档**（按优先级加载 DataFlow，因其包含完整链路）：
```
Read /path/to/example-kb/flows/order-creation-flow.md
```
→ 发现链路：`API Gateway → order-service → inventory-service → payment-service → Kafka(order_created) → notification-service`

**Step 4 — 追踪链接**：从 order-creation-flow.md 中追踪引用的 `order-service.md`、`inventory-service.md`、`payment-service.md`、`notification-service.md` → 读取各服务文档的 `## 端口` 和 `## 核心职责和依赖`

**Step 5 — 注入上下文**（按 Type 分组）：

```
### DataFlow:
- **order-creation-flow**（来源：flows/order-creation-flow.md:## 完整链路）
  链路：API Gateway → order-service（创建订单）→ inventory-service（扣减库存）→ payment-service（处理支付）→ Kafka → notification-service（发送通知）
  ...

### Service:
- **order-service**（来源：services/order-service.md:## 端口）
  端口：gRPC CreateOrder，依赖 inventory-service、payment-service、MySQL
  - **inventory-service**（来源：services/inventory-service.md:## 核心职责和依赖）
  职责：库存扣减和归还，依赖 MySQL
  ...

### BusinessEntity:
- **Order**（来源：domain/entities/order.md:## 关键属性）
  订单实体，包含 orderId、userId、items、status（PENDING → PAID → SHIPPED → COMPLETED）
  ...
```

Agent 据此回答用户："下单流程涉及 5 个服务：API Gateway 接收请求 → order-service 创建订单 → inventory-service 扣减库存 → payment-service 处理支付 → 发送 Kafka 消息 → notification-service 推送通知。订单状态流转为 PENDING → PAID → SHIPPED → COMPLETED..."

---

### 场景三：查找特定领域概念的定义和关联

**用户输入**：
```
什么是"用户等级"？它在系统中是怎么计算的？
```

**Agent 执行过程**：

**Step 2 — 匹配概念**：
```
grep -i "用户等级\|user.*level\|会员\|vip\|level" /path/to/example-kb/index.md
```
→ 匹配到 `domain/concepts/user-level-system.md`（BusinessConcept）

**Step 3 — 加载文档**：
```
Read /path/to/example-kb/domain/concepts/user-level-system.md
```
→ 前线：type=BusinessConcept，描述"用户等级是根据消费金额和活跃度计算的用户分层机制"

**Step 4 — 追踪链接**：从 user-level-system.md 中追踪引用的 `user.md`（BusinessEntity）、`order-service.md`（Service）、`decisions/level-calculation-strategy.md`（ArchitectureDecision）

**Step 5 — 注入上下文**：

```
### BusinessConcept:
- **user-level-system**（来源：domain/concepts/user-level-system.md:## 核心规则）
  用户等级计算规则：基于近 90 天消费金额和登录天数加权计算...
  ...
```

## 常见问题

### 知识库不完整怎么办？

知识库可能缺少某些模块的文档（尤其是新模块或增量更新遗漏的模块）。处理策略：

1. **先确认可用范围**：查看 `<kb>/index.md` 的六分组内容，了解知识库覆盖了哪些模块
2. **依赖代码作为补充**：对于知识库未覆盖的模块，回退到直接阅读源代码，以代码实现为准
3. **标注信息可信度**：基于知识库得出的结论标注 `（来源：知识库）`，基于代码推断的结论标注 `（来源：代码推断，未经知识库确认）`
4. **建议补充生成**：提示用户运行 `/okf-knowledge-gen:incremental` 更新知识库，或在 `project-profile.md` 中补充遗漏模块的描述

### 链接失效怎么办？

知识库文档之间的交叉引用链接可能因文档移动、重命名或删除而失效。处理策略：

1. **收集断链**：在 Step 4 追踪链接时，收集所有无法读取的链接目标
2. **标注在输出末尾**：在最终输出的末尾列出所有断链，格式为 `"以下链接已失效:\n- <来源文档> → <断链目标>"`
3. **不中断流程**：断链不阻塞正常流程——继续处理其他有效链接和文档
4. **推测替代路径**：根据断链目标文件名，在知识库中搜索同名或相似名称的文档，如找到则标注 `（推测替代）`

### 如何与 okf-knowledge-gen 配合使用？

`okf-knowledge-gen` 负责**生成和维护**知识库，`okf-knowledge-read` 负责**检索和注入**知识库内容。推荐工作流：

1. **首次使用**：在目标项目上运行 `/okf-knowledge-gen:full` 生成完整知识库
2. **日常使用**：在需要理解代码时使用 `/okf-knowledge-read kb=<知识库路径>` 检索上下文
3. **代码变更后**：运行 `/okf-knowledge-gen:incremental --since HEAD~5` 增量更新知识库
4. **定期校准**：建议每周或每次大版本发布前运行一次增量更新，保持知识库与代码同步

两个 Skill 共享同一套 Type 定义（见 `skills/okf-knowledge-gen/templates/type-registry.md`），确保生成和读取阶段的文档分类一致。

### 增量更新导致文档版本不一致怎么办？

当增量更新只覆盖了部分文档时，可能出现 index.md 索引指向新版本而某些被引用文档仍是旧版本的情况。

处理策略（按优先级）：

1. **优先信任 index.md 最新索引**：index.md 由 Verify 阶段最后生成，包含所有文档的最新路径和标题。若 index.md 中列出的文档路径与实际文件不匹配，以 index.md 为准
2. **检查文档生成时间戳**：每个 OKF 文档的 frontmatter 中包含 `timestamp` 字段（ISO 8601 格式）。对比引用文档和被引用文档的时间戳——若被引用文档的时间戳明显早于引用文档，说明可能未同步更新
3. **标注版本差异**：当发现时间戳不一致时，在注入输出中标注 `⚠️ 版本不一致：<文档A>（生成时间: xxx）引用了 <文档B>（生成时间: yyy），后者可能已过时`
4. **建议全量重新生成**：若版本不一致的文档数量 ≥3 个，建议用户运行 `/okf-knowledge-gen:full` 全量重新生成知识库

## 输出格式

所有 Step 5 注入的上下文必须遵循以下结构化格式，确保不同 Agent 执行时输出一致。

**模板**：

    ## OKF 知识库上下文（来源：<!-- 知识库路径 -->）

    > 检索时间：<!-- ISO 8601 时间戳 -->
    > 检索关键词：<!-- 用户问题中提取的关键词列表 -->
    > Type 来源：<!-- "type-registry.md" 或 "内置 Type 定义（兜底）" -->

    <!-- 以下按 type 分组，某 type 下无匹配文档时跳过该分组 -->

    ### BusinessEntity:
    <!-- 如无匹配文档，跳过此分组 -->

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description（来自 frontmatter） -->
      - 关键属性：<!-- 关键属性列表 -->
      - 核心规则：<!-- 核心规则摘要 -->
      - 关联文档：<!-- 如有链接追踪结果，列出关联文档名 -->

    ### BusinessConcept:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 核心规则：<!-- 核心规则摘要 -->
      - 适用实体：<!-- 如有链接追踪结果 -->

    ### Service:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 核心职责：<!-- 核心职责列表 -->
      - 端口：<!-- 对外暴露的 API/端口 -->
      - 依赖：<!-- 依赖的其他 Service/Infrastructure -->
      - 关联文档：<!-- 如有链接追踪结果 -->

    ### DataFlow:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 完整链路：<!-- 链路各环节列表 -->
      - 各环节职责：<!-- 各环节职责描述 -->
      - 关联服务：<!-- 如有链接追踪结果 -->

    ### Infrastructure:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 用途：<!-- 在该项目中的用途 -->
      - 配置要点：<!-- 关键配置项 -->
      - 依赖方：<!-- 如有链接追踪结果 -->

    ### ArchitectureDecision:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 决策：<!-- 决策内容摘要 -->
      - 理由：<!-- 决策理由 -->
      - 影响范围：<!-- 如有链接追踪结果 -->

    ### Reference:

    - **<!-- 文档 title -->**（来源：<!-- 文档路径 -->:<!-- 章节名 -->）
      <!-- description -->
      - 资源链接：<!-- 外部 URL（如有） -->
      - 关联文档：<!-- 如有链接追踪结果 -->

    <!-- 如有断链，在此列出 -->
    <!-- ⚠️ 以下链接已失效: -->
    <!-- - <来源文档路径> → <断链目标路径> -->

    <!-- 如使用了内置 Type 定义兜底，在此标注 -->
    <!-- ℹ️ 未找到 type-registry.md，已使用内置 Type 定义 -->

**格式规则**：

| 规则 | 说明 |
|------|------|
| 分组顺序 | 固定为 BusinessEntity → BusinessConcept → Service → DataFlow → Infrastructure → ArchitectureDecision → Reference |
| 空分组跳过 | 某 Type 下无匹配文档时，不输出该分组的标题（避免无意义的空标题） |
| 来源标注 | 每条文档条目必须标注 `（来源：<文档路径>:<章节名>）`，文档路径相对于知识库根目录 |
| 占位符 | 动态内容使用 `<!-- ... -->` HTML 注释标记，确保模板可复制使用 |
| 断链收集 | 所有 Step 4 中发现的断链统一在输出末尾列出，不分散在各条目中 |
| 兜底声明 | 如使用了内置 Type 定义（非 type-registry.md），在输出末尾标注 |
| 摘要优先 | 每个条目先输出 `description`（一行概括），再列出结构化字段，便于快速扫描 |
