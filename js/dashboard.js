/* ============================================
   Jarvis Dashboard — Control Panel
   Displays current mood, focus task,
   recent thoughts, recurring emotions,
   active goals, brain map summary, insights
   ============================================ */

const Dashboard = {
  refresh() {
    this._updateMood();
    this._updateFocusTask();
    this._updateActiveGoals();
    this._updateRecurringEmotions();
    this._updateBrainMapSummary();
    this._updateInsights();
  },

  _updateMood() {
    const mood = Memory.get('currentMood');
    const el = document.getElementById('current-mood');
    if (mood) {
      el.textContent = mood;
      el.style.borderLeftColor = this._moodColor(mood);
    } else {
      el.textContent = '—';
      el.style.borderLeftColor = '';
    }
  },

  _updateFocusTask() {
    const task = Memory.get('currentFocusTask');
    document.getElementById('current-task').textContent = task || '—';
  },

  _updateActiveGoals() {
    const goals = Memory.getActiveGoals();
    const el = document.getElementById('active-goals');
    if (goals.length === 0) {
      el.innerHTML = '<li style="color:var(--text-muted);font-size:12px;">No goals set</li>';
      return;
    }
    el.innerHTML = goals.slice(-5).reverse().map(g => `<li>${g.text}</li>`).join('');
  },

  _updateRecurringEmotions() {
    const freq = Memory.getEmotionFrequency(14);
    const el = document.getElementById('recurring-emotions');
    if (freq.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No data yet</span>';
      return;
    }
    el.innerHTML = freq.slice(0, 5).map(([emotion, count]) => {
      const color = this._moodColor(emotion);
      return `<span class="emotion-tag" style="border-color:${color};">${emotion} ×${count}</span>`;
    }).join('');
  },

  _updateBrainMapSummary() {
    const graph = Memory.get('brainGraph');
    const el = document.getElementById('brainmap-summary');
    if (graph.nodes.length === 0) {
      el.textContent = 'No thoughts mapped yet.';
      return;
    }

    const tags = new Set();
    for (const node of graph.nodes) {
      for (const tag of node.tags) tags.add(tag);
    }

    el.textContent = `${graph.nodes.length} thoughts · ${graph.edges.length} connections · ${tags.size} themes`;
  },

  _updateInsights() {
    const insights = Memory.get('insights');
    const el = document.getElementById('insight-feed');

    const recent = insights.filter(i => !i.read).slice(-5).reverse();
    if (recent.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Insights will appear here as you use Jarvis.</div>';
      return;
    }

    el.innerHTML = recent.map(insight =>
      `<div class="insight-item" data-id="${insight.id}">${insight.text}</div>`
    ).join('');

    // Mark as read when shown
    for (const insight of recent) {
      Memory.markInsightRead(insight.id);
    }
  },

  _moodColor(emotion) {
    const colors = {
      'Happiness': 'var(--green)',
      'Calm': 'var(--blue)',
      'Anxiety': 'var(--orange)',
      'Fear': 'var(--orange)',
      'Worry': 'var(--orange)',
      'Sadness': 'var(--blue)',
      'Anger': 'var(--red)',
      'Frustration': 'var(--red)',
      'Overwhelm': 'var(--orange)',
      'Fatigue': 'var(--text-muted)',
      'Excitement': 'var(--green)',
      'Gratitude': 'var(--green)',
      'Hope': 'var(--green)',
      'Motivation': 'var(--green)',
      'Stress': 'var(--orange)',
      'Boredom': 'var(--text-muted)',
      'Loneliness': 'var(--blue)',
      'Rejection': 'var(--red)',
      'Guilt': 'var(--orange)',
      'Shame': 'var(--red)',
    };
    return colors[emotion] || 'var(--accent)';
  },
};
