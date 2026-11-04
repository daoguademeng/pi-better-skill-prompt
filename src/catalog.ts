import type { Skill } from "@earendil-works/pi-coding-agent";

function cell(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ").replace(/\|/g, "\\|");
}

/** Body of the `available_skills` prompt section; Pi wraps it in the section's tags. */
export function renderCatalog(skills: readonly Skill[]): string {
  const rows = skills.map((skill) => `|${cell(skill.name)}|${cell(skill.description)}|`);
  return ["", "Load a skill by name with `load_skill` when its description matches the task.", "", "|name|description|", "|---|---|", ...rows, ""].join("\n");
}
