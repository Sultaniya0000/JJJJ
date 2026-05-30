/* ============================================
   Chat Interface — UI layer
   Renders messages, handles input,
   manages suggestions and typing indicators
   ============================================ */

const ChatInterface = {
  _isProcessing: false,
  _voiceMode: false,
  _pendingReplay: null,
  _pendingReflection: null,

  init() {
    this._bindEvents();
    this._renderWelcomeMessage();
    this._checkForReflection();
    this._renderExistingMessages();
  },

  _bindEvents() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const suggestionsBar = document.getElementById('suggestions-bar');

    // Send on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Suggestion chips
    suggestionsBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip) {
        input.value = chip.dataset.text;
        this.sendMessage();
      }
    });

    // Voice toggle
    document.getElementById('voice-toggle').addEventListener('click', () => {
      VoiceManager.toggle();
    });

    // Menu toggle (mobile)
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('dashboard').classList.toggle('open');
    });

    // Command button
    document.getElementById('command-btn').addEventListener('click', () => {
      input.value = '/help';
      this.sendMessage();
    });

    // Listen for Jarvis reminder events
    document.addEventListener('jarvis-reminder', (e) => {
      this._showReminder(e.detail);
    });

    // Listen for Jarvis insight events
    document.addEventListener('jarvis-insight', (e) => {
      this._showInsight(e.detail);
    });

    // Listen for open journal
    document.addEventListener('jarvis-open-journal', () => {
      this._openJournal();
    });

    // Listen for open brain map
    document.addEventListener('jarvis-open-brainmap', () => {
      this._openBrainMap();
    });

    // Listen for open replay
    document.addEventListener('jarvis-open-replay', () => {
      this._openReplay();
    });

    // Listen for thought details
    document.addEventListener('jarvis-show-thought', (e) => {
      this._showThoughtDetail(e.detail);
    });

    // Close modals
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
      });
    });

    // Voice transcript callback
    VoiceManager.onTranscript = (transcript) => {
      input.value = transcript;
      this.sendMessage();
    };

    // Update time
    this._updateTime();
    setInterval(() => this._updateTime(), 30000);
  },

  _updateTime() {
    const now = new Date();
    document.getElementById('time-display').textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });
  },

  _renderWelcomeMessage() {
    if (Memory.get('conversations').length === 0) {
      const hour = new Date().getHours();
      let greeting;
      if (hour < 12) greeting = 'Good morning';
      else if (hour < 17) greeting = 'Good afternoon';
      else if (hour < 22) greeting = 'Good evening';
      else greeting = 'Good night';

      this.addMessage('jarvis', `${greeting}, Sir. I'm Jarvis, your cognitive companion.\n\nI'm here to help you understand how your mind works. No judgments, no pressure — just a thinking partner.\n\nHow are you feeling right now?`);
    }
  },

  _renderExistingMessages() {
    const messages = Memory.getRecentConversation(50);
    for (const msg of messages) {
      this._renderMessage(msg.role, msg.content, msg.timestamp, false);
    }
    this._scrollToBottom();
  },

  _checkForReflection() {
    // Check if it's time for evening reflection
    setTimeout(() => {
      const msg = InsightEngine.getScheduledCheckin();
      if (msg) {
        setTimeout(() => this.addMessage('jarvis', msg), 1500);
      }
    }, 2000);
  },

  async sendMessage() {
    if (this._isProcessing) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this._isProcessing = true;

    // Add user message (also logs to memory)
    this.addMessage('user', text);

    // Check for connection to past thoughts
    const connection = ThoughtGraph.detectConnection(text);

    // Show typing indicator
    this._showTypingIndicator();

    // Simulate processing time (for natural feel)
    await this._delay(600 + Math.random() * 800);

    // Generate response
    let response = await JarvisCore.generateResponse(text);

    if (!response) {
      response = "I'm not sure how to respond to that. Could you tell me more?";
    }

    // If there's a thought connection, append it
    if (connection && !text.startsWith('/')) {
      response += `\n\n${connection.text}\n\nWould you like to explore this connection?`;
      this._pendingReplay = connection.thought;
    }

    // Check for proactive insight after message
    const insightMsg = InsightEngine.triggerAfterMessage();
    if (insightMsg) {
      response += '\n\n' + insightMsg;
    }

    // Hide typing indicator and show response (also logs to memory)
    this._hideTypingIndicator();
    this.addMessage('jarvis', response);

    // Auto-speak if voice mode
    if (this._voiceMode) {
      VoiceManager.speak(response);
    }

    // Update dashboard
    Dashboard.refresh();

    this._isProcessing = false;
  },

  addMessage(role, content) {
    this._renderMessage(role, content, Date.now(), true);
    Memory.addMessage(role, content);
    this._scrollToBottom();
  },

  _renderMessage(role, content, timestamp, animate) {
    const container = document.getElementById('messages');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    if (!animate) msgDiv.style.animation = 'none';

    const avatar = role === 'jarvis' ? 'J' : 'You';
    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';

    // Convert markdown-like formatting
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    bubbleEl.innerHTML = formatted;

    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    msgDiv.appendChild(avatarEl);
    msgDiv.appendChild(bubbleEl);
    bubbleEl.appendChild(timeEl);

    container.appendChild(msgDiv);
  },

  _showTypingIndicator() {
    const container = document.getElementById('messages');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    this._scrollToBottom();
  },

  _hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  },

  _showReminder(detail) {
    this.addMessage('jarvis', `*Gentle reminder:* ${detail.message}`);
  },

  _showInsight(detail) {
    this.addMessage('jarvis', `*Insight:* ${detail.text}\n\nWould you like to explore this further?`);
    Memory.markInsightRead(detail.id);
  },

  _openJournal() {
    const modal = document.getElementById('journal-modal');
    const content = document.getElementById('journal-content');
    modal.classList.remove('hidden');

    const todayLog = Memory.getTodayLog();
    if (todayLog) {
      content.innerHTML = `<p>You've already completed today's reflection. Here's what you wrote:</p><br>`;
      for (const [q, a] of Object.entries(todayLog.entries)) {
        content.innerHTML += `<div class="reflection-question"><label>${q}</label><p>${a}</p></div>`;
      }
      return;
    }

    const questions = [
      'What went well today?',
      'What was difficult today?',
      'What distracted you most?',
      'What energized you?',
      'What emotion appeared most often?',
      'What did you learn about yourself?',
    ];

    content.innerHTML = '<h3 style="margin-bottom:16px;font-weight:500;">Evening Reflection</h3>';
    const answers = {};

    for (const q of questions) {
      const div = document.createElement('div');
      div.className = 'reflection-question';
      const label = document.createElement('label');
      label.textContent = q;
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Type your answer...';
      textarea.rows = 2;
      div.appendChild(label);
      div.appendChild(textarea);
      content.appendChild(div);
      answers[q] = textarea;
    }

    const submitBtn = document.createElement('button');
    submitBtn.className = 'suggestion-chip';
    submitBtn.textContent = 'Save Reflection';
    submitBtn.style.marginTop = '12px';
    submitBtn.addEventListener('click', () => {
      const entries = {};
      for (const [q, textarea] of Object.entries(answers)) {
        entries[q] = textarea.value;
      }
      Memory.saveDailyLog(entries);
      this.addMessage('jarvis', 'Thank you, Sir. Your reflection has been saved. Reviewing patterns like these helps build self-awareness over time.');
      modal.classList.add('hidden');
    });
    content.appendChild(submitBtn);
  },

  _openBrainMap() {
    const modal = document.getElementById('brainmap-modal');
    modal.classList.remove('hidden');
    ThoughtGraph.render('brainmap-canvas');

    // Re-render on resize
    setTimeout(() => ThoughtGraph.render('brainmap-canvas'), 100);
  },

  _openReplay() {
    const modal = document.getElementById('replay-modal');
    const content = document.getElementById('replay-content');
    modal.classList.remove('hidden');

    // Use the last user message or a default chain
    const conversations = Memory.getRecentConversation(10);
    const lastUserMsg = [...conversations].reverse().find(m => m.role === 'user');
    const query = lastUserMsg ? lastUserMsg.content : 'my thoughts';

    const chain = ThoughtGraph.getThoughtChain(query);
    if (chain.length === 0) {
      content.innerHTML = '<p>Not enough related thoughts found to build a replay chain. Keep sharing your thoughts and this will populate.</p>';
      return;
    }

    let html = '<div class="replay-chain">';
    for (let i = 0; i < chain.length; i++) {
      const thought = chain[i];
      const date = new Date(thought.timestamp).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
      const time = new Date(thought.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      });
      const isCurrent = i === chain.length - 1;

      html += `<div class="replay-node ${isCurrent ? 'current' : ''}">`;
      html += `"${thought.text.slice(0, 120)}"`;
      html += `<span class="replay-date">${date} at ${time}${thought.tags.length ? ' · ' + thought.tags.join(', ') : ''}</span>`;
      html += `</div>`;

      if (i < chain.length - 1) {
        html += `<div class="replay-connector"><span class="arrow">↓</span></div>`;
      }
    }
    html += '</div>';

    content.innerHTML = html;
  },

  _showThoughtDetail(detail) {
    this.addMessage('jarvis', `**Thought Detail**\n\n"${detail.text}"\n\n**Tags:** ${detail.tags.join(', ') || 'None'}\n**Recorded:** ${detail.date}\n**Linked to:** ${detail.links} other thought(s)`);
  },

  _scrollToBottom() {
    const container = document.getElementById('messages-container');
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  },

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
