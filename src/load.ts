import { readFile } from "node:fs/promises";
import { type Skill, stripFrontmatter } from "@earendil-works/pi-coding-agent";

const DIRECTORY_PREFIX = "Directory: ";

/** Reads the skill body fresh from disk and formats the skill load result. */
export async function loadSkill(skills: readonly Skill[], name: string): Promise<string> {
  const skill = skills.find((candidate) => candidate.name === name);
  if (!skill) throw new Error(`Unknown skill: ${name}`);
  let content: string;
  try {
    content = await readFile(skill.filePath, "utf8");
  } catch (error) {
    throw new Error(`Cannot read skill ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return `${DIRECTORY_PREFIX}${skill.baseDir}\n\n${stripFrontmatter(content).trim()}`;
}

/** Splits a skill load result back into its skill directory and skill body. */
export function parseSkillLoad(text: string): { directory: string; body: string } {
  const end = text.indexOf("\n\n");
  return { directory: text.slice(DIRECTORY_PREFIX.length, end), body: text.slice(end + 2) };
}
