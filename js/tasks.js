/* ============================================
   Task Awareness System
   Manages focus tasks, reminders, and
   gentle nudges without guilt or shame
   ============================================ */

const TaskManager = {
  init() {
    this._restoreFocusTask();
    this._startReminderCheck();
  },

  _restoreFocusTask() {
    const current = Memory.get('currentFocusTask');
    if (current) {
      document.getElementById('current-task').textContent = current;
    }
  },

  setFocusTask(title) {
    Memory.setCurrentFocusTask(title);
    Memory.addTask(title, 'high');
    document.getElementById('current-task').textContent = title;
  },

  clearFocusTask() {
    Memory.setCurrentFocusTask(null);
    document.getElementById('current-task').textContent = '—';
  },

  completeFocusTask() {
    const current = Memory.get('currentFocusTask');
    if (current) {
      const tasks = Memory.getPendingTasks();
      const task = tasks.find(t => t.title === current);
      if (task) {
        Memory.completeTask(task.id);
      }
      this.clearFocusTask();
      return `Excellent work, Sir. I've marked "${current}" as complete.`;
    }
    return null;
  },

  _startReminderCheck() {
    setInterval(() => this._checkForReminder(), 600000); // every 10 min
  },

  _checkForReminder() {
    const focusTask = Memory.get('currentFocusTask');
    if (!focusTask) return;

    // Only remind if no recent conversation activity
    const conversations = Memory.getRecentConversation(5);
    if (conversations.length === 0) return;

    const lastMsg = conversations[conversations.length - 1];
    if (!lastMsg) return;

    // Don't remind if user just sent a message (within last 2 min)
    const minutesSinceLast = (Date.now() - lastMsg.timestamp) / 60000;
    if (minutesSinceLast < 2) return;

    // Check if user mentioned the task recently
    const recentMsgs = conversations.slice(-3);
    const mentionedRecently = recentMsgs.some(m =>
      m.role === 'user' && m.content.toLowerCase().includes(focusTask.toLowerCase().slice(0, 10))
    );
    if (mentionedRecently) return;

    const event = new CustomEvent('jarvis-reminder', {
      detail: {
        task: focusTask,
        message: `You mentioned that ${focusTask} was important today. Would you like to continue?`,
      },
    });
    document.dispatchEvent(event);
  },

  getTaskList() {
    const pending = Memory.getPendingTasks();
    const completed = Memory.get('tasks').filter(t => t.completed);

    return {
      pending: pending.slice(-10).reverse(),
      completed: completed.slice(-10).reverse(),
      total: pending.length + completed.length,
      completionRate: completed.length > 0
        ? Math.round(completed.length / (pending.length + completed.length) * 100)
        : 0,
    };
  },

  generateTaskSummary() {
    const pending = Memory.getPendingTasks();
    const focus = Memory.get('currentFocusTask');

    if (pending.length === 0) {
      return "You have no pending tasks. Would you like to set a new focus?";
    }

    if (focus) {
      return `Your current focus is "${focus}". You also have ${pending.length - 1} other pending task(s).`;
    }

    return `You have ${pending.length} pending task(s). Would you like to set a focus for today?`;
  },
};
