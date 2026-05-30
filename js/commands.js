/* ============================================
   Command Center — Slash commands
   /today  /mood  /tasks  /journal
   /brainmap  /patterns  /focus  /help
   ============================================ */

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
    this.register('focus', 'Set focus task', this.cmdFocus);
    this.register('replay', 'Brain replay mode', this.cmdReplay);
    this.register('insights', 'View recent insights', this.cmdInsights);
    this.register('stats', 'View your stats', this.cmdStats);
    this.register('clear', 'Clear conversation', this.cmdClear);
    this.register('export', 'Export your data', this.cmdExport);
  },

  register(name, description, handler) {
    this.registry[name] = { description, handler };
  },

  execute(input) {
    const parts = input.toLowerCase().replace(/^\//, '').split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const entry = this.registry[cmd];
    if (!entry) {
      return `Unknown command. Type /help to see available commands.`;
    }

    return entry.handler(args);
  },

  cmdHelp() {
    const commands = Object.entries(Commands.registry);
    let text = '**Available Commands:**\n\n';
    for (const [name, entry] of commands) {
      text += `**/${name}** — ${entry.description}\n`;
    }
    return text;
  },

  cmdToday() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const focusTask = Memory.get('currentFocusTask');
    const mood = Memory.get('currentMood');
    const pending = Memory.getPendingTasks();
    const conversations = Memory.getTodayConversation();

    let text = `**${dateStr}**\n\n`;
    text += `**Mood:** ${mood || 'Not recorded yet'}\n`;
    text += `**Focus:** ${focusTask || 'Not set'}\n`;
    text += `**Pending Tasks:** ${pending.length}\n`;
    text += `**Messages Today:** ${conversations.length}\n`;

    // Recent emotions
    const emotions = Memory.getRecentEmotions(1);
    if (emotions.length > 0) {
      text += `\n**Emotions logged today:**\n`;
      for (const e of emotions.slice(-5)) {
        text += `• ${e.emotion} (${e.intensity}/10) — ${new Date(e.timestamp).toLocaleTimeString()}\n`;
      }
    }

    return text;
  },

  cmdMood() {
    const moods = ['Happy', 'Calm', 'Anxious', 'Sad', 'Angry', 'Overwhelmed', 'Tired', 'Excited', 'Grateful', 'Hopeful', 'Stressed', 'Bored', 'Frustrated', 'Lonely', 'Rejected'];
    let text = `**How are you feeling?** Choose one:\n\n`;
    for (const mood of moods) {
      text += `• ${mood}\n`;
    }
    text += `\nOr type: /mood [your emotion]`;
    return text;
  },

  cmdTasks() {
    const taskData = TaskManager.getTaskList();
    if (taskData.pending.length === 0) {
      return `**Tasks:** No pending tasks. You're all caught up, Sir.`;
    }

    let text = `**Pending Tasks (${taskData.pending.length})**\n\n`;
    for (const task of taskData.pending) {
      const created = new Date(task.createdAt).toLocaleDateString();
      text += `• ${task.title} (${task.priority}) — added ${created}\n`;
    }

    if (taskData.completionRate > 0) {
      text += `\n**Completion Rate:** ${taskData.completionRate}%`;
    }

    return text;
  },

  cmdJournal() {
    // Open journal modal via event
    const event = new CustomEvent('jarvis-open-journal');
    document.dispatchEvent(event);
    return `Opening your daily reflection journal, Sir.`;
  },

  cmdBrainmap() {
    const event = new CustomEvent('jarvis-open-brainmap');
    document.dispatchEvent(event);
    return `Opening your thought graph, Sir.`;
  },

  cmdPatterns() {
    const patterns = PatternEngine.analyzeAll();
    if (patterns.length === 0) {
      return `No significant patterns detected yet. Continue using Jarvis and patterns will emerge as data accumulates.`;
    }

    let text = `**Detected Patterns (${patterns.length})**\n\n`;
    for (const p of patterns) {
      const icon = p.severity === 'warning' ? '⚠️' : p.severity === 'insight' ? '💡' : '📊';
      text += `${icon} **${p.type}:** ${p.text}\n\n`;
    }

    // Store patterns
    for (const p of patterns) {
      Memory.addInsight(p.text, p.type);
    }

    return text;
  },

  cmdFocus(args) {
    const current = Memory.get('currentFocusTask');

    if (args[0] === 'clear') {
      TaskManager.clearFocusTask();
      Dashboard.refresh();
      return `Focus task cleared, Sir.`;
    }

    if (args.length > 0) {
      const task = args.join(' ');
      TaskManager.setFocusTask(task);
      Dashboard.refresh();
      return `I've set "${task}" as your focus for today, Sir. I'll check in with you on it later.`;
    }

    if (current) {
      return `Your current focus is: "${current}".\n\nTo change it, tell me what you want to focus on.\nTo clear it, type: /focus clear`;
    }
    return `You don't have a focus task set. What is the most important thing you need to do?`;
  },

  cmdReplay() {
    const event = new CustomEvent('jarvis-open-replay');
    document.dispatchEvent(event);
    return `Opening Brain Replay mode, Sir.`;
  },

  cmdInsights() {
    const insights = Memory.get('insights');
    const unread = insights.filter(i => !i.read);

    if (unread.length === 0 && insights.length === 0) {
      return `No insights yet. They'll appear as you use Jarvis more.`;
    }

    const recent = insights.slice(-10).reverse();
    let text = `**Recent Insights**\n\n`;
    for (const insight of recent) {
      const date = new Date(insight.createdAt).toLocaleDateString();
      text += `• [${insight.type}] ${insight.text} (${date})\n`;
      Memory.markInsightRead(insight.id);
    }
    return text;
  },

  cmdStats() {
    const stats = Memory.getStats();
    let text = `**Jarvis — Your Statistics**\n\n`;
    text += `**Conversation:** ${stats.totalMessages} messages\n`;
    text += `**Thoughts:** ${stats.totalThoughts}\n`;
    text += `**Emotions:** ${stats.totalEmotions}\n`;
    text += `**Tasks:** ${stats.completedTasks} completed / ${stats.missedTasks} pending\n`;
    text += `**Patterns Detected:** ${stats.totalPatterns}\n`;
    text += `**Insights Generated:** ${stats.totalInsights}\n`;
    text += `**Days Tracked:** ${stats.daysTracked}\n`;

    if (stats.topEmotions.length > 0) {
      text += `\n**Top Emotions (30 days):**\n`;
      for (const [emotion, count] of stats.topEmotions) {
        text += `• ${emotion}: ${count} times\n`;
      }
    }

    return text;
  },

  cmdClear(args) {
    if (args[0] === 'confirm') {
      Memory.set('conversations', []);
      return `Conversation cleared, Sir. A fresh start.`;
    }
    return `Are you sure you want to clear the conversation? Type: /clear confirm`;
  },

  cmdExport() {
    const data = JSON.stringify(Memory._data, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return `Your data has been exported, Sir.`;
  },
};
