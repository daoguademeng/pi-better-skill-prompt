import type { ExtensionAPI, Skill } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderCatalog } from "./catalog.ts";
import { loadSkill } from "./load.ts";
import { renderLoadSkillCall, renderLoadSkillResult } from "./render.ts";

const TOOL_NAME = "load_skill";

export default function loadSkillExtension(pi: ExtensionAPI): void {
  let modelVisibleSkills: Skill[] = [];

  pi.registerTool({
    name: TOOL_NAME,
    label: "Load Skill",
    description:
      "Load a skill from <available_skills> by name. Returns its directory and instructions; resolve relative paths against that directory.",
    parameters: Type.Object({ name: Type.String({ description: "Skill name" }) }),
    async execute(_toolCallId, params) {
      const text = await loadSkill(modelVisibleSkills, params.name);
      return { content: [{ type: "text", text }], details: undefined };
    },
    renderCall: renderLoadSkillCall,
    renderResult: renderLoadSkillResult,
  });

  pi.on("before_agent_start", (event) => {
    const options = event.systemPromptOptions;
    modelVisibleSkills = options.skills.filter((skill) => !skill.disableModelInvocation);
    if (!options.selectedTools.includes(TOOL_NAME)) return;
    options.skills = [];
    if (modelVisibleSkills.length > 0) options.sections.available_skills = renderCatalog(modelVisibleSkills);
  });
}
