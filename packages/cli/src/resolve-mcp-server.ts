import { createRequire } from 'module';
import { existsSync } from 'fs';

const nodeRequire = createRequire(__filename);

/**
 * Resolve the installed @contexthub/mcp-server entry (works from npm install / npx).
 */
export function resolveMcpServerEntry(): string {
  let entry: string;
  try {
    entry = nodeRequire.resolve('@contexthub/mcp-server');
  } catch {
    throw new Error(
      '@contexthub/mcp-server is not installed. Run: npm install @contexthub/cli'
    );
  }

  if (!existsSync(entry)) {
    throw new Error(
      '@contexthub/mcp-server entry is missing. Try reinstalling @contexthub/cli.'
    );
  }

  return entry;
}
