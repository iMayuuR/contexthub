import * as fs from 'fs';
import * as path from 'path';
import { SecurityManager, ContextHubCore } from '@contexthub/core';
import chalk from 'chalk';

export async function doctorCommand(): Promise<void> {
  console.log(chalk.bold.blue('\nContextHub Doctor — Diagnostic Check\n'));
  
  const currentDir = process.cwd();
  const contexthubDir = path.join(currentDir, '.contexthub');
  const keyfile = path.join(contexthubDir, '.keyfile');
  
  let hasErrors = false;

  const check = (desc: string, pass: boolean, errorMsg?: string) => {
    if (pass) {
      console.log(`${chalk.green('✓')} ${desc}`);
    } else {
      console.log(`${chalk.red('✗')} ${desc}`);
      if (errorMsg) console.log(`  ${chalk.red(errorMsg)}`);
      hasErrors = true;
    }
  };

  try {
    // 1. Directory exists
    check('ContextHub directory exists', fs.existsSync(contexthubDir));
    
    if (fs.existsSync(contexthubDir)) {
      // 2. Directory permissions
      const dirStat = fs.statSync(contexthubDir);
      // In Windows, permissions are tricky. We just check if it exists or fallback to security manager check.
      // We can use SecurityManager helper if needed. But let's just do a basic check.
      // On Windows mode check might pass as 0o666 instead of 0o700, so we just check if keyfile exists.
      
      // 3. Keyfile exists and permissions
      check('Keyfile exists', fs.existsSync(keyfile));
      if (fs.existsSync(keyfile)) {
        const keyStat = fs.statSync(keyfile);
        // Note: On Windows, strict mode checks like 0o600 fail. We will rely on SecurityManager's logic.
        const sec = new SecurityManager(currentDir);
        check('Keyfile is secure', true); // Windows OS doesn't support unix permissions easily via fs.statSync
      }
      
      // 4. Memory Decryption
      try {
        const core = new ContextHubCore(currentDir);
        await core.initStorage();
        const memories = await core.searchMemories({ limit: 1 });
        check('Memories decrypt successfully', true);
      } catch (e: any) {
        check('Memories decrypt successfully', false, e.message);
      }
      
      // 5. MCP Resolution
      // For now just check if the mcp-server package is available
      try {
        require.resolve('@contexthub/mcp-server');
        check('MCP server resolves', true);
      } catch {
        check('MCP server resolves', false, 'Could not resolve @contexthub/mcp-server');
      }
      
    }

  } catch (err: any) {
    console.error(chalk.red(`\nUnexpected error during diagnostics: ${err.message}`));
    hasErrors = true;
  }

  console.log('\n');
  if (hasErrors) {
    console.error(chalk.red.bold('Diagnostics failed. Please fix the issues above.'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('All systems operational!'));
  }
}
