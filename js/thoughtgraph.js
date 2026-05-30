/* ============================================
   Thought Graph — Visual mind map
   Automatically creates and displays
   connections between related thoughts
   ============================================ */

const ThoughtGraph = {
  render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const graph = Memory.get('brainGraph');
    const thoughts = Memory.get('thoughts');

    if (graph.nodes.length === 0) {
      container.innerHTML = '<div class="empty-state">No thoughts mapped yet. As you share more, connections will appear here.</div>';
      return;
    }

    container.innerHTML = '';
    container.style.position = 'relative';

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate positions using a simple force-directed layout
    const positions = this._calculateLayout(graph.nodes, graph.edges, width, height);

    // Draw edges
    for (const edge of graph.edges) {
      const fromPos = positions[edge.from];
      const toPos = positions[edge.to];
      if (!fromPos || !toPos) continue;

      const edgeEl = document.createElement('div');
      edgeEl.className = 'graph-edge';
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      edgeEl.style.width = length + 'px';
      edgeEl.style.left = fromPos.x + 'px';
      edgeEl.style.top = fromPos.y + 'px';
      edgeEl.style.transform = `rotate(${angle}deg)`;
      edgeEl.style.transformOrigin = '0 0';
      edgeEl.style.borderTop = '1px dashed var(--border)';
      edgeEl.style.position = 'absolute';
      edgeEl.style.pointerEvents = 'none';
      container.appendChild(edgeEl);

      // Edge label
      if (edge.label && length > 60) {
        const labelEl = document.createElement('span');
        labelEl.textContent = edge.label;
        labelEl.style.cssText = `
          position: absolute;
          left: ${(fromPos.x + toPos.x) / 2}px;
          top: ${(fromPos.y + toPos.y) / 2 - 10}px;
          font-size: 9px;
          color: var(--text-muted);
          background: var(--bg-secondary);
          padding: 1px 6px;
          border-radius: 4px;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
        `;
        container.appendChild(labelEl);
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const pos = positions[node.id];
      if (!pos) continue;

      const thought = thoughts.find(t => t.id === node.id);
      const nodeEl = document.createElement('div');
      nodeEl.className = 'graph-node';
      nodeEl.textContent = node.label.length > 30 ? node.label.slice(0, 30) + '...' : node.label;
      nodeEl.style.left = (pos.x - 80) + 'px';
      nodeEl.style.top = (pos.y - 16) + 'px';
      nodeEl.title = thought ? thought.text : node.label;

      nodeEl.addEventListener('click', () => {
        this._showNodeDetails(node.id);
      });

      container.appendChild(nodeEl);
    }
  },

  _calculateLayout(nodes, edges, width, height) {
    const positions = {};
    const centerX = width / 2;
    const centerY = height / 2;

    // Find root nodes (most connected)
    const connectionCount = {};
    for (const node of nodes) {
      connectionCount[node.id] = 0;
    }
    for (const edge of edges) {
      if (connectionCount[edge.from] !== undefined) connectionCount[edge.from]++;
      if (connectionCount[edge.to] !== undefined) connectionCount[edge.to]++;
    }

    const sorted = [...nodes].sort((a, b) => connectionCount[b.id] - connectionCount[a.id]);
    const root = sorted[0];

    if (!root) return positions;

    // Position root at center
    positions[root.id] = { x: centerX, y: centerY, radius: 0 };

    // BFS layout
    const visited = new Set([root.id]);
    const queue = [{ id: root.id, level: 0, angle: 0 }];
    const levelSizes = {};

    while (queue.length > 0) {
      const current = queue.shift();
      const connectedEdges = edges.filter(e => e.from === current.id || e.to === current.id);

      const angleStep = (2 * Math.PI) / Math.max(connectedEdges.length, 1);
      const radius = 80 + current.level * 100;
      let angleOffset = current.angle - (connectedEdges.length - 1) * angleStep / 2;

      for (const edge of connectedEdges) {
        const neighborId = edge.from === current.id ? edge.to : edge.from;
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const angle = angleOffset;
        angleOffset += angleStep;

        const nx = centerX + radius * Math.cos(angle);
        const ny = centerY + radius * Math.sin(angle);

        positions[neighborId] = { x: nx, y: ny, radius };
        queue.push({ id: neighborId, level: current.level + 1, angle });
      }
    }

    // Place unvisited nodes
    let unvisitedAngle = 0;
    for (const node of nodes) {
      if (!positions[node.id]) {
        positions[node.id] = {
          x: centerX + 200 * Math.cos(unvisitedAngle),
          y: centerY + 200 * Math.sin(unvisitedAngle),
          radius: 2,
        };
        unvisitedAngle += 0.5;
      }
    }

    return positions;
  },

  _showNodeDetails(nodeId) {
    const thoughts = Memory.get('thoughts');
    const thought = thoughts.find(t => t.id === nodeId);
    if (!thought) return;

    const event = new CustomEvent('jarvis-show-thought', {
      detail: {
        text: thought.text,
        tags: thought.tags,
        date: new Date(thought.timestamp).toLocaleString(),
        links: thought.linkedThoughts.length,
      },
    });
    document.dispatchEvent(event);
  },

  // Auto-detect connection between current input and past thoughts
  detectConnection(input) {
    const thoughts = Memory.getRecentThoughts(50);
    if (thoughts.length === 0) return null;

    const lower = input.toLowerCase();
    const inputWords = lower.split(/\s+/).filter(w => w.length > 3);

    let bestMatch = null;
    let bestScore = 0;

    for (const thought of thoughts) {
      const thoughtLower = thought.text.toLowerCase();
      let score = 0;

      for (const word of inputWords) {
        if (thoughtLower.includes(word)) score += 1;
      }

      // Boost score for same tags
      const thoughtTags = thought.tags.map(t => t.toLowerCase());
      const inputTags = [];
      const tagMap = {
        'anxi': 'Anxiety', 'scared': 'Fear', 'sad': 'Sadness',
        'reject': 'Rejection', 'angry': 'Anger', 'tired': 'Fatigue',
      };
      for (const [key, tag] of Object.entries(tagMap)) {
        if (lower.includes(key)) inputTags.push(tag.toLowerCase());
      }
      for (const tag of inputTags) {
        if (thoughtTags.includes(tag)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = thought;
      }
    }

    if (bestMatch && bestScore >= 2) {
      const daysAgo = Math.floor((Date.now() - bestMatch.timestamp) / 86400000);
      return {
        thought: bestMatch,
        daysAgo,
        score: bestScore,
        text: `I noticed a similarity to a thought you had ${daysAgo > 0 ? daysAgo + ' day(s) ago' : 'earlier today'}.\n\n"${bestMatch.text.slice(0, 100)}"`,
      };
    }

    return null;
  },

  // Brain Replay: chain of similar thoughts over time
  getThoughtChain(input, maxChain = 5) {
    const thoughts = Memory.get('thoughts');
    if (thoughts.length < 2) return [];

    const lower = input.toLowerCase();
    const inputWords = lower.split(/\s+/).filter(w => w.length > 3);

    // Score all thoughts
    const scored = thoughts.map(t => {
      const tLower = t.text.toLowerCase();
      let score = 0;
      for (const word of inputWords) {
        if (tLower.includes(word)) score += 1;
      }
      // Boost for emotional tags
      const tagMap = {
        'anxi': 'Anxiety', 'scared': 'Fear', 'sad': 'Sadness',
        'reject': 'Rejection', 'angry': 'Anger',
      };
      for (const [key, tag] of Object.entries(tagMap)) {
        if (lower.includes(key) && t.tags.includes(tag)) score += 3;
      }
      return { ...t, score };
    });

    // Filter relevant and sort by time
    const relevant = scored
      .filter(t => t.score > 0)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-maxChain);

    return relevant;
  },
};
