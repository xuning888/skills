# 依赖关系

task1

# 产出文件清单

- `skills/okf-knowledge-read/SKILL.md`（在 task1 基础上填充占位章节，最终完整版）

# 任务名称

编写辅助章节：内置 Type 定义兜底、使用示例、常见问题和输出格式规范

# 任务目标

在 task1 完成的 SKILL.md 骨架基础上，使用 Edit 工具将 `<!-- TASK2_FILL: ... -->` 占位锚点替换为实际内容，补充辅助章节：内置 7 种 Type 定义（兜底 type-registry.md 缺失场景）、至少 2 个典型使用场景示例、常见问题 FAQ、结构化输出格式规范（标注来源路径）。如发现 task1 内容有误（如文件路径、流程描述矛盾），允许修正但必须在 SKILL.md 顶部用 HTML 注释标注修改内容和原因。

# 关键结果

1. SKILL.md 包含 `## 内置 Type 定义` 章节，参考 `skills/okf-knowledge-gen/templates/type-registry.md` 作为权威来源。Type 定义表格必须从该模板逐行对应复制（type、含义、适用场景、frontmatter 特有字段四列），不得增删改 Type 名称或字段名；仅允许在"适用场景"列添加面向 reader skill 的额外识别提示。完成后用 `diff` 验证 Type 名称列表与模板一致
2. SKILL.md 包含 `## 使用示例` 章节，至少覆盖"理解项目整体架构"和"追踪某个业务流程"两个场景。示例中标注"以下假设存在 example-kb 知识库，实际使用时替换为你的知识库路径"。示例必须包含具体的用户输入和 agent 预期输出片段（非虚构的完整对话），展示关键步骤（发现→匹配→加载→注入）的实际效果
3. SKILL.md 包含 `## 常见问题` 章节，覆盖：知识库不完整怎么办、链接失效怎么办、如何与 okf-knowledge-gen 配合使用、增量更新导致文档版本不一致怎么办（优先相信 index.md 最新索引，标注文档生成时间戳）
4. SKILL.md 包含 `## 输出格式` 章节，定义结构化注入格式。必须包含一个完整的 Markdown 模板示例，展示每种 type 分组下的输出格式，使用 `<!-- 占位 -->` 标记动态内容位置，确保不同 agent 执行时输出格式一致（按 type 分组、每项标注 `（来源：<文档路径>:<章节>）`）

# 测试方法

1. **正常路径测试：内置 Type 定义完整性**
   - 前置条件：SKILL.md 已包含内置 Type 定义章节
   - 输入参数：验证七种 Type 均被列出
   - 操作序列：grep 每种 Type 名称（BusinessEntity, BusinessConcept, Service, DataFlow, Infrastructure, ArchitectureDecision, Reference）
   - 预期输出：每种 Type 在章节中均有定义，含含义和识别特征说明

2. **正常路径测试：使用示例文档完整性**
   - 前置条件：SKILL.md 中 `## 使用示例` 章节已填写
   - 输入参数：SKILL.md 中使用示例章节全文
   - 操作序列：遍历使用示例章节，提取每个示例的要素
   - 预期输出：
     (a) 至少包含 2 个示例（"理解项目整体架构"+"追踪某个业务流程"）
     (b) 每个示例包含假设知识库声明（明确标注"以下假设存在 X 知识库"）
     (c) 每个示例包含具体的用户输入文本（非模板占位符）
     (d) 每个示例包含可验证的预期输出片段（含具体 type 名称、文档名、来源标注）

3. **边界用例：内置 Type 与 type-registry.md 冲突**
   - 前置条件：知识库的 type-registry.md 定义了一个额外自定义 Type（如 "CustomComponent"）
   - 输入参数：`kb=/path/to/kb-with-custom-type`
   - 操作序列：Read type-registry.md → 发现自定义 Type → 合并内置 Type + 自定义 Type
   - 预期输出：agent 能识别自定义 Type 的文档，不会因为未知 Type 而报错或跳过

4. **异常路径：输出格式验证**
   - 前置条件：加载了多个不同 type 的文档
   - 输入参数：验证输出是否按 type 分组
   - 操作序列：检查输出中是否包含 `### BusinessEntity:` `### Service:` 等分组标题
   - 预期输出：输出按 type 分组，每条信息标注 `（来源：<文档路径>:<章节>）`
