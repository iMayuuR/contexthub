#!/usr/bin/env node
/**
 * Cursor hook: securely persist agent turn summaries via ContextHub core.
 * Fail-open — never block the agent if ContextHub is unavailable.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function pickMessages(input) {
  const prompt =
    input?.prompt ??
    input?.userMessage ??
    input?.user_message ??
    input?.lastUserMessage ??
    '';
  const response =
    input?.response ??
    input?.assistantMessage ??
    input?.assistant_message ??
    input?.lastAssistantMessage ??
    input?.completion ??
    '';
  return { prompt: String(prompt), response: String(response) };
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) process.exit(0);

    const input = JSON.parse(raw);
    const { prompt, response } = pickMessages(input);
    if (!prompt && !response) process.exit(0);

    const repoPath = process.cwd();
    const contexthubDir = join(repoPath, '.contexthub');
    if (!existsSync(contexthubDir)) process.exit(0);

    let coreMod;
    let secMod;
    try {
      coreMod = require('@imayuur/contexthub-core');
    } catch {
      process.exit(0);
    }

    const { ContextHubCore, SecurityManager } = coreMod;
    const security = new SecurityManager(repoPath);
    const core = new ContextHubCore(repoPath);
    await core.initStorage();

    const agent = 'cursor';
    const sessions = await core.getSessions(1);
    let sessionId = sessions[0]?.id;
    if (!sessionId) {
      sessionId = await core.createSession(agent, { source: 'cursor-hook' });
    }

    const save = async (type, content, tags) => {
      let text = security.sanitizeInput(content, 51200);
      if (security.isSensitive(text)) {
        text = security.redactSensitive(text);
      }
      const validType = security.validateMemoryType(type);
      await core.saveMemory({
        sessionId,
        type: validType,
        content: text,
        timestamp: Date.now(),
        tags: tags.slice(0, 20).map((t) => security.sanitizeInput(t, 100)),
      });
    };

    if (prompt.trim()) {
      await save('prompt', prompt.slice(0, 8000), ['prompt', 'cursor', 'hook']);
    }
    if (response.trim()) {
      await save('response', response.slice(0, 8000), ['response', 'cursor', 'hook']);
    }

    await core.close();
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();
