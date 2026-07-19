#!/usr/bin/env python3
"""Task 1 测试脚本：验证 okf-knowledge-read 技能目录结构和 SKILL.md 骨架

TDD RED 阶段：该目录尚未创建，测试预期失败。
"""
import json
import sys
import os


def main():
    errors = []

    # 获取项目根目录（测试脚本位于 .rick/jobs/job_1/doing/tests/ 下）
    # __file__ = .../.rick/jobs/job_1/doing/tests/task1.py，向上 6 层到项目根
    project_root = os.path.dirname(
        os.path.dirname(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(
                        os.path.dirname(os.path.abspath(__file__))
                    )
                )
            )
        )
    )

    skill_dir = os.path.join(project_root, "skills", "okf-knowledge-read")
    skill_md = os.path.join(skill_dir, "SKILL.md")

    # ============================================================
    # Test 1: 目录存在性
    # 前置条件：无（技能目录尚未创建）
    # 输入参数：skill_dir = skills/okf-knowledge-read/
    # 操作序列：os.path.isdir() 检查
    # 预期输出：目录存在
    # ============================================================
    if not os.path.isdir(skill_dir):
        errors.append(
            "skills/okf-knowledge-read/ 目录不存在"
        )

    # ============================================================
    # Test 2: SKILL.md 文件存在性
    # 前置条件：目录存在
    # 输入参数：skill_md = skills/okf-knowledge-read/SKILL.md
    # 操作序列：os.path.isfile() 检查
    # 预期输出：文件存在
    # ============================================================
    if not os.path.isfile(skill_md):
        errors.append(
            "skills/okf-knowledge-read/SKILL.md 文件不存在"
        )
    else:
        # 只有文件存在时才读取内容做进一步检查
        try:
            with open(skill_md, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            errors.append(f"无法读取 SKILL.md: {str(e)}")
            content = ""

        # ============================================================
        # Test 3: Frontmatter 元数据
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查 YAML frontmatter 是否包含 name 和 description
        # 预期输出：包含 name: okf-knowledge-read 和 description
        # ============================================================
        if not content.startswith("---"):
            errors.append(
                "SKILL.md 缺少 YAML frontmatter（应以 '---' 开头）"
            )
        else:
            # 提取 frontmatter
            second_delim = content.find("---", 3)
            if second_delim == -1:
                errors.append(
                    "SKILL.md frontmatter 格式错误：缺少结束的 '---'"
                )
            else:
                frontmatter = content[3:second_delim].strip()
                fm_lines = [line.strip() for line in frontmatter.split("\n")]

                has_name = any(
                    line.startswith("name:") and "okf-knowledge-read" in line
                    for line in fm_lines
                )
                if not has_name:
                    errors.append(
                        "SKILL.md frontmatter 缺少 name: okf-knowledge-read"
                    )

                has_description = any(
                    line.startswith("description:") for line in fm_lines
                )
                if not has_description:
                    errors.append(
                        "SKILL.md frontmatter 缺少 description"
                    )

        # ============================================================
        # Test 4: 触发条件（什么时候用）
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否包含触发条件/使用场景章节
        # 预期输出：包含"什么时候用"或"触发条件"章节
        # ============================================================
        has_trigger = (
            "## 什么时候用" in content
            or "## 触发条件" in content
            or "## 何时使用" in content
        )
        if not has_trigger:
            errors.append(
                "SKILL.md 缺少触发条件章节（## 什么时候用 / ## 触发条件 / ## 何时使用）"
            )

        # ============================================================
        # Test 5: 前置准备
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否包含前置准备章节
        # 预期输出：包含"前置准备"或"准备工作"章节
        # ============================================================
        has_preparation = (
            "## 前置准备" in content
            or "## 准备工作" in content
        )
        if not has_preparation:
            errors.append(
                "SKILL.md 缺少前置准备章节（## 前置准备 / ## 准备工作）"
            )

        # ============================================================
        # Test 6: 运行参数说明
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否包含运行参数/配置参数章节
        # 预期输出：包含参数说明表格或配置参数章节
        # ============================================================
        has_params = (
            "## 运行" in content
            or "## 配置参数" in content
            or "## 运行参数" in content
        )
        if not has_params:
            errors.append(
                "SKILL.md 缺少运行参数章节（## 运行 / ## 配置参数 / ## 运行参数）"
            )

        # ============================================================
        # Test 7: 核心 5 步 Pipeline 指令
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查 5 个 Pipeline 步骤
        # 预期输出：
        #   1. 发现知识库
        #   2. 匹配概念
        #   3. 加载文档
        #   4. 追踪链接
        #   5. 注入上下文
        # ============================================================
        pipeline_steps = [
            ("发现知识库", ["发现知识库", "Discover"]),
            ("匹配概念", ["匹配概念", "Match"]),
            ("加载文档", ["加载文档", "Load"]),
            ("追踪链接", ["追踪链接", "Trace"]),
            ("注入上下文", ["注入上下文", "Inject"]),
        ]

        missing_steps = []
        for step_name, keywords in pipeline_steps:
            found = any(kw in content for kw in keywords)
            if not found:
                missing_steps.append(step_name)

        if missing_steps:
            errors.append(
                f"SKILL.md 缺少以下 Pipeline 步骤: {', '.join(missing_steps)}"
                f"（需要: 发现知识库 → 匹配概念 → 加载文档 → 追踪链接 → 注入上下文）"
            )

        # ============================================================
        # Test 8: 边界用例处理 —— 缺少 type-registry.md
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否说明 type-registry.md 缺失时的回退策略
        # 预期输出：文档提到回退到内置 Type 定义
        # ============================================================
        has_type_fallback = (
            "type-registry" in content
            or "type_registry" in content
            or "type registry" in content.lower()
            or "内置" in content
        )
        if not has_type_fallback:
            errors.append(
                "SKILL.md 缺少 type-registry 相关说明（需包含缺失时的回退策略）"
            )

        # ============================================================
        # Test 9: 边界用例处理 —— 非法知识库（无 index.md）
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否说明 index.md 不存在时的错误处理
        # 预期输出：文档提到对无效知识库目录的报错处理
        # ============================================================
        has_invalid_kb_handling = (
            "不是有效的" in content
            or "非法" in content
            or "无效" in content
            or "报错" in content
        )
        if not has_invalid_kb_handling:
            errors.append(
                "SKILL.md 缺少非法知识库目录的错误处理说明"
            )

        # ============================================================
        # Test 10: 异常路径 —— 断链处理
        # 前置条件：SKILL.md 存在且可读
        # 输入参数：文件内容
        # 操作序列：检查是否说明断链的处理策略
        # 预期输出：文档提到跳过断链并标注失效链接
        # ============================================================
        has_broken_link_handling = (
            "断链" in content
            or "失效" in content
            or "链接已失效" in content
            or "broken" in content.lower()
        )
        if not has_broken_link_handling:
            errors.append(
                "SKILL.md 缺少断链/失效链接的处理说明"
            )

    # ============================================================
    # 构建结果 JSON
    # ============================================================
    result = {
        "pass": len(errors) == 0,
        "errors": errors,
    }

    # 输出 JSON 到 stdout（CRITICAL: 只有这一行）
    print(json.dumps(result, ensure_ascii=False))

    # 退出码
    sys.exit(0 if result["pass"] else 1)


if __name__ == "__main__":
    main()
