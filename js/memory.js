/* ============================================
   Memory System — Persistent data layer
   Stores conversations, thoughts, emotions,
   tasks, patterns, goals, daily logs, sleep
   ============================================ */

const Memory = {
  STORAGE_KEY: 'jarvis_memory',

  _data: null,

  _defaults() {
    return {
      conversations: [],
      thoughts: [],
      emotions: [],
      tasks: [],
      goals: [],
      patterns: [],
      dailyLogs: [],
      sleepLogs: [],
      insights: [],
      brainGraph: { nodes: [], edges: [] },
      lastCheckin: null,
      currentMood: null,
      currentFocusTask: null,
      activeGoalIds: [],
      setupComplete: false,
      firstVisit: true,
    };
  },

  init() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        this._data = JSON.parse(raw);
        const defaults = this._defaults();
        for (const key of Object.keys(defaults)) {
          if (!(key in this._data)) this._data[key] = defaults[key];
        }
      } else {
        this._data = this._defaults();
        this.save();
      }
    } catch {
      this._data = this._defaults();
      this.save();
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('Memory save failed:', e);
    }
  },

  get(key) {
    return this._data[key];
  },

  set(key, value) {
    this._data[key] = value;
    this.save();
  },

  // --- Conversations ---
  addMessage(role, content) {
    const msg = {
      role,
      content,
      timestamp: Date.now(),
    };
    this._data.conversations.push(msg);
    this.save();

    // Extract thoughts from user messages
    if (role === 'user' && content.length > 3) {
      this._extractThought(content);
    }
    return msg;
  },

  getRecentConversation(limit = 50) {
    return this._data.conversations.slice(-limit);
  },

  getTodayConversation() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this._data.conversations.filter(m => m.timestamp >= today.getTime());
  },

  // --- Thoughts ---
  _extractThought(content) {
    const thought = {
      id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: content,
      timestamp: Date.now(),
      tags: [],
      emotions: [],
      linkedThoughts: [],
    };
    this._data.thoughts.push(thought);
    this._autoTagThought(thought);
    this._autoLinkThought(thought);
    this.save();
    return thought;
  },

  _autoTagThought(thought) {
    const lower = thought.text.toLowerCase();
    const tagMap = {
      'anxi': 'Anxiety',
      'scared': 'Fear',
      'fear': 'Fear',
      'worried': 'Worry',
      'stress': 'Stress',
      'angry': 'Anger',
      'mad': 'Anger',
      'sad': 'Sadness',
      'depress': 'Sadness',
      'happy': 'Happiness',
      'excited': 'Excitement',
      'reject': 'Rejection',
      'alone': 'Loneliness',
      'tire': 'Fatigue',
      'overwhelm': 'Overwhelm',
      'focus': 'Focus',
      'distract': 'Distraction',
      'procrastinat': 'Procrastination',
      'guilt': 'Guilt',
      'shame': 'Shame',
      'fail': 'Fear of Failure',
      'perfect': 'Perfectionism',
      'imposter': 'Imposter Syndrome',
      'compare': 'Comparison',
      'regret': 'Regret',
      'hope': 'Hope',
      'grateful': 'Gratitude',
      'love': 'Love',
      'confident': 'Confidence',
      'motivat': 'Motivation',
    };
    for (const [keyword, tag] of Object.entries(tagMap)) {
      if (lower.includes(keyword)) {
        thought.tags.push(tag);
      }
    }
  },

  _autoLinkThought(thought) {
    const recent = this._data.thoughts.slice(-30);
    for (const prev of recent) {
      if (prev.id === thought.id) continue;
      const sharedTags = prev.tags.filter(t => thought.tags.includes(t));
      if (sharedTags.length > 0) {
        if (!thought.linkedThoughts.includes(prev.id)) {
          thought.linkedThoughts.push(prev.id);
        }
        if (!prev.linkedThoughts.includes(thought.id)) {
          prev.linkedThoughts.push(thought.id);
        }
        // Add to graph
        this._addGraphEdge(prev.id, thought.id, sharedTags[0]);
      }
    }
  },

  getThoughtsByTag(tag) {
    return this._data.thoughts.filter(t => t.tags.includes(tag));
  },

  getRecentThoughts(limit = 10) {
    return this._data.thoughts.slice(-limit).reverse();
  },

  // --- Brain Graph ---
  _addGraphEdge(fromId, toId, label) {
    const graph = this._data.brainGraph;
    // Add nodes if missing
    const fromThought = this._data.thoughts.find(t => t.id === fromId);
    const toThought = this._data.thoughts.find(t => t.id === toId);
    if (!fromThought || !toThought) return;

    if (!graph.nodes.find(n => n.id === fromId)) {
      graph.nodes.push({ id: fromId, label: fromThought.text.slice(0, 40), tags: fromThought.tags });
    }
    if (!graph.nodes.find(n => n.id === toId)) {
      graph.nodes.push({ id: toId, label: toThought.text.slice(0, 40), tags: toThought.tags });
    }

    const exists = graph.edges.find(e => e.from === fromId && e.to === toId);
    if (!exists) {
      graph.edges.push({ from: fromId, to: toId, label, weight: 1 });
    } else {
      exists.weight += 1;
    }
  },

  // --- Emotions ---
  logEmotion(emotion, intensity = 5, note = '') {
    const entry = {
      id: 'e_' + Date.now(),
      emotion,
      intensity,
      note,
      timestamp: Date.now(),
    };
    this._data.emotions.push(entry);
    this._data.currentMood = emotion;
    this.save();
    return entry;
  },

  getRecentEmotions(days = 7) {
    const cutoff = Date.now() - days * 86400000;
    return this._data.emotions.filter(e => e.timestamp >= cutoff);
  },

  getEmotionFrequency(days = 30) {
    const cutoff = Date.now() - days * 86400000;
    const recent = this._data.emotions.filter(e => e.timestamp >= cutoff);
    const freq = {};
    for (const e of recent) {
      freq[e.emotion] = (freq[e.emotion] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  },

  // --- Tasks ---
  addTask(title, priority = 'medium', dueDate = null) {
    const task = {
      id: 'task_' + Date.now(),
      title,
      priority,
      dueDate,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
    };
    this._data.tasks.push(task);
    this.save();
    return task;
  },

  completeTask(id) {
    const task = this._data.tasks.find(t => t.id === id);
    if (task) {
      task.completed = true;
      task.completedAt = Date.now();
      this.save();
    }
  },

  getTodayTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this._data.tasks.filter(t => t.createdAt >= today.getTime() && !t.completed);
  },

  getPendingTasks() {
    return this._data.tasks.filter(t => !t.completed);
  },

  getMissedTasks(days = 7) {
    const cutoff = Date.now() - days * 86400000;
    return this._data.tasks.filter(t => !t.completed && t.createdAt >= cutoff);
  },

  setCurrentFocusTask(title) {
    this._data.currentFocusTask = title;
    this.save();
  },

  // --- Goals ---
  addGoal(text) {
    const goal = { id: 'g_' + Date.now(), text, createdAt: Date.now(), active: true };
    this._data.goals.push(goal);
    if (!this._data.activeGoalIds.includes(goal.id)) {
      this._data.activeGoalIds.push(goal.id);
    }
    this.save();
    return goal;
  },

  getActiveGoals() {
    return this._data.goals.filter(g => g.active && this._data.activeGoalIds.includes(g.id));
  },

  // --- Daily Logs / Reflections ---
  saveDailyLog(entries) {
    const log = {
      date: new Date().toISOString().slice(0, 10),
      entries,
      timestamp: Date.now(),
    };
    this._data.dailyLogs.push(log);
    this._data.lastCheckin = Date.now();
    this.save();
    return log;
  },

  getTodayLog() {
    const today = new Date().toISOString().slice(0, 10);
    return this._data.dailyLogs.find(l => l.date === today);
  },

  getRecentLogs(days = 14) {
    return this._data.dailyLogs.slice(-days);
  },

  // --- Sleep ---
  logSleep(hours, quality = 5) {
    this._data.sleepLogs.push({
      date: new Date().toISOString().slice(0, 10),
      hours,
      quality,
      timestamp: Date.now(),
    });
    this.save();
  },

  getRecentSleep(days = 14) {
    return this._data.sleepLogs.slice(-days);
  },

  // --- Patterns ---
  addPattern(description, type = 'auto', severity = 'info') {
    const pattern = {
      id: 'p_' + Date.now(),
      description,
      type,
      severity,
      detectedAt: Date.now(),
      acknowledged: false,
    };
    this._data.patterns.push(pattern);
    this.save();
    return pattern;
  },

  getPatterns(limit = 20) {
    return this._data.patterns.slice(-limit).reverse();
  },

  // --- Insights ---
  addInsight(text, type = 'pattern') {
    const insight = {
      id: 'i_' + Date.now(),
      text,
      type,
      createdAt: Date.now(),
      read: false,
    };
    this._data.insights.push(insight);
    this.save();
    return insight;
  },

  getUnreadInsights() {
    return this._data.insights.filter(i => !i.read);
  },

  markInsightRead(id) {
    const insight = this._data.insights.find(i => i.id === id);
    if (insight) { insight.read = true; this.save(); }
  },

  // --- Utility ---
  clear() {
    this._data = this._defaults();
    this.save();
  },

  getStats() {
    const d = this._data;
    return {
      totalMessages: d.conversations.length,
      totalThoughts: d.thoughts.length,
      totalEmotions: d.emotions.length,
      totalTasks: d.tasks.length,
      completedTasks: d.tasks.filter(t => t.completed).length,
      missedTasks: d.tasks.filter(t => !t.completed).length,
      totalPatterns: d.patterns.length,
      totalInsights: d.insights.length,
      daysTracked: new Set(d.dailyLogs.map(l => l.date)).size,
      topEmotions: this.getEmotionFrequency(30).slice(0, 3),
    };
  },
};

Memory.init();
