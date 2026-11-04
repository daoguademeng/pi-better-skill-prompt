import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type FauxResponseStep, fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt, type Message, type ToolResultMessage } from "@earendil-works/pi-ai";
import { createAgentSession, createCodemodeExtension, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import loadSkillExtension from "../src/index.ts";

export interface SkillFixture {
  name: string;
  description: string;
  body: string;
  disableModelInvocation?: boolean;
}

export interface SessionOptions {
  skills: SkillFixture[];
  tools: string[];
  codemode?: "on" | "only";
}

export interface ToolCallSpec {
  name: string;
  arguments: Parameters<typeof fauxToolCall>[1];
}

export interface Harness {
  skillsDir: string;
  /** System prompt the provider received on its latest request. */
  lastSystemPrompt(): string;
  /** Runs one prompt whose assistant turn makes `calls`, and returns the tool results the provider then receives. */
  callTools(calls: ToolCallSpec[]): Promise<ToolResultMessage[]>;
  /** Runs one prompt answered with plain text. */
  prompt(): Promise<void>;
  dispose(): void;
}

export function skillFile(fixture: SkillFixture): string {
  const frontmatter = ["---", `name: ${fixture.name}`, `description: ${JSON.stringify(fixture.description)}`, ...(fixture.disableModelInvocation ? ["disable-model-invocation: true"] : []), "---"];
  return `${frontmatter.join("\n")}\n\n${fixture.body}\n`;
}

export async function startSession(options: SessionOptions): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), "pi-skill-loader-"));
  const cwd = join(root, "project");
  const agentDir = join(root, "agent");
  const skillsDir = join(agentDir, "skills");
  mkdirSync(cwd, { recursive: true });
  for (const fixture of options.skills) {
    const dir = join(skillsDir, fixture.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillFile(fixture));
  }

  const faux = fauxProvider();
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
  });
  modelRuntime.registerNativeProvider(faux.provider);

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    ...(options.codemode ? { codemode: { mode: options.codemode } } : {}),
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noContextFiles: true,
    extensionFactories: [loadSkillExtension, ...(options.codemode ? [createCodemodeExtension()] : [])],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model: faux.getModel(),
    modelRuntime,
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    tools: options.tools,
  });
  await session.bindExtensions({});

  let systemPrompt: string | undefined;
  let toolResults: ToolResultMessage[] = [];
  const record =
    (reply: (messages: Message[]) => ReturnType<typeof fauxAssistantMessage>): FauxResponseStep =>
    (context) => {
      systemPrompt = getCurrentSystemPrompt(context.messages);
      return reply(context.messages);
    };

  const finalReply = record((messages) => {
    const start = messages.findLastIndex((message) => message.role === "assistant");
    toolResults = messages.slice(start + 1).filter((message): message is ToolResultMessage => message.role === "toolResult");
    return fauxAssistantMessage("done");
  });

  return {
    skillsDir,
    lastSystemPrompt() {
      if (systemPrompt === undefined) throw new Error("provider received no request");
      return systemPrompt;
    },
    async callTools(calls) {
      faux.setResponses([
        record(() =>
          fauxAssistantMessage(
            calls.map((call) => fauxToolCall(call.name, call.arguments)),
            { stopReason: "toolUse" },
          ),
        ),
        finalReply,
      ]);
      toolResults = [];
      await session.prompt("go");
      return toolResults;
    },
    async prompt() {
      faux.setResponses([finalReply]);
      await session.prompt("go");
    },
    dispose() {
      session.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
