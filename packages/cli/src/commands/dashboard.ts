import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import chalk from 'chalk';
import { ContextHubCore, SecurityManager, runUnifiedQuery, DASHBOARD_MAX_RECORDS, MAX_GRAPH_DISPLAY_NODES } from '@imayuur/contexthub-core';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { GitIntegration } from '@imayuur/contexthub-git-integration';

export interface DashboardOptions {
  port?: string;
}

export async function dashboardCommand(options: DashboardOptions = {}): Promise<void> {
  const currentDir = process.cwd();
  const security = new SecurityManager(currentDir);
  const core = new ContextHubCore(currentDir);
  const graphManager = new CodeGraphManager(currentDir);
  const vectorEngine = new VectorEngine(currentDir);
  const gitIntegration = new GitIntegration(core, currentDir);
  
  const port = parseInt(options.port || '3847', 10);
  
  // Verify token
  const tokenPath = path.join(currentDir, '.contexthub', '.auth-token');
  let token = '';
  if (fs.existsSync(tokenPath)) {
    token = fs.readFileSync(tokenPath, 'utf8').trim();
  }

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'CONTEXTHUB_TOKEN');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Extract token from multiple possible headers
    const reqToken = req.headers['contexthub_token'] 
      || req.headers['contexthub-token'] 
      || req.headers['authorization']?.replace(/^Bearer\s+/i, '') 
      || '';

    // Security check
    if (token && reqToken !== token && !req.url?.startsWith('/index.html') && req.url !== '/') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '/';

      if (pathname === '/api/health') {
        const memories = await core.searchMemories({ limit: 1000 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          memoryCount: memories.length,
          encryptionActive: true
        }));
        return;
      }

      if (pathname === '/api/memories') {
        const memories = await core.searchMemories({ limit: DASHBOARD_MAX_RECORDS });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ memories }));
        return;
      }

      if (pathname === '/api/query') {
        const query = parsedUrl.query.q as string || '';
        const results = await runUnifiedQuery(query, 10, core, vectorEngine, graphManager, gitIntegration);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
      }

      if (pathname === '/api/graph') {
        try {
          const graph = await graphManager.loadGraph();
          // Cap graph output to 5000 nodes for frontend safety
          let nodes = graph.nodes;
          let edges = graph.edges;
          if (nodes.length > MAX_GRAPH_DISPLAY_NODES) {
            nodes = nodes.slice(0, MAX_GRAPH_DISPLAY_NODES);
            const nodeIds = new Set(nodes.map((n: any) => n.id));
            edges = edges.filter((e: any) => nodeIds.has(e.from) && nodeIds.has(e.to));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            nodes,
            edges,
            stats: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length, updatedAt: graph.updatedAt }
          }));
        } catch (e) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Graph not found' }));
        }
        return;
      }

      // Serve static UI
      if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getDashboardHtml(token));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(chalk.cyan(`\n🚀 ContextHub Dashboard running at http://127.0.0.1:${port}`));
    if (token) {
      console.log(chalk.yellow(`Security: Token required for API access`));
    }
    console.log(chalk.gray(`Press Ctrl+C to stop`));
  });
}function getDashboardHtml(token: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ContextHub Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    :root {
      --bg: #080b11;
      --bg-card: rgba(22, 28, 45, 0.4);
      --bg-sidebar: #0f1322;
      --primary: #10b981;
      --primary-glow: rgba(16, 185, 129, 0.15);
      --secondary: #3b82f6;
      --text: #f1f5f9;
      --text-muted: #64748b;
      --border: rgba(51, 65, 85, 0.5);
      --border-focus: #10b981;
      --font-main: 'Outfit', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    
    * { box-sizing: border-box; outline: none; }
    
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }
    
    body {
      margin: 0; 
      font-family: var(--font-main);
      background: var(--bg); 
      color: var(--text);
      display: grid; 
      grid-template-columns: 280px 1fr; 
      height: 100vh;
      overflow: hidden;
    }
    
    /* Sidebar Styling */
    .sidebar { 
      background: var(--bg-sidebar); 
      border-right: 1px solid var(--border); 
      padding: 30px 20px; 
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 40px;
    }
    
    .logo-glow {
      width: 12px;
      height: 12px;
      background: var(--primary);
      border-radius: 50%;
      box-shadow: 0 0 15px var(--primary);
    }
    
    .logo-text {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #fff 0%, #a7f3d0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .nav-tabs {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .tab-btn {
      padding: 14px 18px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.02);
    }
    
    .tab-btn.active {
      background: var(--primary-glow);
      color: var(--primary);
      border-color: rgba(16, 185, 129, 0.2);
      font-weight: 600;
    }
    
    .sidebar-footer {
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }
    
    .stats-card {
      background: rgba(255,255,255,0.01);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    
    .stats-val {
      color: var(--text);
      font-weight: 600;
      font-family: var(--font-mono);
    }
    
    /* Main Layout */
    .main { 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
      position: relative;
    }
    
    .header { 
      padding: 24px 30px; 
      border-bottom: 1px solid var(--border); 
      backdrop-filter: blur(12px);
      background: rgba(8, 11, 17, 0.7); 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      z-index: 10;
    }
    
    .header h2 { 
      margin: 0; 
      font-size: 20px; 
      font-weight: 600; 
      letter-spacing: -0.5px;
    }
    
    .badge-secure {
      font-size: 12px; 
      color: var(--primary); 
      display: flex; 
      align-items: center; 
      gap: 8px;
      padding: 6px 12px;
      background: var(--primary-glow);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 20px;
      font-weight: 500;
    }
    
    .content { 
      flex: 1; 
      padding: 30px; 
      overflow-y: auto; 
      background: radial-gradient(circle at 50% 50%, rgba(22, 28, 45, 0.25) 0%, transparent 100%);
      position: relative;
    }
    
    /* UI components */
    .search-box { 
      width: 100%; 
      padding: 16px 20px; 
      background: rgba(15, 23, 42, 0.6); 
      border: 1px solid var(--border); 
      color: #fff; 
      border-radius: 12px; 
      font-size: 15px; 
      margin-bottom: 25px; 
      transition: all 0.3s;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .search-box:focus { 
      border-color: var(--border-focus); 
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
    }
    
    /* Memory Feed card design */
    .memory-list-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .memory-item { 
      padding: 24px; 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: 14px; 
      font-size: 14.5px; 
      backdrop-filter: blur(8px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    .memory-item:hover { 
      transform: translateY(-2px); 
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      background: rgba(22, 28, 45, 0.55);
    }
    
    .tag { 
      display: inline-block; 
      padding: 4px 10px; 
      background: rgba(16, 185, 129, 0.1); 
      color: var(--primary); 
      border-radius: 6px; 
      font-size: 11px; 
      font-weight: 600; 
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .tag.decision { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
    .tag.bugfix { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .tag.manual { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    
    .memory-meta {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-top: 15px; 
      font-size: 12px; 
      color: var(--text-muted);
      border-top: 1px solid rgba(255,255,255,0.03);
      padding-top: 12px;
    }
    
    .mono-meta {
      font-family: var(--font-mono);
      background: rgba(255,255,255,0.02);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-muted);
    }
    
    /* Premium Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 40px;
      background: var(--bg-card);
      border: 1px dashed var(--border);
      border-radius: 16px;
      margin-top: 20px;
    }
    
    .empty-state h3 {
      font-size: 18px;
      margin: 0 0 10px 0;
      color: var(--text);
    }
    
    .empty-state p {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0 0 25px 0;
    }
    
    .cmd-box {
      background: #090d16;
      border: 1px solid var(--border);
      padding: 14px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: #3b82f6;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 600px;
      margin: 0 auto;
    }
    
    .btn-copy {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .btn-copy:hover { color: #fff; background: rgba(255,255,255,0.05); }
    
    /* Interactive Graph Section */
    .graph-outer {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 25px;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      padding: 30px;
    }
    
    .graph-container { 
      background: rgba(15, 23, 42, 0.4); 
      border: 1px solid var(--border);
      border-radius: 16px;
      position: relative; 
      overflow: hidden;
      box-shadow: inset 0 0 40px rgba(0,0,0,0.4);
    }
    
    .graph-details-panel {
      background: var(--bg-sidebar);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
    }
    
    .graph-detail-title {
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--primary);
      font-weight: 700;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    
    .detail-item {
      font-size: 14px;
      line-height: 1.6;
    }
    
    .detail-item span {
      display: block;
      color: var(--text-muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    
    /* Result Card Unified Query */
    .result-card { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: 14px; 
      padding: 20px; 
      margin-bottom: 20px; 
      box-shadow: 0 8px 16px rgba(0,0,0,0.15);
      backdrop-filter: blur(8px);
    }
    
    .result-header { 
      color: var(--primary); 
      font-size: 12px; 
      font-weight: 700; 
      margin-bottom: 12px; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div>
      <div class="logo-container">
        <div class="logo-glow"></div>
        <div class="logo-text">ContextHub</div>
      </div>
      
      <div class="nav-tabs">
        <button class="tab-btn active" onclick="switchTab('feed')">
          <span style="font-size: 16px;">🧠</span> Memory Feed
        </button>
        <button class="tab-btn" onclick="switchTab('query')">
          <span style="font-size: 16px;">🔍</span> Intelligent Query
        </button>
        <button class="tab-btn" onclick="switchTab('graph')">
          <span style="font-size: 16px;">📊</span> Topology Graph
        </button>
      </div>
    </div>
    
    <div class="sidebar-footer">
      <div id="stats" class="stats-card">
        Loading stats...
      </div>
    </div>
  </div>
  
  <div class="main">
    <div class="header">
      <h2 id="view-title">Memory Feed</h2>
      <div class="badge-secure">
        <div style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%;"></div>
        Encrypted Layer Active
      </div>
    </div>
    
    <div class="content" id="content-area">
      <!-- Dynamic View Area -->
    </div>
  </div>

  <script>
    const token = '${token}';
    const headers = token ? { 'CONTEXTHUB_TOKEN': token } : {};
    let network = null;
    
    async function fetchAPI(path) {
      const res = await fetch(path, { headers });
      return res.json();
    }

    async function loadStats() {
      const health = await fetchAPI('/api/health');
      let html = \`
        <div>Memories: <span class="stats-val">\${health.memoryCount}</span></div>
      \`;
      
      try {
        const graphData = await fetchAPI('/api/graph');
        if (graphData.stats) {
          html += \`
            <div style="margin-top: 8px;">Nodes: <span class="stats-val">\${graphData.stats.nodeCount}</span></div>
            <div style="margin-top: 4px;">Edges: <span class="stats-val">\${graphData.stats.edgeCount}</span></div>
          \`;
        }
      } catch(e) {}
      
      document.getElementById('stats').innerHTML = html;
    }
    
    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      event.currentTarget.classList.add('active');
      
      const content = document.getElementById('content-area');
      const title = document.getElementById('view-title');
      
      if (tab === 'feed') {
        title.innerText = 'Memory Feed';
        content.innerHTML = '<div id="memories-list" class="memory-list-container">Loading...</div>';
        loadMemories();
      } else if (tab === 'query') {
        title.innerText = 'Intelligent Query';
        content.innerHTML = \`
          <input type="text" id="query-input" class="search-box" placeholder="Ask anything about the codebase..." onkeydown="if(event.key==='Enter') runQuery()">
          <div id="query-results"></div>
        \`;
      } else if (tab === 'graph') {
        title.innerText = 'Topology Graph';
        content.innerHTML = \`
          <div class="graph-outer">
            <div id="graph-network-container" class="graph-container"></div>
            <div class="graph-details-panel" id="graph-details">
              <div class="graph-detail-title">File Details</div>
              <div style="color:var(--text-muted); font-size:13px; text-align:center; padding-top:40px;">
                Click any node in the topology to explore its modular connections and dependency degree.
              </div>
            </div>
          </div>
        \`;
        initGraph();
      }
    }
    
    async function loadMemories() {
      try {
        const data = await fetchAPI('/api/memories');
        if (!data.memories || data.memories.length === 0) {
          showEmptyState();
          return;
        }
        
        const html = data.memories.sort((a,b)=>b.timestamp-a.timestamp).map(m => {
          const mainTag = (m.tags && m.tags[0]) || 'manual';
          return \`
            <div class="memory-item">
              <div style="margin-bottom: 12px;">
                <span class="tag \${mainTag}">\${mainTag}</span>
                \${(m.tags||[]).slice(1).map(t => \`<span class="tag">\${t}</span>\`).join('')}
              </div>
              <div style="color: #e2e8f0; line-height: 1.6; font-size:14.5px;">\${marked.parse(m.content)}</div>
              <div class="memory-meta">
                <span>🕒 \${new Date(m.timestamp).toLocaleString()}</span>
                \${m.commitHash ? \`<span>🌿 Commit: <span class="mono-meta">\${m.commitHash.substring(0,8)}</span></span>\` : ''}
              </div>
            </div>
          \`;
        }).join('');
        document.getElementById('memories-list').innerHTML = html;
      } catch (e) {
        document.getElementById('memories-list').innerHTML = '<div style="color:#ef4444">Failed to load memories.</div>';
      }
    }
    
    function showEmptyState() {
      document.getElementById('memories-list').innerHTML = \`
        <div class="empty-state">
          <h3>No memories recorded yet</h3>
          <p>Start pair programming! ContextHub will securely record your workspace sessions automatically, or you can manually save memories.</p>
          <div class="cmd-box">
            <span>npx @imayuur/contexthub memory --add "Your custom memory note"</span>
            <button class="btn-copy" onclick="navigator.clipboard.writeText('npx @imayuur/contexthub memory --add \\'Your custom memory note\\'')">📋 Copy</button>
          </div>
        </div>
      \`;
    }
    
    async function runQuery() {
      const q = document.getElementById('query-input').value;
      if (!q) return;
      const resDiv = document.getElementById('query-results');
      resDiv.innerHTML = '<div style="color:var(--text-muted); font-size:14px;">Stitching codebase topology context...</div>';
      
      try {
        const data = await fetchAPI('/api/query?q=' + encodeURIComponent(q));
        let html = '';
        
        if (data.exactMatch) {
          html += \`<div class="result-card" style="border-color:var(--primary)">
            <div class="result-header">Exact Memory Match</div>
            <div style="line-height:1.6;">\${marked.parse(data.exactMatch.content)}</div>
          </div>\`;
        }
        
        if (data.contextChunks?.length) {
          html += \`<div class="result-card">
            <div class="result-header">Semantic Context & Core References</div>
            <ul style="margin:0; padding-left:20px; font-size:13.5px; line-height:1.7; color:#e2e8f0;">
              \${data.contextChunks.map(c => \`<li>\${c}</li>\`).join('')}
            </ul>
          </div>\`;
        }
        
        if (data.relatedFiles?.length) {
          html += \`<div class="result-card">
            <div class="result-header">Graph Topology Hits (transitive connections)</div>
            <div style="font-size:13.5px; font-family:var(--font-mono); line-height:1.6; color:#a7f3d0;">
              \${data.relatedFiles.map(f => \`<div>🔹 \${f}</div>\`).join('')}
            </div>
          </div>\`;
        }
        
        if (data.gitContext) {
          html += \`<div class="result-card">
            <div class="result-header">Git Context & Changes</div>
            <div style="font-size:13.5px; line-height:1.6; white-space:pre-wrap; color:#cbd5e1;">\${data.gitContext}</div>
          </div>\`;
        }
        
        resDiv.innerHTML = html || '<div style="color:var(--text-muted)">No results found matching query.</div>';
      } catch(e) {
        resDiv.innerHTML = '<div style="color:#ef4444">Error running semantic query.</div>';
      }
    }
    
    async function initGraph() {
      const container = document.getElementById('graph-network-container');
      if (!container) return;
      
      try {
        const data = await fetchAPI('/api/graph');
        if (!data.nodes || data.nodes.length === 0) {
          container.innerHTML = \`<div style="color:var(--text-muted); text-align:center; padding-top:100px; font-size:14px;">
            Topology graph empty. Run a code analysis first using setup or watch to map dependencies!
          </div>\`;
          return;
        }
        
        // Color coding scheme based on package layers
        const visNodes = data.nodes.map(n => {
          let color = '#64748b'; // default slate
          if (n.id.includes('packages/core')) color = '#3b82f6'; // neon blue
          else if (n.id.includes('packages/cli')) color = '#f59e0b'; // neon yellow
          else if (n.id.includes('packages/mcp-server')) color = '#10b981'; // neon green
          else if (n.id.includes('packages/shared-types')) color = '#8b5cf6'; // purple
          else if (n.id.includes('packages/vector-engine')) color = '#ec4899'; // pink
          else if (n.id.includes('packages/knowledge-graph')) color = '#06b6d4'; // cyan
          
          return {
            id: n.id,
            label: n.label || n.id.split('/').pop(),
            color: {
              background: color,
              border: 'rgba(255,255,255,0.1)',
              highlight: { background: color, border: '#fff' }
            },
            shape: 'dot',
            size: n.kind === 'file' ? 12 : 6,
            font: { color: '#f1f5f9', size: 10, face: 'Outfit' }
          };
        });
        
        const visEdges = data.edges.map(e => ({
          from: e.from,
          to: e.to,
          color: { color: 'rgba(255,255,255,0.06)', highlight: 'rgba(59, 130, 246, 0.4)' },
          width: 1
        }));
        
        const visData = { nodes: visNodes, edges: visEdges };
        
        const options = {
          physics: {
            barnesHut: {
              gravitationalConstant: -2000,
              centralGravity: 0.3,
              springLength: 95,
              springConstant: 0.04
            },
            stabilization: { iterations: 150, updateInterval: 25 }
          },
          interaction: { hover: true, tooltipDelay: 200 }
        };
        
        network = new vis.Network(container, visData, options);
        
        network.on("click", function (params) {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = visNodes.find(n => n.id === nodeId);
            
            // Calculate connections
            const connectedEdges = visEdges.filter(e => e.from === nodeId || e.to === nodeId);
            const degree = connectedEdges.length;
            
            let packageLayer = 'unknown';
            if (nodeId.includes('packages/')) {
              packageLayer = nodeId.match(/packages\\/([^\\/]+)/)?.[1] || 'shared';
            }
            
            const detailHtml = \`
              <div class="graph-detail-title">File Details</div>
              <div class="detail-item">
                <span>File Path</span>
                <div style="font-family:var(--font-mono); font-size:12px; color:#cbd5e1; word-break:break-all;">\${nodeId}</div>
              </div>
              <div class="detail-item">
                <span>Package Workspace</span>
                <div style="text-transform:capitalize; font-weight:600; color:var(--primary);">\${packageLayer}</div>
              </div>
              <div class="detail-item">
                <span>Dependency Connections (Degree)</span>
                <div style="font-size:18px; font-weight:700; font-family:var(--font-mono);">\${degree}</div>
              </div>
              <div class="detail-item">
                <span>Direct Neighbors</span>
                <div style="font-size:12px; max-height:200px; overflow-y:auto; color:var(--text-muted); font-family:var(--font-mono); line-height:1.6;">
                  \${connectedEdges.map(e => {
                    const neighbor = e.from === nodeId ? e.to : e.from;
                    return \`<div>• \${neighbor.split('/').pop()}</div>\`;
                  }).join('')}
                </div>
              </div>
            \`;
            document.getElementById('graph-details').innerHTML = detailHtml;
          }
        });
        
      } catch (e) {
        container.innerHTML = '<div style="color:#ef4444; padding:20px;">Error rendering graph topology.</div>';
      }
    }
    
    // Init
    loadStats();
    loadMemories();
  </script>
</body>
</html>`;
}
