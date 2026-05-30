const Commands = {
  registry: {},

  init() {
    this.register('help', 'Show available commands', this.cmdHelp);
    this.register('today', 'Daily summary', this.cmdToday);
    this.register('mood', 'Log your current mood', this.cmdMood);
    this.register('tasks', 'View pending tasks', this.cmdTasks);
    this.register('journal', 'Open daily reflection', this.cmdJournal);
    this.register('brainmap', 'View thought graph', this.cmdBrainmap);
    this.register('patterns', 'View detected patterns', this.cmdPatterns);
    this.register('focus', 'Set/clear focus task', this.cmdFocus);
    this.register('replay', 'Brain replay mode', this.cmdReplay);
    this.register('insights', 'View recent insights', this.cmdInsights);
    this.register('stats', 'View your statistics', this.cmdStats);
    this.register('clear', 'Clear conversation', this.cmdClear);
    this.register('export', 'Export your data', this.cmdExport);
  },

  register(name, description, handler) {
    this.registry[name] = { description, handler };
  },

  async execute(input) {
    const parts = input.toLowerCase().replace(/^\//, '').split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const entry = this.registry[cmd];
    if (!entry) return `Unknown command. Type /help to see available commands.`;
    return entry.handler(args);
  },

  cmdHelp() {
    const cmds = Object.entries(Commands.registry);
    let text = '**Available Commands:**\n\n';
    for (const [name, entry] of cmds) {
      text += `**/${name}** — ${entry.description}\n`;
    }
    return text;
  },

  async cmdToday() {
    const stats = await ApiClient.getStats();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    let text = `**${dateStr}**\n\n`;
    text += `**Messages:** ${stats.totalMessages}\n`;
    text += `**Thoughts:** ${stats.totalThoughts}\n`;
    text += `**Emotions Logged:** ${stats.totalEmotions}\n`;
    text += `**Tasks:** ${stats.completedTasks} completed / ${stats.pendingTasks} pending\n`;
    if (stats.topEmotions.length > 0) {
      text += `\n**Top Emotions (30 days):**\n`;
      for (const [e, c] of stats.topEmotions) {
        text += `• ${e}: ${c} times\n`;
      }
    }
    return text;
  },

  cmdMood() {
    const moods = ['Happy', 'Calm', 'Anxious', 'Sad', 'Angry', 'Overwhelmed', 'Tired', 'Excited', 'Grateful', 'Stressed', 'Bored', 'Frustrated', 'Lonely', 'Rejected'];
    let text = `**How are you feeling?** Choose one:\n\n`;
    for (const m of moods) text += `• ${m}\n`;
    text += `\nOr type: /mood [your emotion]`;
    return text;
  },

  async cmdTasks() {
    const data = await ApiClient.getTasks();
    const pending = data.pending || [];
    if (pending.length === 0) return `**Tasks:** No pending tasks. You're all caught up, Sir.`;
    let text = `**Pending Tasks (${pending.length})**\n\n`;
    for (const t of pending) {
      const created = new Date(t.created_at).toLocaleDateString();
      text += `• ${t.title} (${t.priority}) — added ${created}\n`;
    }
    return text;
  },

  cmdJournal() {
    document.dispatchEvent(new CustomEvent('jarvis-open-journal'));
    return `Opening your daily reflection journal, Sir.`;
  },

  cmdBrainmap() {
    document.dispatchEvent(new CustomEvent('jarvis-open-brainmap'));
    return `Opening your thought graph, Sir.`;
  },

  async cmdPatterns() {
    const patterns = await ApiClient.getPatterns();
    if (patterns.length === 0) return `No significant patterns detected yet. Continue using Jarvis and patterns will emerge as data accumulates.`;
    let text = `**Detected Patterns (${patterns.length})**\n\n`;
    for (const p of patterns) {
      const icon = p.severity === 'warning' ? '⚠️' : '💡';
      text += `${icon} **${p.type}:** ${p.description}\n\n`;
    }
    return text;
  },

  async cmdFocus(args) {
    if (args[0] === 'clear') {
      await ApiClient.clearFocusTask();
      Dashboard.refresh();
      return `Focus task cleared, Sir.`;
    }
    if (args.length > 0) {
      const task = args.join(' ');
      await ApiClient.setFocusTask(task);
      Dashboard.refresh();
      return `I've set "${task}" as your focus for today, Sir. I'll check in with you on it.`;
    }
    const mem = await ApiClient.getMemory();
    const current = mem.currentFocusTask;
    if (current) return `Your current focus is: "${current}".\n\nTo change it, tell me what you want to focus on.\nTo clear it, type: /focus clear`;
    return `You don't have a focus task set. What is the most important thing you need to do?`;
  },

  cmdReplay() {
    document.dispatchEvent(new CustomEvent('jarvis-open-replay'));
    return `Opening Brain Replay mode, Sir.`;
  },

  async cmdInsights() {
    const insights = await ApiClient.getInsights();
    const recent = insights.slice(0, 10);
    if (recent.length === 0) return `No insights yet. They'll appear as you use Jarvis more.`;
    let text = `**Recent Insights**\n\n`;
    for (const ins of recent) {
      const date = new Date(ins.created_at).toLocaleDateString();
      text += `• [${ins.type}] ${ins.text} (${date})\n`;
      try { await ApiClient.markInsightRead(ins.id); } catch {}
    }
    return text;
  },

  async cmdStats() {
    const stats = await ApiClient.getStats();
    let text = `**Jarvis — Your Statistics**\n\n`;
    text += `**Conversation:** ${stats.totalMessages} messages\n`;
    text += `**Thoughts:** ${stats.totalThoughts}\n`;
    text += `**Emotions:** ${stats.totalEmotions}\n`;
    text += `**Tasks:** ${stats.completedTasks} completed / ${stats.pendingTasks} pending\n`;
    text += `**Patterns Detected:** ${stats.totalPatterns}\n`;
    text += `**Insights Generated:** ${stats.totalInsights}\n`;
    text += `**Days Tracked:** ${stats.daysTracked}\n`;
    if (stats.topEmotions.length > 0) {
      text += `\n**Top Emotions (30 days):**\n`;
      for (const [e, c] of stats.topEmotions) text += `• ${e}: ${c} times\n`;
    }
    return text;
  },

  async cmdClear(args) {
    if (args[0] === 'confirm') {
      await ApiClient.clearConversations();
      return `Conversation cleared, Sir. A fresh start.`;
    }
    return `Are you sure you want to clear the conversation? Type: /clear confirm`;
  },

  cmdExport() {
    return `Data export is available via the server API.\n\nVisit: ${window.location.origin}/api/stats\n\nFull data export coming soon.`;
  },
};
