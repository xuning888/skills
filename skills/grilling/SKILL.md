---
name: grilling
description: 在任何需要追问用户的时候使用
---

# Skill: Grilling（结构化追问协议）

**对用户的提问需要有目的性, 无意义的提问会增加用户沟通负担, 拉长会话链路，降低交互效率，应当避免。**
**提问前先明确目标: 是为了补全信息、澄清歧义，还是定位问题；不做重复、试探、与当前诉求无关的无效提问**

---

## 核心指令

Interview me relentlessly about every aspect of this plan until we reach a shared understanding.
Model the plan as a design tree. Traverse it layer by layer — at each layer, identify the modules and their pipeline (call relationships), then loop asking questions until the layer meets its termination condition before descending to the next layer.
Ask all questions for the current layer at once. For each question, provide your recommended answer.
If a question can be answered by exploring the codebase, explore the codebase instead of asking.

---

## 设计树模型

结构化追问的设计阶段是一棵**设计树**：

- **每一层**代表一个设计层次，由若干**模块**组成
- **每个模块**是下一层的根节点，向下展开为更细粒度的子模块
- **每一层**可表达为一条由模块间调用关系构成的 **pipeline**（A → B → C → ...）
- **非叶子层**：澄清该层的 pipeline——哪些模块存在、各自职责、相互调用关系
- **叶子层**：将每个模块的决策落实到**可直接执行、无歧义**的若干维度上; 维度由任务的产出类型决定，如编码任务为：关键代码实现（文件路径 + 函数签名）、文件结构（新建/修改哪些文件，
  目录组织）、工具调用（命令 + 参数）、环境依赖 + 配置（依赖项、环境变量、配置文件）

**Grilling 的任务**：逐层遍历设计树，在每一层循环追问，直到该层达标后再下钻，直至整棵树的叶子层全部落实。

> 声明: 我会使用结构化追问协议开展追问工作, 在设计追问方案前我会一步步的思考。

---

## 设计并输出结构化追问方案

> 我已明确现状是 ______ , 期望是 ______ 。
> 经过 ______ 的思考, 我设计了如下的追问树模型, 这样的设计有助于 ________。

```markdown
layer_0:   模块1
            |
layer_1:    | 模块2 ---> 模块3 ----> 模块4
            |
layer_2:    | 模块5 ---> 模块6 ----> 模块7
            |
layer_n:    | 模块n ----> 模块n+1
```

---

## 每层追问流程

```
for each layer (top-down):
    while 当前层未达标:
        1. 识别该层的模块组成和 pipeline（调用关系）
        2. 批量列出当前层所有待澄清问题（含推荐答案）
        3. 等待用户回答
        4. 重新评估当前层终止条件
    descend: 以本层每个模块为根节点，展开下一层
```

---

## 每层终止条件

**非叶子层**达标——该层 pipeline 已完全澄清：
- 所有模块已命名，职责边界清晰，无重叠或遗漏
- 模块间调用关系（pipeline 顺序、接口契约）已确认
- 每个模块的输入/输出已定义，下层可完备支撑上层需求

**叶子层**达标——每个模块的决策已全部落实：
- [ ] 已明确该模块的落实维度
- [ ] 每个维度均得到明确答案，无空白、无歧义、可直接执行

---

## 追问规范

- **每问必附推荐答案**：格式 `推荐：<答案及理由>`，帮助用户快速确认或纠偏
- **只问关键分歧**：只提出会改变方案/调研走向的问题；多个问题若同源，合并为一问；不为凑数提问
- **不得跳层**：当前层未达标前禁止下钻，上层 pipeline 不清晰则下层问题无意义
- **不得假设**：对用户意图有疑问时，追问而非自行填充
- **不得遗漏分支**：每个模块都要展开到叶子层，不留模糊决策
- **优先自行探索**：能通过读代码/读文件/检索资料回答的问题，先探索再提问

---

## 全局终止条件

所有层均达标（叶子层全部维度落实）后，终止追问并声明：

**"Grilling 完成——设计树已遍历完毕，所有模块的决策已在各自维度上全部落实。"**

随后输出结构化决策摘要，按层列出每个模块的关键决策。