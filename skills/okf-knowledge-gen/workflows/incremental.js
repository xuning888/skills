// ============================================================
// OKF Knowledge Generation — Incremental Update Workflow
// 基于 git diff 增量更新，仅重新生成受影响文档
// 设计原则：各 Phase 通过磁盘文件传递数据
// ============================================================

export const meta = {
  name: 'okf-incremental-update',
  description: '基于 git diff 增量更新 OKF 知识库，仅重新生成受影响的文档',
  phases: [
    { title: 'Detect Changes' },
    { title: 'Impact Analysis' },
    { title: 'Regenerate' },
    { title: 'Verify' },
  ],
};

const REPO = args?.repo || '.';
const SINCE = args?.since || 'HEAD~1';

// ============================================================
// Phase 1: Detect Changes
// ============================================================

phase('Detect Changes');

const DETECT_PROMPT = `执行命令获取变更文件列表：cd ${REPO} && git diff ${SINCE} --name-only
将变更文件列表输出到 knowledge-catalog/.work/incremental-changed-files.txt，每行一个路径。`;

await agent(DETECT_PROMPT, { label: 'detect', phase: 'Detect Changes' });
log('Phase 1 变更检测完成');

// ============================================================
// Phase 2: Impact Analysis
// ============================================================

phase('Impact Analysis');

const IMPACT_PROMPT = `你是影响面分析 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/.work/incremental-changed-files.txt 获取变更文件
2. Read knowledge-catalog/references/plan.json 获取上次全量生成的规划

## 影响面规则
| 文件类型 | 受影响概念 |
|---------|-----------|
| 实体类（model/entity/DTO） | 该实体 BusinessEntity + 所有引用者 |
| handler/controller | 相关 DataFlow |
| 配置文件 | 相关 Infrastructure |
| 构建文件 | 相关 Service 依赖章节 |
| 新增模块 | 需全量 Discover 扫描 |
| 删除模块 | 标记对应 Service 废弃 |

## 映射逻辑
变更文件 -> 路径前缀匹配 plan.json module -> 该 module 相关的所有 concepts

## 输出
写入 knowledge-catalog/.work/incremental-impact.json：
{
  "affected_concepts": [{ "concept_id": "..", "change_type": "..", "changed_files": [".."], "action": "regenerate" }],
  "new_modules": [],
  "deleted_modules": [],
  "needs_full_discover": false
}`;

await agent(IMPACT_PROMPT, { label: 'impact', phase: 'Impact Analysis' });
log('Phase 2 影响面分析完成');

// ============================================================
// Phase 3: Regenerate
// ============================================================

phase('Regenerate');

const REGEN_PROMPT = `你是增量文档生成 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/.work/incremental-impact.json 获取受影响概念列表
2. Read knowledge-catalog/references/plan.json 获取概念详情
3. Read project-profile.md 获取项目背景
4. 按 P0->P1->P2 顺序处理每个受影响概念：
   a. Read 对应模板文件：
      - BusinessEntity: ~/.claude/skills/okf-knowledge-gen/templates/business-entity.md
      - BusinessConcept: ~/.claude/skills/okf-knowledge-gen/templates/business-concept.md
      - Service: ~/.claude/skills/okf-knowledge-gen/templates/service-overview.md
      - DataFlow: ~/.claude/skills/okf-knowledge-gen/templates/data-flow.md
      - Infrastructure: ~/.claude/skills/okf-knowledge-gen/templates/infrastructure.md
      - ArchitectureDecision: ~/.claude/skills/okf-knowledge-gen/templates/architecture-decision.md
      - Reference: ~/.claude/skills/okf-knowledge-gen/templates/reference.md
   b. Read code_evidence 源码文件
   c. 如文档已存在，先 Read 现有文档再增量更新
   d. 用 Write 写入更新后的文档
5. 全部生成后再做交叉链接`;

await agent(REGEN_PROMPT, { label: 'regen', phase: 'Regenerate' });
log('Phase 3 重新生成完成');

// ============================================================
// Phase 4: Verify
// ============================================================

phase('Verify');

const V1_INCR_PROMPT = `你是断链检测 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/.work/incremental-impact.json 获取受影响概念
2. 检查这些概念文档中的 Markdown 链接有效性
3. 输出到 knowledge-catalog/.work/incremental-verify-links.json`;

const V4_INCR_PROMPT = `你是 index 更新 agent。

## 目标仓库：${REPO}

1. Read knowledge-catalog/references/plan.json
2. Read knowledge-catalog/.work/incremental-impact.json
3. 更新受影响的 index.md 文件
4. 更新 knowledge-catalog/log.md（追加 IncrementalUpdate 条目，记录触发 commit 和受影响概念）
5. 更新 knowledge-catalog/references/type-registry.md（如有新 type）`;

await parallel([
  () => agent(V1_INCR_PROMPT, { label: 'V1-links', phase: 'Verify' }),
  () => agent(V4_INCR_PROMPT, { label: 'V4-indexes', phase: 'Verify' }),
]);

log('Phase 4 校验完成');
log('增量更新结束');
