import { createRequire } from 'module';
import { existsSync } from 'fs';

const nodeRequire = createRequire(__filename);

/**
 * Resolve the installed @imayuur/contexthub-mcp-server entry (works from npm install / npx).
 */
export function resolveMcpServerEntry(): string {
  let entry: string;
  try {
    entry = nodeRequire.resolve('@imayuur/contexthub-mcp-server');
  } catch {
    throw new Error(
      '@imayuur/contexthub-mcp-server is not installed. Run: npm install @imayuur/contexthub'
    );
  }

  if (!existsSync(entry)) {
    throw new Error(
      '@imayuur/contexthub-mcp-server entry is missing. Try reinstalling @imayuur/contexthub.'
    );
  }

  return entry;
}
