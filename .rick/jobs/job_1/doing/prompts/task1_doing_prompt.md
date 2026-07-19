# Rick 项目执行阶段

## 角色定义

你是一个资深的软件工程师。你的任务是执行规划好的任务，完成具体的编码工作。

---

## 先验知识（执行前必读）

## 可用的项目 Loops

（暂无项目 Loop 记录）


## 可用的项目 Skills

（暂无项目 Skill 记录）


---

## Job 上下文

暂无问题记录

---

## 任务信息

**任务 ID**: task1
**任务名称**: 创建 okf-knowledge-read 技能目录结构和 SKILL.md 骨架及核心流程指令

### 任务目标
在 `skills/okf-knowledge-read/` 下创建技能目录，编写 SKILL.md 的主干内容：frontmatter 元数据、触发条件、前置准备、运行参数说明，以及核心 5 步 Pipeline 指令（发现知识库 → 匹配概念 → 加载文档 → 追踪链接 → 注入上下文）。

### 关键结果
1. `skills/okf-knowledge-read/SKILL.md` 文件存在，frontmatter 包含 `name: okf-knowledge-read` 和 `description`，description 明确列出至少 3 种触发场景（格式参考 `skills/okf-knowledge-gen/SKILL.md` 第 10-14 行的"什么时候用"写法，每条以"- "开头带粗体关键词，如"- 新项目需要了解架构"、"- 追踪某个业务流程的完整链路"、"- 查找特定领域概念的定义和关联"）
2. SKILL.md 包含完整的 5 步核心流程指令，每步必须明确：(a) 工具名称（Read/Bash(grep)/ls/mkdir）和具体参数模式；(b) 决策阈值（如关键词匹配数≥1即为候选，否则回退到 ls 遍历目录）；(c) 失败回退策略（如 grep 无结果时回退到 ls 遍历、Read 失败时尝试相对路径变体）
3. 技能声明输入参数 `kb`（知识库路径），含两级路径验证：(a) `ls <kb>` 目录存在；(b) `Read <kb>/index.md` 文件存在且内容非空——任一步失败立即终止并报错"<路径> 不是有效的 OKF 知识库目录"
4. 核心流程覆盖：发现（index.md + type-registry.md 加载，index.md 格式参考 `skills/okf-knowledge-gen/templates/index.md` 的六分组结构）、匹配（关键词 grep → 语义精筛）、加载（摘要优先 → 全文，文档章节结构参考 `skills/okf-knowledge-gen/templates/` 下各类型模板，优先提取 frontmatter + 核心章节如关键属性、核心职责和依赖、完整链路和环节职责表）、追踪（一跳链接）、注入（按 type 分组输出）
5. 技能包含明确的**处理范围声明**，基于 `skills/okf-knowledge-gen/SKILL.md` 中定义的目录结构：纳入处理（index.md、type-registry.md、domain/entities/、domain/concepts/、services/、flows/、infrastructure/、decisions/、references/）；不纳入处理（plan.json、log.md、.work/ 等生成阶段内部文件），避免 agent 读取无关文件浪费 token
6. SKILL.md 包含以下明确的章节锚点（按固定顺序），其中辅助章节使用 HTML 注释作为 Task2 的 Edit 替换目标：
7. `## 什么时候用`（即触发条件）
8. `## 前置准备`
9. `## 运行`（含 `kb` 参数说明）
10. `## 核心流程`（5 步 Pipeline：发现 → 匹配 → 加载 → 追踪 → 注入）
11. `## 内置 Type 定义` → 内容写 `<!-- TASK2_FILL: 内置 Type 定义 -->`
12. `## 使用示例` → 内容写 `<!-- TASK2_FILL: 使用示例 -->`
13. `## 常见问题` → 内容写 `<!-- TASK2_FILL: 常见问题 -->`
14. `## 输出格式` → 内容写 `<!-- TASK2_FILL: 输出格式 -->`


### 测试方法
**正常路径测试**
前置条件：存在一个有效的 OKF 知识库目录，结构如下：
index.md（含四个分组条目）
references/type-registry.md
domain/entities/ 下至少 2 个 Entity 文档
services/ 下至少 1 个 Service 文档
flows/ 下至少 1 个 DataFlow 文档
输入参数：`kb=/path/to/valid-knowledge-catalog`，用户问题="介绍一下这个项目的架构"
操作序列：agent 加载 skill → Read index.md → Read type-registry.md → grep index.md 匹配关键词 → 按匹配结果 Read 文档摘要 → 判断相关性后全文加载 → 追踪链接 → 按 type 分组注入
预期输出：
**边界用例：知识库缺少 type-registry.md**
前置条件：知识库目录存在，index.md 存在，但 `references/type-registry.md` 不存在
输入参数：`kb=/path/to/kb-without-type-registry`，用户问题="介绍一下项目架构"
操作序列：Read index.md 成功 → Read type-registry.md 失败（404）→ agent 回退到内置 Type 定义 → 继续加载文档
预期输出：
**边界用例：index.md 不存在（非法知识库）**
前置条件：目录存在但不包含 index.md
输入参数：`kb=/path/to/not-okf-dir`
操作序列：ls 目录 → Read index.md 失败
预期输出：agent 报错 "<路径> 不是有效的 OKF 知识库目录"，终止流程
**异常路径：链接指向不存在的文档**
前置条件：知识库中存在 Markdown 链接指向已删除的文档
输入参数：`kb=/path/to/kb-with-broken-links`
操作序列：加载文档 → 提取链接 → Read 目标文档失败 → 记录断链警告
预期输出：agent 跳过断链，继续处理其他链接，并在输出中标注"以下链接已失效: ..."




---

**你需要一步步执行以下操作，不可跳过任何步骤。**



## 第一步：执行 Doing Loop

# Doing Loop

> ⚠️ 以下是默认 loop 的执行步骤，也是 gen-loop 需要参考的 skill 模板！！

---

## Step 0：Domain 搜索 + Loop 匹配

**必须依次完成以下两项，再进入 Step 1：**

### 0.1 搜索 Domain（强制）

根据澄清的需求，读取 `/Users/xuning/IdeaProjects/skills/.rick/domain` 下的相关文件，获取足够的事实信息（环境配置、已知问题、接口约束、构建命令等），建立解决问题的基本视角。

- 由 AI 自行判断读取哪些文件，但**必须完成搜索动作**后再继续
- 遇到任何问题（编译报错 / 测试失败 / 行为异常），**必须优先搜索 `/Users/xuning/IdeaProjects/skills/.rick/domain/bugs.md` 和 `/Users/xuning/IdeaProjects/skills/.rick/domain/`**，再做其他尝试

### 0.2 匹配 Loop

在 Domain 搜索完毕后，读取 `loops_context`，按 trigger 字段匹配当前任务/需求：

- **有匹配** → 读取对应 Loop 文件，按其定义步骤执行（不再执行以下 Step 1–5）
- **无匹配** → 按以下 Step 1–5 执行默认 Loop

---

## Step 1：Main Agent 确认全局目标

确认以下内容全部清晰后才继续：

- task.md 中 `# 任务目标` 和 `# 关键结果` 已理解
- 成功标准已明确：测试脚本全通过 + check pass + 所有 Key Results 达成

---

## Step 2：Main Agent 读取上下文（压缩策略）

从 `doing/debug/` 目录读取已有信息，按以下方式压缩后传递给 Sub Agent：

- **bug\*.md** → 从每个文件的 frontmatter `summary` 字段提取摘要，避免重复踩坑
- **跨轮核心事实** → 任务目标 + Key Results 达成状态 + debug/ 摘要 + 当前迭代编号 N

---

## Step 3：启动 Sub Agent 执行工作流

**每轮迭代由 Main Agent 启动一个独立 Sub Agent，携带 Step 2 的上下文，执行完整工作流后返回产出摘要。**

```
[Main Agent]
   │
   ├─ SPAWN Sub Agent（携带：任务目标 + debug/摘要 + 迭代编号 N）
   │     │
   │     │  Sub Agent 执行：
   │     │  [ANALYZE] → [RED] → [GREEN] → [REFACTOR] → [COMMIT]
   │     │                 ↑        │
   │     │                 └──[DEBUG]┘
   │     │
   │     └─ Sub Agent 完成，输出产出摘要
   │
   └─ Main Agent 执行 Step 4 产出评估
```

### Sub Agent：ANALYZE（理解需求）
1. 声明：`"I will use skill:sense."`，按 S→E→N 分析（Symptoms / Evidence / Next）
2. 读取 debug/ 摘要，避免重复踩坑

### Sub Agent：RED（先写失败测试）
1. 声明：`"I will use skill:tdd for implementation."`
2. 针对 `# 测试方法` 中每个场景编写测试
3. 运行测试，**必须确认 FAIL**（证明测试有效，进入 GREEN 的前提）

### Sub Agent：GREEN（最小实现）
1. 编写让测试通过的最小实现代码（不超出 task scope）
2. 通过 → REFACTOR；失败 → DEBUG

### Sub Agent：DEBUG（遇红强制触发）

触发条件（任意一条）：测试 FAIL / 编译报错 / 行为与预期不符

1. **优先搜索 `/Users/xuning/IdeaProjects/skills/.rick/domain/bugs.md` 和 `/Users/xuning/IdeaProjects/skills/.rick/domain/`**，查看是否有精确解决方案
   - 有匹配 → 直接应用，记录引用来源
   - 无匹配 → 继续下方流程
2. 声明：`"I will use skill:debug-skill."`，加载 skill 文件：`/Users/xuning/IdeaProjects/skills/.rick/jobs/job_1/doing/prompts/skill_debug_skill.md`
3. 在 `doing/debug/` 下创建 `bug{N}-{描述}.md`，按 Phase 1-6 执行
4. Phase 4 上限 3 次，达上限后输出当前状态并升级人工协作
5. 修复后回到 GREEN

### Sub Agent：REFACTOR（代码改善）
1. 测试全绿后改善代码质量（命名、结构、去重）
2. 运行全量测试确认无回归；回归失败 → DEBUG

### Sub Agent：COMMIT（收尾提交）
1. `git add` + `git commit`（commit message 含 task ID）
2. 运行 check 命令（使用 prompt 上下文中的 rick_bin_path 和 job_id）：
   - doing 阶段：`<rick_bin_path> tools doing_check <job_id>`
   - easy 阶段：`<rick_bin_path> tools easy_check <job_id>`
3. check 失败 → 修复后重新运行，循环直到 pass
4. **Sub Agent 完成**：输出本轮产出摘要（完成了哪些 KR、遗留了哪些问题），通知 Main Agent 执行 Step 4

---

## Step 4：Main Agent 产出评估

Sub Agent 完成后，Main Agent 逐项检查：

| 检查项 | 判断方法 |
|--------|----------|
| check pass | 读取 doing_check / easy_check 输出，确认 ✅ |
| 测试全通过 | 确认测试脚本无 FAIL 输出 |
| Key Results 达成 | 逐条比对 task.md `# 关键结果` |

- **全部通过** → 进入 Step 5
- **存在失败** → 将失败原因附加到上下文，返回 Step 3 启动下一轮迭代

---

## Step 5：Main Agent 确认停止标准

**成功退出**：check pass + 测试全通过 + 所有 Key Results 达成

**优雅退出**（任意一条触发）：
- 迭代次数达上限（默认 **3 轮**）
- 连续 2 轮产出相同错误（判断无法自动收敛）
- 人类明确要求停止

**退出时**：Main Agent 输出 Loop 执行摘要（完成了哪些 KR、遗留了哪些问题），等待人类决策。





---

## 第二步：格式检查

`rick tools doing_check job_1`

check pass 后才算完成。


