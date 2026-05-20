import { getAgentPolicyMarkdown } from './agent-policy';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Helper to get ContextHubCore or DB info if needed
import { ContextHubCore } from '@imayuur/contexthub-core';

export function registerResourcesAndPrompts(server: any) {
  // ── Resources ────────────────────────────────────────────────────────────

  // 1. ContextHub Policy Resource
  server.registerResource(
    'ContextHub Memory Policy',
    'contexthub://policy',
    {
      mimeType: 'text/markdown',
      description: 'The secure auto-memory policy and instructions for agents.'
    },
    async (uri: any) => {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: getAgentPolicyMarkdown()
        }]
      };
    }
  );

  // 2. Code Graph Stats Resource
  server.registerResource(
    'Code Graph Stats',
    'contexthub://graph-stats',
    {
      mimeType: 'application/json',
      description: 'Current size and synchronization statistics of the code graph.'
    },
    async (uri: any) => {
      const repoPath = process.cwd();
      const graphManager = new CodeGraphManager(repoPath);
      const graph = await graphManager.loadGraph().catch(() => null);

      const stats = graph ? {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        updatedAt: graph.updatedAt,
        version: graph.version
      } : { status: 'not_initialized' };

      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    }
  );

  // 3. Graph Report Resource
  server.registerResource(
    'Graph Report',
    'contexthub://report',
    {
      mimeType: 'text/markdown',
      description: 'The full GRAPH_REPORT.md file containing community and god node analytics.'
    },
    async (uri: any) => {
      const reportPath = path.join(process.cwd(), 'GRAPH_REPORT.md');
      let text = '';

      if (fs.existsSync(reportPath)) {
        text = fs.readFileSync(reportPath, 'utf8');
      } else {
        text = '# GRAPH_REPORT.md\nNo report generated yet. Run `update_knowledge_graph` tool or run `contexthub report` in the CLI to generate it.';
      }

      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text
        }]
      };
    }
  );

  // ── Prompts ──────────────────────────────────────────────────────────────

  // 1. Summarize Session Prompt
  server.registerPrompt(
    'summarize-session',
    {
      description: 'Generate a comprehensive summary of an active ContextHub session',
      argsSchema: {
        sessionId: z.string().optional().describe('The UUID of the session to summarize (defaults to most recent)')
      }
    },
    async (args: { sessionId?: string }) => {
      const id = args.sessionId || 'most recent';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please review and summarize the session memories and code architecture updates for session: ${id}. Focus on key design decisions, bug fixes, modified file paths, and general achievements.`
          }
        }]
      };
    }
  );

  // 2. Onboard Repo Prompt
  server.registerPrompt(
    'onboard-repo',
    {
      description: 'Onboard a new agent to the repository by summarizing god nodes, communities, and architecture'
    },
    async () => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please onboard me to this repository. Analyze the god nodes, subdirectories, communities, and external dependencies. Explain the general framework, target languages, and where to start working based on the available knowledge graph.`
          }
        }]
      };
    }
  );

  // 3. Pre-Commit Review Prompt
  server.registerPrompt(
    'pre-commit-review',
    {
      description: 'Execute a pre-commit check analyzing recent git commits and memory session highlights'
    },
    async () => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please perform a pre-commit review of my recent changes. Check for style, architectural alignment with the existing code graph, secure memory compliance, and potential breaking modifications before staging.`
          }
        }]
      };
    }
  );
}
