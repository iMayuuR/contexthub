import type { ParsedFile, Symbol, ImportExport } from '@contexthub/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export class RepoParser {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'c++':
        return 'cpp';
      case 'c':
      case 'h':
      case 'hpp':
        return 'c';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'rb':
        return 'ruby';
      case 'php':
        return 'php';
      case 'cs':
        return 'csharp';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'scala':
        return 'scala';
      case 'vue':
      case 'svelte':
        return 'framework';
      default:
        return 'unknown';
    }
  }

  /**
   * Simple JS/TS parser for extracting symbols, imports, exports
   */
  private parseJSTS(content: string): { symbols: Symbol[]; imports: ImportExport[]; exports: ImportExport[] } {
    const symbols: Symbol[] = [];
    const imports: ImportExport[] = [];
    const exports: ImportExport[] = [];

    const lines = content.split('\n');

    // Patterns for TypeScript/JavaScript
    const patterns = {
      functionDecl: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      classDecl: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      constDecl: /^(?:export\s+)?const\s+(\w+)\s*=/,
      letDecl: /^(?:export\s+)?let\s+(\w+)\s*=/,
      interfaceDecl: /^interface\s+(\w+)/,
      typeDecl: /^type\s+(\w+)/,
      enumDecl: /^enum\s+(\w+)/,
      importDefault: /^import\s+(\w+)\s+from\s+['"](.+?)['"]/,
      importNamed: /^import\s+{([^}]+)}\s+from\s+['"](.+?)['"]/,
      importAll: /^import\s+\*\s+as\s+(\w+)\s+from\s+['"](.+?)['"]/,
      exportDefault: /^export\s+default\s+/,
      exportNamed: /^export\s+(?:const|let|function|class|interface|type|enum)\s+(\w+)/
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Functions
      const funcMatch = trimmed.match(patterns.functionDecl);
      if (funcMatch) {
        symbols.push({ type: 'function', name: funcMatch[1], lineNumber, columnNumber: 0 });
      }

      // Classes
      const classMatch = trimmed.match(patterns.classDecl);
      if (classMatch) {
        symbols.push({ type: 'class', name: classMatch[1], lineNumber, columnNumber: 0 });
      }

      // Constants/Variables
      const constMatch = trimmed.match(patterns.constDecl);
      if (constMatch) {
        symbols.push({ type: 'variable', name: constMatch[1], lineNumber, columnNumber: 0 });
      }

      const letMatch = trimmed.match(patterns.letDecl);
      if (letMatch) {
        symbols.push({ type: 'variable', name: letMatch[1], lineNumber, columnNumber: 0 });
      }

      // Interfaces
      const ifaceMatch = trimmed.match(patterns.interfaceDecl);
      if (ifaceMatch) {
        symbols.push({ type: 'interface', name: ifaceMatch[1], lineNumber, columnNumber: 0 });
      }

      // Type aliases
      const typeMatch = trimmed.match(patterns.typeDecl);
      if (typeMatch) {
        symbols.push({ type: 'interface', name: typeMatch[1], lineNumber, columnNumber: 0 });
      }

      // Enums
      const enumMatch = trimmed.match(patterns.enumDecl);
      if (enumMatch) {
        symbols.push({ type: 'class', name: enumMatch[1], lineNumber, columnNumber: 0 });
      }

      // Default imports
      const importDefMatch = trimmed.match(patterns.importDefault);
      if (importDefMatch) {
        imports.push({
          source: importDefMatch[2],
          imported: [importDefMatch[1]],
          isDefault: true,
          lineNumber
        });
      }

      // Named imports
      const importNamedMatch = trimmed.match(patterns.importNamed);
      if (importNamedMatch) {
        const importedItems = importNamedMatch[1].split(',').map(s => s.trim()).filter(s => s);
        imports.push({
          source: importNamedMatch[2],
          imported: importedItems,
          isDefault: false,
          lineNumber
        });
      }

      // Namespace imports
      const importAllMatch = trimmed.match(patterns.importAll);
      if (importAllMatch) {
        imports.push({
          source: importAllMatch[2],
          imported: [importAllMatch[1]],
          isDefault: true,
          lineNumber
        });
      }

      // Default exports
      if (trimmed.match(patterns.exportDefault)) {
        exports.push({ source: '', imported: ['default'], isDefault: true, lineNumber });
      }

      // Named exports
      const exportMatch = trimmed.match(patterns.exportNamed);
      if (exportMatch) {
        exports.push({ source: '', imported: [exportMatch[1]], isDefault: false, lineNumber });
      }
    });

    return { symbols, imports, exports };
  }

  /**
   * Parse a Python file for symbols
   */
  private parsePython(content: string): { symbols: Symbol[]; imports: ImportExport[]; exports: ImportExport[] } {
    const symbols: Symbol[] = [];
    const imports: ImportExport[] = [];
    const exports: ImportExport[] = [];

    const lines = content.split('\n');
    const patterns = {
      classDecl: /^class\s+(\w+)/,
      functionDecl: /^def\s+(\w+)/,
      importFrom: /^from\s+([\w.]+)\s+import\s+(.+)/,
      import: /^import\s+(.+)/
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      const classMatch = trimmed.match(patterns.classDecl);
      if (classMatch) {
        symbols.push({ type: 'class', name: classMatch[1], lineNumber, columnNumber: 0 });
      }

      const funcMatch = trimmed.match(patterns.functionDecl);
      if (funcMatch) {
        symbols.push({ type: 'function', name: funcMatch[1], lineNumber, columnNumber: 0 });
      }

      const importFromMatch = trimmed.match(patterns.importFrom);
      if (importFromMatch) {
        const items = importFromMatch[2].split(',').map(s => s.trim()).filter(s => s !== '*');
        imports.push({ source: importFromMatch[1], imported: items, isDefault: false, lineNumber });
      }

      const importMatch = trimmed.match(patterns.import);
      if (importMatch) {
        imports.push({ source: importMatch[1], imported: ['*'], isDefault: false, lineNumber });
      }

      // __all__ export
      if (trimmed.startsWith('__all__')) {
        exports.push({ source: '', imported: ['__all__'], isDefault: false, lineNumber });
      }
    });

    return { symbols, imports, exports };
  }

  /**
   * Parse a single file
   */
  async parseFile(filePath: string): Promise<ParsedFile> {
    const ext = filePath.split('.').pop()?.toLowerCase();
    let symbols: Symbol[] = [];
    let imports: ImportExport[] = [];
    let exports: ImportExport[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
        const parsed = this.parseJSTS(content);
        symbols = parsed.symbols;
        imports = parsed.imports;
        exports = parsed.exports;
      } else if (ext === 'py') {
        const parsed = this.parsePython(content);
        symbols = parsed.symbols;
        imports = parsed.imports;
        exports = parsed.exports;
      }
    } catch (e) {
      console.error(`Failed to parse ${filePath}:`, e);
    }

    return {
      path: filePath,
      language: this.detectLanguage(filePath),
      symbols,
      imports,
      exports
    };
  }

  /**
   * Parse all code files in a directory
   */
  async parseDirectory(dirPath: string, patterns: string[] = ['**/*.{ts,tsx,js,jsx,py}']): Promise<ParsedFile[]> {
    const results: ParsedFile[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: dirPath, absolute: true });
      for (const file of files) {
        // Skip node_modules and .contexthub
        if (file.includes('node_modules') || file.includes('.contexthub')) continue;

        const parsed = await this.parseFile(file);
        results.push(parsed);
      }
    }

    console.log(`Parsed ${results.length} files in ${dirPath}`);
    return results;
  }

  /**
   * Build a dependency graph from parsed files
   */
  buildDependencyGraph(files: ParsedFile[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const file of files) {
      const deps: string[] = [];
      for (const imp of file.imports) {
        deps.push(imp.source);
      }
      graph.set(file.path, deps);
    }

    return graph;
  }

  /**
   * Find files that match a pattern or contain a symbol
   */
  async findRelatedFiles(filePath: string, allFiles: ParsedFile[]): Promise<string[]> {
    const related: string[] = [];

    // Find imports that match this file's name
    const fileName = path.basename(filePath, path.extname(filePath));

    for (const file of allFiles) {
      if (file.path === filePath) continue;

      // Check imports
      for (const imp of file.imports) {
        if (imp.source.includes(fileName) || imp.imported.some(i => i === fileName)) {
          related.push(file.path);
          break;
        }
      }
    }

    return [...new Set(related)];
  }

  /**
   * Get summary statistics for a parsed codebase
   */
  getCodeStats(files: ParsedFile[]): {
    totalFiles: number;
    byLanguage: Record<string, number>;
    totalSymbols: number;
    byType: Record<string, number>;
  } {
    const stats = {
      totalFiles: files.length,
      byLanguage: {} as Record<string, number>,
      totalSymbols: 0,
      byType: {} as Record<string, number>
    };

    for (const file of files) {
      stats.byLanguage[file.language] = (stats.byLanguage[file.language] || 0) + 1;

      for (const symbol of file.symbols) {
        stats.totalSymbols++;
        stats.byType[symbol.type] = (stats.byType[symbol.type] || 0) + 1;
      }
    }

    return stats;
  }
}