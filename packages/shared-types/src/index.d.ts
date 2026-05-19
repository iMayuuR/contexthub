export interface Session {
    id: string;
    repoPath: string;
    startTime: number;
    endTime?: number;
    agent: string;
    metadata: Record<string, any>;
}
export interface MemoryEntry {
    id: string;
    sessionId: string;
    type: 'prompt' | 'response' | 'summary' | 'decision' | 'architecture' | 'bugfix' | 'manual';
    content: string;
    timestamp: number;
    tags: string[];
    embedding?: number[];
}
export interface ProjectMetadata {
    repoPath: string;
    name: string;
    description?: string;
    language?: string;
    framework?: string;
    createdAt: number;
    updatedAt: number;
}
export interface VectorSearchResult {
    id: string;
    score: number;
    metadata: MemoryEntry;
}
export interface KnowledgeGraphNode {
    id: string;
    type: 'file' | 'function' | 'class' | 'variable' | 'import';
    label: string;
    properties: Record<string, any>;
}
export interface KnowledgeGraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'calls' | 'imports' | 'contains' | 'references';
    properties: Record<string, any>;
}
export interface ParsedFile {
    path: string;
    language: string;
    symbols: Symbol[];
    imports: ImportExport[];
    exports: ImportExport[];
}
export interface Symbol {
    type: 'function' | 'class' | 'variable' | 'interface' | 'method';
    name: string;
    lineNumber: number;
    columnNumber: number;
}
export interface ImportExport {
    source: string;
    imported: string[];
    isDefault: boolean;
    lineNumber: number;
}
