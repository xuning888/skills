# 依赖关系

（无依赖）

# 产出文件清单

- `skills/okf-knowledge-read/SKILL.md`（骨架，含占位锚点）

# 任务名称

创建 okf-knowledge-read 技能目录结构和 SKILL.md 骨架及核心流程指令

# 任务目标

在 `skills/okf-knowledge-read/` 下创建技能目录，编写 SKILL.md 的主干内容：frontmatter 元数据、触发条件、前置准备、运行参数说明，以及核心 5 步 Pipeline 指令（发现知识库 → 匹配概念 → 加载文档 → 追踪链接 → 注入上下文）。

# 关键结果

1. `skills/okf-knowledge-read/SKILL.md` 文件存在，frontmatter 包含 `name: okf-knowledge-read` 和 `description`，description 明确列出至少 3 种触发场景（格式参考 `skills/okf-knowledge-gen/SKILL.md` 第 10-14 行的"什么时候用"写法，每条以"- "开头带粗体关键词，如"- 新项目需要了解架构"、"- 追踪某个业务流程的完整链路"、"- 查找特定领域概念的定义和关联"）
2. SKILL.md 包含完整的 5 步核心流程指令，每步必须明确：(a) 工具名称（Read/Bash(grep)/ls/mkdir）和具体参数模式；(b) 决策阈值（如关键词匹配数≥1即为候选，否则回退到 ls 遍历目录）；(c) 失败回退策略（如 grep 无结果时回退到 ls 遍历、Read 失败时尝试相对路径变体）
3. 技能声明输入参数 `kb`（知识库路径），含两级路径验证：(a) `ls <kb>` 目录存在；(b) `Read <kb>/index.md` 文件存在且内容非空——任一步失败立即终止并报错"<路径> 不是有效的 OKF 知识库目录"
4. 核心流程覆盖：发现（index.md + type-registry.md 加载，index.md 格式参考 `skills/okf-knowledge-gen/templates/index.md` 的六分组结构）、匹配（关键词 grep → 语义精筛）、加载（摘要优先 → 全文，文档章节结构参考 `skills/okf-knowledge-gen/templates/` 下各类型模板，优先提取 frontmatter + 核心章节如关键属性、核心职责和依赖、完整链路和环节职责表）、追踪（一跳链接）、注入（按 type 分组输出）
5. 技能包含明确的**处理范围声明**，基于 `skills/okf-knowledge-gen/SKILL.md` 中定义的目录结构：纳入处理（index.md、type-registry.md、domain/entities/、domain/concepts/、services/、flows/、infrastructure/、decisions/、references/）；不纳入处理（plan.json、log.md、.work/ 等生成阶段内部文件），避免 agent 读取无关文件浪费 token
6. SKILL.md 包含以下明确的章节锚点（按固定顺序），其中辅助章节使用 HTML 注释作为 Task2 的 Edit 替换目标：
   - `## 什么时候用`（即触发条件）
   - `## 前置准备`
   - `## 运行`（含 `kb` 参数说明）
   - `## 核心流程`（5 步 Pipeline：发现 → 匹配 → 加载 → 追踪 → 注入）
   - `## 内置 Type 定义` → 内容写 `<!-- TASK2_FILL: 内置 Type 定义 -->`
   - `## 使用示例` → 内容写 `<!-- TASK2_FILL: 使用示例 -->`
   - `## 常见问题` → 内容写 `<!-- TASK2_FILL: 常见问题 -->`
   - `## 输出格式` → 内容写 `<!-- TASK2_FILL: 输出格式 -->`

# 测试方法

1. **正常路径测试**
   - 前置条件：存在一个有效的 OKF 知识库目录，结构如下：
     - index.md（含四个分组条目）
     - references/type-registry.md
     - domain/entities/ 下至少 2 个 Entity 文档
     - services/ 下至少 1 个 Service 文档
     - flows/ 下至少 1 个 DataFlow 文档
   - 输入参数：`kb=/path/to/valid-knowledge-catalog`，用户问题="介绍一下这个项目的架构"
   - 操作序列：agent 加载 skill → Read index.md → Read type-registry.md → grep index.md 匹配关键词 → 按匹配结果 Read 文档摘要 → 判断相关性后全文加载 → 追踪链接 → 按 type 分组注入
   - 预期输出：
     (a) 列出 index.md 中所有分组的条目名称
     (b) 每个条目附带 type 标签和来源路径（`来源：<文档路径>`）
     (c) 按 type 分组（`### BusinessEntity:` / `### Service:` / `### DataFlow:` / `### Infrastructure:`）

2. **边界用例：知识库缺少 type-registry.md**
   - 前置条件：知识库目录存在，index.md 存在，但 `references/type-registry.md` 不存在
   - 输入参数：`kb=/path/to/kb-without-type-registry`，用户问题="介绍一下项目架构"
   - 操作序列：Read index.md 成功 → Read type-registry.md 失败（404）→ agent 回退到内置 Type 定义 → 继续加载文档
   - 预期输出：
     (a) 不中断流程，继续加载和分组文档
     (b) 输出中仍包含 type 分组标题（`### BusinessEntity:` 等），使用内置 Type 名称
     (c) 输出末尾标注"未找到 type-registry.md，已使用内置 Type 定义"

3. **边界用例：index.md 不存在（非法知识库）**
   - 前置条件：目录存在但不包含 index.md
   - 输入参数：`kb=/path/to/not-okf-dir`
   - 操作序列：ls 目录 → Read index.md 失败
   - 预期输出：agent 报错 "<路径> 不是有效的 OKF 知识库目录"，终止流程

4. **异常路径：链接指向不存在的文档**
   - 前置条件：知识库中存在 Markdown 链接指向已删除的文档
   - 输入参数：`kb=/path/to/kb-with-broken-links`
   - 操作序列：加载文档 → 提取链接 → Read 目标文档失败 → 记录断链警告
   - 预期输出：agent 跳过断链，继续处理其他链接，并在输出中标注"以下链接已失效: ..."
