import * as fs from 'fs';
import * as path from 'path';
import { SecurityManager, ContexthubIgnore, loadConfig } from '@imayuur/contexthub-core';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { RepoParser } from '@imayuur/contexthub-repo-parser';
import { DocsIngester } from '@imayuur/contexthub-docs-ingest';

export interface WatchOptions {
  debounce?: string;
  noEmbeddings?: boolean;
  quiet?: boolean;
}

export async function watchCommand(targetPath: string = '.', options: WatchOptions = {}): Promise<void> {
  const currentDir = process.cwd();
  const security = new SecurityManager(currentDir);
  const ignore = new ContexthubIgnore(currentDir);
  const config = loadConfig(currentDir);
  const roots = config.roots ?? ['.'];

  // Validate and resolve target path safely
  let resolvedTarget: string;
  try {
    resolvedTarget = security.validatePath(targetPath);
  } catch (error: any) {
    console.error('Error: Path escapes repository boundary.');
    process.exit(1);
  }

  const debounceMs = Number(options.debounce || config.watch?.debounceMs || '3000');
  const noEmbeddings = !!options.noEmbeddings;
  const quiet = !!options.quiet;

  if (isNaN(debounceMs) || debounceMs < 0) {
    console.error('Error: Debounce must be a positive number.');
    process.exit(1);
  }

  if (!quiet) {
    console.log(`Starting ContextHub watch mode on ${path.relative(currentDir, resolvedTarget) || '.'}`);
    console.log(`Debounce: ${debounceMs}ms, Embeddings: ${!noEmbeddings ? 'ON' : 'OFF'}`);
  }

  const graphManager = new CodeGraphManager(currentDir);
  const parser = new RepoParser(currentDir);

  // Build a fresh code graph initially if it doesn't exist
  try {
    await graphManager.loadGraph();
  } catch {
    if (!quiet) console.log('Building initial code graph...');
    await graphManager.buildCodeGraph();
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  const changedFiles = new Set<string>();

  const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.md']);

  const processBatch = async () => {
    if (changedFiles.size === 0) return;

    // Cap files per watch cycle to 100
    const batchFiles = Array.from(changedFiles).slice(0, 100);
    for (const file of batchFiles) {
      changedFiles.delete(file);
    }

    const start = Date.now();
    if (!quiet) {
      console.log(`\nBatching changes for ${batchFiles.length} file(s)...`);
      batchFiles.forEach(f => console.log(`  - ${f}`));
    }

    try {
      // 1. Patch graph
      // Separate markdown files from code files
      const mdFiles = batchFiles.filter(f => f.endsWith('.md'));
      const codeFiles = batchFiles.filter(f => !f.endsWith('.md'));

      // 1. Patch graph for code files
      let graph: any;
      if (codeFiles.length > 0) {
        graph = await graphManager.patchCodeGraph(codeFiles);
      } else {
        graph = await graphManager.loadGraph();
      }

      // 2. Re-ingest markdown files
      if (mdFiles.length > 0) {
        const vectorEngine = new VectorEngine(currentDir);
        const ingester = new DocsIngester(currentDir, vectorEngine, graphManager);
        await ingester.ingestMarkdown(mdFiles);
      }

      // 2. Incremental vector embeddings
      if (!noEmbeddings) {
        const vectorEngine = new VectorEngine(currentDir);
        for (const file of codeFiles) {
          const absPath = path.resolve(currentDir, file);
          if (fs.existsSync(absPath)) {
            const pf = await parser.parseFile(absPath);
            for (const sym of pf.symbols) {
              const symId = `${file}#${sym.name}`;
              await vectorEngine.addEmbeddingForContent(symId, sym.name);
            }
          }
        }
      }

      const duration = Date.now() - start;
      if (!quiet) {
        console.log(`✓ Patched code graph in ${duration}ms`);
        console.log(`  Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
      }
    } catch (e: any) {
      const safeMsg = String(e?.message || 'unknown error').replace(/\/[^\s]+/g, '[path]');
      console.error('Error during code graph patch:', safeMsg);
    }
  };

  // Start native watch
  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(resolvedTarget, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Skip internal folders
      if (
        filename.includes('node_modules') ||
        filename.includes('.contexthub') ||
        filename.includes('.git')
      ) {
        return;
      }

      // Check extension
      const ext = path.extname(filename).toLowerCase();
      if (!allowedExtensions.has(ext)) {
        return;
      }

      // Check if file is sensitive
      const absPath = path.resolve(resolvedTarget, filename);
      if (security.isSensitiveFile(absPath)) {
        return;
      }

      // Validate resolved path
      try {
        security.validatePath(absPath);
      } catch {
        return; // traversal block
      }

      const relPath = path.relative(currentDir, absPath);
      
      // Check if file is within one of the configured roots
      const isInRoots = roots.some(root => {
        const resolvedRoot = path.resolve(currentDir, root);
        const relative = path.relative(resolvedRoot, absPath);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
      });
      if (!isInRoots) {
        return;
      }

      // Apply contexthub ignore rules
      if (ignore.ignores(relPath)) {
        return;
      }

      changedFiles.add(relPath);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processBatch, debounceMs);
    });
  } catch (error: any) {
    const safeMsg = String(error?.message || 'unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('Failed to start native watcher:', safeMsg);
    process.exit(1);
  }

  // Graceful shutdown
  const cleanup = () => {
    if (!quiet) console.log('\nStopping watch mode...');
    watcher.close();
    if (debounceTimer) clearTimeout(debounceTimer);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
