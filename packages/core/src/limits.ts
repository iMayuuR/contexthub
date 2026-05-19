/**
 * Centralized system limits and performance caps for ContextHub.
 * 
 * These constants enforce strict boundaries on memory consumption,
 * response payload sizes, and parsing limits to ensure the MCP server
 * remains lightweight and stable.
 */

// Memory limits
export const MAX_MEMORY_CONTENT_LENGTH = 51200; // 50KB
export const MAX_MEMORY_TAGS = 20;
export const MAX_RELATED_PATHS = 20;
export const MAX_RELATED_SYMBOLS = 20;
export const MAX_MEMORIES_TOTAL = 10000;

// Query limits
export const MAX_QUERY_LIMIT = 100;
export const DEFAULT_QUERY_LIMIT = 10;
export const MAX_SEARCH_CANDIDATES = 1000;
export const MAX_QUERY_LENGTH = 1000;

// Graph & Parsing limits
export const MAX_GRAPH_DISPLAY_NODES = 5000;
export const MAX_FILES_PER_SCAN = 1000;
export const MAX_INGEST_FILE_SIZE = 1024 * 1024; // 1MB
export const MAX_PDF_PAGES = 50;
export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Watcher limits
export const MAX_WATCH_FILES_PER_BATCH = 100;

// Dashboard limits
export const DASHBOARD_MAX_RECORDS = 500;

// Security limits
export const MAX_COMMIT_HASH_LENGTH = 40;
export const MAX_BRANCH_LENGTH = 100;
