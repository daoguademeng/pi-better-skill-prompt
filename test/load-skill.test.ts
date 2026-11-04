import { afterEach, describe, expect, it } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Harness, type SessionOptions, skillFile, startSession } from "./harness.ts";

let harness: Harness | undefined;

async function start(options: SessionOptions): Promise<Harness> {
  harness = await startSession(options);
  return harness;
}

afterEach(() => {
  harness?.dispose();
  harness = undefined;
});

describe("skill catalog", () => {
  it("replaces Pi's skills section with a name/description table of model-visible skills", async () => {
    const h = await start({
      tools: ["read", "load_skill"],
      skills: [
        { name: "alpha", description: "Alpha does things", body: "# Alpha" },
        { name: "beta", description: "Beta does other things", body: "# Beta" },
        { name: "manual", description: "Manual invocation only", body: "# Manual", disableModelInvocation: true },
      ],
    });

    await h.prompt();

    const prompt = h.lastSystemPrompt();
    expect(prompt).toContain("<available_skills>\n\nLoad a skill by name with `load_skill` when its description matches the task.\n\n|name|description|\n|---|---|\n|alpha|Alpha does things|\n|beta|Beta does other things|\n\n</available_skills>");
    expect(prompt.match(/<available_skills>/g)).toHaveLength(1);
    expect(prompt).not.toContain("<skills>");
    expect(prompt).not.toContain(h.skillsDir);
    expect(prompt).not.toContain("manual");
  });

  it("keeps each skill on one table row when its description contains pipes or line breaks", async () => {
    const h = await start({
      tools: ["load_skill"],
      skills: [{ name: "tricky", description: "a|b\nc\r\nd", body: "# Tricky" }],
    });

    await h.prompt();

    expect(h.lastSystemPrompt()).toContain("|---|---|\n|tricky|a\\|b c d|\n\n</available_skills>");
  });

  it("is omitted when no skill is model-visible", async () => {
    const h = await start({
      tools: ["read", "load_skill"],
      skills: [{ name: "manual", description: "Manual invocation only", body: "# Manual", disableModelInvocation: true }],
    });

    await h.prompt();

    const prompt = h.lastSystemPrompt();
    expect(prompt).not.toContain("available_skills");
    expect(prompt).not.toContain("<skills>");
  });

  it("leaves Pi's skills section in place when load_skill is not active", async () => {
    const h = await start({
      tools: ["read"],
      skills: [{ name: "alpha", description: "Alpha does things", body: "# Alpha" }],
    });

    await h.prompt();

    const prompt = h.lastSystemPrompt();
    expect(prompt).toContain("<skills>");
    expect(prompt).toContain(`<location>${h.skillsDir}/alpha/SKILL.md</location>`);
    expect(prompt).not.toContain("|name|description|");
  });
});

describe("load_skill", () => {
  const longBody = ["# Alpha", "", "Read [the guide](references/guide.md).", ...Array.from({ length: 3000 }, (_, i) => `- step ${i}`)].join("\n");

  it("returns the skill directory and the complete skill body without frontmatter", async () => {
    const h = await start({
      tools: ["load_skill"],
      skills: [{ name: "alpha", description: "Alpha does things", body: longBody }],
    });

    const [result] = await h.callTools([{ name: "load_skill", arguments: { name: "alpha" } }]);

    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: "text", text: `Directory: ${h.skillsDir}/alpha\n\n${longBody}` }]);
  });

  it("reads the skill body from disk on every skill load", async () => {
    const skill = { name: "alpha", description: "Alpha does things", body: "# Alpha v1" };
    const h = await start({ tools: ["load_skill"], skills: [skill] });
    const load = { name: "load_skill", arguments: { name: "alpha" } };

    await h.callTools([load]);
    writeFileSync(join(h.skillsDir, "alpha", "SKILL.md"), skillFile({ ...skill, body: "# Alpha v2" }));
    const [result] = await h.callTools([load]);

    expect(result.content).toEqual([{ type: "text", text: `Directory: ${h.skillsDir}/alpha\n\n# Alpha v2` }]);
  });

  it("fails for names that are not model-visible skills", async () => {
    const h = await start({
      tools: ["load_skill"],
      skills: [
        { name: "alpha", description: "Alpha does things", body: "# Alpha" },
        { name: "manual", description: "Manual invocation only", body: "# Manual", disableModelInvocation: true },
      ],
    });

    const results = await h.callTools([
      { name: "load_skill", arguments: { name: "manual" } },
      { name: "load_skill", arguments: { name: "Alpha" } },
    ]);

    expect(results.map((result) => [result.isError, result.content])).toEqual([
      [true, [{ type: "text", text: "Unknown skill: manual" }]],
      [true, [{ type: "text", text: "Unknown skill: Alpha" }]],
    ]);
  });

  it("fails with the system error when SKILL.md cannot be read", async () => {
    const h = await start({
      tools: ["load_skill"],
      skills: [{ name: "alpha", description: "Alpha does things", body: "# Alpha" }],
    });
    const file = join(h.skillsDir, "alpha", "SKILL.md");

    rmSync(file);
    const systemError = await readFile(file).catch((error: Error) => error.message);
    const [result] = await h.callTools([{ name: "load_skill", arguments: { name: "alpha" } }]);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: `Cannot read skill alpha: ${systemError}` }]);
  });

  it("resolves to the same string from a codemode script while the catalog stays in the prompt", async () => {
    const h = await start({
      tools: ["codemode", "load_skill"],
      codemode: "only",
      skills: [{ name: "alpha", description: "Alpha does things", body: "# Alpha" }],
    });

    const [result] = await h.callTools([
      { name: "codemode", arguments: { code: 'return JSON.stringify(await tools.load_skill({ name: "alpha" }));' } },
    ]);

    expect(h.lastSystemPrompt()).toContain("|alpha|Alpha does things|");
    expect(result.isError).toBe(false);
    expect(result.content).toContainEqual({
      type: "text",
      text: expect.stringContaining(JSON.stringify(`Directory: ${h.skillsDir}/alpha\n\n# Alpha`)),
    });
  });
});
