#!/usr/bin/env python3
"""task3 端到端验证测试：okf-knowledge-read 技能完整流程测试

覆盖：正常路径、边界情况、异常路径、Fixture 完整性、回归检查(KR7)
"""
from __future__ import annotations
import json
import sys
import os
import re


def main():
    errors = []

    # 获取项目根目录（测试脚本在 .rick/jobs/job_1/doing/tests/ 下，向上5级到项目根）
    project_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..')
    )
    fixture_root = os.path.join(project_root, 'skills', 'okf-knowledge-read', 'test-fixture')
    skill_md_path = os.path.join(project_root, 'skills', 'okf-knowledge-read', 'SKILL.md')

    # ─────────────────────────────────────────────────────────────
    # Fixture 完整性前置检查
    # ─────────────────────────────────────────────────────────────
    required_files = [
        'index.md',
        'references/type-registry.md',
        'domain/entities/user.md',
        'domain/entities/message.md',
        'services/im-gateway/overview.md',
        'flows/c2c-message-send.md',
        'infrastructure/mysql.md',
    ]

    required_frontmatter_fields = ['type', 'title', 'description', 'tags', 'timestamp']

    for rel_path in required_files:
        full_path = os.path.join(fixture_root, rel_path)
        if not os.path.exists(full_path):
            errors.append(f'Fixture 完整性：缺少文件 {rel_path}')
            continue

        # 检查 frontmatter 五字段齐全
        try:
            with open(full_path, 'r') as f:
                content = f.read()
        except Exception as e:
            errors.append(f'Fixture 完整性：无法读取 {rel_path}: {e}')
            continue

        # 提取 frontmatter
        fm = extract_frontmatter(content)
        if fm is None:
            errors.append(f'Fixture 完整性：{rel_path} 缺少有效的 frontmatter（---...---）')
        else:
            for field in required_frontmatter_fields:
                if field not in fm:
                    errors.append(f'Fixture 完整性：{rel_path} frontmatter 缺少字段 "{field}"')

    # ─────────────────────────────────────────────────────────────
    # 正常路径测试：理解项目整体架构
    # ─────────────────────────────────────────────────────────────
    index_path = os.path.join(fixture_root, 'index.md')
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r') as f:
                index_content = f.read()
        except Exception as e:
            errors.append(f'正常路径-架构：无法读取 index.md: {e}')
        else:
            # 检查六分组结构
            expected_groups = [
                '# 业务领域',
                '# 服务',
                '# 消息 / 数据流',
                '# 基础设施',
                '# 架构决策',
                '# 引用',
            ]
            for group in expected_groups:
                if group not in index_content:
                    errors.append(f'正常路径-架构：index.md 缺少分组 "{group}"')

            # 检查条目指向的文件存在性
            entries = re.findall(r'\[([^\]]+)\]\(([^)]+\.md)\)', index_content)
            for name, link_path in entries:
                # 跳过模板注释
                if '<!--' in name or '<!--' in link_path:
                    continue
                link_full = os.path.join(fixture_root, link_path)
                if 'decisions/' in link_path:
                    # 架构决策组允许为空（测试 fixture 中没有决策文档）
                    continue
                if not os.path.exists(link_full):
                    errors.append(f'正常路径-架构：index.md 中引用的文件不存在: {link_path}')

            # 检查 type-registry.md
            type_registry_path = os.path.join(fixture_root, 'references', 'type-registry.md')
            if os.path.exists(type_registry_path):
                try:
                    with open(type_registry_path, 'r') as f:
                        tr_content = f.read()
                    # 应包含 7 种 Type 定义
                    expected_types = [
                        'BusinessEntity',
                        'BusinessConcept',
                        'Service',
                        'DataFlow',
                        'Infrastructure',
                        'ArchitectureDecision',
                        'Reference',
                    ]
                    for t in expected_types:
                        if t not in tr_content:
                            errors.append(f'正常路径-架构：type-registry.md 缺少 Type 定义 "{t}"')
                except Exception as e:
                    errors.append(f'正常路径-架构：无法读取 type-registry.md: {e}')

    # ─────────────────────────────────────────────────────────────
    # 正常路径测试：追踪业务流程
    # ─────────────────────────────────────────────────────────────
    flow_path = os.path.join(fixture_root, 'flows', 'c2c-message-send.md')
    if os.path.exists(flow_path):
        try:
            with open(flow_path, 'r') as f:
                flow_content = f.read()
        except Exception as e:
            errors.append(f'正常路径-流程：无法读取 c2c-message-send.md: {e}')
        else:
            # 检查 DataFlow type
            fm = extract_frontmatter(flow_content)
            if fm and fm.get('type') != 'DataFlow':
                errors.append(f'正常路径-流程：c2c-message-send.md type 应为 DataFlow，实际为 {fm.get("type")}')

            # 检查必须章节
            if '## 完整链路' not in flow_content:
                errors.append(f'正常路径-流程：c2c-message-send.md 缺少"## 完整链路"章节')
            if '## 各环节职责' not in flow_content:
                errors.append(f'正常路径-流程：c2c-message-send.md 缺少"## 各环节职责"章节')

            # 检查链接到相关文档
            links = re.findall(r'\[([^\]]+)\]\(([^)]+\.md)\)', flow_content)
            linked_files = [l[1] for l in links]
            # 流程文档应至少引用一个服务或实体文档
            if not linked_files:
                errors.append(f'正常路径-流程：c2c-message-send.md 没有引用任何相关文档')

    # ─────────────────────────────────────────────────────────────
    # 正常路径测试：概念搜索
    # ─────────────────────────────────────────────────────────────
    user_path = os.path.join(fixture_root, 'domain', 'entities', 'user.md')
    if os.path.exists(user_path):
        try:
            with open(user_path, 'r') as f:
                user_content = f.read()
        except Exception as e:
            errors.append(f'正常路径-概念：无法读取 user.md: {e}')
        else:
            fm = extract_frontmatter(user_content)
            if fm and fm.get('type') != 'BusinessEntity':
                errors.append(f'正常路径-概念：user.md type 应为 BusinessEntity，实际为 {fm.get("type")}')

            if '## 关键属性' not in user_content:
                errors.append(f'正常路径-概念：user.md 缺少"## 关键属性"章节')

            # 检查关键属性表
            if '| 属性 | 类型 | 说明 |' not in user_content:
                errors.append(f'正常路径-概念：user.md "关键属性"章节缺少属性表')

            # 检查"相关概念"链接
            if '## 相关概念' not in user_content:
                errors.append(f'正常路径-概念：user.md 缺少"## 相关概念"章节')

    # ─────────────────────────────────────────────────────────────
    # 边界用例：index.md 缺失
    # ─────────────────────────────────────────────────────────────
    bad_no_index = os.path.join(fixture_root, 'bad', 'dir-without-index')
    if not os.path.isdir(bad_no_index):
        errors.append('边界-index缺失：bad/dir-without-index/ 目录不存在')
    else:
        no_index_md = os.path.join(bad_no_index, 'index.md')
        if os.path.exists(no_index_md):
            errors.append('边界-index缺失：bad/dir-without-index/ 应不含 index.md，但文件存在')
        # 目录内应有内容（即使是空的），确保 agent 能访问它
        # 此处只验证目录可被正常列出
        try:
            contents = os.listdir(bad_no_index)
            # 目录可以为空或仅有非 index.md 文件
        except Exception as e:
            errors.append(f'边界-index缺失：无法列出 bad/dir-without-index/ 内容: {e}')

    # ─────────────────────────────────────────────────────────────
    # 边界用例：空知识库（index.md 存在但无有效概念）
    # ─────────────────────────────────────────────────────────────
    empty_kb_index = os.path.join(fixture_root, 'empty-kb', 'index.md')
    if not os.path.exists(empty_kb_index):
        errors.append('边界-空知识库：empty-kb/index.md 不存在')
    else:
        try:
            with open(empty_kb_index, 'r') as f:
                empty_content = f.read()
        except Exception as e:
            errors.append(f'边界-空知识库：无法读取 empty-kb/index.md: {e}')
        else:
            # 应包含六分组标题，但没有 Markdown 链接条目
            has_groups = all(
                g in empty_content
                for g in ['# 业务领域', '# 服务', '# 消息 / 数据流', '# 基础设施', '# 架构决策', '# 引用']
            )
            if not has_groups:
                errors.append('边界-空知识库：empty-kb/index.md 应包含全部六个分组标题')

            # 检查无 Markdown 链接条目
            entries = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', empty_content)
            if entries:
                errors.append(f'边界-空知识库：empty-kb/index.md 不应包含任何条目，但发现了 {len(entries)} 个')

    # ─────────────────────────────────────────────────────────────
    # 异常路径：断链处理
    # ─────────────────────────────────────────────────────────────
    broken_mysql = os.path.join(fixture_root, 'broken-link-variant', 'infrastructure', 'mysql.md')
    if not os.path.exists(broken_mysql):
        errors.append('异常-断链：broken-link-variant/infrastructure/mysql.md 不存在')
    else:
        try:
            with open(broken_mysql, 'r') as f:
                broken_content = f.read()
        except Exception as e:
            errors.append(f'异常-断链：无法读取 broken-link-variant/infrastructure/mysql.md: {e}')
        else:
            # 检查包含指向不存在文件的链接
            broken_links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', broken_content)
            found_broken = False
            nonexistent_refs = []
            for name, link in broken_links:
                if link.endswith('.md'):
                    # 检查链接目标是否存在
                    # 链接对 infrastructure/nonexistent.md → 相对于 mysql.md 所在目录即 infrastructure/
                    link_dir = os.path.dirname(broken_mysql)
                    link_full = os.path.normpath(os.path.join(link_dir, link))
                    if not os.path.exists(link_full):
                        found_broken = True
                        nonexistent_refs.append(link)
            if not found_broken:
                errors.append('异常-断链：broken-link-variant 的 mysql.md 应包含指向不存在文件的断链')

    # ─────────────────────────────────────────────────────────────
    # 异常路径：type-registry.md 缺失——回退内置定义
    # ─────────────────────────────────────────────────────────────
    no_tr_dir = os.path.join(fixture_root, 'no-type-registry')
    if not os.path.isdir(no_tr_dir):
        errors.append('异常-type-registry缺失：no-type-registry/ 目录不存在')
    else:
        no_tr_index = os.path.join(no_tr_dir, 'index.md')
        if not os.path.exists(no_tr_index):
            errors.append('异常-type-registry缺失：no-type-registry/index.md 不存在')

        tr_path = os.path.join(no_tr_dir, 'references', 'type-registry.md')
        if os.path.exists(tr_path):
            errors.append('异常-type-registry缺失：no-type-registry/ 应不含 type-registry.md，但文件存在')

    # ─────────────────────────────────────────────────────────────
    # 异常路径：格式损坏——frontmatter 不符合规范
    # ─────────────────────────────────────────────────────────────
    # (a) 目录无 index.md → 已在"边界用例：index.md 缺失"中覆盖

    # (b) frontmatter 缺失（index.md 第一行不是 ---）
    bad_fm_index = os.path.join(fixture_root, 'bad', 'no-frontmatter', 'index.md')
    if not os.path.exists(bad_fm_index):
        errors.append('异常-格式损坏：bad/no-frontmatter/index.md 不存在')
    else:
        try:
            with open(bad_fm_index, 'r') as f:
                first_line = f.readline().strip()
        except Exception as e:
            errors.append(f'异常-格式损坏：无法读取 bad/no-frontmatter/index.md: {e}')
        else:
            if first_line == '---':
                errors.append('异常-格式损坏：bad/no-frontmatter/index.md 第一行应该是 ---（表示有 frontmatter），但预期它不应该有有效 frontmatter')

    # ─────────────────────────────────────────────────────────────
    # 回归检查（KR7）
    # ─────────────────────────────────────────────────────────────
    if not os.path.exists(skill_md_path):
        errors.append(f'回归检查-KR7：SKILL.md 不存在于 {skill_md_path}')
    else:
        try:
            with open(skill_md_path, 'r') as f:
                skill_content = f.read()
        except Exception as e:
            errors.append(f'回归检查-KR7：无法读取 SKILL.md: {e}')
        else:
            # 检查 TASK2_FILL 占位符
            if 'TASK2_FILL' in skill_content:
                errors.append('回归检查-KR7：SKILL.md 中仍存在 TASK2_FILL 占位符，task2 未完成填充')

            # 检查章节顺序（核心流程的 5 个步骤应按顺序出现）
            steps_order = [
                'Step 1：发现知识库',
                'Step 2：匹配概念',
                'Step 3：加载文档',
                'Step 4：追踪链接',
                'Step 5：注入上下文',
            ]
            positions = {}
            for step in steps_order:
                pos = skill_content.find(step)
                if pos == -1:
                    errors.append(f'回归检查-KR7：SKILL.md 缺少章节 "{step}"')
                else:
                    positions[step] = pos

            # 验证步骤按顺序出现
            sorted_steps = sorted(positions.items(), key=lambda x: x[1])
            for i, (step, _) in enumerate(sorted_steps):
                if step != steps_order[i]:
                    errors.append(
                        f'回归检查-KR7：SKILL.md 章节顺序错误，期望 "{steps_order[i]}" 但先出现 "{step}"'
                    )
                    break

            # 检查无内容矛盾（例如：内置 Type 定义与 SKILL.md 描述一致）
            # 检查内置 Type 定义表是否包含 7 种类型
            if '| BusinessEntity |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 BusinessEntity')
            if '| BusinessConcept |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 BusinessConcept')
            if '| Service |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 Service')
            if '| DataFlow |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 DataFlow')
            if '| Infrastructure |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 Infrastructure')
            if '| ArchitectureDecision |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 ArchitectureDecision')
            if '| Reference |' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 内置 Type 定义表缺少 Reference')

            # 检查输出格式中的分组顺序
            output_section = skill_content[skill_content.find('## 输出格式'):] if '## 输出格式' in skill_content else ''
            output_groups_order = [
                'BusinessEntity',
                'BusinessConcept',
                'Service',
                'DataFlow',
                'Infrastructure',
                'ArchitectureDecision',
                'Reference',
            ]
            output_positions = {}
            for group in output_groups_order:
                marker = f'### {group}:'
                pos = output_section.find(marker)
                if pos != -1:
                    output_positions[group] = pos

            sorted_output = sorted(output_positions.items(), key=lambda x: x[1])
            for i, (group, _) in enumerate(sorted_output):
                if group != output_groups_order[i]:
                    errors.append(
                        f'回归检查-KR7：输出格式分组顺序错误，期望 "{output_groups_order[i]}" 但先出现 "{group}"'
                    )
                    break

            # 检查文档版本不一致的说明存在（4.3 节处理策略）
            if '版本不一致' not in skill_content:
                errors.append('回归检查-KR7：SKILL.md 缺少"版本不一致"处理说明（FAQ 第4节）')

    # ─────────────────────────────────────────────────────────────
    # 构建结果
    # ─────────────────────────────────────────────────────────────
    result = {
        'pass': len(errors) == 0,
        'errors': errors,
    }

    # 输出 JSON（CRITICAL: 只有这一行输出到 stdout）
    print(json.dumps(result, ensure_ascii=False))

    # 使用合适的退出码
    sys.exit(0 if result['pass'] else 1)


def extract_frontmatter(content: str) -> dict | None:
    """从 Markdown 内容中提取 frontmatter 字段。

    返回 dict 包含 frontmatter 中所有 key-value 对，如果无有效 frontmatter 返回 None。
    """
    # frontmatter 必须以 --- 开头
    if not content.startswith('---'):
        return None

    # 找到结束的 ---
    end_idx = content.find('---', 3)
    if end_idx == -1:
        return None

    fm_text = content[3:end_idx].strip()
    if not fm_text:
        return None

    result = {}
    for line in fm_text.split('\n'):
        line = line.strip()
        if ':' in line:
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip()
            result[key] = value

    return result if result else None


if __name__ == '__main__':
    main()
