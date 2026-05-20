/**
 * DeepSync Command — One-command repo intelligence scanner
 *
 * Orchestrates all existing ContextHub engines to build a complete
 * knowledge graph of the repository in a single pass:
 *   1. Parse all code files → build full knowledge graph
 *   2. Scan all *.md files → store as documentation memories
 *   3. Mine git history → extract patterns and hot files
 *   4. Generate vector embeddings for semantic search
 *   5. Write DEEPSYNC.md report
 *   6. Save a deepsync-complete marker with timestamp
 *
 * After the initial scan, ensure_session auto-patches the graph
 * incrementally on every session start — zero manual effort.
 */

import { ContextHubCore, SecurityManager } from '@imayuur/contexthub-core';
import { RepoParser } from '@imayuur/contexthub-repo-parser';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { GitIntegration } from '@imayuur/contexthub-git-integration';
import { DocsIngester } from '@imayuur/contexthub-docs-ingest';
import { join, relative, basename, extname, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, lstatSync } from 'fs';
import chalk from 'chalk';

interface DeepSyncResult {
  filesAnalyzed: number;
  symbolCount: number;
  nodeCount: number;
  edgeCount: number;
  docsIngested: number;
  commitsAnalyzed: number;
  memoryCount: number;
  durationMs: number;
}

/**
 * Recursively find all markdown files in a directory,
 * skipping common non-user directories.
 */
function findMarkdownFiles(dir: string, repoPath: string, security: SecurityManager): Array<{ path: string; sizeKB: number }> {
  const results: Array<{ path: string; sizeKB: number }> = [];
  const SKIP_DIRS = new Set(['node_modules', '.git', '.contexthub', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv']);

  // Security: ensure dir is within repo boundary
  const resolvedDir = resolve(dir);
  const resolvedRepo = resolve(repoPath);
  if (!resolvedDir.startsWith(resolvedRepo)) {
    return results;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Security: Don't follow symlinks — use lstatSync (not statSync!)
      try {
        const lstats = lstatSync(fullPath);
        if (lstats.isSymbolicLink()) continue;
      } catch { continue; }

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...findMarkdownFiles(fullPath, repoPath, security));
        }
        continue;
      }

      if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        // Security: skip sensitive files (.env.md edge case, etc.)
        if (security.isSensitiveFile(fullPath)) continue;

        try {
          const lstats = lstatSync(fullPath);
          if (lstats.size <= 1024 * 1024) { // Skip files > 1MB
            results.push({
              path: relative(repoPath, fullPath).replace(/\\/g, '/'),
              sizeKB: lstats.size / 1024,
            });
          }
        } catch {}
      }
    }
  } catch {}

  return results;
}

export async function deepsyncCommand(options: { force?: boolean } = {}): Promise<void> {
  const startTime = Date.now();
  const currentDir = process.cwd();
  const contexthubDir = join(currentDir, '.contexthub');

  console.log('');
  console.log(chalk.bold.cyan('🧠 DeepSync') + chalk.dim(' — One scan. Total recall. Forever in context.'));
  console.log('');

  // ── Step 0: Ensure ContextHub is initialized ────────────────────────────
  const core = new ContextHubCore(currentDir);
  const security = new SecurityManager(currentDir);
  await core.initStorage();

  // Check if already synced (unless --force)
  const markerPath = join(contexthubDir, 'deepsync-marker.json');
  if (!options.force && existsSync(markerPath)) {
    try {
      const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
      const ago = Date.now() - (marker.timestamp || 0);
      const agoMin = Math.floor(ago / 60000);
      if (agoMin < 5) {
        console.log(chalk.yellow(`  ⚡ DeepSync was run ${agoMin < 1 ? 'just now' : `${agoMin}m ago`}. Use --force to re-scan.`));
        console.log('');
        return;
      }
    } catch {}
  }

  // ── Step 1: Parse all code files → build knowledge graph ────────────────
  console.log(chalk.blue('  📂 Scanning code files...'));
  const repoParser = new RepoParser(currentDir);
  const graphManager = new CodeGraphManager(currentDir);

  let graph;
  try {
    graph = await graphManager.buildCodeGraph();
  } catch (e: any) {
    // Security: sanitize error messages — don't expose internal paths
    const safeMsg = String(e?.message || 'unknown').replace(/[\\/][^\s]+/g, '[path]');
    console.log(chalk.yellow(`  ⚠️  Graph build warning: ${safeMsg}`));
    graph = { nodes: [], edges: [], updatedAt: Date.now(), version: '1.0.0' };
  }

  const fileNodes = graph.nodes.filter((n: any) => n.kind === 'file');
  const symbolNodes = graph.nodes.filter((n: any) => n.kind === 'symbol');

  // Language breakdown
  const languageBreakdown: Record<string, number> = {};
  for (const node of fileNodes) {
    const lang = (node as any).lang || 'unknown';
    languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1;
  }

  console.log(chalk.green(`  ✅ ${fileNodes.length} files parsed`) + chalk.dim(` (${Object.keys(languageBreakdown).filter(l => l !== 'unknown').join(', ')})`));
  console.log(chalk.green(`  ✅ ${symbolNodes.length} symbols indexed`));
  console.log(chalk.green(`  ✅ ${graph.edges.filter((e: any) => e.kind === 'imports').length} import relationships mapped`));

  // ── Step 2: Scan markdown docs → ingest into vector engine + memory ─────
  console.log(chalk.blue('  📄 Ingesting documentation...'));
  const vectorEngine = new VectorEngine(currentDir);
  let docsIngested = 0;
  const docFiles = findMarkdownFiles(currentDir, currentDir, security);

  try {
    const ingester = new DocsIngester(currentDir, vectorEngine, graphManager);
    docsIngested = await ingester.ingestMarkdown(['**/*.md', '**/*.mdx']);
  } catch (e: any) {
    const safeMsg = String(e?.message || 'unknown').replace(/[\\/][^\s]+/g, '[path]');
    console.log(chalk.yellow(`  ⚠️  Docs ingest warning: ${safeMsg}`));
  }

  // Also store key documentation as memories for agent access
  const keyDocs = docFiles.filter((d) =>
    /^(readme|changelog|contributing|architecture|design|agents|claude)/i.test(basename(d.path))
  );
  for (const doc of keyDocs.slice(0, 10)) {
    try {
      const fullPath = join(currentDir, doc.path);
      // Security: validate path stays within repo boundary
      security.validatePath(fullPath);
      const content = readFileSync(fullPath, 'utf8');
      // Security: redact any sensitive patterns (API keys, passwords) before saving
      const redacted = security.redactSensitive(content.substring(0, 4000));

      await core.saveMemory({
        sessionId: 'deepsync',
        type: 'manual',
        content: `[DeepSync] Documentation: ${doc.path}\n\n${redacted}`,
        timestamp: Date.now(),
        tags: ['deepsync', 'documentation', basename(doc.path, extname(doc.path)).toLowerCase()],
        relatedPaths: [doc.path],
      });
    } catch {}
  }

  console.log(chalk.green(`  ✅ ${docsIngested} documentation files ingested`));

  // ── Step 3: Mine git history ────────────────────────────────────────────
  console.log(chalk.blue('  🔀 Analyzing git history...'));
  let commitsAnalyzed = 0;
  let gitBranch: string | undefined;
  let hotFiles: Array<{ path: string; changes: number }> = [];
  let recentFocusAreas: string[] = [];

  try {
    const gitIntegration = new GitIntegration(core, currentDir);
    const summary = await gitIntegration.getGitSummary();
    gitBranch = summary.currentBranch;
    commitsAnalyzed = summary.recentCommits.length;

    // Save recent commits as memories
    await gitIntegration.processRecentCommits(50);

    // Compute hot files from working directory status
    const statusFiles = [
      ...summary.status.files.modified,
      ...summary.status.files.added,
    ];
    const fileChangeCounts: Record<string, number> = {};
    for (const f of statusFiles) {
      fileChangeCounts[f] = (fileChangeCounts[f] || 0) + 1;
    }
    hotFiles = Object.entries(fileChangeCounts)
      .map(([p, c]) => ({ path: p, changes: c }))
      .sort((a, b) => b.changes - a.changes)
      .slice(0, 10);

    // Extract focus areas from recent commit messages
    const msgWords = summary.recentCommits
      .map((c) => c.message.toLowerCase())
      .join(' ')
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'will', 'been', 'were', 'they',
      'their', 'some', 'when', 'what', 'your', 'more', 'about', 'into', 'also',
      'merge', 'branch', 'commit', 'update', 'updated', 'added', 'removed', 'fixed',
    ]);
    for (const w of msgWords) {
      if (!stopWords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }
    recentFocusAreas = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    console.log(chalk.green(`  ✅ ${commitsAnalyzed} git commits analyzed`) + chalk.dim(` (branch: ${gitBranch})`));
  } catch {
    console.log(chalk.yellow('  ⚠️  Not a git repository — skipping git analysis'));
  }

  // ── Step 4: Generate vector embeddings ──────────────────────────────────
  console.log(chalk.blue('  🔢 Generating vector embeddings...'));
  try {
    const memories = await core.searchMemories({ limit: 500 });
    let embeddingCount = 0;
    for (const mem of memories) {
      try {
        const embedding = await vectorEngine.generateEmbedding(mem.content);
        await vectorEngine.updateEmbedding(`mem_${mem.id}`, embedding);
        embeddingCount++;
      } catch {}
    }
    console.log(chalk.green(`  ✅ ${embeddingCount} vector embeddings generated`));
  } catch (e: any) {
    const safeMsg = String(e?.message || 'unknown').replace(/[\\/][^\s]+/g, '[path]');
    console.log(chalk.yellow(`  ⚠️  Embedding warning: ${safeMsg}`));
  }

  // ── Step 5: Generate knowledge graph snapshot ───────────────────────────
  console.log(chalk.blue('  📸 Creating graph snapshot...'));
  try {
    const snapshotId = await graphManager.createGraphSnapshot();
    if (snapshotId) {
      console.log(chalk.green(`  ✅ Graph snapshot saved`) + chalk.dim(` (${snapshotId})`));
    }
  } catch {}

  // ── Step 6: Write DEEPSYNC.md report ────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const totalMemories = (await core.searchMemories({ limit: 1 })).length || 0;

  console.log(chalk.blue('  📊 Writing DeepSync report...'));
  try {
    const { writeDeepSyncReport } = await import('@imayuur/contexthub-knowledge-graph');
    const reportPath = await writeDeepSyncReport({
      repoPath: currentDir,
      filesAnalyzed: fileNodes.length,
      symbolCount: symbolNodes.length,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      docsIngested,
      commitsAnalyzed,
      memoryCount: totalMemories,
      gitBranch,
      languageBreakdown,
      docFiles,
      hotFiles,
      recentFocusAreas,
      durationMs,
    });
    console.log(chalk.green(`  ✅ Report saved → `) + chalk.underline('.contexthub/DEEPSYNC.md'));
  } catch (e: any) {
    const safeMsg = String(e?.message || 'unknown').replace(/[\\/][^\s]+/g, '[path]');
    console.log(chalk.yellow(`  ⚠️  Report write warning: ${safeMsg}`));
  }

  // ── Step 7: Save marker ─────────────────────────────────────────────────
  const marker = {
    timestamp: Date.now(),
    version: '1.0.0',
    filesAnalyzed: fileNodes.length,
    symbolCount: symbolNodes.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    docsIngested,
    commitsAnalyzed,
    durationMs,
  };
  try {
    writeFileSync(markerPath, JSON.stringify(marker, null, 2), { mode: 0o600 });
    security.setSecurePermissions(markerPath);
  } catch {}

  // ── Done! ───────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.green.bold(`  🧠 Knowledge graph built`) + chalk.dim(` (${graph.nodes.length} nodes, ${graph.edges.length} edges)`));
  console.log(chalk.cyan('  🔄 Auto-sync enabled') + chalk.dim(' — context updates every session automatically'));
  console.log('');
  console.log(chalk.bold.green(`  🧠 DeepSync complete!`) + ' Your AI agent now has total repo awareness.');
  console.log(chalk.dim(`     Completed in ${(durationMs / 1000).toFixed(1)}s`));
  console.log('');
}
