import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { SecurityManager } from '@contexthub/core';

export interface ActiveSessionState {
  sessionId: string;
  agent: string;
  startedAt: number;
  graphSnapshotId?: string;
}

export function activeSessionPath(repoPath: string): string {
  return join(repoPath, '.contexthub', 'active-session.json');
}

export function readActiveSession(repoPath: string): ActiveSessionState | null {
  const path = activeSessionPath(repoPath);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as ActiveSessionState;
    if (data?.sessionId && data?.agent) return data;
  } catch {
    return null;
  }
  return null;
}

export function writeActiveSession(
  repoPath: string,
  state: ActiveSessionState,
  security: SecurityManager
): void {
  const path = activeSessionPath(repoPath);
  writeFileSync(path, JSON.stringify(state, null, 2), { mode: 0o600 });
  security.setSecurePermissions(path);
}

export function clearActiveSession(repoPath: string): void {
  const path = activeSessionPath(repoPath);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}
