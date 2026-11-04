# pi-better-skill-prompt

[English](README.md)

让 [Pi](https://github.com/earendil-works/pi) 的技能提示词更精简：用 Markdown 表格替代嵌套 XML 技能条目，通过 `load_skill` 按需加载。

- **精简目录**：常驻提示词只保留技能名称和描述。
- **渐进式披露**：加载技能时才返回路径，不提前占用上下文。
- **不重复元数据**：加载结果只有技能目录和完整正文，去掉包含名称、描述的 frontmatter。

## 安装

```bash
pi install npm:pi-better-skill-prompt
```

已有会话执行 `/reload`。需要 Pi 1.5.0 或更高版本，已在 Pi 1.5.0 验证。

## 工作方式

原版 Pi：

```text
<skills>
The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
Resolve relative paths against the skill's directory (parent of SKILL.md). Use absolute paths in tool calls.

<available_skills>
  <skill>
    <name>code-review</name>
    <description>Review changes for correctness.</description>
    <location>/path/to/skills/code-review/SKILL.md</location>
  </skill>
</available_skills>
</skills>
```

启用后：

```text
<available_skills>

|name|description|
|---|---|
|code-review|Review changes for correctness.|

</available_skills>
```

模型以 `{"name":"code-review"}` 调用 `load_skill`，获取技能目录和指令。每次调用都重新读取完整文件。TUI 显示可折叠的 `[skill] code-review` 卡片。

也支持 codemode，包括 `only` 模式：

```js
return await tools.load_skill({ name: "code-review" });
```

手动 `/skill:name` 调用保持 Pi 原样。标记 `disable-model-invocation` 的技能仍仅限手动调用。停用 `load_skill` 后恢复 Pi 默认目录。

直接替换整个 system prompt 的其他扩展可能覆盖此目录。

## 许可证

[MIT](LICENSE)
