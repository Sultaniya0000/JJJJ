const App = {
  async init() {
    Commands.init();
    VoiceManager.init();

    await ChatInterface.init();
    await Dashboard.refresh();

    // Auto-refresh dashboard periodically
    setInterval(() => Dashboard.refresh(), 30000);

    console.log('Jarvis Cognitive Companion initialized (AI backend)');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

window.addEventListener('error', (e) => {
  console.warn('Jarvis error:', e.message);
});

window.ApiClient = ApiClient;
window.Commands = Commands;
window.ChatInterface = ChatInterface;
window.Dashboard = Dashboard;
window.ThoughtGraph = ThoughtGraph;
window.VoiceManager = VoiceManager;
