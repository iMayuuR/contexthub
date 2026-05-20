import type { VectorSearchResult, MemoryEntry } from '@imayuur/contexthub-shared-types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── Security Constants ────────────────────────────────────────────────────
const MAX_EMBEDDINGS = 10000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface EmbeddingStore {
  [id: string]: number[];
}

export type EmbeddingMode = 'local' | 'off' | 'transformers';

export class VectorEngine {
  private embeddingsPath: string;
  private embeddings: EmbeddingStore;
  private dimension: number;
  private mode: EmbeddingMode;
  private static extractor: any = null;

  constructor(repoPath: string, mode: EmbeddingMode = 'local') {
    this.mode = mode;
    this.dimension = mode === 'transformers' ? 384 : 1536;
    this.embeddingsPath = path.join(repoPath, '.contexthub', 'embeddings');
    this.embeddings = this.loadEmbeddings();
  }

  private loadEmbeddings(): EmbeddingStore {
    try {
      const indexPath = path.join(this.embeddingsPath, 'index.json');
      if (fs.existsSync(indexPath)) {
        // Security: Check file size before reading
        const stats = fs.statSync(indexPath);
        if (stats.size > MAX_FILE_SIZE) {
          console.error('Embeddings file too large, starting fresh');
          return {};
        }
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load embeddings:', (e as Error)?.message || 'unknown error');
    }
    return {};
  }

  private saveEmbeddings(): void {
    // Security: Cap embedding count
    const keys = Object.keys(this.embeddings);
    if (keys.length > MAX_EMBEDDINGS) {
      // Remove oldest entries (by key insertion order)
      const toRemove = keys.slice(0, keys.length - MAX_EMBEDDINGS);
      for (const key of toRemove) {
        delete this.embeddings[key];
      }
      console.error(`Embedding store capped at ${MAX_EMBEDDINGS} entries`);
    }

    if (!fs.existsSync(this.embeddingsPath)) {
      fs.mkdirSync(this.embeddingsPath, { recursive: true });
    }

    // Atomic write: write to tmp, then rename
    const indexPath = path.join(this.embeddingsPath, 'index.json');
    const tmpPath = indexPath + `.tmp.${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.embeddings, null, 2), { mode: 0o600 });
      fs.renameSync(tmpPath, indexPath);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      throw e;
    }
  }

  /**
   * Lazy load the transformers pipeline
   */
  private async getExtractor(): Promise<any> {
    if (!VectorEngine.extractor) {
      try {
        // Use dynamic import to avoid static dependency and bundle bloat
        const transformers = await Function('return import("@xenova/transformers")')();
        // Setup cache dir within .contexthub if we want, or rely on default
        VectorEngine.extractor = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch (e: any) {
        throw new Error('Failed to load @xenova/transformers. Install it with: npm install @xenova/transformers\n' + e.message);
      }
    }
    return VectorEngine.extractor;
  }

  /**
   * Generate embedding from text using the selected mode
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.mode === 'off') {
      return [];
    }

    if (this.mode === 'transformers') {
      const extractor = await this.getExtractor();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    }

    // Local mode: Hash + Bigram TF weighting
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const termFreqs = new Map<string, number>();

    // Unigrams
    for (const word of words) {
      termFreqs.set(word, (termFreqs.get(word) || 0) + 1);
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i+1]}`;
      termFreqs.set(bigram, (termFreqs.get(bigram) || 0) + 1);
    }

    const embedding = new Array(this.dimension).fill(0);

    for (const [term, freq] of termFreqs.entries()) {
      let hash = 0;
      for (let i = 0; i < term.length; i++) {
        hash = ((hash << 5) - hash) + term.charCodeAt(i);
        hash = hash & hash;
      }
      const seed = Math.abs(hash);
      
      const isBigram = term.includes(' ');
      
      // Spread across 3 positions based on seed
      const pos1 = seed % this.dimension;
      const pos2 = (seed * 17) % this.dimension;
      const pos3 = (seed * 31) % this.dimension;

      // TF weighting: 1 + log10(tf)
      const tfWeight = 1 + Math.log10(freq);
      
      // Bigrams receive a slight multiplier to emphasize phrase matches
      const weight = tfWeight * (isBigram ? 1.5 : 1.0);

      embedding[pos1] += weight;
      embedding[pos2] += weight * 0.5;
      embedding[pos3] += weight * 0.25;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Add embedding for a memory entry
   */
  async addEmbedding(id: string, embedding: number[]): Promise<void> {
    this.embeddings[id] = embedding;
    this.saveEmbeddings();
    console.log(`Added embedding for memory ${id} (${embedding.length} dimensions)`);
  }

  /**
   * Add embedding by generating it from content
   */
  async addEmbeddingForContent(id: string, content: string): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    await this.addEmbedding(id, embedding);
  }

  /**
   * Search for similar embeddings using cosine similarity
   */
  async searchSimilar(embedding: number[], limit: number = 10): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [id, storedEmbedding] of Object.entries(this.embeddings)) {
      const score = this.cosineSimilarity(embedding, storedEmbedding);
      results.push({ id, score, metadata: null as any });
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Search for similar text content
   */
  async searchSimilarText(query: string, memories: MemoryEntry[], limit: number = 10): Promise<VectorSearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const results: VectorSearchResult[] = [];

    for (const memory of memories) {
      let embedding = this.embeddings[memory.id];
      if (!embedding && memory.content) {
        embedding = await this.generateEmbedding(memory.content);
        this.embeddings[memory.id] = embedding;
      }

      if (embedding) {
        const score = this.cosineSimilarity(queryEmbedding, embedding);
        results.push({ id: memory.id, score, metadata: memory });
      }
    }

    this.saveEmbeddings();
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Update an existing embedding
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    this.embeddings[id] = embedding;
    this.saveEmbeddings();
    console.log(`Updated embedding for memory ${id}`);
  }

  /**
   * Delete an embedding
   */
  async deleteEmbedding(id: string): Promise<void> {
    delete this.embeddings[id];
    this.saveEmbeddings();
    console.log(`Deleted embedding for memory ${id}`);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitudeProduct = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (magnitudeProduct === 0) return 0;

    return dotProduct / magnitudeProduct;
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async batchGenerateEmbeddings(items: { id: string; content: string }[]): Promise<void> {
    for (const item of items) {
      const embedding = await this.generateEmbedding(item.content);
      this.embeddings[item.id] = embedding;
    }
    this.saveEmbeddings();
    console.log(`Generated embeddings for ${items.length} items`);
  }

  /**
   * Get embedding count
   */
  getEmbeddingCount(): number {
    return Object.keys(this.embeddings).length;
  }

  /**
   * Clear all embeddings
   */
  async clearAll(): Promise<void> {
    this.embeddings = {};
    this.saveEmbeddings();
    console.log('Cleared all embeddings');
  }
}