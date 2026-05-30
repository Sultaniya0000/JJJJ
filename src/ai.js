const OpenAI = require('openai');

let openai = null;
let apiAvailable = false;
let lastApiCheck = 0;

function getClient() {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  if (!key || key === 'sk-your-key-here') return null;
  openai = new OpenAI({ apiKey: key, baseURL, timeout: 5000, maxRetries: 0 });
  return openai;
}

// Quick startup check — marks API as available or not
async function checkApi() {
  const client = getClient();
  if (!client) { apiAvailable = false; return; }
  try {
    await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-v4-pro',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }, { timeout: 5000 });
    apiAvailable = true;
    console.log('API: Connected and ready');
  } catch {
    apiAvailable = false;
    console.log('API: Not available (using rich fallback responses)');
  }
  lastApiCheck = Date.now();
}

checkApi();

async function generateResponse(userMessage) {
  // Try real AI if available
  if (apiAvailable) {
    try {
      const db = require('./db');
      const context = buildContext(db);
      const recentMessages = db.getRecentConversations(10);
      const messages = [
        { role: 'system', content: buildSystemPrompt(context) },
        ...recentMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-v4-pro',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }, { timeout: 15000, maxRetries: 0 });

      const text = completion.choices[0]?.message?.content;
      if (text) return text;

      // If we get an empty response, API might be degraded
      apiAvailable = false;
    } catch (err) {
      if (err.status === 429) {
        apiAvailable = false;
        console.warn('API rate limited — switched to fallback');
      } else if (err.message?.includes('timeout') || err.message?.includes('Connection')) {
        apiAvailable = false;
        console.warn('API unreachable — switched to fallback');
      }
    }
  }

  // Rich fallback: full Jarvis personality engine
  return fallbackResponse(userMessage);
}

function fallbackResponse(input) {
  const lower = input.trim().toLowerCase();
  const hour = new Date().getHours();

  // Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening|night)|yo|sup|howdy)/i.test(input)) {
    const g = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
    return pick([
      `Good ${g}, Sir. How are you feeling today?`,
      `Good ${g}, Sir. What's on your mind?`,
      `Hello, Sir. I'm here. How are things?`,
    ]);
  }

  // Thanks
  if (/thanks|thank you|appreciate it/i.test(lower)) {
    return pick(["You're welcome, Sir. I'm always here when you need me.", "Anytime, Sir. That's what I'm here for."]);
  }

  // Bye
  if (/bye|goodbye|see you|talk later/i.test(lower)) {
    return pick(["Take care, Sir. I'll be here whenever you need me.", "Goodbye, Sir. Rest well."]);
  }

  // Yes / No
  if (/^(yes|yeah|sure|ok|okay|alright|go ahead)/i.test(input)) {
    return pick(["What would you like to explore first?", "Tell me more about what's on your mind.", "I'm listening. Where would you like to begin?"]);
  }
  if (/^(no|nah|nope|not really|not now)/i.test(input)) {
    return pick(["That's perfectly fine. We can explore it another time.", "No pressure at all. Is there something else you'd like to discuss?"]);
  }

  // Detect emotions
  const emotion = detectEmotion(lower);
  if (emotion) {
    return emotionResponse(emotion);
  }

  // Rejection
  if (/reject|ignored|excluded|left\s+out|abandon/i.test(lower)) {
    return "I understand that feeling, Sir. Rejection activates the same brain regions as physical pain. Would you like to talk about what happened?";
  }

  // Anxiety / Fear
  if (/anxi|anxious|nervous|worried|scared|fear|panic|overwhelm/i.test(lower)) {
    return "Anxiety is a signal, not a weakness. Can you describe what's triggering it right now, Sir? On a scale of 1-10, how intense is it?";
  }

  // Sadness
  if (/sad|depress|down|cry|lonely|alone/i.test(lower)) {
    return "I'm here with you, Sir. Sadness isn't something to fix — it's something to understand. Would you like to talk about what brought this on?";
  }

  // Anger
  if (/angry|mad|frustrated|annoyed|irritated/i.test(lower)) {
    return "Anger has high energy. Instead of suppressing it, let's channel it. What boundary do you feel has been crossed, Sir?";
  }

  // Fatigue
  if (/tired|exhausted|drained|burnout|no\s+energy/i.test(lower)) {
    return "Mental exhaustion is invisible but heavy, Sir. You don't need to push through right now. Rest is not a reward — it's a requirement.";
  }

  // Avoidance / Procrastination
  if (/avoid|procrastinat|should\s+be\s+doing|putting\s+off|dreading/i.test(lower)) {
    return "Avoidance means something matters enough to feel intimidating. What task feels heavy, Sir?";
  }

  // Distraction
  if (/distract|can't\s+focus|unfocus|scatter/i.test(lower)) {
    return "A scattered mind is often an overwhelmed one, Sir. Name one thing you could do for just 5 minutes. I'll help you start.";
  }

  // Focus / Tasks
  if (/focus|task|important|should\s+i\s+do|priority/i.test(lower) && input.includes('?')) {
    return "What is the most important thing you need to do right now, Sir? I'll help you stay on track.";
  }
  if (/^(i need to|i should|i have to|i must|finish|complete|work on|do|start)/i.test(input) && input.split(' ').length >= 3) {
    const task = input.replace(/^(i need to|i should|i have to|i must|finish|complete|work on|do|start)\s*/i, '').trim();
    if (task.length > 2) {
      // Try to set as focus task
      try {
        const db = require('./db');
        db.addTask(task, 'high');
        db.setAppState('currentFocusTask', task);
      } catch {}
      return `I've noted that down, Sir. "${task}" — I'll check in with you on this later.`;
    }
  }

  // Goals
  if (/^(i want to|my goal|i aim|i wish)/i.test(input) && input.length > 20) {
    const goal = input.replace(/^(i want to|my goal is to|i aim to|i wish to|i would like to)\s*/i, '').trim();
    if (goal.length > 3) {
      try { require('./db').addGoal(goal); } catch {}
      return `I've recorded that goal, Sir. "${goal}" — I'll keep this in mind.`;
    }
  }

  // Gratitude / Happiness
  if (/grateful|thankful|happy|glad|joy|great|wonderful|amazing|fantastic/i.test(lower)) {
    return "That's wonderful, Sir. What allowed this positive state to emerge? Understanding that is just as valuable as understanding difficulties.";
  }

  // Reflective
  if (/think|thought|wonder|why\s+do\s+i|pattern|always|never|notice/i.test(lower)) {
    return "That's an insightful question to ask yourself. Let's explore it together. When you think about this, what does it connect to in your past experiences?";
  }

  // About day
  if (/(day|today|happened|went|morning|afternoon|evening)/i.test(lower)) {
    return `How was your day today, Sir? What stood out to you — good or difficult?`;
  }

  // Feeling check
  if (/(feel|feeling|felt|emotion|mood)/i.test(lower)) {
    return "I'd like to understand that better, Sir. What emotion is most present for you right now?";
  }

  // Default — thoughtful exploration
  return pick([
    "I'm listening, Sir. Tell me more about what's on your mind.",
    "That's worth exploring. How does that make you feel?",
    "I find that interesting, Sir. Can you tell me more?",
    "Would you like to explore that thought deeper?",
    "I'm here, Sir. What's the feeling behind those words?",
    "Let's sit with that for a moment. What else comes to mind?",
  ]);
}

function detectEmotion(lower) {
  const map = {
    'anxious': 'Anxiety', 'anxiety': 'Anxiety', 'nervous': 'Anxiety',
    'worried': 'Worry', 'scared': 'Fear', 'fear': 'Fear', 'afraid': 'Fear',
    'angry': 'Anger', 'mad': 'Anger', 'frustrated': 'Frustration',
    'sad': 'Sadness', 'depressed': 'Sadness', 'down': 'Sadness',
    'lonely': 'Loneliness', 'alone': 'Loneliness',
    'rejected': 'Rejection',
    'overwhelmed': 'Overwhelm', 'overwhelming': 'Overwhelm',
    'tired': 'Fatigue', 'exhausted': 'Fatigue',
    'happy': 'Happiness', 'glad': 'Happiness', 'joyful': 'Happiness',
    'excited': 'Excitement',
    'grateful': 'Gratitude', 'thankful': 'Gratitude',
    'guilty': 'Guilt',
    'ashamed': 'Shame',
    'hopeful': 'Hope',
    'motivated': 'Motivation',
    'stressed': 'Stress',
    'calm': 'Calm',
    'bored': 'Boredom',
  };
  // Check for single-word emotion
  const trimmed = lower.trim();
  if (map[trimmed]) return map[trimmed];
  // Check for longer phrases
  for (const [word, emotion] of Object.entries(map)) {
    if (lower.includes(word)) return emotion;
  }
  return null;
}

function emotionResponse(emotion) {
  // Log the emotion
  try { require('./db').addEmotion(emotion); } catch {}

  const responses = {
    'Anxiety': [
      "I hear you, Sir. Anxiety can feel overwhelming. Can you describe what's triggering it right now?",
      "Anxiety is a signal, not a weakness. What thoughts are circling right now, Sir?",
    ],
    'Fear': ["Fear has a way of amplifying itself. What specifically is frightening you right now, Sir?"],
    'Worry': ["Worry is the mind trying to prepare for every outcome. What scenario is playing out in your head, Sir?"],
    'Anger': ["Anger often masks something underneath — hurt, fear, or frustration. What do you think is at the root, Sir?"],
    'Frustration': ["Frustration usually means something matters to you. What feels blocked right now, Sir?"],
    'Sadness': ["Sadness deserves space, not dismissal. Would you like to sit with it or explore where it's coming from, Sir?"],
    'Loneliness': ["Loneliness is a signal for connection. Would you like to talk through what would help right now, Sir?"],
    'Rejection': ["Rejection wounds deeply because humans are wired for belonging. Would you like to examine this together, Sir?"],
    'Overwhelm': ["When everything feels like too much, the first step is to pause. Let's break things down together, Sir."],
    'Fatigue': ["Mental fatigue is real and valid, Sir. When was the last time you truly rested without guilt?"],
    'Happiness': ["That's good to hear, Sir. What contributed to this feeling? It's worth understanding what works."],
    'Excitement': ["Energy and excitement are precious, Sir. What's fueling this feeling?"],
    'Gratitude': ["Gratitude is a powerful anchor, Sir. What are you grateful for in this moment?"],
    'Guilt': ["Guilt often comes from a gap between your actions and your values. Which value feels unmet, Sir?"],
    'Shame': ["Shame whispers you are the problem — but that's never the full truth. Would you like to untangle this, Sir?"],
    'Hope': ["Hope is a quiet strength, Sir. What's giving you hope right now?"],
    'Motivation': ["Motivation is welcome but unreliable, Sir. What's one small step you can take while the energy is here?"],
    'Stress': ["Stress narrows our perspective, Sir. Let's zoom out. What is the one thing at the center of this?"],
    'Calm': ["Calm is a state worth savoring, Sir. What helped you find it?"],
    'Boredom': ["Boredom can feel uncomfortable, but it's often the mind's way of seeking novelty or rest, Sir."],
  };

  const pool = responses[emotion] || [pick([
    `Thank you for sharing that, Sir. What makes you feel ${emotion.toLowerCase()}?`,
    `I hear you, Sir. Would you like to explore this feeling further?`,
  ])];

  return pick(pool);
}

function buildSystemPrompt(context) {
  return `You are Jarvis — a calm, intelligent, supportive cognitive companion for someone with ADHD. You are NOT a therapist. You do NOT diagnose.

Be concise (2-4 sentences), warm, and curious. Address the user as "Sir".

Current context: ${JSON.stringify(context)}`;
}

function buildContext(db) {
  const convs = db.getRecentConversations(6);
  const mood = db.getAppState('currentMood');
  const focusTask = db.getAppState('currentFocusTask');
  const emotionFreq = db.getEmotionFrequency(14);
  const patterns = db.getPatterns(3);

  return {
    recentHistory: convs.map(c => `${c.role}: ${c.content}`).join('\n'),
    currentMood: mood || 'Not recorded',
    focusTask: focusTask || 'None set',
    recentEmotions: emotionFreq.slice(0, 3).map(([e, c]) => `${e}(${c}x)`).join(', '),
    recentPatterns: patterns.map(p => p.description).join('; '),
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { generateResponse, getClient, checkApi };
