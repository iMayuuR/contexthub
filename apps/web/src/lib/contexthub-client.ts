export class ContextHubClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_CONTEXTHUB_URL || 'http://127.0.0.1:3847';
    this.token = process.env.CONTEXTHUB_TOKEN;
  }

  private get headers(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/api/health`, { headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  }

  async getMemories() {
    const res = await fetch(`${this.baseUrl}/api/memories`, { headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  }

  async getGraph() {
    const res = await fetch(`${this.baseUrl}/api/graph`, { headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch graph stats');
    return res.json();
  }

  async query(q: string) {
    const res = await fetch(`${this.baseUrl}/api/query?q=${encodeURIComponent(q)}`, { headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to execute query');
    return res.json();
  }
}

export const contexthubClient = new ContextHubClient();
