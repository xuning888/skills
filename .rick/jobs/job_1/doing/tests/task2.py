#!/usr/bin/env python3
"""Task2 测试脚本：验证 SKILL.md 辅助章节（内置 Type 定义、使用示例、常见问题、输出格式）是否已正确填写。

测试方法：
  - 正常路径：内置 Type 定义完整性（7 种 Type 均列出且有含义说明）
  - 正常路径：使用示例文档完整性（≥2 个典型使用场景）
  - 边界用例：内置 Type 与 type-registry.md 冲突处理文档化
  - 异常路径：输出格式规范完整性（分组标题、来源标注）
"""
import json
import sys
import os
import re


def main():
    errors = []

    # 计算项目根目录
    # 脚本路径: <root>/.rick/jobs/job_1/doing/tests/task2.py
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = script_dir
    for _ in range(5):
        project_root = os.path.dirname(project_root)

    skill_md_path = os.path.join(project_root, 'skills', 'okf-knowledge-read', 'SKILL.md')

    # 前置条件：验证 SKILL.md 存在
    if not os.path.exists(skill_md_path):
        errors.append(f'SKILL.md 文件不存在: {skill_md_path}')
        result = {'pass': False, 'errors': errors}
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    try:
        with open(skill_md_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        errors.append(f'无法读取 SKILL.md: {str(e)}')
        result = {'pass': False, 'errors': errors}
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    # =========================================================================
    # Test 1: 正常路径 — TASK2_FILL 占位符已全部替换
    # =========================================================================
    task2_fill_pattern = r'<!--\s*TASK2_FILL:'
    task2_fill_matches = re.findall(task2_fill_pattern, content)
    if task2_fill_matches:
        errors.append(
            f'TASK2_FILL 占位符未被完全替换：发现 {len(task2_fill_matches)} 个未替换的占位符。'
            f'请将"内置 Type 定义""使用示例""常见问题""输出格式"四个章节的占位符替换为实际内容'
        )

    # =========================================================================
    # Test 2: 正常路径 — 内置 Type 定义完整性
    # 前置条件：SKILL.md 已包含"内置 Type 定义"章节
    # 操作序列：grep 每种 Type 名称
    # 预期输出：每种 Type 在章节中均有定义，含含义和识别特征说明
    # =========================================================================
    builtin_types = [
        'BusinessEntity',
        'BusinessConcept',
        'Service',
        'DataFlow',
        'Infrastructure',
        'ArchitectureDecision',
        'Reference',
    ]

    builtin_section_match = re.search(
        r'##\s+内置\s*Type\s*定义\s*\n(.*?)(?=^##\s|\Z)',
        content,
        re.MULTILINE | re.DOTALL,
    )

    if not builtin_section_match:
        errors.append('未找到"## 内置 Type 定义"章节（期望该章节作为二级标题存在）')
    else:
        builtin_section = builtin_section_match.group(1)

        for type_name in builtin_types:
            if type_name not in builtin_section:
                errors.append(
                    f'内置 Type 定义章节中缺少 "{type_name}" 的定义'
                )
            else:
                # 验证 Type 有含义和识别特征说明（其后至少有一段中文描述）
                type_pos = builtin_section.find(type_name)
                after_type = builtin_section[type_pos + len(type_name):]
                # 取 Type 名称后的 300 字符作为描述范围
                context_after = after_type[:300]
                # 检查是否包含中文描述（含义说明 + 识别特征）
                chinese_chars = re.findall(r'[一-鿿]', context_after)
                if len(chinese_chars) < 10:
                    errors.append(
                        f'"{type_name}" 缺少含义和识别特征说明（Type 名称后中文描述不足）'
                    )

    # =========================================================================
    # Test 3: 正常路径 — 使用示例文档完整性
    # 前置条件：SKILL.md 中"## 使用示例"章节已填写
    # 操作序列：遍历使用示例章节，提取每个示例的要素
    # 预期输出：至少包含 2 个典型使用场景示例，每个示例有明确的前置条件和预期行为
    # =========================================================================
    usage_section_match = re.search(
        r'##\s+使用示例\s*\n(.*?)(?=^##\s|\Z)',
        content,
        re.MULTILINE | re.DOTALL,
    )

    if not usage_section_match:
        errors.append('未找到"## 使用示例"章节')
    else:
        usage_section = usage_section_match.group(1).strip()

        if not usage_section or len(usage_section) < 80:
            errors.append(
                '"使用示例"章节内容过短或为空（期望至少包含 2 个典型使用场景，建议每个场景包含场景描述和操作步骤）'
            )
        else:
            # 统计示例数量（通过子标题 ### 或数字编号 1. 2. 或 **场景** 等标记）
            example_markers = re.findall(
                r'(?:^###\s|^\d+[\.\)]\s\*\*|^\*\*场景\s*\d+|^####\s)',
                usage_section,
                re.MULTILINE,
            )
            if len(example_markers) < 2:
                errors.append(
                    f'"使用示例"章节示例数量不足（期望 ≥2 个，实际检测到 {len(example_markers)} 个标记）'
                )

    # =========================================================================
    # Test 4: 边界用例 — 内置 Type 与 type-registry.md 冲突处理
    # 前置条件：知识库的 type-registry.md 定义了额外的自定义 Type
    # 预期输出：SKILL.md 文档说明了自定义 Type 的处理方式（合并而非报错/跳过）
    # =========================================================================
    # 检查 SKILL.md 中是否提及了 type-registry.md 的自定义 Type 处理策略
    type_registry_mentions = re.findall(
        r'(?:type-registry|自定义\s*Type|额外.*Type|合并.*Type|回退.*内置)',
        content,
        re.IGNORECASE,
    )
    # 至少需要在"内置 Type 定义"章节或 Step 1 中提到回退/合并策略
    if not type_registry_mentions:
        errors.append(
            'SKILL.md 未说明 type-registry.md 自定义 Type 与内置 Type 的合并/回退策略'
        )
    else:
        # 进一步检查是否明确描述了"不会因未知 Type 报错或跳过"
        has_error_handling = re.search(
            r'(?:不.*报错|不.*跳过|合并.*自定义|回退.*内置|兜底)',
            content,
            re.IGNORECASE,
        )
        if not has_error_handling:
            errors.append(
                'SKILL.md 未明确说明：当 type-registry.md 包含自定义 Type 时，'
                'agent 不会因未知 Type 而报错或跳过文档（缺少自定义 Type 兜底处理说明）'
            )

    # =========================================================================
    # Test 5: 异常路径 — 输出格式验证
    # 前置条件：SKILL.md 包含"输出格式"章节
    # 操作序列：检查输出格式是否描述了按 Type 分组、来源标注
    # 预期输出：输出按 type 分组，包含 `### BusinessEntity:` `### Service:` 等分组标题，
    #           每条信息标注 `（来源：<文档路径>:<章节>）`
    # =========================================================================
    output_section_match = re.search(
        r'##\s+输出格式\s*\n(.*?)(?=^##\s|\Z)',
        content,
        re.MULTILINE | re.DOTALL,
    )

    if not output_section_match:
        errors.append('未找到"## 输出格式"章节')
    else:
        output_section = output_section_match.group(1).strip()

        if not output_section or len(output_section) < 80:
            errors.append(
                '"输出格式"章节内容过短或为空'
                '（期望包含：按 Type 分组规范、分组标题格式、来源标注格式）'
            )
        else:
            # 检查是否包含分组标题格式（如 `### BusinessEntity:`）
            group_titles_found = []
            for t in builtin_types:
                pattern = rf'###\s+{t}[:\s]'
                if re.search(pattern, output_section):
                    group_titles_found.append(t)

            if len(group_titles_found) < 7:
                missing = [t for t in builtin_types if t not in group_titles_found]
                errors.append(
                    f'"输出格式"章节缺少以下 Type 分组标题示例：{", ".join(missing)}'
                    f'（期望包含所有 7 种 Type 的 `### TypeName:` 格式说明）'
                )

            # 检查是否包含来源标注格式
            source_pattern = r'来源\s*[：:]\s*.*路径|来源\s*[：:]\s*<.*文档'
            if not re.search(source_pattern, output_section):
                errors.append(
                    '"输出格式"章节未说明来源标注格式'
                    '（期望每条信息标注 `（来源：<文档路径>:<章节>）`）'
                )

    # =========================================================================
    # 构建并输出结果 JSON
    # =========================================================================
    result = {
        'pass': len(errors) == 0,
        'errors': errors,
    }

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result['pass'] else 1)


if __name__ == '__main__':
    main()
