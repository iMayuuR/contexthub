import * as fs from 'fs';
import * as path from 'path';

export class ContexthubIgnore {
  private rules: RegExp[] = [];

  constructor(private repoPath: string) {
    this.loadIgnoreFiles();
    // Default ignores
    this.rules.push(/^\.git([\\/]|$)/);
    this.rules.push(/^\.contexthub([\\/]|$)/);
    this.rules.push(/^node_modules([\\/]|$)/);
  }

  private loadIgnoreFiles() {
    const filesToTry = ['.contexthubignore', '.gitignore'];
    for (const filename of filesToTry) {
      const filePath = path.join(this.repoPath, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        for (const line of lines) {
          try {
            // Simple conversion of glob to regex
            let regexStr = line
              .replace(/\./g, '\\.')
              .replace(/\*\*/g, '.*')
              .replace(/\*/g, '[^/\\\\]*')
              .replace(/\?/g, '.');
            
            if (line.startsWith('/')) {
              regexStr = '^' + regexStr.substring(1);
            } else if (!line.startsWith('**') && !line.startsWith('.*')) {
              // If it's a file or directory name, it could match anywhere unless specified
              regexStr = '(^|[\\\\/])' + regexStr;
            }

            if (!line.endsWith('/') && !line.endsWith('*')) {
              regexStr = regexStr + '([\\\\/]|$)';
            }

            this.rules.push(new RegExp(regexStr));
          } catch (e) {
            // Ignore invalid regex
          }
        }
      }
    }
  }

  public ignores(targetPath: string): boolean {
    // Normalize path to relative posix path for testing
    let relPath = path.relative(this.repoPath, targetPath);
    // Replace windows separators with posix for consistent regex matching if needed
    // but our regex handles both
    for (const rule of this.rules) {
      if (rule.test(relPath) || rule.test('/' + relPath)) {
        return true;
      }
    }
    return false;
  }
}
