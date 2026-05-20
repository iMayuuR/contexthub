import { ContextHubCore } from '@imayuur/contexthub-core';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import chalk from 'chalk';

export async function benchmarkCommand(): Promise<void> {
  const currentDir = process.cwd();
  console.log(chalk.bold.blue('\nContextHub Benchmark\n'));

  try {
    const core = new ContextHubCore(currentDir);
    await core.initStorage();
    
    // 1. Graph Build
    const graphManager = new CodeGraphManager(currentDir);
    const startGraph = Date.now();
    await graphManager.buildCodeGraph();
    const graphTime = Date.now() - startGraph;
    console.log(`${chalk.cyan('Graph Build:')} ${graphTime}ms`);
    
    // 2. Memory Search
    const startMemSearch = Date.now();
    await core.searchMemories({ limit: 50 });
    const memSearchTime = Date.now() - startMemSearch;
    console.log(`${chalk.cyan('Memory Search (50 limit):')} ${memSearchTime}ms`);
    
    // 3. Vector Embeddings Search
    const vectorEngine = new VectorEngine(currentDir);
    const memories = await core.searchMemories({ limit: 500 });
    const startVector = Date.now();
    await vectorEngine.searchSimilarText('test query', memories, 10);
    const vectorTime = Date.now() - startVector;
    console.log(`${chalk.cyan('Vector Search:')} ${vectorTime}ms`);

    console.log(chalk.green.bold('\nBenchmark complete!\n'));
  } catch (error: any) {
    console.error(chalk.red(`Failed to run benchmark: ${error.message}`));
    process.exit(1);
  }
}
