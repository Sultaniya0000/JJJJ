/* ============================================
   Voice Mode — Speech I/O
   Supports speech recognition (Web Speech API)
   and text-to-speech output
   ============================================ */

const VoiceManager = {
  enabled: false,
  listening: false,
  recognition: null,
  synthesis: window.speechSynthesis,
  onTranscript: null,
  preferredVoice: null,

  init() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not available');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && this.onTranscript) {
        this.onTranscript(finalTranscript);
        this.stopListening();
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.listening = false;
      this._updateUI();
    };

    this.recognition.onend = () => {
      this.listening = false;
      this._updateUI();
    };

    // Find a good voice
    this.synthesis.onvoiceschanged = () => {
      const voices = this.synthesis.getVoices();
      this.preferredVoice = voices.find(v => v.name.includes('Samantha'))
        || voices.find(v => v.lang.startsWith('en') && v.name.includes('Female'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
    };
  },

  toggle() {
    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  },

  startListening() {
    if (!this.recognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      this.recognition.start();
      this.listening = true;
      this._updateUI();
    } catch (e) {
      console.warn('Voice start failed:', e);
    }
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    this.listening = false;
    this._updateUI();
  },

  speak(text, callback) {
    if (!this.synthesis) {
      if (callback) callback();
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    utterance.onend = () => {
      if (callback) callback();
    };

    utterance.onerror = () => {
      if (callback) callback();
    };

    this.synthesis.speak(utterance);
  },

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  },

  _updateUI() {
    const toggleBtn = document.getElementById('voice-toggle');
    const indicator = document.getElementById('voice-indicator');

    if (toggleBtn) {
      toggleBtn.textContent = this.listening ? '🔴' : '🎤';
      toggleBtn.style.color = this.listening ? 'var(--red)' : '';
    }

    if (indicator) {
      indicator.classList.toggle('hidden', !this.listening);
    }

    document.getElementById('status-text').textContent = this.listening ? 'Listening...' : 'Ready';
  },

  isSupported() {
    return !!(
      ('webkitSpeechRecognition' in window) ||
      ('SpeechRecognition' in window)
    );
  },
};
