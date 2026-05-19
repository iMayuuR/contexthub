import type { VectorSearchResult, MemoryEntry } from '@contexthub/shared-types';
import * as fs from 'fs';
import * as path from 'path';

interface EmbeddingStore {
  [id: string]: number[];
}

export class VectorEngine {
  private embeddingsPath: string;
  private embeddings: EmbeddingStore;
  private dimension: number;

  constructor(repoPath: string, dimension: number = 1536) {
    this.dimension = dimension;
    this.embeddingsPath = path.join(repoPath, '.contexthub', 'embeddings');
    this.embeddings = this.loadEmbeddings();
  }

  private loadEmbeddings(): EmbeddingStore {
    try {
      const indexPath = path.join(this.embeddingsPath, 'index.json');
      if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load embeddings:', e);
    }
    return {};
  }

  private saveEmbeddings(): void {
    if (!fs.existsSync(this.embeddingsPath)) {
      fs.mkdirSync(this.embeddingsPath, { recursive: true });
    }
    const indexPath = path.join(this.embeddingsPath, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(this.embeddings, null, 2));
  }

  /**
   * Generate embedding from text using a simple TF-IDF style approach
   * This is a placeholder - in production, use OpenAI embeddings or local models
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const embedding = new Array(this.dimension).fill(0);

    // Simple hash-based seeding for deterministic embeddings
    words.forEach((word, index) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const seed = Math.abs(hash);

      // Use multiple positions based on word characteristics
      const pos1 = (seed + index * 7) % this.dimension;
      const pos2 = (seed + index * 13 + 1) % this.dimension;
      const pos3 = (seed * 3 + index * 17) % this.dimension;

      embedding[pos1] += 1;
      embedding[pos2] += 0.5;
      embedding[pos3] += 0.25;
    });

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