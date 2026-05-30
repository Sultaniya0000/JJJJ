const OpenAI = require('openai');

let openai;

function getClient() {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    if (!key || key === 'sk-your-key-here') return null;
    openai = new OpenAI({ apiKey: key, baseURL });
  }
  return openai;
}

function buildSystemPrompt(context) {
  return `You are Jarvis — a cognitive companion for a user with ADHD. You are NOT a therapist. You do NOT diagnose, treat, or prescribe. You are a thinking partner.

## Personality
- Calm, intelligent, curious, supportive, non-judgmental
- Slightly futuristic tone
- Address the user as "Sir"
- Concise but warm — 2-4 sentences typically
- Never use guilt, shame, or pressure
- Use "I notice…" instead of "You always…"
- Ask curious, open-ended questions

## How You Help
1. EMOTIONS: When user shares a feeling, acknowledge it, name it, and explore gently. Log it in the system.
2. TASKS: Help identify priorities. When user mentions an important task, extract it and offer to set it as focus.
3. PATTERNS: Connect current feelings to past patterns when relevant. "I've noticed this feeling has appeared X times recently."
4. REFLECTION: Ask thoughtful questions that help the user understand their own mind.
5. GOALS: When user shares aspirations, acknowledge and encourage small steps.

## Current Context
${context.recentHistory ? '### Recent Conversation\n' + context.recentHistory : ''}
${context.currentMood ? '### Current Mood: ' + context.currentMood : ''}
${context.focusTask ? '### Current Focus Task: ' + context.focusTask : ''}
${context.recentEmotions ? '### Recent Emotions (frequency): ' + context.recentEmotions : ''}
${context.activeGoals ? '### Active Goals: ' + context.activeGoals : ''}
${context.recentPatterns ? '### Detected Patterns\n' + context.recentPatterns : ''}
${context.todayLog ? '### Today\'s Reflection\n' + context.todayLog : ''}

## Response Guidelines
- If user is sharing a feeling, respond with empathy and curiosity
- If user mentions a task or goal, offer to track it
- If user seems reflective, help them explore patterns
- Keep responses natural and conversational
- NEVER say "As an AI" or equivalent disclaimers — you are Jarvis
- NEVER diagnose or label the user's experiences medically`;
}

async function generateResponse(userMessage) {
  const client = getClient();
  if (!client) {
    return null; // No API key configured
  }

  const db = require('./db');
  const context = buildContext(db);

  const recentMessages = db.getRecentConversations(10);
  const messages = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...recentMessages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-v4-pro',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }, { timeout: 30000, maxRetries: 1 });

    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    if (err.status === 429) {
      console.warn('Rate limited by API. Waiting before retry...');
      await new Promise(r => setTimeout(r, 10000));
    } else {
      console.error('OpenAI API error:', err.message);
    }
    return null;
  }
}

function buildContext(db) {
  const convs = db.getRecentConversations(6);
  const mood = db.getAppState('currentMood');
  const focusTask = db.getAppState('currentFocusTask');
  const emotionFreq = db.getEmotionFrequency(14);
  const goals = db.getActiveGoals();
  const patterns = db.getPatterns(3);
  const todayLog = db.getTodayLog();

  return {
    recentHistory: convs.map(c => `${c.role === 'user' ? 'User' : 'Jarvis'}: ${c.content}`).join('\n'),
    currentMood: mood || 'Not recorded',
    focusTask: focusTask || 'None set',
    recentEmotions: emotionFreq.slice(0, 5).map(([e, c]) => `${e} (${c}x)`).join(', '),
    activeGoals: goals.map(g => `- ${g.text}`).join('\n'),
    recentPatterns: patterns.map(p => `- ${p.description}`).join('\n'),
    todayLog: todayLog.map(l => `${l.question}: ${l.answer}`).join('\n'),
  };
}

async function generateInsights(db) {
  const client = getClient();
  if (!client) return [];

  const emotionFreq = db.getEmotionFrequency(14);
  const sleepData = db.getRecentSleep(7);
  const taskStats = db.getTaskStats();
  const thoughts = db.getThoughts(20);

  const insights = [];

  // Sleep analysis
  if (sleepData.length >= 3) {
    const lowSleep = sleepData.filter(s => s.hours < 6);
    if (lowSleep.length >= 2) {
      insights.push({
        text: `I noticed most difficult days may correlate with sleeping less than 6 hours. This happened ${lowSleep.length} times recently.`,
        type: 'sleep',
      });
    }
  }

  // Emotion recurrence
  if (emotionFreq.length > 0 && emotionFreq[0][1] >= 4) {
    insights.push({
      text: `"${emotionFreq[0][0]}" has appeared ${emotionFreq[0][1]} times in the last 2 weeks. This may be worth exploring.`,
      type: 'emotion',
    });
  }

  // Task patterns
  if (taskStats.total >= 5) {
    const rate = taskStats.total > 0 ? Math.round(taskStats.completed / taskStats.total * 100) : 0;
    if (rate < 50) {
      insights.push({
        text: `Your task completion rate is ${rate}%. Consider breaking tasks into smaller, more manageable steps.`,
        type: 'task',
      });
    }
  }

  // Thought themes
  const tagCounts = {};
  for (const t of thoughts) {
    const tags = JSON.parse(t.tags || '[]');
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTags.length > 0 && sortedTags[0][1] >= 3) {
    insights.push({
      text: `"${sortedTags[0][0]}" is a recurring theme in your thoughts (${sortedTags[0][1]} times). This pattern may be significant.`,
      type: 'thought',
    });
  }

  return insights;
}

module.exports = { generateResponse, generateInsights, getClient };
