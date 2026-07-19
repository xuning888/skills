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

<!-- TASK2_FILL: 内置 Type 定义 -->

## 使用示例

<!-- TASK2_FILL: 使用示例 -->

## 常见问题

<!-- TASK2_FILL: 常见问题 -->

## 输出格式

<!-- TASK2_FILL: 输出格式 -->
