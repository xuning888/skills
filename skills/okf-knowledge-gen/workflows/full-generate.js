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

// ============================================================
// Phase 1: Discover — 4+1 并行探索 agent
// ============================================================

phase('Discover');

const A1_PROMPT = `你是模块扫描 agent。扫描代码仓库的物理结构和模块拓扑。

## 目标仓库：${REPO}

## 策略：穷举 -> 深读

### 穷举层
1. find 完整目录树（排除 node_modules/ target/ build/ .git/ vendor/ __pycache__/ venv/ .idea/）
2. find 所有构建文件：pom.xml build.gradle go.mod Cargo.toml package.json Makefile
3. find 所有 proto/IDL/GraphQL schema/SQL migration 文件
4. 对每个顶级目录统计文件数和估算行数

### 深读层（不超过 30 个文件）
1. 读所有构建文件 -> 提取模块名、依赖、语言版本
2. 每模块抽样 1-2 个代表性源码文件
3. 读入口文件（main/Application 类）

## 输出：将结果写入 ${REPO}/knowledge-catalog/.work/discover-a1-modules.json
{
  "modules": [{ "name": "..", "path": "..", "language": "java/go/..", "estimated_lines": N, "summary": "一句话", "build_file": ".." }],
  "dependency_graph": [{ "from": "A", "to": "B", "type": "compile" }],
  "key_files": { "build_files": [], "entry_points": [], "proto_files": [], "sql_migrations": [] },
  "organization": "mono-repo|multi-project",
  "layering_convention": "分层描述"
}`;

const A2_PROMPT = `你是实体提取 agent。从代码中提取领域概念。

## 目标仓库：${REPO}

## 策略：穷举 -> 分组 -> 深读

### 穷举层
1. grep class/interface/enum/record 定义
2. grep ORM 注解（@Entity @Table @Document @TableName）
3. grep protobuf message 定义
4. grep DTO/VO/Request/Response 类名模式

### 分组层
1. 按 package 分组 -> 实体聚类
2. 按引用次数排序 -> top-50 核心概念
3. 过滤纯技术类：Builder Config Util Exception Constants Helper Factory

### 深读层（不超过 50 个文件）
1. 引用最多的 top-20 实体类
2. 所有 Proto message 定义
3. 枚举类

## 输出：将结果写入 ${REPO}/knowledge-catalog/.work/discover-a2-entities.json
{
  "entities": [{ "name": "..", "type_hint": "BusinessEntity", "module": "..", "summary": "..", "attributes": ["name:type"], "code_evidence": ["文件:行号"], "referenced_by_count": N, "has_state": true }],
  "business_concepts": [{ "name": "..", "type_hint": "BusinessConcept", "module": "..", "summary": "..", "is_enum": true, "code_evidence": ["文件:行号"] }]
}`;

const A3_SURFACE_PROMPT = `你是流程追踪 agent（穷举阶段）。找出所有 API 入口和消息消费者。

## 目标仓库：${REPO}

## 穷举
1. grep HTTP 注解：@RequestMapping @PostMapping @GetMapping @PutMapping @DeleteMapping
2. grep 消息/定时注解：@RabbitListener @KafkaListener @Scheduled
3. grep gRPC service 定义
4. grep GraphQL resolver/mutation

## 输出：将结果写入 ${REPO}/knowledge-catalog/.work/discover-a3-surface.json
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

## 输出：将结果写入 ${REPO}/knowledge-catalog/.work/discover-a4-config.json
{
  "external_systems": [{ "name": "..", "type": "database|mq|cache|registry|..", "instances": [], "used_by_modules": [], "config_evidence": ["文件:行号"] }],
  "key_config": [{ "key": "..", "default_value": "..", "env_specific": true, "location": "文件:行号" }],
  "deployment_topology": [{ "service": "..", "ports": [], "depends_on_infra": [], "evidence": [] }]
}`;

// Phase 1: 4 个 agent 并行扫描
await parallel([
  () => agent(A1_PROMPT, { label: 'A1-modules', phase: 'Discover' }),
  () => agent(A2_PROMPT, { label: 'A2-entities', phase: 'Discover' }),
  () => agent(A3_SURFACE_PROMPT, { label: 'A3-surface', phase: 'Discover' }),
  () => agent(A4_PROMPT, { label: 'A4-config', phase: 'Discover' }),
]);

// A3 第二阶段：读取 A2 输出做分级深追
const A3_DEEP_PROMPT = `你是流程追踪 agent（深追阶段）。读取实体列表和入口清单，分级追踪关键流程。

## 目标仓库：${REPO}

## 步骤
1. Read knowledge-catalog/.work/discover-a2-entities.json 获取核心实体列表
2. Read knowledge-catalog/.work/discover-a3-surface.json 获取入口清单
3. 按分级规则追踪：
   - 第一级（深追 5 层）：handler 包含核心实体名 + 状态变更（POST/PUT/DELETE/发送）
   - 第二级（追 2 层）：handler 包含核心实体名但仅查询（GET）
   - 第三级（跳过）：/health /metrics /actuator 静态资源
4. 追踪方式：优先 Read handler 函数体 -> grep 被调用方法名 -> LSP callHierarchy 如可用
5. 标注每个断言：已验证（实际追踪到代码）vs 推断（基于命名约定）

## 输出：将结果写入 ${REPO}/knowledge-catalog/.work/discover-a3-deep.json
{
  "flow_patterns": [{ "name": "..", "description": "..", "representative_cases": [] }],
  "key_flows": [{ "name": "..", "entry_point": "文件:行号", "trace": [{"step":1,"location":"..","method":"..","verified":true}], "data_flow": [{"from":"..","to":"..","via":".."}], "branch_points": [] }],
  "assertions": [{ "claim": "..", "status": "已验证|推断", "evidence": "文件:行号" }]
}`;

await agent(A3_DEEP_PROMPT, { label: 'A3-deep', phase: 'Discover' });
log('Phase 1 Discover 完成');

// ============================================================
// Phase 2: Plan — 合成 plan.json
// ============================================================

phase('Plan');

const PLAN_PROMPT = `你是规划 agent。合成四个探索 agent 的发现为统一概念生成计划。

## 目标仓库：${REPO}

## 输入
Read 以下文件：
- knowledge-catalog/.work/discover-a1-modules.json
- knowledge-catalog/.work/discover-a2-entities.json
- knowledge-catalog/.work/discover-a3-deep.json
- knowledge-catalog/.work/discover-a4-config.json
- project-profile.md（项目背景和术语表）

## 处理

1. 概念去重合并：A1 模块 + A2 实体/概念 + A3 流程概念 + A4 外部系统
2. Type 分配：entity->BusinessEntity, concept->BusinessConcept, module->Service, flow->DataFlow, infra->Infrastructure, 策略/设计->ArchitectureDecision
3. 优先级：P0=核心实体+服务, P1=流程+基础设施, P2=决策+引用, P3=index+log+type-registry
4. 链接预案：基于依赖图和概念引用
5. 交叉验证：检查 A1 有模块但 A2 无概念、A2 有实体但 A3 无流程等盲区
6. Profile 差异：profile 声明但代码未发现 vs 代码发现但 profile 未声明

## 输出
将 plan.json 写入 ${REPO}/knowledge-catalog/references/plan.json：
{
  "concepts": [{ "id": "..", "name": "..", "type": "..", "priority": "P0|P1|P2|P3", "module": "..", "code_evidence": ["文件:行号"], "outgoing_links": [".."], "attributes_summary": [".."] }],
  "types": { "BusinessEntity": {"count":N}, "BusinessConcept": {"count":N}, "Service": {"count":N}, "DataFlow": {"count":N}, "Infrastructure": {"count":N}, "ArchitectureDecision": {"count":N}, "Reference": {"count":N} },
  "cross_check_results": [{"rule":"..","target":"..","action":".."}],
  "profile_diff": [{"level":"MISSING_IN_CODE|NOT_IN_PROFILE","field":"..","value":".."}],
  "output_directory": "knowledge-catalog/"
}`;

await agent(PLAN_PROMPT, { label: 'Plan', phase: 'Plan' });
log('Phase 2 Plan 完成');

// ============================================================
// Phase 3: Generate — 4 个 agent 并行生成，各负责一层优先级
// ============================================================

phase('Generate');

const TEMPLATE_PATHS = `
模板文件路径：
- BusinessEntity: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/business-entity.md
- BusinessConcept: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/business-concept.md
- Service: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/service-overview.md
- DataFlow: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/data-flow.md
- Infrastructure: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/infrastructure.md
- ArchitectureDecision: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/architecture-decision.md
- Reference: /Users/xuning/.claude/skills/okf-knowledge-gen/templates/reference.md`;

const PATH_RULES = `
文件写入路径规则：
- BusinessEntity -> knowledge-catalog/domain/entities/<name>.md
- BusinessConcept -> knowledge-catalog/domain/concepts/<name>.md
- Service -> knowledge-catalog/services/<name>/overview.md
- DataFlow -> knowledge-catalog/flows/<name>.md
- Infrastructure -> knowledge-catalog/infrastructure/<name>.md
- ArchitectureDecision -> knowledge-catalog/decisions/<name>.md
- Reference -> knowledge-catalog/references/<name>.md`;

const FORMAT_RULES = `
## 文档格式要求
- YAML frontmatter 必须包含：type title description tags timestamp
- timestamp 用当前 ISO 8601 时间
- 正文遵循模板的章节顺序
- 跨文档链接使用 bundle 内绝对路径（/services/xxx/overview.md）
- 每个技术断言必须有代码证据（文件路径:行号）
- 不确定的地方标注（待确认），不要编造

## 质量要求（关键）
- DataFlow：对每个流程，必须 Read 至少 3 个关键 handler/controller 源码文件，追踪方法调用链。完整链路 ASCII 图 + 各环节职责表每个步骤必须有具体的类名和方法名
- Service：对每个服务，必须 Read 入口类 + 至少 2 个核心 handler/controller 源码 + 配置文件
- BusinessEntity：必须 Read 实体类源码 + Proto message 定义（如适用）`;

// Agent 1: P0 概念（核心实体 + 核心服务，约 16 个概念）
const GEN_P0_PROMPT = `你是 P0 文档生成 agent。为最高优先级概念生成 OKF 文档。这些是知识库的基石，其他文档会链向它们，必须高质量。

## 目标仓库：${REPO}

## 步骤
1. Read knowledge-catalog/references/plan.json 获取概念清单
2. Read project-profile.md 获取项目背景和术语表
3. 只处理 priority = "P0" 的概念
4. 对每个概念：Read 对应模板 -> Read code_evidence 源码 -> 基于实际代码 Write 文档
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// Agent 2: P1 概念（BusinessEntity + BusinessConcept + Service，约 15 个）
const GEN_P1A_PROMPT = `你是 P1 领域文档生成 agent。为中等优先级的实体、概念和服务生成 OKF 文档。

## 目标仓库：${REPO}

## 步骤
1. Read knowledge-catalog/references/plan.json
2. 只处理 priority = "P1" 且 type 为 BusinessEntity/BusinessConcept/Service 的概念
3. 对每个概念：Read 对应模板 -> Read code_evidence 源码 -> Write 文档
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// Agent 3: P1 概念（DataFlow + Infrastructure，约 19 个，最关键——需要深追代码）
const GEN_P1B_PROMPT = `你是 P1 流程与基础设施文档生成 agent。DataFlow 文档需要最深度的代码追踪。

## 目标仓库：${REPO}

## 步骤
1. Read knowledge-catalog/references/plan.json
2. 只处理 priority = "P1" 且 type 为 DataFlow/Infrastructure 的概念
3. 对每个 DataFlow：
   - Read project-profile.md 了解业务背景
   - Read 流程入口源码（handler/controller）
   - grep 追踪被调用的方法，Read 每个关键方法的源码文件
   - 至少追踪 5 层调用链，画出完整 ASCII 链路图
   - 各环节职责表每步必须有：服务名、类名、方法名、关键操作描述
   - 标注实现断言：已验证（实际追踪到）vs 推断
4. 对每个 Infrastructure：Read 配置文件 + Read 至少 1 个使用方的源码
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}`;

// Agent 4: P2+P3 概念（ArchitectureDecision + Reference + index/log/type-registry）
const GEN_P2_PROMPT = `你是 P2/P3 文档生成 agent。为架构决策、引用和索引生成文档。

## 目标仓库：${REPO}

## 步骤
1. Read knowledge-catalog/references/plan.json
2. 处理 priority = "P2" 和 "P3" 的概念
3. 对 ArchitectureDecision：Read 相关源码 + project-profile.md，按 ADR 格式写
4. 对 Reference：简洁描述外部资源及其与项目关系
5. 生成 knowledge-catalog/index.md（根索引，按领域分组）
6. 生成各级子目录 index.md
7. 生成 knowledge-catalog/references/type-registry.md
8. 生成/更新 knowledge-catalog/log.md
${TEMPLATE_PATHS}
${PATH_RULES}
${FORMAT_RULES}

index.md 和 log.md 无 frontmatter`;

// 4 个 agent 并行生成
await parallel([
  () => agent(GEN_P0_PROMPT, { label: 'gen-P0', phase: 'Generate' }),
  () => agent(GEN_P1A_PROMPT, { label: 'gen-P1-entities', phase: 'Generate' }),
  () => agent(GEN_P1B_PROMPT, { label: 'gen-P1-flows', phase: 'Generate' }),
  () => agent(GEN_P2_PROMPT, { label: 'gen-P2-indexes', phase: 'Generate' }),
]);

// 交叉链接：等所有文档生成完后补充链接
const CROSSLINK_PROMPT = `你是交叉链接 agent。检查所有已生成文档的链接完整性。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json 获取所有概念的 outgoing_links
2. 抽查 10-15 个关键概念文档（优先 DataFlow 和 Service）
3. 验证 outgoing_links 指向的文档已存在
4. 如有断链，用 Read+Write 修正
5. 如正文中缺少对链接预案中概念的引用，补充之`;

await agent(CROSSLINK_PROMPT, { label: 'crosslink', phase: 'Generate' });
log('Phase 3 Generate 完成');

// ============================================================
// Phase 4: Verify — 4 个并行校验 agent
// ============================================================

phase('Verify');

const V1_PROMPT = `你是断链检测 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json 获取所有概念文档路径
2. 逐个 Read 每个文档，提取 Markdown 链接 [text](target)
3. 验证 target：bundle 内绝对路径检查文件存在，外部 URL 检查格式
4. 输出断链清单到 knowledge-catalog/.work/verify-v1-broken-links.json`;

const V2_PROMPT = `你是一致性校验 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json 获取所有概念
2. 验证每个文档 frontmatter：type title description timestamp 四个必填字段
3. 验证 type 值在 type-registry.md 中存在
4. 验证正文包含对应 type 模板的必须章节
5. 输出到 knowledge-catalog/.work/verify-v2-consistency.json`;

const V3_PROMPT = `你是实现断言验证 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json 获取概念及其 code_evidence
2. 优先检查 DataFlow 文档中的断言（偏差风险最高）
3. 对每个"已验证"断言，Read 对应源码确认
4. 对每个"推断"断言，尝试从源码确认或推翻
5. 抽样上限 20 个断言
6. 输出到 knowledge-catalog/.work/verify-v3-assertions.json`;

const V4_PROMPT = `你是 index 生成 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json
2. 生成各级 index.md：
   - 根 index.md：按 业务领域/服务/消息流/基础设施/架构决策/引用 分组
   - 子目录 index.md（domain/entities/ domain/concepts/ services/ flows/ infrastructure/ decisions/ references/）
3. 生成 knowledge-catalog/references/type-registry.md
4. 生成/更新 knowledge-catalog/log.md
5. index.md 和 log.md 无 frontmatter
6. 每个条目：- [Title](link) - description`;

await parallel([
  () => agent(V1_PROMPT, { label: 'V1-links', phase: 'Verify' }),
  () => agent(V2_PROMPT, { label: 'V2-consistency', phase: 'Verify' }),
  () => agent(V3_PROMPT, { label: 'V3-assertions', phase: 'Verify' }),
  () => agent(V4_PROMPT, { label: 'V4-indexes', phase: 'Verify' }),
]);

log('Phase 4 Verify 完成');
log('全量生成结束。输出目录：knowledge-catalog/');
