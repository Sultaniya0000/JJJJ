/* ============================================
   Jarvis Core — Personality & Response Engine
   Calm, intelligent, curious, supportive,
   non-judgmental, slightly futuristic
   ============================================ */

const JarvisCore = {
  userTitle: 'Sir',

  init() {
    this._setGreeting();
    this._startInsightTimer();
  },

  _setGreeting() {
    const hour = new Date().getHours();
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else if (hour < 22) greeting = 'Good evening';
    else greeting = 'Good night';
    document.getElementById('greeting-text').textContent = `${greeting}, ${this.userTitle}.`;
  },

  // --- Generate response based on user input and context ---
  async generateResponse(userInput) {
    const input = userInput.trim();
    if (!input) return null;

    const lower = input.toLowerCase();

    // Handle commands (start with /)
    if (input.startsWith('/')) {
      return this._handleCommand(input);
    }

    // Check for specific patterns and intents
    const context = this._analyzeContext(input);

    // Build a response using the context analysis
    const response = this._composeResponse(input, context);
    return response;
  },

  _analyzeContext(input) {
    const lower = input.toLowerCase();
    const context = {
      isGreeting: /^(hi|hello|hey|good\s*(morning|afternoon|evening|night)|yo|sup|howdy)/i.test(input),
      isFeeling: /(feel|feeling|felt|emotion|mood)/i.test(lower),
      isQuestion: input.includes('?'),
      isAboutDay: /(day|today|happened|went|morning|afternoon|evening)/i.test(lower),
      isAvoidance: /(avoid|procrastinat|should\s+be\s+doing|putting\s+off|dreading)/i.test(lower),
      isAnger: /(angry|mad|frustrated|annoyed|irritated)/i.test(lower),
      isSad: /(sad|depress|down|cry|tears|lonely|alone)/i.test(lower),
      isAnxious: /(anxi|anxious|nervous|worried|scared|fear|panic|overwhelm)/i.test(lower),
      isRejection: /(reject|ignored|excluded|left\s+out|abandon)/i.test(lower),
      isExhausted: /(tired|exhausted|drained|burnout|no\s+energy)/i.test(lower),
      isGrateful: /(grateful|thankful|blessed|appreciate|gratitude)/i.test(lower),
      isHappy: /(happy|glad|joy|great|wonderful|amazing|good|fantastic)/i.test(lower),
      isFocusTask: /(focus|task|important|should\s+i\s+do|priority)/i.test(lower),
      isHyperfocus: /(hyperfocus|hyper.?focus|locked\s+in|zone|obsess)/i.test(lower),
      isDistracted: /(distract|can't\s+focus|unfocus|scatter|scattered)/i.test(lower),
      isReflective: /(think|thought|wonder|why\s+do\s+i|pattern|always|never|notice)/i.test(lower),
      isHelp: /(help|assist|can\s+you|would\s+you|please)/i.test(lower),
      isThanks: /(thanks|thank\s+you|appreciate\s+it)/i.test(lower),
      isBye: /(bye|goodbye|see\s+you|talk\s+later|night)/i.test(lower),
    };

    // Extract emotional content
    const emotionKeywords = [
      { word: 'anxious', emotion: 'Anxiety' },
      { word: 'anxiety', emotion: 'Anxiety' },
      { word: 'nervous', emotion: 'Anxiety' },
      { word: 'worried', emotion: 'Worry' },
      { word: 'scared', emotion: 'Fear' },
      { word: 'fear', emotion: 'Fear' },
      { word: 'angry', emotion: 'Anger' },
      { word: 'frustrated', emotion: 'Frustration' },
      { word: 'sad', emotion: 'Sadness' },
      { word: 'lonely', emotion: 'Loneliness' },
      { word: 'rejected', emotion: 'Rejection' },
      { word: 'overwhelmed', emotion: 'Overwhelm' },
      { word: 'tired', emotion: 'Fatigue' },
      { word: 'exhausted', emotion: 'Fatigue' },
      { word: 'happy', emotion: 'Happiness' },
      { word: 'excited', emotion: 'Excitement' },
      { word: 'grateful', emotion: 'Gratitude' },
      { word: 'guilty', emotion: 'Guilt' },
      { word: 'ashamed', emotion: 'Shame' },
      { word: 'hopeful', emotion: 'Hope' },
      { word: 'motivated', emotion: 'Motivation' },
      { word: 'stressed', emotion: 'Stress' },
      { word: 'calm', emotion: 'Calm' },
      { word: 'bored', emotion: 'Boredom' },
    ];

    context.detectedEmotion = null;
    for (const { word, emotion } of emotionKeywords) {
      if (lower.includes(word)) {
        context.detectedEmotion = emotion;
        break;
      }
    }

    // Check for thought tags (via memory)
    context.relatedThoughts = Memory.getThoughtsByTag(context.detectedEmotion || '');

    return context;
  },

  _composeResponse(input, context) {
    // First visit / setup
    if (Memory.get('firstVisit')) {
      Memory.set('firstVisit', false);
      return this._firstVisitResponse();
    }

    // Handle specific intents with priority
    if (context.isGreeting && input.length < 30) {
      return this._greetingResponse();
    }

    if (context.isThanks) {
      return "You're welcome, Sir. I'm always here when you need me.";
    }

    if (context.isBye) {
      return "Take care, Sir. I'll be here whenever you need me. Rest well.";
    }

    // Handle simple yes/no answers to prior questions
    if (/^(yes|yeah|sure|ok|okay|alright|go ahead)/i.test(input)) {
      return this._yesResponse();
    }
    if (/^(no|nah|nope|not really|not now)/i.test(input)) {
      return this._noResponse();
    }

    // Check for single-word emotion ("Anxious", "Sad", etc.)
    const singleEmotion = this._detectSingleEmotion(input);
    if (singleEmotion || (context.detectedEmotion && (context.isFeeling || input.length < 30))) {
      return this._emotionResponse(context.detectedEmotion || singleEmotion, context);
    }

    // Handle numeric rating (e.g., "7" in response to scale question)
    if (/^\d{1,2}$/.test(input.trim()) || /^(it's a|its a|about a) \d{1,2}/i.test(input)) {
      return this._numericResponse(input);
    }

    if (context.isRejection) {
      return this._rejectionResponse(context);
    }

    if (context.isAnxious) {
      return this._anxietyResponse(context);
    }

    if (context.isSad) {
      return this._sadnessResponse(context);
    }

    if (context.isAnger) {
      return this._angerResponse(context);
    }

    if (context.isExhausted) {
      return this._exhaustionResponse();
    }

    if (context.isAvoidance) {
      return this._avoidanceResponse();
    }

    if (context.isDistracted) {
      return this._distractionResponse();
    }

    // Detect focus setting (user responding to focus prompt)
    if (context.isFocusTask || this._isSettingTask(input)) {
      return this._focusResponse(input);
    }

    // Goal extraction
    if (this._isSettingGoal(input)) {
      return this._goalResponse(input);
    }

    if (context.isReflective) {
      return this._reflectiveResponse(input, context);
    }

    if (context.isAboutDay) {
      return this._dayResponse(context);
    }

    if (context.isHappy || context.isGrateful) {
      return this._positiveResponse();
    }

    // Default: thoughtful exploration
    return this._defaultResponse(input, context);
  },

  _firstVisitResponse() {
    return `Welcome, ${this.userTitle}. I'm Jarvis, your cognitive companion. I'm here to help you understand how your mind works.

I don't diagnose or treat — I simply observe, remember, and help you identify patterns.

To begin, could you tell me how you're feeling right now?`;
  },

  _greetingResponse() {
    const hour = new Date().getHours();
    let timeContext = '';
    if (hour < 12) timeContext = 'starting your morning';
    else if (hour < 17) timeContext = 'in the middle of your day';
    else if (hour < 22) timeContext = 'winding down';
    else timeContext = 'still awake at this hour';

    const variants = [
      `Hello, ${this.userTitle}. How are you ${timeContext}?`,
      `Good to hear from you, ${this.userTitle}. How are things?`,
      `Right here with you, ${this.userTitle}. What's on your mind?`,
    ];
    return this._random(variants);
  },

  _emotionResponse(emotion, context) {
    Memory.logEmotion(emotion);

    // Check for patterns
    const freq = Memory.getEmotionFrequency(30);
    const match = freq.find(([e]) => e === emotion);
    const count = match ? match[1] : 0;

    let patternNote = '';
    if (count >= 5) {
      patternNote = ` I've noticed this feeling has appeared ${count} times in the last month.`;
    }

    const responses = {
      'Anxiety': [
        `I hear you, ${this.userTitle}. Anxiety can feel overwhelming. Can you describe what's triggering it right now?${patternNote}`,
        `Anxiety is a signal, not a weakness. What thoughts are circling right now?${patternNote}`,
      ],
      'Fear': [
        `Fear has a way of amplifying itself. What specifically is frightening you right now?${patternNote}`,
      ],
      'Worry': [
        `Worry is the mind trying to prepare for every outcome. What scenario is playing out in your head?${patternNote}`,
      ],
      'Anger': [
        `Anger often masks something underneath — hurt, fear, or frustration. What do you think is at the root?${patternNote}`,
      ],
      'Frustration': [
        `Frustration usually means something matters to you. What feels blocked right now?${patternNote}`,
      ],
      'Sadness': [
        `Sadness deserves space, not dismissal. Would you like to sit with it, or explore where it's coming from?${patternNote}`,
      ],
      'Loneliness': [
        `Loneliness is a signal for connection. Would you like to talk through what would help right now?${patternNote}`,
      ],
      'Rejection': [
        `Rejection wounds deeply because humans are wired for belonging. Would you like to examine this feeling together?${patternNote}`,
      ],
      'Overwhelm': [
        `When everything feels like too much, the first step is to pause. Let's break things down together.${patternNote}`,
      ],
      'Fatigue': [
        `Mental fatigue is real and valid. When was the last time you truly rested without guilt?${patternNote}`,
      ],
      'Happiness': [
        `That's good to hear, ${this.userTitle}. What contributed to this feeling? It's worth understanding what works.`,
      ],
      'Excitement': [
        `Energy and excitement are precious. What's fueling this feeling?`,
      ],
      'Gratitude': [
        `Gratitude is a powerful anchor. What are you grateful for in this moment?`,
      ],
      'Guilt': [
        `Guilt often comes from a gap between your actions and your values. Can you identify which value feels unmet?${patternNote}`,
      ],
      'Shame': [
        `Shame whispers 'you are the problem' — but that's never the full truth. Would you like to untangle this feeling?${patternNote}`,
      ],
      'Hope': [
        `Hope is a quiet strength. What's giving you hope right now?`,
      ],
      'Motivation': [
        `Motivation is welcome but unreliable. What's one small step you can take while the energy is here?`,
      ],
      'Stress': [
        `Stress narrows our perspective. Let's zoom out together. What is the one thing at the center of this?${patternNote}`,
      ],
      'Calm': [
        `Calm is a state worth savoring. What helped you find it?`,
      ],
      'Boredom': [
        `Boredom can feel uncomfortable, but it's often the mind's way of saying it needs novelty or rest.`,
      ],
    };

    const pool = responses[emotion] || [
      `Thank you for sharing that, ${this.userTitle}. I'd like to understand more. What makes you feel ${emotion.toLowerCase()}?`,
    ];

    return this._random(pool);
  },

  _rejectionResponse(context) {
    const freq = Memory.getEmotionFrequency(30);
    const rejectionCount = freq.find(([e]) => e === 'Rejection');
    const count = rejectionCount ? rejectionCount[1] : 0;

    let replayOffer = '';
    if (count >= 2) {
      replayOffer = ` Would you like to connect this feeling to previous experiences? I can show you related moments.`;
    }

    return `I understand that feeling, ${this.userTitle}. Rejection activates the same brain regions as physical pain.${replayOffer} Can you tell me more about what happened?`;
  },

  _anxietyResponse(context) {
    return `Anxiety wants you to prepare, but it often over-prepares. Let me ask: on a scale of 1-10, how intense is this anxiety right now? What's the first thought that comes with it?`;
  },

  _sadnessResponse(context) {
    return `I'm here with you, ${this.userTitle}. Sadness isn't something to fix — it's something to understand. Would you like to talk about what brought this on, or simply sit with the feeling for a moment?`;
  },

  _angerResponse(context) {
    return `Anger has high energy. Instead of suppressing it, let's channel it. What is the boundary that you feel has been crossed?`;
  },

  _exhaustionResponse() {
    return `Mental exhaustion is invisible but heavy. You don't need to push through right now. What if we just sat with it for a moment? Rest is not a reward — it's a requirement.`;
  },

  _avoidanceResponse() {
    return `Avoidance is a sign that something matters enough to feel intimidating. What task are you avoiding, and what about it feels heavy?`;
  },

  _distractionResponse() {
    return `A scattered mind is often an overwhelmed mind. Let's try something: name one thing you could focus on for just 5 minutes. I'll help you start.`;
  },

  _focusResponse(input) {
    if (input) {
      // User provided a task - extract and set it
      let task = input
        .replace(/^(i need to|i should|i have to|i must|my task is|my focus is|the most important thing|i want to|i'm working on|finish|complete|work on|do|start)/i, '')
        .replace(/^(today|now)/i, '')
        .trim();
      if (task.length > 2) {
        // Clean up leading punctuation
        task = task.replace(/^[:\s,.-]+/, '').trim();
        TaskManager.setFocusTask(task);
        Dashboard.refresh();
        return `I've set "${task}" as your focus for today, Sir. I'll check in with you on it later. Would you like to set a time to work on it?`;
      }
    }
    return `Let's identify your priority. What is the most important task you need to complete today? I'll help you stay on track.`;
  },

  _positiveResponse() {
    return `That's wonderful, ${this.userTitle}. What allowed this positive state to emerge? Understanding that is just as important as understanding difficulties.`;
  },

  _dayResponse(context) {
    const hasLog = Memory.getTodayLog();
    if (hasLog) {
      return `You've already recorded some reflections today. Would you like to add more or explore something specific about how your day went?`;
    }
    return `How was your day today, ${this.userTitle}? What stood out to you — good or difficult?`;
  },

  _reflectiveResponse(input, context) {
    return `That's an insightful question to ask yourself. Let's explore it together. When you think about this, what does it connect to in your past experiences?`;
  },

  _defaultResponse(input, context) {
    // Fallback response that encourages exploration
    const responses = [
      `I find that interesting, ${this.userTitle}. Can you tell me more?`,
      `I'd like to understand that better. What makes you say that?`,
      `Let's sit with that for a moment. What else comes to mind?`,
      `That's worth exploring. How does that make you feel?`,
      `I'm listening, ${this.userTitle}. What's the feeling behind those words?`,
      `Would you like to explore that thought deeper?`,
      `That's a meaningful observation. What do you think it says about your mental patterns?`,
    ];
    return this._random(responses);
  },

  // --- Command execution ---
  _handleCommand(input) {
    const cmd = input.toLowerCase().split(' ')[0];
    const Commands = window.Commands;
    if (Commands && Commands.execute) {
      return Commands.execute(cmd);
    }
    return `Command "${cmd}" not recognized. Try /help to see available commands.`;
  },

  // --- Pattern check (called periodically) ---
  checkForPatterns() {
    const stats = Memory.getStats();

    // Check for sleep-mood correlation
    const sleepData = Memory.getRecentSleep(7);
    if (sleepData.length >= 3) {
      const lowSleep = sleepData.filter(s => s.hours < 6);
      if (lowSleep.length >= 2) {
        const insight = `I noticed most difficult days occur after sleeping less than 6 hours.`;
        Memory.addInsight(insight, 'pattern');
        Memory.addPattern(insight, 'auto', 'warning');
      }
    }

    // Check for emotional recurrence
    const emotions = Memory.getEmotionFrequency(14);
    const topEmotion = emotions[0];
    if (topEmotion && topEmotion[1] >= 4) {
      const insight = `"${topEmotion[0]}" has appeared ${topEmotion[1]} times in the last 2 weeks. This may be worth exploring.`;
      Memory.addInsight(insight, 'pattern');
    }

    // Check for missed tasks
    const missed = Memory.getMissedTasks(7);
    if (missed.length >= 3) {
      const insight = `You have ${missed.length} uncompleted tasks from this week. Would you like to review them?`;
      Memory.addInsight(insight, 'task');
    }
  },

  _startInsightTimer() {
    // Check for patterns every 5 minutes
    setInterval(() => this.checkForPatterns(), 300000);
    // Check once after 30 seconds
    setTimeout(() => this.checkForPatterns(), 30000);
  },

  _detectSingleEmotion(input) {
    const trimmed = input.trim().toLowerCase();
    const emotionMap = {
      'anxious': 'Anxiety', 'anxiety': 'Anxiety', 'nervous': 'Anxiety',
      'worried': 'Worry', 'worry': 'Worry',
      'scared': 'Fear', 'fear': 'Fear', 'afraid': 'Fear',
      'angry': 'Anger', 'mad': 'Anger', 'frustrated': 'Frustration', 'frustration': 'Frustration',
      'sad': 'Sadness', 'sadness': 'Sadness', 'depressed': 'Sadness', 'down': 'Sadness',
      'lonely': 'Loneliness', 'alone': 'Loneliness',
      'rejected': 'Rejection', 'rejection': 'Rejection',
      'overwhelmed': 'Overwhelm', 'overwhelm': 'Overwhelm',
      'tired': 'Fatigue', 'exhausted': 'Fatigue', 'fatigue': 'Fatigue',
      'happy': 'Happiness', 'happiness': 'Happiness', 'glad': 'Happiness', 'great': 'Happiness',
      'excited': 'Excitement', 'excitement': 'Excitement',
      'grateful': 'Gratitude', 'gratitude': 'Gratitude', 'thankful': 'Gratitude',
      'guilty': 'Guilt', 'guilt': 'Guilt',
      'ashamed': 'Shame', 'shame': 'Shame',
      'hopeful': 'Hope', 'hope': 'Hope',
      'motivated': 'Motivation', 'motivation': 'Motivation',
      'stressed': 'Stress', 'stress': 'Stress',
      'calm': 'Calm',
      'bored': 'Boredom', 'boredom': 'Boredom',
    };
    return emotionMap[trimmed] || null;
  },

  _yesResponse() {
    const variants = [
      "What would you like to explore first?",
      "Tell me more about what's on your mind.",
      "I'm listening. Where would you like to begin?",
      "Good. Let's dive in. What's the first thing that comes to mind?",
    ];
    return this._random(variants);
  },

  _noResponse() {
    const variants = [
      "That's perfectly fine. We can explore it another time.",
      "No pressure at all. Is there something else you'd like to discuss?",
      "Understood. What would you like to talk about instead?",
      "Alright. I'm here whenever you're ready.",
    ];
    return this._random(variants);
  },

  _numericResponse(input) {
    const num = parseInt(input.match(/\d+/)[0], 10);
    if (num <= 3) {
      return `Thank you for being honest. That's significant. Would you like to talk about what's contributing to this?`;
    } else if (num <= 6) {
      return `I appreciate you sharing that. It's in the middle range — manageable but present. What would help shift it even by one point?`;
    } else {
      return `That's reassuring to hear. What's supporting that positive state right now?`;
    }
  },

  _isSettingTask(input) {
    const lower = input.toLowerCase();
    const focusIndicators = [
      /^(i need to|i should|i have to|i must|my task|my focus|the most important|i want to finish|i'm working on)/i,
      /^(finish|complete|work on|do|start|write|study|prepare|submit)/i,
    ];
    // Only match if it looks like a task statement (not a question)
    if (input.includes('?')) return false;
    return focusIndicators.some(re => re.test(lower)) && input.split(' ').length >= 3;
  },

  _isSettingGoal(input) {
    const lower = input.toLowerCase();
    return /^(i want to|my goal|i aim|i aspire|i wish|i'd like to|i would like to)/i.test(lower)
      && input.length > 20
      && !input.includes('?');
  },

  _goalResponse(input) {
    const goal = input.replace(/^(i want to|my goal is to|i aim to|i aspire to|i wish to|i'd like to|i would like to)/i, '').trim();
    if (goal.length > 3) {
      Memory.addGoal(goal);
      Dashboard.refresh();
      return `I've recorded that goal, Sir. "${goal}" — I'll keep this in mind and check in on your progress when appropriate.`;
    }
    return `That sounds meaningful. Would you like to set this as a goal to track?`;
  },

  _random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
};
