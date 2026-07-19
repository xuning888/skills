# OKF 知识库生成 — 全量生成管线重构设计

## 概述

重构 `okf-knowledge-gen` 的全量生成管线（`workflows/full-generate.js`），目标：
- 支持 50 万行级单仓库
- 消除当前 20% 的"推理填补"偏差（根因：Agent 跨文件调用链追踪不完整）
- 数据面/控制面分离，各自穷举、互相校验

## 设计决策

| 决策 | 结论 |
|------|------|
| A1 模块扫描 | 合并入 A2'，compile 级依赖对 DataFlow 无实质帮助 |
| A2 实体提取 | top-20 → 穷举，不做 Type 预判，输出纯事实记录 |
| A3_DEEP 流程追踪 | 从"依赖 A2 匹配"改为"独立枚举所有入口，追踪到 IO 边界" |
| A4 配置扫描 | 不变 |
| Plan 阶段 | 单 agent → 三 agent（Plan-Data + Plan-Control → Plan-Merge） |
| Generate 阶段 | 按优先级分组 → 按文件读取量分组，负载均衡 |
| crosslink | 不变 |
| Verify 阶段 | 不变（输入改善会自然提升质量） |
| 分治策略 | 暂不设计 |

---

## 重构后管线总览

```
Phase 1: Discover
├── 数据面: A2'（穷举概念，纯事实记录）+ A4（配置扫描）
└── 控制面: A3_SURFACE（枚举入口）→ A3_DEEP'（穷举流程，追踪到 IO 边界）

Phase 2: Plan
├── Plan-Data（数据面合成）+ Plan-Control（控制面合成）[并行]
└── Plan-Merge（交叉合并 + 优先级 + 链接预案）

Phase 3: Generate
├── 按文件读取量分组生成（负载均衡）
└── crosslink（不变）

Phase 4: Verify
└── V1/V2/V3/V4 不变
```

---

## Phase 1 Discover — 数据面

### A2' 穷举概念（合并原 A1 职责）

当前问题：
- top-20 按引用数截断，ORM 基类等技术设施挤占核心业务实体位置
- 过早做 type_hint 判定，混淆了 Discover 和 Plan 的职责边界
- 过滤规则是硬编码后缀黑名单，很多技术类不按此命名

重构方向：

| 维度 | 当前 | 重构后 |
|------|------|--------|
| 策略 | top-20 按引用数截断 | 穷举，按领域/模块分治 |
| 过滤 | 硬编码后缀黑名单 | 不做过滤，全量记录事实 |
| 输出 | entities + business_concepts 预分类 + summary | 纯事实：类名、FQN、位置、属性、注解、called_by、calls |
| 合并 | — | 合并原 A1 的 proto/sql migration 文件发现能力 |

输出文件：`discover-data-concepts.json`

```json
{
  "classes": [
    {
      "name": "C2CSendRequestSender",
      "fqn": "com.helloim.dispatch.sender.C2CSendRequestSender",
      "location": "helloim-dispatch/src/.../C2CSendRequestSender.java:15",
      "annotations": ["@Service"],
      "extends": "",
      "implements": [],
      "attributes": [{"name": "serverSeqGenerator", "type": "AtomicLong"}],
      "called_by": [{"method": "MessageHandler.handle", "location": "..."}],
      "calls": [{"method": "Redis.set", "location": "..."}]
    }
  ],
  "proto_messages": [
    {"name": "SendReq", "location": "...", "fields": [...]}
  ],
  "sql_tables": [
    {"name": "t_message", "location": "...", "columns": [...]}
  ]
}
```

关键原则：
- **不做 Type 判定** —— 不区分 entity/concept/flow，Plan 阶段统一做
- **不做 summary 摘要** —— 防止阶段间信息丢失，Plan agent 基于原始事实做判断
- **called_by/calls 只记录精确位置** —— 为 Plan 提供链接预案基础数据

---

## Phase 1 Discover — 控制面

### A3_DEEP' 穷举流程

当前问题：
- 依赖 A2 实体列表，按实体名匹配入口决定追踪深度
- A2 漏了实体 → A3_DEEP 匹配不到 → 降级或跳过 → DataFlow 文档编造
- 分级策略（5层/2层/跳过）是预设的，不是数据驱动的

重构方向：

| 维度 | 当前 | 重构后 |
|------|------|--------|
| 触发条件 | A2 实体列表驱动 | 独立于数据面，枚举所有入口 |
| 追踪策略 | 按实体名匹配，5层/2层/跳过 | 所有入口追踪到 IO 边界（DB/MQ/RPC/文件） |
| 输出 | trace 步骤列表 | 完整调用链 + 方法签名 + 入出参类型 + 分支条件 + IO 边界 |

输出文件：`discover-control-flows.json`

```json
{
  "flows": [
    {
      "id": "flow-001",
      "entry": "POST /api/message/send",
      "entry_location": "MessageController.java:42",
      "entry_method": "sendMessage(SendRequest): SendResponse",
      "trace": [
        {
          "step": 1,
          "location": "MessageServiceImpl.java:88",
          "method": "handleSend(SendRequest): void",
          "params": ["userId: Long", "content: String", "sessionType: int"],
          "return": "void",
          "calls": ["SessionService.getSession", "MsgStore.persist"],
          "branch_condition": "if (sessionType == C2C)"
        }
      ],
      "io_boundary": [
        {"type": "db_write", "target": "MySQL", "table": "t_message", "location": "MsgStore.java:156"},
        {"type": "mq_publish", "target": "Kafka", "topic": "MESSAGE_SEND", "location": "KafkaProducer.java:33"}
      ]
    }
  ]
}
```

关键原则：
- **枚举所有入口**，不按实体名匹配筛选
- **追踪到 IO 边界** —— 不必预设深度，自然终止于 DB/MQ/RPC/文件系统
- **记录 IO 边界** —— Plan-Merge 用来自动发现 Infrastructure 概念
- **独立于数据面运行** —— 可以和 A2' 并行，互不依赖

---

## Phase 2 Plan — 多 agent

### 架构

```
                  ┌─────────────┐
                  │ Plan-Data    │
                  │ 数据面合成    │
                  └──────┬──────┘
                         │ plan-data.json
                         ▼
┌─────────────┐   ┌─────────────┐
│ Plan-Control │   │ Plan-Merge   │
│ 控制面合成    │──▶│ 交叉合并      │──▶ plan.json
└─────────────┘   └─────────────┘
```

三 agent 分开跑，Plan-Data 和 Plan-Control 可并行，Plan-Merge 串行等待两者。

### Plan-Data（数据面合成）

输入：`discover-data-concepts.json` + `project-profile.md`

职责：
1. **逐类判定 Type**：基于属性组合、生命周期模式、注解特征、调用模式 → 分配 BusinessEntity / BusinessConcept / Service / Infrastructure
2. **概念去重**：同一业务实体在不同模块出现（DTO 层 vs Domain 层 vs Proto 层），按 FQN 前缀聚类归并
3. **属性提炼**：从多个 source 文件中提取该概念的完整属性集合
4. **profile 差异**：profile 声明但代码未发现 vs 代码发现但 profile 未声明

输出：`plan-data.json`

### Plan-Control（控制面合成）

输入：`discover-control-flows.json` + `project-profile.md`

职责：
1. **流程归一化**：同一业务路径的不同入口（HTTP vs gRPC vs MQ 消息消费）归一化为同一个 DataFlow
2. **流程→实体映射**：从 trace 中提取每个步骤操作的数据实体（不依赖 Plan-Data 的结果）
3. **IO 边界→Infrastructure**：从 IO 边界自动发现新 Infrastructure 概念（DB 表、MQ topic、外部 RPC 服务）

输出：`plan-control.json`

### Plan-Merge（交叉合并）

输入：`plan-data.json` + `plan-control.json`

职责：
1. **碰撞检测**：
   - Plan-Data 有但 Plan-Control 未涉及的实体 → 可能是死代码、纯配置数据、或控制面漏了
   - Plan-Control 操作了但 Plan-Data 没发现的实体 → 数据面漏网之鱼
2. **盲区标记** → `cross_check_results` 和 `profile_diff`
3. **优先级 P0-P3 排序**
4. **链接预案**：基于 called_by/calls 关系 + trace 构建概念间链接
5. **文件读取清单**：每个概念附着精确的文件:行号清单，Generate 阶段 agent 按清单读取

输出：`plan.json`（格式与现有一致，但每个 concept 增加 `file_manifest` 字段）

---

## Phase 3 Generate — 按负载分组

当前问题：
- 按优先级（P0/P1/P2）分组生成，但同一优先级内负载差异巨大
- P1B 一人处理 19 个概念（DataFlow 每个需 10+ 文件 + Infrastructure），上下文严重超载
- P0 只处理 ~16 个概念但很多是纯实体（文件读取量小），资源浪费

重构方向：Plan-Merge 已为每个概念附着 `file_manifest`（需读取的文件清单），可用于估算生成负载：

```
轻量（<5 个文件）：  BusinessEntity、BusinessConcept、Reference
中量（5-15 个文件）： Service、Infrastructure、ArchitectureDecision
重量（15+ 个文件）：  DataFlow
```

按负载度动态分配 agent：
- 轻量 agent × N：每个处理 8-10 个概念
- 中量 agent × N：每个处理 4-6 个概念
- 重量 agent × N：每个处理 1-3 个 DataFlow

每个 agent 收到的 prompt 包含：
- 待生成概念列表 + 精确文件:行号读取清单
- 对应模板路径
- 统一格式规则

Agent 不再需要猜该读什么文件——Plan 已经算好了。

### crosslink

保持不变。

---

## Phase 4 Verify — 不变

V1（断链）、V2（一致性）、V3（断言验证）、V4（index/log/type-registry）保持不变。

改善来自上游输入质量：Plan 产出的精确文件清单让 V3 断言验证更可靠。

---

## 关键变更对比

| 维度 | 当前 | 重构后 |
|------|------|--------|
| Discover agent 数量 | 4+1（A1/A2/A3_SURFACE/A3_DEEP/A4） | 4（A2'/A3_SURFACE/A3_DEEP'/A4），A1 合并入 A2' |
| A2 策略 | top-20 引用数截断 | 穷举，纯事实记录 |
| A3_DEEP 策略 | A2 实体驱动，预设深度分级 | 独立枚举，追踪到 IO 边界 |
| Discover → Plan 传递 | 摘要 JSON（信息丢失） | 事实 JSON（文件:行号级精确度） |
| Plan agent 数量 | 1 | 3（Data + Control 并行 → Merge） |
| Plan 依赖 | Plan 自己做 Type 分配 | Data/Control 各自做自己的 Type 分配，Merge 交叉验证 |
| Generate 分组 | 按优先级 P0/P1/P2 | 按文件读取负载（轻量/中量/重量） |
| Generate agent 输入 | 概念名 + code_evidence | 概念名 + 精确文件:行号读取清单 |
