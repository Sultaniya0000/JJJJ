const ThoughtGraph = {
  renderFromData(containerId, graph) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!graph || graph.nodes.length === 0) {
      container.innerHTML = '<div class="empty-state">No thoughts mapped yet. As you share more, connections will appear here.</div>';
      return;
    }

    container.innerHTML = '';
    container.style.position = 'relative';
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const centerX = width / 2;
    const centerY = height / 2;

    const positions = this._layout(graph.nodes, graph.edges, width, height);

    for (const edge of graph.edges) {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) continue;
      const el = document.createElement('div');
      el.className = 'graph-edge';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      el.style.width = len + 'px';
      el.style.left = from.x + 'px';
      el.style.top = from.y + 'px';
      el.style.transform = `rotate(${angle}deg)`;
      el.style.transformOrigin = '0 0';
      el.style.borderTop = '1px dashed var(--border)';
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      container.appendChild(el);

      if (edge.label && len > 60) {
        const lbl = document.createElement('span');
        lbl.textContent = edge.label;
        lbl.style.cssText = `position:absolute;left:${(from.x+to.x)/2}px;top:${(from.y+to.y)/2-10}px;font-size:9px;color:var(--text-muted);background:var(--bg-secondary);padding:1px 6px;border-radius:4px;transform:translate(-50%,-50%);z-index:1;pointer-events:none;`;
        container.appendChild(lbl);
      }
    }

    for (const node of graph.nodes) {
      const pos = positions[node.id];
      if (!pos) continue;
      const el = document.createElement('div');
      el.className = 'graph-node';
      el.textContent = node.label.length > 30 ? node.label.slice(0, 30) + '...' : node.label;
      el.style.left = (pos.x - 80) + 'px';
      el.style.top = (pos.y - 16) + 'px';
      container.appendChild(el);
    }
  },

  _layout(nodes, edges, width, height) {
    const positions = {};
    const centerX = width / 2;
    const centerY = height / 2;

    const connCount = {};
    for (const n of nodes) connCount[n.id] = 0;
    for (const e of edges) {
      if (connCount[e.from] !== undefined) connCount[e.from]++;
      if (connCount[e.to] !== undefined) connCount[e.to]++;
    }

    const sorted = [...nodes].sort((a, b) => connCount[b.id] - connCount[a.id]);
    const root = sorted[0];
    if (!root) return positions;

    positions[root.id] = { x: centerX, y: centerY };
    const visited = new Set([root.id]);
    const queue = [{ id: root.id, level: 0, angle: 0 }];

    while (queue.length > 0) {
      const cur = queue.shift();
      const connected = edges.filter(e => e.from === cur.id || e.to === cur.id);
      const step = (2 * Math.PI) / Math.max(connected.length, 1);
      const radius = 80 + cur.level * 100;
      let offset = cur.angle - (connected.length - 1) * step / 2;

      for (const e of connected) {
        const nid = e.from === cur.id ? e.to : e.from;
        if (visited.has(nid)) continue;
        visited.add(nid);
        const a = offset;
        offset += step;
        positions[nid] = { x: centerX + radius * Math.cos(a), y: centerY + radius * Math.sin(a) };
        queue.push({ id: nid, level: cur.level + 1, angle: a });
      }
    }

    let unvisitedAngle = 0;
    for (const n of nodes) {
      if (!positions[n.id]) {
        positions[n.id] = { x: centerX + 200 * Math.cos(unvisitedAngle), y: centerY + 200 * Math.sin(unvisitedAngle) };
        unvisitedAngle += 0.5;
      }
    }

    return positions;
  },
};
