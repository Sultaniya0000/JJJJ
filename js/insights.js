/* ============================================
   Proactive Insights Engine
   Generates timely observations based on
   stored data to help users recognize patterns
   ============================================ */

const InsightEngine = {
  _lastInsightTime: 0,
  _interval: null,

  start() {
    this._checkForProactiveInsight();
    this._interval = setInterval(() => this._checkForProactiveInsight(), 120000); // every 2 min
  },

  stop() {
    if (this._interval) clearInterval(this._interval);
  },

  _checkForProactiveInsight() {
    // Don't show too frequently
    const now = Date.now();
    if (now - this._lastInsightTime < 60000) return;

    const unread = Memory.getUnreadInsights();
    if (unread.length > 0) {
      this._lastInsightTime = now;
      this._showInsightNotification(unread[0]);
    }
  },

  _showInsightNotification(insight) {
    // Dispatch an event that the chat interface can listen to
    const event = new CustomEvent('jarvis-insight', { detail: insight });
    document.dispatchEvent(event);
  },

  generateProactiveMessage() {
    const patterns = PatternEngine.analyzeAll();
    const unread = Memory.getUnreadInsights();

    if (unread.length > 0) {
      const insight = unread[unread.length - 1];
      Memory.markInsightRead(insight.id);
      return `I noticed something worth sharing:\n\n"${insight.text}"\n\nWould you like to explore this further?`;
    }

    if (patterns.length > 0) {
      const pattern = patterns[0];
      Memory.addInsight(pattern.text, pattern.type);
      return `I have noticed a pattern you may want to explore:\n\n"${pattern.text}"`;
    }

    // Check for old thoughts to revisit
    const thoughts = Memory.getRecentThoughts(30);
    if (thoughts.length >= 5) {
      const oldThought = thoughts[thoughts.length - 1];
      const daysAgo = Math.floor((Date.now() - oldThought.timestamp) / 86400000);
      return `Would you like to revisit a thought you recorded ${daysAgo} days ago?\n\n"${oldThought.text.slice(0, 100)}..."`;
    }

    // Check for tasks
    const pending = Memory.getPendingTasks();
    if (pending.length > 0) {
      const task = pending[0];
      return `You mentioned that ${task.title} was important. Would you like to work on it now?`;
    }

    return null;
  },

  getScheduledCheckin() {
    const hour = new Date().getHours();
    const lastCheckin = Memory.get('lastCheckin');
    const today = new Date().toISOString().slice(0, 10);
    const hasTodayLog = Memory.getTodayLog();

    // Night reflection (9 PM - 12 AM)
    if (hour >= 21 || hour < 1) {
      if (!hasTodayLog) {
        return "It's late, and I'd like to help you reflect on your day. Would you like to do a quick evening check-in?";
      }
    }

    // Morning check-in (6 AM - 11 AM)
    if (hour >= 6 && hour <= 11) {
      if (!lastCheckin || !new Date(lastCheckin).toISOString().slice(0, 10) === today) {
        return `Good morning, Sir. How was your day today?`;
      }
    }

    return null;
  },

  _shouldTrigger() {
    const msgCount = Memory.get('conversations').length;
    const thoughts = Memory.get('thoughts').length;

    // Trigger after significant data accumulation
    if (msgCount >= 5 && msgCount % 3 === 0) return true;
    if (thoughts >= 3) return true;

    // Time-based: every ~10 messages
    return msgCount > 0 && msgCount % 10 === 0;
  },

  triggerAfterMessage() {
    if (this._shouldTrigger()) {
      this._lastInsightTime = Date.now();
      return this.generateProactiveMessage();
    }
    return null;
  },
};
