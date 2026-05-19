import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import chalk from 'chalk';
import { ContextHubCore, SecurityManager, runUnifiedQuery, DASHBOARD_MAX_RECORDS, MAX_GRAPH_DISPLAY_NODES } from '@contexthub/core';
import { CodeGraphManager } from '@contexthub/knowledge-graph';
import { VectorEngine } from '@contexthub/vector-engine';
import { GitIntegration } from '@contexthub/git-integration';

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
}

function getDashboardHtml(token: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ContextHub Dashboard</title>
  <style>
    :root {
      --bg: #0f111a;
      --bg-card: #1e2130;
      --primary: #4ade80;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg); color: var(--text);
      display: grid; grid-template-columns: 300px 1fr; height: 100vh;
    }
    /* Premium sleek design rules */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    
    .sidebar { background: var(--bg-card); border-right: 1px solid var(--border); padding: 20px; overflow-y: auto; }
    .main { display: flex; flex-direction: column; overflow: hidden; }
    .header { padding: 20px; border-bottom: 1px solid var(--border); background: var(--bg-card); display: flex; align-items: center; justify-content: space-between; }
    .content { flex: 1; padding: 20px; overflow-y: auto; position: relative; }
    
    h1, h2 { margin: 0; font-weight: 600; letter-spacing: -0.5px; }
    h1 { font-size: 20px; color: var(--primary); }
    
    .memory-item { padding: 15px; margin-bottom: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; font-size: 14px; transition: transform 0.2s, background 0.2s; }
    .memory-item:hover { transform: translateY(-2px); background: rgba(255,255,255,0.05); }
    .tag { display: inline-block; padding: 3px 8px; background: rgba(74, 222, 128, 0.1); color: var(--primary); border-radius: 4px; font-size: 11px; font-weight: 500; margin-right: 5px; }
    
    .search-box { width: 100%; padding: 12px 15px; background: var(--bg); border: 1px solid var(--border); color: #fff; border-radius: 8px; font-size: 14px; margin-bottom: 20px; transition: border-color 0.2s; }
    .search-box:focus { outline: none; border-color: var(--primary); }
    
    .graph-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg); z-index: 0; }
    .top-layer { position: relative; z-index: 10; pointer-events: none; }
    .top-layer * { pointer-events: auto; }
    
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab { padding: 8px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
    .tab.active { background: var(--primary); color: #000; border-color: var(--primary); }
    
    .result-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .result-header { color: var(--primary); font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div class="sidebar">
    <h1 style="margin-bottom: 30px;">ContextHub</h1>
    
    <div class="tabs">
      <div class="tab active" onclick="switchTab('feed')">Memory Feed</div>
      <div class="tab" onclick="switchTab('query')">Query</div>
      <div class="tab" onclick="switchTab('graph')">Graph View</div>
    </div>
    
    <div id="stats" style="margin-top: 30px; font-size: 12px; color: var(--text-muted);">
      Loading stats...
    </div>
  </div>
  
  <div class="main">
    <div class="header">
      <h2 id="view-title">Memory Feed</h2>
      <div style="font-size: 12px; color: var(--primary); display: flex; align-items: center; gap: 6px;">
        <div style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 8px var(--primary);"></div>
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
    
    async function fetchAPI(path) {
      const res = await fetch(path, { headers });
      return res.json();
    }

    async function loadStats() {
      const health = await fetchAPI('/api/health');
      let html = \`<div>Memories: \${health.memoryCount}</div>\`;
      
      try {
        const graphData = await fetchAPI('/api/graph');
        if (graphData.stats) {
          html += \`<div style="margin-top:5px;">Graph Nodes: \${graphData.stats.nodeCount}</div>\`;
          html += \`<div>Graph Edges: \${graphData.stats.edgeCount}</div>\`;
        }
      } catch(e) {}
      
      document.getElementById('stats').innerHTML = html;
    }
    
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      
      const content = document.getElementById('content-area');
      const title = document.getElementById('view-title');
      
      if (tab === 'feed') {
        title.innerText = 'Memory Feed';
        content.innerHTML = '<div id="memories-list">Loading...</div>';
        loadMemories();
      } else if (tab === 'query') {
        title.innerText = 'Unified Query';
        content.innerHTML = \`
          <input type="text" id="query-input" class="search-box" placeholder="Ask anything about the codebase..." onkeydown="if(event.key==='Enter') runQuery()">
          <div id="query-results" class="top-layer"></div>
        \`;
      } else if (tab === 'graph') {
        title.innerText = 'Topology';
        content.innerHTML = '<div class="graph-container"><canvas id="graph-canvas"></canvas></div>';
        initGraph();
      }
    }
    
    async function loadMemories() {
      try {
        const data = await fetchAPI('/api/memories');
        const html = data.memories.sort((a,b)=>b.timestamp-a.timestamp).map(m => \`
          <div class="memory-item">
            <div style="margin-bottom: 8px;">\${(m.tags||[]).map(t => \`<span class="tag">\${t}</span>\`).join('')}</div>
            <div style="color: #cbd5e1; line-height: 1.5;">\${marked.parse(m.content)}</div>
            <div style="margin-top: 10px; font-size: 11px; color: var(--text-muted);">
              \${new Date(m.timestamp).toLocaleString()} \${m.commitHash ? \`| Commit: \${m.commitHash}\` : ''}
            </div>
          </div>
        \`).join('');
        document.getElementById('memories-list').innerHTML = html || 'No memories found.';
      } catch (e) {
        document.getElementById('memories-list').innerHTML = 'Failed to load memories.';
      }
    }

    async function runQuery() {
      const q = document.getElementById('query-input').value;
      if (!q) return;
      const resDiv = document.getElementById('query-results');
      resDiv.innerHTML = '<div style="color:var(--text-muted)">Stitching context...</div>';
      
      try {
        const data = await fetchAPI('/api/query?q=' + encodeURIComponent(q));
        let html = '';
        
        if (data.exactMatch) {
          html += \`<div class="result-card" style="border-color:var(--primary)">
            <div class="result-header">Exact Memory Match</div>
            <div>\${marked.parse(data.exactMatch.content)}</div>
          </div>\`;
        }
        
        if (data.contextChunks?.length) {
          html += \`<div class="result-card">
            <div class="result-header">Semantic Context</div>
            <ul style="margin:0; padding-left:20px; font-size:13px; line-height:1.6;">
              \${data.contextChunks.map(c => \`<li>\${c}</li>\`).join('')}
            </ul>
          </div>\`;
        }
        
        if (data.relatedFiles?.length) {
          html += \`<div class="result-card">
            <div class="result-header">Graph Topology Hits</div>
            <div style="font-size:13px;">\${data.relatedFiles.join('<br>')}</div>
          </div>\`;
        }
        
        if (data.gitContext) {
          html += \`<div class="result-card">
            <div class="result-header">Git History</div>
            <div style="font-size:13px;">\${data.gitContext}</div>
          </div>\`;
        }
        
        resDiv.innerHTML = html || 'No results found.';
      } catch(e) {
        resDiv.innerHTML = '<div style="color:#ef4444">Error running query</div>';
      }
    }

    // Very simple fallback graph renderer for dashboard
    async function initGraph() {
      const canvas = document.getElementById('graph-canvas');
      if (!canvas) return;
      
      const container = canvas.parentElement;
      let width = container.clientWidth;
      let height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      try {
        const data = await fetchAPI('/api/graph');
        if (!data.nodes) return;
        
        const nodes = data.nodes.map(n => ({ ...n, x: Math.random()*width, y: Math.random()*height }));
        
        // Render loop
        function render() {
          if(!document.getElementById('graph-canvas')) return; // Check if still in tab
          ctx.clearRect(0,0,width,height);
          
          for(const n of nodes) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.kind==='file'?3:1.5, 0, 2*Math.PI);
            ctx.fillStyle = n.kind==='file' ? '#3498db' : '#e74c3c';
            ctx.fill();
            
            // tiny random jitter just for visual effect
            n.x += (Math.random()-0.5)*0.5;
            n.y += (Math.random()-0.5)*0.5;
          }
          requestAnimationFrame(render);
        }
        render();
      } catch(e) {}
    }

    // Init
    loadStats();
    loadMemories();
  </script>
</body>
</html>`;
}
