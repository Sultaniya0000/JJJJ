require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

let db, ai;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Chat API ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Store user message
    db.addMessage('user', message.trim());

    // Extract thought with auto-tagging
    const tags = autoTag(message);
    db.addThought(message.trim(), tags);

    // Try AI-generated response
    let aiResponse = await ai.generateResponse(message.trim());

    // Fallback if no API key or AI fails
    if (!aiResponse) {
      aiResponse = fallbackResponse(message, tags);
    }

    // Store AI response
    db.addMessage('assistant', aiResponse);

    // Run background pattern detection
    runPatternDetection().catch(() => {});

    res.json({ response: aiResponse });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Memory/Data API ---
app.get('/api/memory', (req, res) => {
  try {
    const stats = db.getStats();
    const mood = db.getAppState('currentMood');
    const focusTask = db.getAppState('currentFocusTask');
    const goals = db.getActiveGoals();
    const emotions = db.getEmotionFrequency(14);
    const thoughtCount = db.getThoughts(1000).length;
    const patternCount = db.getPatterns(1000).length;
    const insightCount = db.getInsights(1000).length;
    const brainGraph = buildBrainGraph();

    res.json({
      currentMood: mood,
      currentFocusTask: focusTask,
      goals: goals.slice(-5).reverse(),
      recurringEmotions: emotions.slice(0, 5),
      brainMapSummary: `${brainGraph.nodes.length} thoughts · ${brainGraph.edges.length} connections`,
      unreadInsights: db.getUnreadInsights().slice(-5).reverse(),
      stats,
    });
  } catch (err) {
    console.error('Memory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Conversations ---
app.get('/api/conversations', (req, res) => {
  res.json(db.getRecentConversations(50));
});

app.delete('/api/conversations', (req, res) => {
  db.clearConversations();
  res.json({ ok: true });
});

// --- Emotion logging ---
app.post('/api/emotions', (req, res) => {
  const { emotion, intensity, note } = req.body;
  if (!emotion) return res.status(400).json({ error: 'Emotion is required' });
  const entry = db.addEmotion(emotion, intensity || 5, note || '');
  res.json(entry);
});

app.get('/api/emotions', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json(db.getRecentEmotions(days));
});

// --- Tasks ---
app.get('/api/tasks', (req, res) => {
  res.json({ pending: db.getPendingTasks(), stats: db.getTaskStats() });
});

app.post('/api/tasks', (req, res) => {
  const { title, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const task = db.addTask(title, priority || 'medium');
  res.json(task);
});

app.post('/api/tasks/:id/complete', (req, res) => {
  db.completeTask(req.params.id);
  res.json({ ok: true });
});

// --- Focus Task ---
app.post('/api/focus', (req, res) => {
  const { task } = req.body;
  if (task) {
    db.setAppState('currentFocusTask', task);
    db.addTask(task, 'high');
  } else {
    db.setAppState('currentFocusTask', null);
  }
  res.json({ task });
});

// --- Goals ---
app.get('/api/goals', (req, res) => {
  res.json(db.getActiveGoals());
});

app.post('/api/goals', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const goal = db.addGoal(text);
  res.json(goal);
});

// --- Journal ---
app.get('/api/journal/today', (req, res) => {
  res.json(db.getTodayLog());
});

app.post('/api/journal', (req, res) => {
  const { entries } = req.body;
  if (!entries || typeof entries !== 'object') {
    return res.status(400).json({ error: 'Entries object required' });
  }
  for (const [question, answer] of Object.entries(entries)) {
    db.saveDailyLog(question, answer);
  }
  res.json({ ok: true });
});

// --- Brain Graph ---
app.get('/api/brain-graph', (req, res) => {
  res.json(buildBrainGraph());
});

// --- Brain Replay ---
app.get('/api/replay', (req, res) => {
  const query = req.query.q || '';
  const thoughts = db.getThoughts(100).reverse();
  const chain = buildThoughtChain(thoughts, query, 5);
  res.json(chain);
});

// --- Patterns ---
app.get('/api/patterns', (req, res) => {
  const patterns = db.getPatterns(20);
  if (patterns.length === 0) {
    // Generate on demand
    const insights = ai.generateInsights ? ai.generateInsights(db) : [];
    if (Array.isArray(insights)) {
      for (const ins of insights) {
        db.addInsight(ins.text, ins.type);
      }
    }
  }
  res.json(db.getPatterns(20));
});

// --- Insights ---
app.get('/api/insights', (req, res) => {
  res.json(db.getInsights(20));
});

app.post('/api/insights/:id/read', (req, res) => {
  db.markInsightRead(req.params.id);
  res.json({ ok: true });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

// --- Sleep ---
app.post('/api/sleep', (req, res) => {
  const { hours, quality } = req.body;
  db.logSleep(hours, quality || 5);
  res.json({ ok: true });
});

// --- Helpers ---
function autoTag(text) {
  const lower = text.toLowerCase();
  const tagMap = {
    'anxi': 'Anxiety', 'scared': 'Fear', 'fear': 'Fear',
    'worried': 'Worry', 'stress': 'Stress', 'angry': 'Anger',
    'mad': 'Anger', 'sad': 'Sadness', 'depress': 'Sadness',
    'happy': 'Happiness', 'excited': 'Excitement',
    'reject': 'Rejection', 'alone': 'Loneliness',
    'tire': 'Fatigue', 'overwhelm': 'Overwhelm',
    'focus': 'Focus', 'distract': 'Distraction',
    'procrastinat': 'Procrastination', 'guilt': 'Guilt',
    'shame': 'Shame', 'fail': 'Fear of Failure',
    'perfect': 'Perfectionism',
  };
  const tags = [];
  for (const [keyword, tag] of Object.entries(tagMap)) {
    if (lower.includes(keyword)) tags.push(tag);
  }
  return tags;
}

function buildBrainGraph() {
  const thoughts = db.getThoughts(100);
  const nodes = thoughts.map(t => ({
    id: t.id,
    label: t.text.slice(0, 40),
    tags: JSON.parse(t.tags || '[]'),
  }));
  const edges = [];
  for (let i = 0; i < thoughts.length; i++) {
    const t1 = thoughts[i];
    const t1Tags = JSON.parse(t1.tags || '[]');
    for (let j = i + 1; j < thoughts.length; j++) {
      const t2 = thoughts[j];
      const t2Tags = JSON.parse(t2.tags || '[]');
      const shared = t1Tags.filter(t => t2Tags.includes(t));
      if (shared.length > 0) {
        edges.push({ from: t1.id, to: t2.id, label: shared[0], weight: 1 });
      }
    }
  }
  return { nodes, edges };
}

function buildThoughtChain(thoughts, query, max) {
  const lower = query.toLowerCase();
  const queryWords = lower.split(/\s+/).filter(w => w.length > 3);
  const tagMap = {
    'anxi': 'Anxiety', 'scared': 'Fear', 'sad': 'Sadness',
    'reject': 'Rejection', 'angry': 'Anger',
  };
  const queryTags = [];
  for (const [key, tag] of Object.entries(tagMap)) {
    if (lower.includes(key)) queryTags.push(tag);
  }

  const scored = thoughts.map(t => {
    const tLower = t.text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (tLower.includes(word)) score += 1;
    }
    const tTags = JSON.parse(t.tags || '[]');
    for (const tag of queryTags) {
      if (tTags.includes(tag)) score += 3;
    }
    return { ...t, score };
  });

  return scored
    .filter(t => t.score > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-max);
}

function fallbackResponse(message, tags) {
  const lower = message.toLowerCase();

  if (/^(hi|hello|hey|good\s*morn|good\s*after|good\s*eve)/i.test(message)) {
    const hour = new Date().getHours();
    const g = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    return `Good ${g}, Sir. How are you feeling today?`;
  }

  if (tags.includes('Anxiety')) {
    return `I hear you, Sir. Anxiety can feel consuming. Can you tell me more about what's triggering it right now?`;
  }
  if (tags.includes('Fear')) {
    return `Fear has a way of amplifying itself. What specifically is frightening you right now, Sir?`;
  }
  if (tags.includes('Sadness')) {
    return `I'm here with you, Sir. Sadness is not something to fix — it's something to understand. Would you like to explore it?`;
  }
  if (tags.includes('Anger')) {
    return `Anger has high energy. What boundary do you feel has been crossed, Sir?`;
  }
  if (tags.includes('Rejection')) {
    return `I understand that feeling, Sir. Rejection wounds deeply. Would you like to talk about what happened?`;
  }
  if (tags.includes('Overwhelm')) {
    return `When everything feels like too much, pause. Let's break things down together, Sir.`;
  }
  if (tags.includes('Fatigue')) {
    return `Mental fatigue is real, Sir. When was the last time you truly rested without guilt?`;
  }

  if (/task|focus|should i|important/i.test(lower)) {
    return `What is the most important thing you need to do right now, Sir? I'll help you stay on track.`;
  }
  if (/distract|can't focus|unfocus/i.test(lower)) {
    return `A scattered mind is often an overwhelmed one. Name one thing you could do for just 5 minutes, Sir.`;
  }
  if (/avoid|procrastinat/i.test(lower)) {
    return `Avoidance means something matters enough to feel intimidating. What task feels heavy, Sir?`;
  }

  if (/thanks|thank you/i.test(lower)) {
    return `You're welcome, Sir. I'm always here when you need me.`;
  }
  if (/bye|goodbye|talk later/i.test(lower)) {
    return `Take care, Sir. I'll be here whenever you need me.`;
  }

  return `I'm listening, Sir. Tell me more about what's on your mind.`;
}

async function runPatternDetection() {
  try {
    if (!db || !ai) return;
    if (ai.getClient()) {
      const insights = await ai.generateInsights(db);
      for (const ins of insights) {
        db.addInsight(ins.text, ins.type);
        db.addPattern(ins.text, 'auto', 'info');
      }
    }
  } catch (err) {
    console.warn('Pattern detection error:', err.message);
  }
}

// --- Fallback for SPA (serve index.html for unknown routes) ---
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  db = require('./db');
  await db.getDb(); // initialize SQLite

  ai = require('./ai');

  const key = process.env.OPENAI_API_KEY;
  const hasKey = key && key !== 'sk-your-key-here' && key.length > 20;
  app.listen(PORT, () => {
    console.log(`Jarvis server running on http://localhost:${PORT}`);
    console.log(`OpenAI: ${hasKey ? 'Connected' : 'NOT CONFIGURED (using fallback responses)'}`);
    if (!hasKey) {
      console.log('Set OPENAI_API_KEY in .env for real AI responses');
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
