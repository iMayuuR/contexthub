import { Symbol, ImportExport } from '@imayuur/contexthub-shared-types';

export class TreeSitterParser {
  private parser: any;
  private langs: Map<string, any> = new Map();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    const { Parser, Language } = require('web-tree-sitter');
    await Parser.init();
    this.parser = new Parser();
    
    // Load common languages
    const jsPath = require.resolve('@repomix/tree-sitter-wasms/out/tree-sitter-javascript.wasm');
    const tsPath = require.resolve('@repomix/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
    const tsxPath = require.resolve('@repomix/tree-sitter-wasms/out/tree-sitter-tsx.wasm');
    const pyPath = require.resolve('@repomix/tree-sitter-wasms/out/tree-sitter-python.wasm');

    const [jsLang, tsLang, tsxLang, pyLang] = await Promise.all([
      Language.load(jsPath),
      Language.load(tsPath),
      Language.load(tsxPath),
      Language.load(pyPath),
    ]);

    this.langs.set('javascript', jsLang);
    this.langs.set('typescript', tsLang);
    this.langs.set('tsx', tsxLang);
    this.langs.set('python', pyLang);

    this.initialized = true;
  }

  async parse(content: string, language: string): Promise<{ symbols: Symbol[]; imports: ImportExport[]; exports: ImportExport[] } | null> {
    if (!this.initialized) await this.init();

    // Map file extension/language to tree-sitter language
    let tsLang = 'javascript';
    if (language === 'typescript') tsLang = 'typescript';
    if (language === 'tsx') tsLang = 'tsx'; // TSX is a distinct grammar in tree-sitter
    if (language === 'python') tsLang = 'python';

    const langObj = this.langs.get(tsLang);
    if (!langObj) return null;

    this.parser.setLanguage(langObj);

    // Set 5s timeout if supported
    if (typeof this.parser.setTimeoutMicros === 'function') {
      this.parser.setTimeoutMicros(5_000_000);
    } else if (typeof this.parser.setTimeout === 'function') {
      this.parser.setTimeout(5_000_000);
    }

    let tree;
    try {
      tree = this.parser.parse(content);
    } catch (e) {
      // Timeout or parse error
      return null;
    }

    const symbols: Symbol[] = [];
    const imports: ImportExport[] = [];
    const exports: ImportExport[] = [];

    // Traverse the AST
    this.traverse(tree.rootNode, symbols, imports, exports, tsLang);

    return { symbols, imports, exports };
  }

  private traverse(node: any, symbols: Symbol[], imports: ImportExport[], exports: ImportExport[], lang: string) {
    // Determine the type of node
    const type = node.type;

    if (lang === 'javascript' || lang === 'typescript' || lang === 'tsx') {
      if (type === 'function_declaration' || type === 'generator_function_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            type: 'function',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'class_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            type: 'class',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            type: 'method',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'variable_declarator') {
        const nameNode = node.childForFieldName('name');
        if (nameNode && (node.parent?.parent?.type === 'export_statement' || node.parent?.type === 'lexical_declaration')) {
          symbols.push({
            type: 'variable',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'import_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const source = sourceNode.text.replace(/['"]/g, '');
          imports.push({
            source,
            imported: ['*'], // We could extract exact names but * is fine for the graph
            isDefault: false,
            lineNumber: node.startPosition.row + 1
          });
        }
      } else if (type === 'export_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          exports.push({
            source: sourceNode.text.replace(/['"]/g, ''),
            imported: ['*'],
            isDefault: false,
            lineNumber: node.startPosition.row + 1
          });
        } else {
          exports.push({
            source: '',
            imported: ['*'],
            isDefault: false,
            lineNumber: node.startPosition.row + 1
          });
        }
      }
    } else if (lang === 'python') {
      if (type === 'function_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            type: 'function',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            type: 'class',
            name: nameNode.text,
            lineNumber: node.startPosition.row + 1,
            columnNumber: node.startPosition.column
          });
        }
      } else if (type === 'import_statement' || type === 'import_from_statement') {
        let source = '';
        const moduleNameNode = node.childForFieldName('module_name');
        if (moduleNameNode) {
          source = moduleNameNode.text;
        } else {
          // simple import
          const firstChild = node.children.find((c: any) => c.type === 'dotted_name');
          if (firstChild) source = firstChild.text;
        }

        if (source) {
          imports.push({
            source,
            imported: ['*'],
            isDefault: false,
            lineNumber: node.startPosition.row + 1
          });
        }
      } else if (type === 'assignment') {
        const leftNode = node.childForFieldName('left');
        if (leftNode && leftNode.text === '__all__') {
          const rightNode = node.childForFieldName('right');
          if (rightNode && rightNode.type === 'list') {
            const elements = rightNode.children.filter((c: any) => c.type === 'string');
            for (const el of elements) {
              exports.push({
                source: '',
                imported: [el.text.replace(/['"]/g, '')],
                isDefault: false,
                lineNumber: node.startPosition.row + 1
              });
            }
          }
        }
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      this.traverse(node.child(i), symbols, imports, exports, lang);
    }
  }
}
