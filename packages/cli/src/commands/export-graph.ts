import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { SecurityManager, MAX_GRAPH_DISPLAY_NODES } from '@imayuur/contexthub-core';

export interface ExportGraphOptions {
  output?: string;
}

export async function exportGraphCommand(options: ExportGraphOptions = {}): Promise<void> {
  const currentDir = process.cwd();
  const security = new SecurityManager(currentDir);
  
  const outputPath = options.output ? path.resolve(currentDir, options.output) : path.join(currentDir, 'graph.html');

  // Security check on output path
  try {
    security.validatePath(outputPath);
  } catch (e) {
    console.error(chalk.red('Error: Output path escapes the repository boundary.'));
    process.exit(1);
  }

  console.log(chalk.blue('Loading code graph...'));
  const graphManager = new CodeGraphManager(currentDir);
  
  let graph;
  try {
    graph = await graphManager.loadGraph();
  } catch (e) {
    console.error(chalk.red('Error: Code graph not found. Run `contexthub watch` or trigger an update first.'));
    process.exit(1);
  }

  let nodes = graph.nodes;
  let edges = graph.edges;

  if (nodes.length > MAX_GRAPH_DISPLAY_NODES) {
    console.log(chalk.yellow(`Graph is too large (${nodes.length} nodes). Sampling down to ${MAX_GRAPH_DISPLAY_NODES} nodes.`));
    // Sample nodes, prefer files and highly connected symbols
    nodes = nodes.slice(0, MAX_GRAPH_DISPLAY_NODES);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
  }

  const graphDataStr = JSON.stringify({ nodes, edges });

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ContextHub - Code Graph</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #121212;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
    }
    #canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }
    #controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(30, 30, 30, 0.8);
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      backdrop-filter: blur(5px);
    }
    h2 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }
    .stat {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div id="controls">
    <h2>ContextHub Knowledge Graph</h2>
    <div class="stat">Nodes: ${nodes.length}</div>
    <div class="stat">Edges: ${edges.length}</div>
    <div class="stat" style="margin-top: 10px;">Scroll to zoom, drag to pan</div>
  </div>
  <canvas id="canvas"></canvas>

  <script>
    const graphData = ${graphDataStr};
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    window.addEventListener('resize', () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    });

    // Simple force-directed layout implementation
    const nodes = graphData.nodes.map(n => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0
    }));

    const nodeMap = new Map();
    nodes.forEach((n, i) => nodeMap.set(n.id, i));

    const edges = graphData.edges.filter(e => nodeMap.has(e.from) && nodeMap.has(e.to)).map(e => ({
      source: nodeMap.get(e.from),
      target: nodeMap.get(e.to),
      kind: e.kind
    }));

    const ITERATIONS = 100;
    const K = Math.sqrt((width * height) / nodes.length);
    const REPULSION = K * K * 0.5;
    const ATTRACTION = 0.01 / K;
    const DAMPING = 0.85;

    // View transform
    let transform = { x: 0, y: 0, k: 1 };

    // Run physics simulation
    function simulate() {
      let energy = 0;
      
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < K * K * 4) { // Cutoff for performance
            const force = REPULSION / distSq;
            const fx = force * dx;
            const fy = force * dy;
            nodes[i].vx += fx;
            nodes[i].vy += fy;
            nodes[j].vx -= fx;
            nodes[j].vy -= fy;
          }
        }
      }

      // Attraction
      for (const e of edges) {
        const source = nodes[e.source];
        const target = nodes[e.target];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const force = ATTRACTION * dist * dist;
          const fx = force * (dx / dist);
          const fy = force * (dy / dist);
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // Gravity to center
      for (const n of nodes) {
        const dx = (width / 2) - n.x;
        const dy = (height / 2) - n.y;
        n.vx += dx * 0.01;
        n.vy += dy * 0.01;
        
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        
        n.x += n.vx;
        n.y += n.vy;
        
        energy += n.vx * n.vx + n.vy * n.vy;
      }
      
      return energy;
    }

    // Pre-calculate layout to show immediately
    for (let i = 0; i < ITERATIONS; i++) simulate();

    // Render loop
    function render() {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw edges
      ctx.lineWidth = 0.5 / transform.k;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      for (const e of edges) {
        const s = nodes[e.source];
        const t = nodes[e.target];
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();

      // Draw nodes
      for (const n of nodes) {
        ctx.beginPath();
        const radius = n.kind === 'file' ? 4 / transform.k : 2 / transform.k;
        ctx.arc(n.x, n.y, Math.max(radius, 0.5), 0, 2 * Math.PI);
        ctx.fillStyle = n.kind === 'file' ? '#3498db' : '#e74c3c';
        ctx.fill();
      }

      ctx.restore();
      
      // Keep simulating slightly
      if (simulate() > 0.1) {
        requestAnimationFrame(render);
      }
    }

    render();

    // Panning & Zooming
    let isDragging = false;
    let lastX, lastY;

    canvas.addEventListener('mousedown', e => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      transform.x += dx;
      transform.y += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      requestAnimationFrame(render);
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newK = Math.max(0.1, Math.min(10, transform.k * Math.exp(delta)));
      
      // Zoom to mouse pointer
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      transform.x = mouseX - (mouseX - transform.x) * (newK / transform.k);
      transform.y = mouseY - (mouseY - transform.y) * (newK / transform.k);
      transform.k = newK;
      
      requestAnimationFrame(render);
    });

  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
  console.log(chalk.green(`✓ Graph exported successfully to ${outputPath}`));
}
