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

**任务 ID**: task3
**任务名称**: 端到端验证：用真实 OKF 知识库测试技能完整流程

### 任务目标
使用 okf-knowledge-gen 生成的知识库作为测试数据，端到端验证 okf-knowledge-read 技能的完整流程：从加载知识库到结构化注入上下文，覆盖正常路径、边界情况和异常路径。

> ⚠️ 隐含依赖：本 task 需要可用的 OKF 知识库作为测试数据。**必须使用方案 B（手动创建 fixture）**，fixture 路径固定为 `skills/okf-knowledge-read/test-fixture/`，不依赖 okf-knowledge-gen 或外部项目。

### 关键结果
1. 准备测试数据（方案 B）：在 `skills/okf-knowledge-read/test-fixture/` 下手动创建最小但自洽的示例知识库，模拟一个微服务 IM 系统的知识库。**最小文件清单**：
2. `index.md`（含业务领域/服务/数据流/基础设施四个分组，各至少一个条目）
3. `references/type-registry.md`（七种 Type 定义）
4. `domain/entities/user.md`（BusinessEntity，模拟 User 实体，含核心规则、关键属性表、Proto 定义）
5. `domain/entities/message.md`（BusinessEntity，模拟 Message 实体）
6. `services/im-gateway/overview.md`（Service，含端口、核心职责、依赖）
7. `flows/c2c-message-send.md`（DataFlow，含完整 ASCII 链路、各环节职责表、实现断言）
8. `infrastructure/mysql.md`（Infrastructure，含用途、Key/Value 说明）
9. 执行"理解项目整体架构"场景：验证 agent 能列出所有服务、实体和流程
10. 执行"追踪业务流程"场景：验证 agent 能完整追踪一个 DataFlow 的端到端链路
11. 执行"概念搜索"场景：验证 agent 能根据关键词找到相关概念并加载文档
12. 验证链接追踪：确认一跳链接追踪能正确发现关联文档
13. 验证异常处理：至少覆盖以下场景 —— (a) index.md 缺失；(b) 空知识库（index.md 存在但无条目）；(c) type-registry.md 缺失（回退内置定义）；(d) 断链（文件不存在）；(e) 格式损坏（index.md 存在但非 Markdown 或 frontmatter 缺失）
14. 回归检查：所有测试通过后，回读 `skills/okf-knowledge-read/SKILL.md` 全文，确认 Task1 骨架 + Task2 辅助章节无结构损坏、内容矛盾或占位符残留


### 测试方法
**正常路径测试：理解项目整体架构**
前置条件：`skills/okf-knowledge-read/test-fixture/` 已按 KR1 创建完整，包含 index.md、type-registry.md、user.md、message.md、im-gateway/overview.md、c2c-message-send.md、mysql.md
输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下这个项目的架构"
操作序列：agent 加载 skill → 发现知识库（Read index.md + type-registry.md）→ grep index.md 匹配 "im-gateway" "mysql" "c2c-message-send" → 全文 Read services/im-gateway/overview.md → 全文 Read infrastructure/mysql.md → 摘要 Read domain/entities/user.md + message.md → 追踪链接（mysql.md 中是否有指向其他文档的链接）→ 按 type 分组注入
预期输出：
**正常路径测试：追踪业务流程**
前置条件：test-fixture/ 已创建，flows/c2c-message-send.md 存在
输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="c2c-message-send 的完整链路是什么"
操作序列：发现知识库 → grep index.md 匹配 "c2c-message-send" → 全文 Read flows/c2c-message-send.md → 提取链接 → 一跳追踪到 services/im-gateway/overview.md 和 domain/entities/user.md、message.md → 加载关联文档摘要 → 输出完整链路
预期输出：
**正常路径测试：概念搜索**
前置条件：test-fixture/ 已创建，domain/entities/user.md 存在且含关键属性表
输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="User 实体有哪些属性"
操作序列：发现知识库 → grep index.md 匹配 "User" → Read domain/entities/user.md 摘要（frontmatter + 前30行）→ 确认相关后全文加载 → 追踪"相关概念"链接（如 Message）
预期输出：
**边界用例：index.md 缺失**
前置条件：目录存在但无 index.md
输入参数：`kb=/path/to/dir-without-index`
操作序列：ls 目录 → Read index.md 失败
预期输出：agent 报错 "<路径> 不是有效的 OKF 知识库目录：缺少 index.md"，不继续执行后续步骤
**边界用例：空知识库（index.md 存在但无有效概念）**
前置条件：index.md 存在但各分类下无条目
输入参数：`kb=/path/to/empty-kb`
操作序列：Read index.md 成功但无条目 → Read type-registry.md
预期输出：agent 报告"知识库为空，未找到任何概念"，建议运行 okf-knowledge-gen 生成
**异常路径：断链处理**
前置条件：test-fixture/ 中修改一个文档（如 mysql.md），将其"相关概念"章节中的链接改为指向不存在的文件（如 `infrastructure/nonexistent.md`）
输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下项目架构"
操作序列：加载 infrastructure/mysql.md → 提取 Markdown 链接 → Read nonexistent.md 失败 → 记录警告
预期输出：agent 跳过断链继续工作，输出末尾列出失效链接清单（含 `infrastructure/nonexistent.md`）
**异常路径：type-registry.md 缺失——回退内置定义**
前置条件：test-fixture/ 中删除 references/type-registry.md，保留 index.md 和所有业务文档
输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下项目架构"
操作序列：Read index.md 成功 → Read type-registry.md 失败（404）→ 回退使用 SKILL.md 中内置 Type 定义
预期输出：
**异常路径：格式损坏——index.md 缺失或 frontmatter 不符合规范**
前置条件：
(a) `test-fixture/bad/dir-without-index/` 目录存在但不含 index.md
(b) `test-fixture/bad/no-frontmatter/` 目录存在，含 index.md 但第一行不是 `---`
输入参数：`kb=skills/okf-knowledge-read/test-fixture/bad/dir-without-index/`
操作序列：agent 尝试 Read index.md → 失败
预期输出：
(a) 目录无 index.md → 报错"<路径> 不是有效的 OKF 知识库目录：缺少 index.md"，不继续执行后续步骤
(b) frontmatter 缺失 → 报错"<路径> 中的 index.md 不符合 OKF 格式规范"
**Fixture 完整性前置检查**
前置条件：test-fixture/ 已按 KR1 创建
输入参数：`ls skills/okf-knowledge-read/test-fixture/**/*.md`
操作序列：遍历 fixture 目录，验证所有要求的文件存在且 frontmatter 齐全（type, title, description, tags, timestamp 五个字段）
预期输出：7 个文件全部存在（index.md, type-registry.md, user.md, message.md, im-gateway/overview.md, c2c-message-send.md, mysql.md），每个文档 frontmatter 五字段齐全
**回归检查（KR7）**
前置条件：所有测试通过
输入参数：`skills/okf-knowledge-read/SKILL.md`
操作序列：Read SKILL.md 全文 → grep `TASK2_FILL` 占位符 → 检查章节顺序 → 检查无内容矛盾
预期输出：




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


