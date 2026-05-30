/* ============================================
   Jarvis App — Main entry point
   Initializes all modules and coordinates
   the cognitive companion system
   ============================================ */

const App = {
  init() {
    // Initialize subsystems
    JarvisCore.init();
    TaskManager.init();
    Commands.init();
    VoiceManager.init();
    InsightEngine.start();

    // Initialize the chat interface (which also initializes the dashboard via events)
    ChatInterface.init();

    // Initial dashboard render
    Dashboard.refresh();

    // Run pattern analysis on startup
    setTimeout(() => {
      const patterns = PatternEngine.analyzeAll();
      for (const p of patterns) {
        Memory.addInsight(p.text, p.type);
      }
      Dashboard.refresh();
    }, 5000);

    // Listen for focus task setting from chat
    document.addEventListener('jarvis-set-focus', (e) => {
      TaskManager.setFocusTask(e.detail.task);
      Dashboard.refresh();
    });

    console.log(`Jarvis Cognitive Companion initialized.
      Memory: ${Memory.get('conversations').length} messages,
      ${Memory.get('thoughts').length} thoughts,
      ${Memory.get('emotions').length} emotions logged.`);
  },
};

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Handle global errors gracefully
window.addEventListener('error', (e) => {
  console.warn('Jarvis encountered an error:', e.message);
  document.getElementById('status-text').textContent = 'Running';
});

// Export key modules to global scope for cross-module access
window.JarvisCore = JarvisCore;
window.Memory = Memory;
window.Commands = Commands;
window.ChatInterface = ChatInterface;
window.Dashboard = Dashboard;
window.ThoughtGraph = ThoughtGraph;
window.PatternEngine = PatternEngine;
window.InsightEngine = InsightEngine;
window.TaskManager = TaskManager;
window.VoiceManager = VoiceManager;
