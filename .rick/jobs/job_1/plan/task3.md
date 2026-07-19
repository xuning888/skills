# 依赖关系

task1, task2

# 产出文件清单

- `skills/okf-knowledge-read/test-fixture/`（测试知识库 fixture 目录，含完整示例文档）
- `skills/okf-knowledge-read/test-results.md`（端到端测试结果记录）

# 任务名称

端到端验证：用真实 OKF 知识库测试技能完整流程

# 任务目标

使用 okf-knowledge-gen 生成的知识库作为测试数据，端到端验证 okf-knowledge-read 技能的完整流程：从加载知识库到结构化注入上下文，覆盖正常路径、边界情况和异常路径。

> ⚠️ 隐含依赖：本 task 需要可用的 OKF 知识库作为测试数据。**必须使用方案 B（手动创建 fixture）**，fixture 路径固定为 `skills/okf-knowledge-read/test-fixture/`，不依赖 okf-knowledge-gen 或外部项目。

# 关键结果

1. 准备测试数据（方案 B）：在 `skills/okf-knowledge-read/test-fixture/` 下手动创建最小但自洽的示例知识库，模拟一个微服务 IM 系统的知识库。**最小文件清单**：
   - `index.md`（含业务领域/服务/数据流/基础设施四个分组，各至少一个条目）
   - `references/type-registry.md`（七种 Type 定义）
   - `domain/entities/user.md`（BusinessEntity，模拟 User 实体，含核心规则、关键属性表、Proto 定义）
   - `domain/entities/message.md`（BusinessEntity，模拟 Message 实体）
   - `services/im-gateway/overview.md`（Service，含端口、核心职责、依赖）
   - `flows/c2c-message-send.md`（DataFlow，含完整 ASCII 链路、各环节职责表、实现断言）
   - `infrastructure/mysql.md`（Infrastructure，含用途、Key/Value 说明）
   每个 fixture 文档必须是真实模拟的完整内容（不能是模板占位符），frontmatter 齐全
2. 执行"理解项目整体架构"场景：验证 agent 能列出所有服务、实体和流程
3. 执行"追踪业务流程"场景：验证 agent 能完整追踪一个 DataFlow 的端到端链路
4. 执行"概念搜索"场景：验证 agent 能根据关键词找到相关概念并加载文档
5. 验证链接追踪：确认一跳链接追踪能正确发现关联文档
6. 验证异常处理：至少覆盖以下场景 —— (a) index.md 缺失；(b) 空知识库（index.md 存在但无条目）；(c) type-registry.md 缺失（回退内置定义）；(d) 断链（文件不存在）；(e) 格式损坏（index.md 存在但非 Markdown 或 frontmatter 缺失）
7. 回归检查：所有测试通过后，回读 `skills/okf-knowledge-read/SKILL.md` 全文，确认 Task1 骨架 + Task2 辅助章节无结构损坏、内容矛盾或占位符残留

# 测试方法

1. **正常路径测试：理解项目整体架构**
   - 前置条件：`skills/okf-knowledge-read/test-fixture/` 已按 KR1 创建完整，包含 index.md、type-registry.md、user.md、message.md、im-gateway/overview.md、c2c-message-send.md、mysql.md
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下这个项目的架构"
   - 操作序列：agent 加载 skill → 发现知识库（Read index.md + type-registry.md）→ grep index.md 匹配 "im-gateway" "mysql" "c2c-message-send" → 全文 Read services/im-gateway/overview.md → 全文 Read infrastructure/mysql.md → 摘要 Read domain/entities/user.md + message.md → 追踪链接（mysql.md 中是否有指向其他文档的链接）→ 按 type 分组注入
   - 预期输出：
     (a) Service 分组：im-gateway（来源：services/im-gateway/overview.md）
     (b) Infrastructure 分组：mysql（来源：infrastructure/mysql.md）
     (c) BusinessEntity 分组：User（来源：domain/entities/user.md）、Message（来源：domain/entities/message.md）
     (d) 所有来源路径指向 test-fixture/ 下真实存在的文件

2. **正常路径测试：追踪业务流程**
   - 前置条件：test-fixture/ 已创建，flows/c2c-message-send.md 存在
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="c2c-message-send 的完整链路是什么"
   - 操作序列：发现知识库 → grep index.md 匹配 "c2c-message-send" → 全文 Read flows/c2c-message-send.md → 提取链接 → 一跳追踪到 services/im-gateway/overview.md 和 domain/entities/user.md、message.md → 加载关联文档摘要 → 输出完整链路
   - 预期输出：
     (a) 包含 flows/c2c-message-send.md 中定义的完整 ASCII 链路图
     (b) 包含各环节职责表中涉及的 im-gateway Service
     (c) 包含关联的 User 和 Message Entity（来源标注路径）
     (d) 每项标注来源路径

3. **正常路径测试：概念搜索**
   - 前置条件：test-fixture/ 已创建，domain/entities/user.md 存在且含关键属性表
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="User 实体有哪些属性"
   - 操作序列：发现知识库 → grep index.md 匹配 "User" → Read domain/entities/user.md 摘要（frontmatter + 前30行）→ 确认相关后全文加载 → 追踪"相关概念"链接（如 Message）
   - 预期输出：
     (a) 输出 User 实体的关键属性表（Proto 字段列表）
     (b) 输出 User 的核心规则
     (c) 列出关联概念（如 Message），标注来源路径

4. **边界用例：index.md 缺失**
   - 前置条件：目录存在但无 index.md
   - 输入参数：`kb=/path/to/dir-without-index`
   - 操作序列：ls 目录 → Read index.md 失败
   - 预期输出：agent 报错 "<路径> 不是有效的 OKF 知识库目录：缺少 index.md"，不继续执行后续步骤

5. **边界用例：空知识库（index.md 存在但无有效概念）**
   - 前置条件：index.md 存在但各分类下无条目
   - 输入参数：`kb=/path/to/empty-kb`
   - 操作序列：Read index.md 成功但无条目 → Read type-registry.md
   - 预期输出：agent 报告"知识库为空，未找到任何概念"，建议运行 okf-knowledge-gen 生成

6. **异常路径：断链处理**
   - 前置条件：test-fixture/ 中修改一个文档（如 mysql.md），将其"相关概念"章节中的链接改为指向不存在的文件（如 `infrastructure/nonexistent.md`）
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下项目架构"
   - 操作序列：加载 infrastructure/mysql.md → 提取 Markdown 链接 → Read nonexistent.md 失败 → 记录警告
   - 预期输出：agent 跳过断链继续工作，输出末尾列出失效链接清单（含 `infrastructure/nonexistent.md`）
7. **异常路径：type-registry.md 缺失——回退内置定义**
   - 前置条件：test-fixture/ 中删除 references/type-registry.md，保留 index.md 和所有业务文档
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/`，用户问题="介绍一下项目架构"
   - 操作序列：Read index.md 成功 → Read type-registry.md 失败（404）→ 回退使用 SKILL.md 中内置 Type 定义
   - 预期输出：
     (a) 不中断流程，继续加载和分组文档
     (b) 输出中 type 分组标题使用内置 Type 名称
     (c) 输出末尾标注"未找到 type-registry.md，已使用内置 Type 定义"
8. **异常路径：格式损坏——index.md 缺失或 frontmatter 不符合规范**
   - 前置条件：
     - (a) `test-fixture/bad/dir-without-index/` 目录存在但不含 index.md
     - (b) `test-fixture/bad/no-frontmatter/` 目录存在，含 index.md 但第一行不是 `---`
   - 输入参数：`kb=skills/okf-knowledge-read/test-fixture/bad/dir-without-index/`
   - 操作序列：agent 尝试 Read index.md → 失败
   - 预期输出：
     - (a) 目录无 index.md → 报错"<路径> 不是有效的 OKF 知识库目录：缺少 index.md"，不继续执行后续步骤
     - (b) frontmatter 缺失 → 报错"<路径> 中的 index.md 不符合 OKF 格式规范"
9. **Fixture 完整性前置检查**
   - 前置条件：test-fixture/ 已按 KR1 创建
   - 输入参数：`ls skills/okf-knowledge-read/test-fixture/**/*.md`
   - 操作序列：遍历 fixture 目录，验证所有要求的文件存在且 frontmatter 齐全（type, title, description, tags, timestamp 五个字段）
   - 预期输出：7 个文件全部存在（index.md, type-registry.md, user.md, message.md, im-gateway/overview.md, c2c-message-send.md, mysql.md），每个文档 frontmatter 五字段齐全
10. **回归检查（KR7）**
    - 前置条件：所有测试通过
    - 输入参数：`skills/okf-knowledge-read/SKILL.md`
    - 操作序列：Read SKILL.md 全文 → grep `TASK2_FILL` 占位符 → 检查章节顺序 → 检查无内容矛盾
    - 预期输出：
      (a) 无 `TASK2_FILL` 或 `<!-- TODO` 占位符残留
      (b) 章节顺序与 Task1 KR6 约定的 8 个章节一致
      (c) 流程描述、Type 定义、使用示例之间的文件路径和概念名无矛盾
