import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityManager } from './security';

export interface ContexthubConfig {
  roots?: string[];
  query?: { rrfK?: number };
  embeddings?: { mode?: 'local' | 'off' | 'transformers' };
  graph?: { maxNodes?: number; reportPath?: string };
  watch?: { debounceMs?: number; maxFilesPerBatch?: number };
  memory?: { maxAgeDays?: number };
}

export function loadConfig(repoPath: string): ContexthubConfig {
  const configPath = path.join(repoPath, 'contexthub.config.js');
  let config: ContexthubConfig = { roots: ['.'] };

  if (fs.existsSync(configPath)) {
    try {
      // Use createRequire to safely load .js file relative to the repoPath
      const requireRel = createRequire(path.join(repoPath, 'index.js'));
      const loaded = requireRel('./contexthub.config.js');
      if (loaded && typeof loaded === 'object') {
        config = { ...config, ...loaded };
      }
    } catch (e) {
      console.error(`Warning: Failed to load config from ${configPath}:`, e);
    }
  }

  // Validate numbers with validateLimit
  const security = new SecurityManager(repoPath);

  if (config.query && typeof config.query.rrfK === 'number') {
    config.query.rrfK = security.validateLimit(config.query.rrfK, 1, 1000);
  }
  if (config.graph && typeof config.graph.maxNodes === 'number') {
    config.graph.maxNodes = security.validateLimit(config.graph.maxNodes, 1, 100000);
  }
  if (config.watch && typeof config.watch.debounceMs === 'number') {
    config.watch.debounceMs = security.validateLimit(config.watch.debounceMs, 100, 60000);
  }
  if (config.watch && typeof config.watch.maxFilesPerBatch === 'number') {
    config.watch.maxFilesPerBatch = security.validateLimit(config.watch.maxFilesPerBatch, 1, 10000);
  }
  if (config.memory && typeof config.memory.maxAgeDays === 'number') {
    config.memory.maxAgeDays = security.validateLimit(config.memory.maxAgeDays, 1, 3650);
  }

  return config;
}
