// ============================================================
// OKF Knowledge Generation — Full Pipeline Workflow
// Phases: Discover -> Plan -> Generate -> Verify
// 设计原则：各 Phase 通过磁盘文件传递数据，不依赖 JS 内存变量
// ============================================================

export const meta = {
  name: 'okf-full-generate',
  description: '全量生成 OKF 知识库：Discover -> Plan -> Generate -> Verify',
  phases: [
    { title: 'Discover' },
    { title: 'Plan' },
    { title: 'Generate' },
    { title: 'Verify' },
  ],
};

// 目标代码仓库路径
const REPO = args?.repo || '.';
// 知识库输出目录（支持绝对路径或相对 REPO 的路径）
const OUT = (() => {
  const raw = args?.output || 'knowledge-catalog';
  return raw.startsWith('/') ? raw : `${REPO}/${raw}`;
})();

// ============================================================
// Phase 1: Discover — 数据面 + 控制面并行探索
// 数据面（A2'）与控制面（A3_SURFACE）独立运行，互不依赖
// ============================================================

phase('Discover');

// A2' — 数据面：穷举所有概念，输出纯事实记录（不做 Type 判定，不做过滤）
const A2_PROMPT = `你是数据面概念挖掘 agent。穷举代码仓库中所有类、接口、枚举、Proto 消息和数据库表定义，记录纯事实——不做业务判断、不做 Type 分类、不做过滤。

## 目标仓库：${REPO}

## 策略：穷举 -> 深读确认

### 穷举层
1. grep 所有 class/interface/enum/record 定义（Java: ^\s*(public\s+)?(class|interface|enum|record)\s+\w+）
2. grep ORM 注解定义（@Entity @Table @Document @TableName）
3. grep 所有 protobuf message/enum 定义
4. grep 所有 DTO/VO/Request/Response 类名模式
5. find 所有 SQL migration 文件，提取 CREATE TABLE 语句
6. 不按引用数截断——记录所有类，不做 top-N 筛选
7. 不做后缀黑名单过滤——技术设施类和业务类一视同仁记录

### 深读确认层
1. 对每个类：Read 文件头（类声明 + 字段 + 方法签名），确认 attributes 完整
2. 记录 called_by 关系：grep 该类名被哪些文件引用
3. 记录 calls 关系：从代码中提取该类调用了哪些外部方法

## 输出：将结果写入 ${OUT}/.work/discover-data-concepts.json
{
  "classes": [
    {
      "name": "短类名",
      "fqn": "完整限定名",
      "location": "模块/src/.../File.java:行号",
      "annotations": ["@Service", "@Entity"],
      "extends": "父类名或空",
      "implements": ["接口列表"],
      "attributes": [{"name": "字段名", "type": "字段类型", "annotations": ["@Column"]}],
      "called_by": [{"method": "调用方法名", "location": "文件:行号"}],
      "calls": [{"method": "被调用方法名", "location": "文件:行号"}]
    }
  ],
  "proto_messages": [
    {"name": "消息名", "location": "文件:行号", "fields": [{"name": "字段名", "type": "类型", "number": N}]}
  ],
  "sql_tables": [
    {"name": "表名", "location": "migration文件:行号", "columns": [{"name": "列名", "type": "类型", "nullable": true}]}
  ],
  "total_classes_found": N,
  "note": "全量穷举。不做 type 预判，不做摘要，不做过滤。每个记录必须有精确 code_evidence。"
}

## 关键原则
- 不做 Type 判定（不区分 entity/concept/infra），Plan 阶段统一处理
- 不做 summary 摘要——防止信息丢失，Plan agent 基于原始事实做判断
- called_by/calls 只记录精确文件:行号位置
- 如果项目过大导致上下文不足，优先保证每个模块的类记录完整，不得私自截断`;

const A3_SURFACE_PROMPT = `你是流程追踪 agent（穷举阶段）。找出所有 API 入口和消息消费者。

## 目标仓库：${REPO}

## 穷举
1. grep HTTP 注解：@RequestMapping @PostMapping @GetMapping @PutMapping @DeleteMapping
2. grep 消息/定时注解：@RabbitListener @KafkaListener @Scheduled
3. grep gRPC service 定义
4. grep GraphQL resolver/mutation

## 输出：将结果写入 ${OUT}/.work/discover-a3-surface.json
{
  "entry_points": [{ "path": "文件:行号", "method": "POST|GET|..", "url_or_rpc": "..", "handler_function": "..", "module": "..", "entry_type": "http|grpc|message|scheduled" }],
  "total_count": N
}`;

const A4_PROMPT = `你是配置与依赖扫描 agent。识别外部依赖和运维配置。

## 目标仓库：${REPO}

## 策略：穷举 + 全量深读（配置文件数量有限）

1. find 所有配置文件：application*.yml application*.yaml application*.properties .env
2. find Dockerfile docker-compose*.yml K8s manifest
3. find 数据库 migration 文件
4. grep 数据库/MQ/Redis 连接字符串

## 输出：将结果写入 ${OUT}/.work/discover-a4-config.json
{
  "external_systems": [{ "name": "..", "type": "database|mq|cache|registry|..", "instances": [], "used_by_modules": [], "config_evidence": ["文件:行号"] }],
  "key_config": [{ "key": "..", "default_value": "..", "env_specific": true, "location": "文件:行号" }],
  "deployment_topology": [{ "service": "..", "ports": [], "depends_on_infra": [], "evidence": [] }]
}`;

// Phase 1: 3 个 agent 并行扫描（数据面 A2' + 控制面入口 A3_SURFACE + 配置 A4）
await parallel([
  () => agent(A2_PROMPT, { label: 'A2-concept-mining', phase: 'Discover', model: 'opus' }),
  () => agent(A3_SURFACE_PROMPT, { label: 'A3-surface', phase: 'Discover', model: 'opus' }),
  () => agent(A4_PROMPT, { label: 'A4-config', phase: 'Discover', model: 'sonnet' }),
]);

// A3 第二阶段：控制面深追——枚举所有入口，追踪到 IO 边界（DB/MQ/RPC/文件）
// 独立于数据面运行，只依赖 A3_SURFACE 入口清单
const A3_DEEP_PROMPT = `你是控制面流程追踪 agent（深追阶段）。不依赖数据面（A2'）的输出，独立枚举所有入口并追踪到 IO 边界。

## 目标仓库：${REPO}

## 步骤
1. Read ${OUT}/.work/discover-a3-surface.json 获取入口清单
2. 对每个入口追踪调用链，终止于 IO 边界：
   - db_read / db_write：到达数据库插入/更新/查询/删除操作
   - mq_publish / mq_consume：到达消息队列发送或消费
   - rpc_call：到达 gRPC/HTTP 外部服务调用
   - file_read / file_write：到达文件系统读写
3. 记录每个步骤：方法签名、入参类型、出参类型、分支条件
4. 标注每个步骤的验证状态：已验证（实际 Read 到源码）vs 推断

## 追踪规则
- 所有入口一视同仁，不按实体名匹配筛选，不预设追踪深度
- 终止条件为到达 IO 边界，而非固定步数
- 记录 IO 边界处的精确目标（DB 表名、MQ topic、RPC 服务名、文件路径）
- 不跳过任何入口——/health /metrics 这类基础设施入口也记录，但标注为 technical

## 输出：将结果写入 ${OUT}/.work/discover-control-flows.json
{
  "flows": [
    {
      "id": "flow-001",
      "entry": "POST /api/message/send",
      "entry_location": "MessageController.java:42",
      "entry_method": "sendMessage(SendRequest): SendResponse",
      "entry_type": "http",
      "trace": [
        {
          "step": 1,
          "location": "MessageServiceImpl.java:88",
          "method": "handleSend(SendRequest): void",
          "params": ["userId: Long", "content: String", "sessionType: int"],
          "return": "void",
          "calls": ["SessionService.getSession", "MsgStore.persist"],
          "branch_condition": "if (sessionType == C2C)",
          "verified": true
        }
      ],
      "io_boundary": [
        {"type": "db_write", "target": "MySQL", "table": "t_message", "location": "MsgStore.java:156"},
        {"type": "mq_publish", "target": "Kafka", "topic": "MESSAGE_SEND", "location": "KafkaProducer.java:33"}
      ]
    }
  ],
  "total_entries_found": N,
  "total_flows_traced": N
}`;

await agent(A3_DEEP_PROMPT, { label: 'A3-deep-control', phase: 'Discover', model: 'opus' });
log('Phase 1 Discover 完成（数据面 + 控制面）');

// ============================================================
// Phase 2: Plan — 3 agent（Plan-Data + Plan-Control 并行 → Plan-Merge 交叉合并）
// ============================================================

phase('Plan');

// Plan-Data：数据面合成——基于 A2' 纯事实做 Type 分配和概念去重
const PLAN_DATA_PROMPT = `你是数据面合成 agent。基于 Discover 阶段纯事实做 Type 分配、概念去重和属性提炼。

## 目标仓库：${REPO}

## 输入
Read 以下文件：
- ${OUT}/.work/discover-data-concepts.json（A2' 穷举的所有类/Proto/SQL 事实）
- project-profile.md（项目背景和术语表）

## 职责

1. **逐类判定 Type**
   - 有状态 + 有唯一标识 + 有生命周期 → BusinessEntity
   - 抽象规则/机制/策略/枚举 → BusinessConcept
   - 对应一个独立部署模块 → Service
   - 外部中间件/存储/基础设施组件 → Infrastructure
   - 不匹配以上任何类型但有业务含义 → Reference
   - 判定依据必须来自代码事实（annotations、attributes、called_by/calls），不得凭空猜测

2. **概念去重**
   - 同一业务实体在不同模块出现（DTO 层 vs Domain 层 vs Proto 层），按 FQN 前缀和 attributes 相似度聚类归并
   - 去重后保留最完整的属性集合和最接近业务核心的 location

3. **属性提炼**
   - 从多个 source 文件中提取该概念的完整属性集合
   - attributes_summary 列出关键属性名:类型对

4. **Profile 差异**
   - profile 声明但代码未发现的概念 → MISSING_IN_CODE
   - 代码发现但 profile 未声明的概念 → NOT_IN_PROFILE

## 输出
将结果写入 ${OUT}/.work/plan-data.json：
{
  "concepts": [{ "id": "..", "name": "..", "type": "BusinessEntity|BusinessConcept|Service|Infrastructure|Reference", "module": "..", "code_evidence": ["文件:行号"], "attributes_summary": ["字段名:类型"], "fqn": ".." }],
  "profile_diff": [{"level":"MISSING_IN_CODE|NOT_IN_PROFILE","field":"..","value":".."}],
  "types_summary": { "BusinessEntity": {"count":N}, "BusinessConcept": {"count":N}, "Service": {"count":N}, "Infrastructure": {"count":N}, "Reference": {"count":N} }
}`;

// Plan-Control：控制面合成——流程归一化 + 实体映射 + IO→Infra 发现
const PLAN_CONTROL_PROMPT = `你是控制面合成 agent。基于 A3_DEEP' 的流程追踪结果做流程归一化、实体映射和 Infrastructure 发现。

## 目标仓库：${REPO}

## 输入
Read 以下文件：
- ${OUT}/.work/discover-control-flows.json（A3_DEEP' 的完整流程追踪+IO边界）
- project-profile.md（项目背景和术语表）

## 职责

1. **流程归一化**
   - 同一业务路径的不同入口（HTTP vs gRPC vs MQ 消息消费）归一化为同一个 DataFlow
   - 判断依据：trace 中操作的核心数据是否相同、IO 边界是否相同
   - 保留所有入口的 entry_locations

2. **流程→实体映射**
   - 从每步 trace 的 params/return/calls 中提取该流程操作的数据实体名
   - 不做类型判断（留给 Plan-Merge 交叉验证），只记录实体名和所在 trace step
   - operated_entities 列表供 Plan-Merge 碰撞检测使用

3. **IO 边界→Infrastructure 发现**
   - 从所有 flow 的 io_boundary 中汇总去重
   - 自动为每个 IO 资源创建 Infrastructure 概念候选：DB 表 → Infrastructure、MQ topic → Infrastructure、外部 RPC 服务 → Infrastructure
   - 每个 Infrastructure 候选带 io_boundary 来源（代码证据）

## 输出
将结果写入 ${OUT}/.work/plan-control.json：
{
  "normalized_flows": [{ "flow_id": "..", "name": "..", "normalized_entries": ["文件:行号"], "tracked_trace": "完整的归一化 trace", "io_boundary": [...], "operated_entities": ["实体名"] }],
  "discovered_infrastructure": [{ "name": "..", "type": "database|mq|cache|external_rpc", "io_source": "文件:行号", "used_by_flows": ["flow_id"] }]
}`;

// Plan-Merge：交叉合并——碰撞检测 + 优先级 + 链接预案 + file_manifest
const PLAN_MERGE_PROMPT = `你是交叉合并 agent。合并数据面和控制面的结果，做碰撞检测、优先级排序、链接预案，并为每个概念生成文件读取清单。

## 目标仓库：${REPO}

## 输入
Read 以下文件：
- ${OUT}/.work/plan-data.json（数据面：概念+Type+属性）
- ${OUT}/.work/plan-control.json（控制面：流程+实体映射+Infra 候选）
- project-profile.md

## 职责

1. **碰撞检测**
   - Plan-Data 有但 Plan-Control operated_entities 未涉及的实体 → 可能是死代码、纯配置数据、或控制面漏了 → 标记为 cross_check_result
   - Plan-Control operated_entities 有但 Plan-Data 没发现的实体 → 数据面漏网之鱼 → 从 operated_entities 反推创建新概念
   - 控制面 discovered_infrastructure 是否已被数据面覆盖 → 未覆盖的标记为自动发现

2. **Type 最终分配**
   - 合并 Plan-Data 的 type（Entity/Concept/Service/Infra/Reference）和 Plan-Control 的 flow/infra
   - 流程归一化结果 → DataFlow type
   - 控制面发现的 Infrastructure → Infrastructure type
   - 被控制面确认"有流程操作"的实体 → 保持原 type
   - 策略/设计相关的决策 → ArchitectureDecision type

3. **优先级 P0-P3**
   - P0：核心实体 + 核心服务（被多个 flow 操作或被 profile 明确标记为核心）
   - P1：DataFlow + Infrastructure（被流程使用的）
   - P2：ArchitectureDecision + Reference
   - P3：index + log + type-registry

4. **链接预案**
   - 基于 called_by/calls 关系 + trace 构建概念间 outgoing_links
   - 实体 ↔ 流程（实体被哪些 DataFlow 操作）
   - 流程 ↔ Service（流程经过哪些服务模块）
   - Infrastructure ↔ 使用者（哪些 Service/Flow 使用了该 Infra）

5. **文件读取清单 file_manifest**
   为每个概念生成精确的文件:行号读取清单：
   - BusinessEntity/Concept：code_evidence 中的实体定义文件 + called_by 最多的 3 个引用文件
   - Service：入口类 + 构建文件 + 配置文件（不超过 10 个）
   - DataFlow：完整 trace 所有步骤的 location + IO boundary location（15+ 个）
   - Infrastructure：配置文件 + 至少 1 个使用方源码
   - 按文件数分 load_category：light(<5), medium(5-15), heavy(>15)

## 输出
将 plan.json 写入 ${OUT}/references/plan.json：
{
  "concepts": [{ "id": "..", "name": "..", "type": "..", "priority": "P0|P1|P2|P3", "module": "..", "code_evidence": ["文件:行号"], "outgoing_links": ["concept_id"], "attributes_summary": ["字段名:类型"], "file_manifest": { "total_files": N, "load_category": "light|medium|heavy", "files": [{"path": "相对路径", "lines": "行号范围", "reason": "读取原因"}] } }],
  "types": { "BusinessEntity": {"count":N}, "BusinessConcept": {"count":N}, "Service": {"count":N}, "DataFlow": {"count":N}, "Infrastructure": {"count":N}, "ArchitectureDecision": {"count":N}, "Reference": {"count":N} },
  "cross_check_results": [{"rule":"..","target":"..","action":".."}],
  "profile_diff": [{"level":"MISSING_IN_CODE|NOT_IN_PROFILE","field":"..","value":".."}],
  "output_directory": "${OUT}/"
}

## 关键原则
- plan.json 是 Generate 阶段的唯一输入，必须完整准确
- file_manifest 是 Generate agent 的文件读取清单——精确到行号，让它不需要猜测
- 新增字段 file_manifest 是纯增量，不得删除或重命名任何现有字段（incremental.js 依赖它们）`;

// Plan-Data 和 Plan-Control 并行，Plan-Merge 串行等待两者
await parallel([
  () => agent(PLAN_DATA_PROMPT, { label: 'Plan-Data', phase: 'Plan', model: 'opus' }),
  () => agent(PLAN_CONTROL_PROMPT, { label: 'Plan-Control', phase: 'Plan', model: 'opus' }),
]);
await agent(PLAN_MERGE_PROMPT, { label: 'Plan-Merge', phase: 'Plan', model: 'opus' });
log('Phase 2 Plan 完成（Data + Control → Merge）');

// ============================================================
// Phase 3: Generate — 按文件读取负载分组生成（load_category: light/medium/heavy）
// ============================================================

phase('Generate');

const TEMPLATE_PATHS = `
模板文件路径：
- BusinessEntity: ～/.claude/skills/okf-knowledge-gen/templates/business-entity.md
- BusinessConcept: ～/.claude/skills/okf-knowledge-gen/templates/business-concept.md
- Service: ～/.claude/skills/okf-knowledge-gen/templates/service-overview.md
- DataFlow: ～/.claude/skills/okf-knowledge-gen/templates/data-flow.md
- Infrastructure: ～/.claude/skills/okf-knowledge-gen/templates/infrastructure.md
- ArchitectureDecision: ~/.claude/skills/okf-knowledge-gen/templates/architecture-decision.md
- Reference: ~/.claude/skills/okf-knowledge-gen/templates/reference.md`;

const PATH_RULES = `
文件写入路径规则：
- BusinessEntity -> ${OUT}/domain/entities/<name>.md
- BusinessConcept -> ${OUT}/domain/concepts/<name>.md
- Service -> ${OUT}/services/<name>/overview.md
- DataFlow -> ${OUT}/flows/<name>.md
- Infrastructure -> ${OUT}/infrastructure/<name>.md
- ArchitectureDecision -> ${OUT}/decisions/<name>.md
- Reference -> ${OUT}/references/<name>.md`;

const FORMAT_RULES = `
## 文档格式要求
- YAML frontmatter 必须包含：type title description tags timestamp
- timestamp 用当前 ISO 8601 时间
- 正文遵循模板的章节顺序
- 跨文档链接使用 bundle 内绝对路径（/services/xxx/overview.md）
- 每个技术断言必须有代码证据（文件路径:行号）
- 不确定的地方标注（待确认），不要编造

## 质量要求（关键）
- 优先按 file_manifest.files 精确读取——Plan 已经计算好了每个概念需要读哪些文件
- 如果 file_manifest 不完整，用 grep/read 补充，但必须标注"manifest 外补充"
- DataFlow：必须 Read manifest 中所有 trace location + io_boundary location，画出完整 ASCII 链路图
- Service：必须 Read 入口类 + 至少 2 个核心 handler/controller 源码 + 配置文件
- BusinessEntity：必须 Read 实体类源码 + Proto message 定义（如适用）`;

// GEN_LIGHT：轻量概念（<5 个文件，BusinessEntity/BusinessConcept/Reference，8-10个/agent）
const GEN_LIGHT_PROMPT = `你是轻量文档生成 agent。处理 file_manifest.load_category = "light" 的概念。
生成 BusinessEntity、BusinessConcept、Reference 类型文档——文件读取量小，但需要准确提炼领域语义。

## 目标仓库：${REPO}

## 步骤
1. Read ${OUT}/references/plan.json 获取概念清单
2. Read project-profile.md 获取项目背景和术语表
3. 只处理 file_manifest.load_category = "light" 的概念
4. 对每个概念：
   a. Read 对应模板
   b. 按 file_manifest.files 精确读取每个文件（Plan 已经算好了）
   c. 基于实际代码和模板 Write 文档
5. 处理 8-10 个概念后如还有剩余，记录在 ${OUT}/.work/gen-light-remaining.txt 中
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// GEN_MEDIUM：中量概念（5-15 个文件，Service/Infrastructure/ArchitectureDecision，4-6个/agent）
const GEN_MEDIUM_PROMPT = `你是中量文档生成 agent。处理 file_manifest.load_category = "medium" 的概念。
生成 Service、Infrastructure、ArchitectureDecision 类型文档——需要读配置文件和多个源码文件。

## 目标仓库：${REPO}

## 步骤
1. Read ${OUT}/references/plan.json 获取概念清单
2. 只处理 file_manifest.load_category = "medium" 的概念
3. 对每个概念：
   a. Read 对应模板
   b. 按 file_manifest.files 精确读取每个文件
   c. 对 Service：Read 入口类 + 构建文件 + 配置文件
   d. 对 Infrastructure：Read 配置文件 + 至少 1 个使用方源码
   e. 基于实际代码和模板 Write 文档
4. 处理 4-6 个概念后如还有剩余，记录在 ${OUT}/.work/gen-medium-remaining.txt 中
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// GEN_HEAVY：重量概念（15+ 个文件，DataFlow，1-3个/agent——最深度的代码追踪）
const GEN_HEAVY_PROMPT = `你是重量文档生成 agent。处理 file_manifest.load_category = "heavy" 的概念。
生成 DataFlow 类型文档——需要完整追踪跨服务调用链，每个流程涉及 15+ 个源码文件。

## 目标仓库：${REPO}

## 步骤
1. Read ${OUT}/references/plan.json 获取概念清单
2. Read project-profile.md 了解业务背景
3. 只处理 file_manifest.load_category = "heavy" 的概念
4. 对每个 DataFlow：
   a. Read data-flow.md 模板
   b. 按 file_manifest.files 读取所有 trace location + io_boundary location
   c. 画出完整 ASCII 链路图（标注服务名、类名、方法名）
   d. 各环节职责表每步必须有：服务名、类名、方法名、入出参类型、关键操作描述
   e. 标注实现断言：已验证（已在 manifest 文件中追踪到）vs 推断
   f. 如果 manifest 不完整，grep/read 补充追踪，标注"manifest 外补充: 文件:行号"
5. 处理 1-3 个概念后如还有剩余，记录在 ${OUT}/.work/gen-heavy-remaining.txt 中
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// 3 个 agent 并行生成，按负载度分组（取代原来的 P0/P1/P2 优先级分组）
await parallel([
  () => agent(GEN_LIGHT_PROMPT, { label: 'gen-light', phase: 'Generate', model: 'sonnet' }),
  () => agent(GEN_MEDIUM_PROMPT, { label: 'gen-medium', phase: 'Generate', model: 'sonnet' }),
  () => agent(GEN_HEAVY_PROMPT, { label: 'gen-heavy', phase: 'Generate', model: 'opus' }),
]);

// 交叉链接：等所有文档生成完后补充链接
const CROSSLINK_PROMPT = `你是交叉链接 agent。检查所有已生成文档的链接完整性。

## 目标仓库：${REPO}

1. Read ${OUT}/references/plan.json 获取所有概念的 outgoing_links
2. 抽查 10-15 个关键概念文档（优先 DataFlow 和 Service）
3. 验证 outgoing_links 指向的文档已存在
4. 如有断链，用 Read+Write 修正
5. 如正文中缺少对链接预案中概念的引用，补充之`;

await agent(CROSSLINK_PROMPT, { label: 'crosslink', phase: 'Generate', model: 'opus' });
log('Phase 3 Generate 完成');

// ============================================================
// Phase 4: Verify — 4 个并行校验 agent
// ============================================================

phase('Verify');

const V1_PROMPT = `你是断链检测 agent。

## 目标仓库：${REPO}

1. Read ${OUT}/references/plan.json 获取所有概念文档路径
2. 逐个 Read 每个文档，提取 Markdown 链接 [text](target)
3. 验证 target：bundle 内绝对路径检查文件存在，外部 URL 检查格式
4. 输出断链清单到 ${OUT}/.work/verify-v1-broken-links.json`;

const V2_PROMPT = `你是一致性校验 agent。

## 目标仓库：${REPO}

1. Read ${OUT}/references/plan.json 获取所有概念
2. 验证每个文档 frontmatter：type title description timestamp 四个必填字段
3. 验证 type 值在 type-registry.md 中存在
4. 验证正文包含对应 type 模板的必须章节
5. 输出到 ${OUT}/.work/verify-v2-consistency.json`;

const V3_PROMPT = `你是实现断言验证 agent。

## 目标仓库：${REPO}

1. Read ${OUT}/references/plan.json 获取概念及其 code_evidence
2. 优先检查 DataFlow 文档中的断言（偏差风险最高）
3. 对每个"已验证"断言，Read 对应源码确认
4. 对每个"推断"断言，尝试从源码确认或推翻
5. 抽样上限 20 个断言
6. 输出到 ${OUT}/.work/verify-v3-assertions.json`;

const V4_PROMPT = `你是 index 生成 agent。

## 目标仓库：${REPO}

1. Read ${OUT}/references/plan.json
2. 生成各级 index.md：
   - 根 index.md：按 业务领域/服务/消息流/基础设施/架构决策/引用 分组
   - 子目录 index.md（domain/entities/ domain/concepts/ services/ flows/ infrastructure/ decisions/ references/）
3. 生成 ${OUT}/references/type-registry.md
4. 生成/更新 ${OUT}/log.md
5. index.md 和 log.md 无 frontmatter
6. 每个条目：- [Title](link) - description`;

await parallel([
  () => agent(V1_PROMPT, { label: 'V1-links', phase: 'Verify', model: 'opus' }),
  () => agent(V2_PROMPT, { label: 'V2-consistency', phase: 'Verify', model: 'opus' }),
  () => agent(V3_PROMPT, { label: 'V3-assertions', phase: 'Verify', model: 'opus' }),
  () => agent(V4_PROMPT, { label: 'V4-indexes', phase: 'Verify', model: 'opus' }),
]);

log('Phase 4 Verify 完成');
log('全量生成结束。输出目录：${OUT}/');
