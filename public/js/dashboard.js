const Dashboard = {
  _cachedMemory: null,

  async refresh() {
    try {
      this._cachedMemory = await ApiClient.getMemory();
      this._updateMood();
      this._updateFocusTask();
      this._updateActiveGoals();
      this._updateRecurringEmotions();
      this._updateBrainMapSummary();
      this._updateInsights();
    } catch {
      // Silently fail — dashboard will update on next interval
    }
  },

  _updateMood() {
    const mood = this._cachedMemory?.currentMood;
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
    const task = this._cachedMemory?.currentFocusTask;
    document.getElementById('current-task').textContent = task || '—';
  },

  _updateActiveGoals() {
    const goals = this._cachedMemory?.goals || [];
    const el = document.getElementById('active-goals');
    if (goals.length === 0) {
      el.innerHTML = '<li style="color:var(--text-muted);font-size:12px;">No goals set</li>';
      return;
    }
    el.innerHTML = goals.map(g => `<li>${g.text}</li>`).join('');
  },

  _updateRecurringEmotions() {
    const emotions = this._cachedMemory?.recurringEmotions || [];
    const el = document.getElementById('recurring-emotions');
    if (emotions.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No data yet</span>';
      return;
    }
    el.innerHTML = emotions.map(([emotion, count]) => {
      return `<span class="emotion-tag" style="border-color:${this._moodColor(emotion)};">${emotion} ×${count}</span>`;
    }).join('');
  },

  _updateBrainMapSummary() {
    const summary = this._cachedMemory?.brainMapSummary;
    document.getElementById('brainmap-summary').textContent = summary || 'No thoughts mapped yet.';
  },

  _updateInsights() {
    const insights = this._cachedMemory?.unreadInsights || [];
    const el = document.getElementById('insight-feed');
    if (insights.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Insights will appear here as you use Jarvis.</div>';
      return;
    }
    el.innerHTML = insights.map(i =>
      `<div class="insight-item">${i.text}</div>`
    ).join('');
  },

  _moodColor(emotion) {
    const colors = {
      'Happiness': 'var(--green)', 'Calm': 'var(--blue)',
      'Anxiety': 'var(--orange)', 'Fear': 'var(--orange)',
      'Worry': 'var(--orange)', 'Sadness': 'var(--blue)',
      'Anger': 'var(--red)', 'Frustration': 'var(--red)',
      'Overwhelm': 'var(--orange)', 'Fatigue': 'var(--text-muted)',
      'Excitement': 'var(--green)', 'Gratitude': 'var(--green)',
      'Hope': 'var(--green)', 'Motivation': 'var(--green)',
      'Stress': 'var(--orange)', 'Boredom': 'var(--text-muted)',
      'Loneliness': 'var(--blue)', 'Rejection': 'var(--red)',
      'Guilt': 'var(--orange)', 'Shame': 'var(--red)',
    };
    return colors[emotion] || 'var(--accent)';
  },
};
