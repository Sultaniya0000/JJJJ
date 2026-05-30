const ChatInterface = {
  _isProcessing: false,
  _voiceMode: false,
  _conversations: [],

  async init() {
    this._bindEvents();
    await this._loadConversations();
    this._setGreeting();
  },

  _setGreeting() {
    const hour = new Date().getHours();
    let g;
    if (hour < 12) g = 'Good morning';
    else if (hour < 17) g = 'Good afternoon';
    else if (hour < 22) g = 'Good evening';
    else g = 'Good night';
    document.getElementById('greeting-text').textContent = `${g}, Sir.`;
  },

  _bindEvents() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    sendBtn.addEventListener('click', () => this.sendMessage());

    document.getElementById('suggestions-bar').addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip) { input.value = chip.dataset.text; this.sendMessage(); }
    });

    document.getElementById('voice-toggle').addEventListener('click', () => VoiceManager.toggle());
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('dashboard').classList.toggle('open');
    });
    document.getElementById('command-btn').addEventListener('click', () => {
      input.value = '/help'; this.sendMessage();
    });

    document.addEventListener('jarvis-open-journal', () => this._openJournal());
    document.addEventListener('jarvis-open-brainmap', () => this._openBrainMap());
    document.addEventListener('jarvis-open-replay', () => this._openReplay());

    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
      });
    });

    VoiceManager.onTranscript = (transcript) => {
      input.value = transcript;
      this.sendMessage();
    };

    this._updateTime();
    setInterval(() => this._updateTime(), 30000);
  },

  _updateTime() {
    document.getElementById('time-display').textContent = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });
  },

  async _loadConversations() {
    try {
      this._conversations = await ApiClient.getConversations();
      const container = document.getElementById('messages');
      container.innerHTML = '';
      for (const msg of this._conversations) {
        this._renderMessage(msg.role, msg.content, msg.timestamp, false);
      }
      if (this._conversations.length === 0) {
        this._renderWelcomeMessage();
      }
      this._scrollToBottom();
    } catch {
      this._renderWelcomeMessage();
    }
  },

  _renderWelcomeMessage() {
    const hour = new Date().getHours();
    let g;
    if (hour < 12) g = 'Good morning';
    else if (hour < 17) g = 'Good afternoon';
    else if (hour < 22) g = 'Good evening';
    else g = 'Good night';
    this._renderMessage('assistant', `${g}, Sir. I'm Jarvis, your cognitive companion.\n\nI'm here to help you understand how your mind works. No judgments, no pressure — just a thinking partner.\n\nHow are you feeling right now?`, Date.now(), true);
  },

  async sendMessage() {
    if (this._isProcessing) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this._isProcessing = true;

    this._renderMessage('user', text, Date.now(), true);
    this._showTypingIndicator();

    try {
      let response;

      if (text.startsWith('/')) {
        response = await Commands.execute(text);
      } else {
        response = await ApiClient.chat(text);
        if (!response) {
          response = "I'm not sure how to respond to that. Could you tell me more, Sir?";
        }
      }

      this._hideTypingIndicator();
      this._renderMessage('assistant', response, Date.now(), true);

      // Check for thought connection (client-side)
      this._checkConnection(text, response);
    } catch (err) {
      this._hideTypingIndicator();
      this._renderMessage('assistant', "I apologize, Sir. I'm having trouble connecting. Please try again.", Date.now(), true);
    }

    if (this._voiceMode) {
      const lastMsg = document.querySelector('.message:last-child .message-bubble');
      if (lastMsg) VoiceManager.speak(lastMsg.textContent);
    }

    Dashboard.refresh();
    this._isProcessing = false;
  },

  async _checkConnection(userText, aiResponse) {
    try {
      const chain = await ApiClient.getReplayChain(userText);
      if (chain.length >= 2) {
        const latest = chain[chain.length - 1];
        const daysAgo = Math.floor((Date.now() - latest.timestamp) / 86400000);
        const msg = `I noticed a similarity to a thought you had ${daysAgo > 0 ? daysAgo + ' day(s) ago' : 'earlier today'}.\n\n"${latest.text.slice(0, 100)}"\n\nWould you like to explore this connection?`;
        setTimeout(() => this._renderMessage('assistant', msg, Date.now(), true), 1500);
      }
    } catch {}
  },

  _renderMessage(role, content, timestamp, animate) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'jarvis'}`;
    if (!animate) div.style.animation = 'none';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'J';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    bubble.appendChild(time);
    div.appendChild(avatar);
    div.appendChild(bubble);
    container.appendChild(div);
    this._scrollToBottom();
  },

  _showTypingIndicator() {
    const container = document.getElementById('messages');
    const ind = document.createElement('div');
    ind.className = 'typing-indicator';
    ind.id = 'typing-indicator';
    ind.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(ind);
    this._scrollToBottom();
  },

  _hideTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  async _openJournal() {
    const modal = document.getElementById('journal-modal');
    const content = document.getElementById('journal-content');
    modal.classList.remove('hidden');

    try {
      const todayLog = await ApiClient.getTodayJournal();
      if (todayLog && todayLog.length > 0) {
        let html = '<p>Your reflection for today:</p><br>';
        for (const entry of todayLog) {
          html += `<div class="reflection-question"><label>${entry.question}</label><p>${entry.answer}</p></div>`;
        }
        content.innerHTML = html;
        return;
      }
    } catch {}

    const questions = [
      'What went well today?',
      'What was difficult today?',
      'What distracted you most?',
      'What energized you?',
      'What emotion appeared most often?',
      'What did you learn about yourself?',
    ];

    content.innerHTML = '<h3 style="margin-bottom:16px;font-weight:500;">Evening Reflection</h3>';
    const inputs = {};

    for (const q of questions) {
      const div = document.createElement('div');
      div.className = 'reflection-question';
      const label = document.createElement('label');
      label.textContent = q;
      const ta = document.createElement('textarea');
      ta.placeholder = 'Type your answer...';
      ta.rows = 2;
      div.appendChild(label);
      div.appendChild(ta);
      content.appendChild(div);
      inputs[q] = ta;
    }

    const btn = document.createElement('button');
    btn.className = 'suggestion-chip';
    btn.textContent = 'Save Reflection';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', async () => {
      const entries = {};
      for (const [q, ta] of Object.entries(inputs)) {
        if (ta.value.trim()) entries[q] = ta.value;
      }
      if (Object.keys(entries).length === 0) return;
      try {
        await ApiClient.saveJournal(entries);
        this._renderMessage('assistant', 'Thank you, Sir. Your reflection has been saved.', Date.now(), true);
      } catch {}
      modal.classList.add('hidden');
    });
    content.appendChild(btn);
  },

  async _openBrainMap() {
    const modal = document.getElementById('brainmap-modal');
    modal.classList.remove('hidden');
    try {
      const graph = await ApiClient.getBrainGraph();
      ThoughtGraph.renderFromData('brainmap-canvas', graph);
    } catch {
      document.getElementById('brainmap-canvas').innerHTML = '<div class="empty-state">Unable to load brain map.</div>';
    }
  },

  async _openReplay() {
    const modal = document.getElementById('replay-modal');
    const content = document.getElementById('replay-content');
    modal.classList.remove('hidden');

    const lastUserMsg = this._conversations.filter(m => m.role === 'user').pop();
    const query = lastUserMsg ? lastUserMsg.content : 'my thoughts';

    try {
      const chain = await ApiClient.getReplayChain(query);
      if (!chain || chain.length === 0) {
        content.innerHTML = '<p>Not enough related thoughts to build a replay chain. Keep sharing and this will populate.</p>';
        return;
      }
      let html = '<div class="replay-chain">';
      for (let i = 0; i < chain.length; i++) {
        const t = chain[i];
        const date = new Date(t.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const tags = JSON.parse(t.tags || '[]');
        html += `<div class="replay-node ${i === chain.length - 1 ? 'current' : ''}">`;
        html += `"${t.text.slice(0, 120)}"`;
        html += `<span class="replay-date">${date}${tags.length ? ' · ' + tags.join(', ') : ''}</span>`;
        html += `</div>`;
        if (i < chain.length - 1) html += `<div class="replay-connector"><span class="arrow">↓</span></div>`;
      }
      html += '</div>';
      content.innerHTML = html;
    } catch {
      content.innerHTML = '<p>Error loading replay chain.</p>';
    }
  },

  _scrollToBottom() {
    requestAnimationFrame(() => {
      document.getElementById('messages-container').scrollTop =
        document.getElementById('messages-container').scrollHeight;
    });
  },
};
