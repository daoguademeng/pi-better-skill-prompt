# pi-better-skill-prompt

[中文](README.zh-CN.md)

A leaner skill prompt for [Pi](https://github.com/earendil-works/pi). Replaces nested XML skill entries with a Markdown table and adds `load_skill` for on-demand loading.

- **Compact catalog:** only skill names and descriptions stay in the system prompt.
- **Progressive disclosure:** the model gets skill paths only when it loads a skill.
- **No repeated metadata:** loading returns the skill directory and full body, without frontmatter containing the name and description.

## Install

```bash
pi install npm:pi-better-skill-prompt
```

Run `/reload` in an existing session. Requires Pi 1.5.0 or later. Tested with Pi 1.5.0.

## How it works

Before (Pi default):

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

After:

```text
<available_skills>

|name|description|
|---|---|
|code-review|Review changes for correctness.|

</available_skills>
```

It calls `load_skill` with `{"name":"code-review"}` to get the skill directory and instructions. Each call reads the current file in full. The TUI shows a collapsible `[skill] code-review` card.

Codemode works too, including `only` mode:

```js
return await tools.load_skill({ name: "code-review" });
```

Manual `/skill:name` commands keep Pi's normal behavior. Skills marked `disable-model-invocation` remain manual-only. Disabling `load_skill` restores Pi's default catalog.

Extensions that replace the entire system prompt can override this catalog.

## License

[MIT](LICENSE)
