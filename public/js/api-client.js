/* ============================================
   API Client — Replaces localStorage Memory
   All data operations go through the server
   ============================================ */

const API_BASE = '';

const ApiClient = {
  async _fetch(path, options = {}) {
    const url = API_BASE + path;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API error');
    }
    return res.json();
  },

  // --- Chat ---
  async chat(message) {
    const data = await this._fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return data.response;
  },

  // --- Conversations ---
  async getConversations() {
    return this._fetch('/api/conversations');
  },

  async clearConversations() {
    return this._fetch('/api/conversations', { method: 'DELETE' });
  },

  // --- Emotions ---
  async logEmotion(emotion, intensity = 5, note = '') {
    return this._fetch('/api/emotions', {
      method: 'POST',
      body: JSON.stringify({ emotion, intensity, note }),
    });
  },

  async getRecentEmotions(days = 7) {
    return this._fetch(`/api/emotions?days=${days}`);
  },

  // --- Memory / Dashboard ---
  async getMemory() {
    return this._fetch('/api/memory');
  },

  // --- Tasks ---
  async getTasks() {
    return this._fetch('/api/tasks');
  },

  async addTask(title, priority = 'medium') {
    return this._fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, priority }),
    });
  },

  async completeTask(id) {
    return this._fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
  },

  // --- Focus ---
  async setFocusTask(task) {
    return this._fetch('/api/focus', {
      method: 'POST',
      body: JSON.stringify({ task }),
    });
  },

  async clearFocusTask() {
    return this._fetch('/api/focus', {
      method: 'POST',
      body: JSON.stringify({ task: null }),
    });
  },

  // --- Goals ---
  async getGoals() {
    return this._fetch('/api/goals');
  },

  async addGoal(text) {
    return this._fetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // --- Journal ---
  async getTodayJournal() {
    return this._fetch('/api/journal/today');
  },

  async saveJournal(entries) {
    return this._fetch('/api/journal', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    });
  },

  // --- Brain Graph ---
  async getBrainGraph() {
    return this._fetch('/api/brain-graph');
  },

  // --- Replay ---
  async getReplayChain(query) {
    return this._fetch(`/api/replay?q=${encodeURIComponent(query)}`);
  },

  // --- Patterns ---
  async getPatterns() {
    return this._fetch('/api/patterns');
  },

  // --- Insights ---
  async getInsights() {
    return this._fetch('/api/insights');
  },

  async markInsightRead(id) {
    return this._fetch(`/api/insights/${id}/read`, { method: 'POST' });
  },

  // --- Stats ---
  async getStats() {
    return this._fetch('/api/stats');
  },

  // --- Sleep ---
  async logSleep(hours, quality = 5) {
    return this._fetch('/api/sleep', {
      method: 'POST',
      body: JSON.stringify({ hours, quality }),
    });
  },
};
