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

**任务 ID**: task2
**任务名称**: 编写辅助章节：内置 Type 定义兜底、使用示例、常见问题和输出格式规范

### 任务目标
在 task1 完成的 SKILL.md 骨架基础上，使用 Edit 工具将 `<!-- TASK2_FILL: ... -->` 占位锚点替换为实际内容，补充辅助章节：内置 7 种 Type 定义（兜底 type-registry.md 缺失场景）、至少 2 个典型使用场景示例、常见问题 FAQ、结构化输出格式规范（标注来源路径）。如发现 task1 内容有误（如文件路径、流程描述矛盾），允许修正但必须在 SKILL.md 顶部用 HTML 注释标注修改内容和原因。

### 关键结果
1. SKILL.md 包含 `## 内置 Type 定义` 章节，参考 `skills/okf-knowledge-gen/templates/type-registry.md` 作为权威来源。Type 定义表格必须从该模板逐行对应复制（type、含义、适用场景、frontmatter 特有字段四列），不得增删改 Type 名称或字段名；仅允许在"适用场景"列添加面向 reader skill 的额外识别提示。完成后用 `diff` 验证 Type 名称列表与模板一致
2. SKILL.md 包含 `## 使用示例` 章节，至少覆盖"理解项目整体架构"和"追踪某个业务流程"两个场景。示例中标注"以下假设存在 example-kb 知识库，实际使用时替换为你的知识库路径"。示例必须包含具体的用户输入和 agent 预期输出片段（非虚构的完整对话），展示关键步骤（发现→匹配→加载→注入）的实际效果
3. SKILL.md 包含 `## 常见问题` 章节，覆盖：知识库不完整怎么办、链接失效怎么办、如何与 okf-knowledge-gen 配合使用、增量更新导致文档版本不一致怎么办（优先相信 index.md 最新索引，标注文档生成时间戳）
4. SKILL.md 包含 `## 输出格式` 章节，定义结构化注入格式。必须包含一个完整的 Markdown 模板示例，展示每种 type 分组下的输出格式，使用 `<!-- 占位 -->` 标记动态内容位置，确保不同 agent 执行时输出格式一致（按 type 分组、每项标注 `（来源：<文档路径>:<章节>）`）


### 测试方法
**正常路径测试：内置 Type 定义完整性**
前置条件：SKILL.md 已包含内置 Type 定义章节
输入参数：验证七种 Type 均被列出
操作序列：grep 每种 Type 名称（BusinessEntity, BusinessConcept, Service, DataFlow, Infrastructure, ArchitectureDecision, Reference）
预期输出：每种 Type 在章节中均有定义，含含义和识别特征说明
**正常路径测试：使用示例文档完整性**
前置条件：SKILL.md 中 `## 使用示例` 章节已填写
输入参数：SKILL.md 中使用示例章节全文
操作序列：遍历使用示例章节，提取每个示例的要素
预期输出：
**边界用例：内置 Type 与 type-registry.md 冲突**
前置条件：知识库的 type-registry.md 定义了一个额外自定义 Type（如 "CustomComponent"）
输入参数：`kb=/path/to/kb-with-custom-type`
操作序列：Read type-registry.md → 发现自定义 Type → 合并内置 Type + 自定义 Type
预期输出：agent 能识别自定义 Type 的文档，不会因为未知 Type 而报错或跳过
**异常路径：输出格式验证**
前置条件：加载了多个不同 type 的文档
输入参数：验证输出是否按 type 分组
操作序列：检查输出中是否包含 `### BusinessEntity:` `### Service:` 等分组标题
预期输出：输出按 type 分组，每条信息标注 `（来源：<文档路径>:<章节>）`




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


