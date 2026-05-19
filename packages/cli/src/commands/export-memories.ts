import { ContextHubCore } from '@contexthub/core';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';

function askPassphrase(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter passphrase to encrypt the memory export: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function exportMemoriesCommand(options: { out?: string; passphrase?: string }): Promise<void> {
  const currentDir = process.cwd();
  console.log(chalk.bold.blue('\nContextHub Export Memories\n'));

  const outPath = options.out || 'bundle.chub';
  const resolvedOutPath = path.resolve(outPath);

  try {
    const contexthubDir = path.join(currentDir, '.contexthub');
    if (!fs.existsSync(contexthubDir)) {
      console.error(chalk.red('ContextHub is not initialized in this repository.'));
      process.exit(1);
    }

    let passphrase = options.passphrase || process.env.CONTEXTHUB_EXPORT_PASSPHRASE;
    if (!passphrase) {
      passphrase = await askPassphrase();
    }

    if (!passphrase || passphrase.length < 4) {
      console.error(chalk.red('Passphrase must be at least 4 characters long.'));
      process.exit(1);
    }

    // 1. Get memories
    const core = new ContextHubCore(currentDir);
    await core.initStorage();
    const memories = await core.searchMemories({ limit: 100000 });
    await core.close();

    console.log(`Extracting ${memories.length} memories...`);

    // 2. Encrypt
    const plaintext = JSON.stringify(memories);
    
    // Derive key using Scrypt
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(passphrase, salt, 32); // 32 bytes key for AES-256
    
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    
    const authTag = cipher.getAuthTag();

    // Bundle structure: salt (16B) + iv (12B) + authTag (16B) + ciphertext
    const bundle = Buffer.concat([salt, iv, authTag, ciphertext]);

    // 3. Write to file
    const parentDir = path.dirname(resolvedOutPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(resolvedOutPath, bundle);
    console.log(chalk.green.bold(`✓ Successfully exported memories to: ${resolvedOutPath}\n`));
  } catch (error: any) {
    console.error(chalk.red(`Failed to export memories: ${error.message}`));
    process.exit(1);
  }
}
