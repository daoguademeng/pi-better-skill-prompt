import { type AgentToolResult, getMarkdownTheme, type Theme, type ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { parseSkillLoad } from "./load.ts";

interface RenderContext {
  isError: boolean;
  keyHint(keybinding: string, description: string): string;
}

export function renderLoadSkillCall(args: { name?: string }, theme: Theme): Component {
  return new Text(`${theme.fg("accent", theme.bold("[skill]"))} ${theme.fg("accent", args.name ?? "")}`, 0, 0);
}

export function renderLoadSkillResult(result: AgentToolResult<unknown>, { expanded }: ToolRenderResultOptions, theme: Theme, context: RenderContext): Component {
  const text = result.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  if (context.isError) return new Text(theme.fg("error", text), 0, 0);

  const { directory, body } = parseSkillLoad(text);
  if (!expanded) {
    const lines = body === "" ? 0 : body.split("\n").length;
    const summary = `${theme.fg("muted", directory)} ${theme.fg("dim", `(${lines} lines, ${context.keyHint("app.tools.expand", "to expand")})`)}`;
    return new Text(summary, 0, 0);
  }
  const view = new Container();
  view.addChild(new Text(theme.fg("muted", directory), 0, 0));
  view.addChild(new Spacer(1));
  view.addChild(new Markdown(body, 0, 0, getMarkdownTheme(), { color: (line) => theme.fg("toolOutput", line) }));
  return view;
}
