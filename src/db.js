const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'jarvis.db');

let db;

async function getDb() {
  if (!db) {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    db.run('PRAGMA journal_mode=WAL');
    initTables();
    saveDb();
  }
  return db;
}

function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.warn('DB save error:', err.message);
  }
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      tags TEXT DEFAULT '[]',
      emotions TEXT DEFAULT '[]',
      linked_thoughts TEXT DEFAULT '[]'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS emotions (
      id TEXT PRIMARY KEY,
      emotion TEXT NOT NULL,
      intensity INTEGER DEFAULT 5,
      note TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      date TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (date, question)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sleep_logs (
      date TEXT PRIMARY KEY,
      hours REAL NOT NULL,
      quality INTEGER DEFAULT 5,
      timestamp INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      type TEXT DEFAULT 'pattern',
      created_at INTEGER NOT NULL,
      read INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      type TEXT DEFAULT 'auto',
      severity TEXT DEFAULT 'info',
      detected_at INTEGER NOT NULL,
      acknowledged INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } else {
    stmt.run(params);
    stmt.free();
    saveDb();
    return { changes: db.getRowsModified() };
  }
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

// --- Conversations ---
function addMessage(role, content) {
  query('INSERT INTO conversations (role, content, timestamp) VALUES (?, ?, ?)', [role, content, Date.now()]);
  return { role, content, timestamp: Date.now() };
}

function getRecentConversations(limit = 50) {
  return query('SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?', [limit]).reverse();
}

function getTodayConversations() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return query('SELECT * FROM conversations WHERE timestamp >= ? ORDER BY timestamp ASC', [today.getTime()]);
}

function clearConversations() { query('DELETE FROM conversations'); }

// --- Thoughts ---
function addThought(text, tags = []) {
  const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  query('INSERT INTO thoughts (id, text, timestamp, tags, emotions, linked_thoughts) VALUES (?, ?, ?, ?, ?, ?)',
    [id, text, Date.now(), JSON.stringify(tags), '[]', '[]']);
}

function getThoughts(limit = 50) {
  return query('SELECT * FROM thoughts ORDER BY timestamp DESC LIMIT ?', [limit]);
}

// --- Emotions ---
function addEmotion(emotion, intensity = 5, note = '') {
  const id = 'e_' + Date.now();
  query('INSERT INTO emotions (id, emotion, intensity, note, timestamp) VALUES (?, ?, ?, ?, ?)',
    [id, emotion, intensity, note, Date.now()]);
  setAppState('currentMood', emotion);
  return { id, emotion, intensity, note, timestamp: Date.now() };
}

function getRecentEmotions(days = 7) {
  const cutoff = Date.now() - days * 86400000;
  return query('SELECT * FROM emotions WHERE timestamp >= ? ORDER BY timestamp DESC', [cutoff]);
}

function getEmotionFrequency(days = 30) {
  const cutoff = Date.now() - days * 86400000;
  return query('SELECT emotion, COUNT(*) as count FROM emotions WHERE timestamp >= ? GROUP BY emotion ORDER BY count DESC', [cutoff]).map(r => [r.emotion, r.count]);
}

// --- Tasks ---
function addTask(title, priority = 'medium') {
  const id = 'task_' + Date.now();
  query('INSERT INTO tasks (id, title, priority, completed, created_at) VALUES (?, ?, ?, 0, ?)', [id, title, priority, Date.now()]);
  return { id, title, priority };
}

function completeTask(id) {
  query('UPDATE tasks SET completed = 1, completed_at = ? WHERE id = ?', [Date.now(), id]);
}

function getPendingTasks() {
  return query('SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at DESC');
}

function getMissedTasks(days = 7) {
  const cutoff = Date.now() - days * 86400000;
  return query('SELECT * FROM tasks WHERE completed = 0 AND created_at >= ? ORDER BY created_at DESC', [cutoff]);
}

function getTaskStats() {
  const total = get('SELECT COUNT(*) as c FROM tasks')?.c || 0;
  const completed = get('SELECT COUNT(*) as c FROM tasks WHERE completed = 1')?.c || 0;
  return { total, completed, pending: total - completed };
}

// --- Goals ---
function addGoal(text) {
  const id = 'g_' + Date.now();
  query('INSERT INTO goals (id, text, created_at, active) VALUES (?, ?, ?, 1)', [id, text, Date.now()]);
  return { id, text };
}

function getActiveGoals() {
  return query('SELECT * FROM goals WHERE active = 1 ORDER BY created_at DESC');
}

// --- Daily Logs ---
function saveDailyLog(question, answer) {
  const date = new Date().toISOString().slice(0, 10);
  query('INSERT OR REPLACE INTO daily_logs (date, question, answer, timestamp) VALUES (?, ?, ?, ?)', [date, question, answer, Date.now()]);
}

function getTodayLog() {
  const date = new Date().toISOString().slice(0, 10);
  return query('SELECT * FROM daily_logs WHERE date = ?', [date]);
}

// --- Sleep ---
function logSleep(hours, quality = 5) {
  const date = new Date().toISOString().slice(0, 10);
  query('INSERT OR REPLACE INTO sleep_logs (date, hours, quality, timestamp) VALUES (?, ?, ?, ?)', [date, hours, quality, Date.now()]);
}

function getRecentSleep(days = 14) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return query('SELECT * FROM sleep_logs WHERE date >= ? ORDER BY date DESC', [d.toISOString().slice(0, 10)]);
}

// --- Insights ---
function addInsight(text, type = 'pattern') {
  const id = 'i_' + Date.now();
  query('INSERT INTO insights (id, text, type, created_at, read) VALUES (?, ?, ?, ?, 0)', [id, text, type, Date.now()]);
}

function getUnreadInsights() {
  return query('SELECT * FROM insights WHERE read = 0 ORDER BY created_at DESC');
}

function markInsightRead(id) {
  query('UPDATE insights SET read = 1 WHERE id = ?', [id]);
}

function getInsights(limit = 20) {
  return query('SELECT * FROM insights ORDER BY created_at DESC LIMIT ?', [limit]);
}

// --- Patterns ---
function addPattern(description, type = 'auto', severity = 'info') {
  const id = 'p_' + Date.now();
  query('INSERT INTO patterns (id, description, type, severity, detected_at) VALUES (?, ?, ?, ?, ?)', [id, description, type, severity, Date.now()]);
}

function getPatterns(limit = 20) {
  return query('SELECT * FROM patterns ORDER BY detected_at DESC LIMIT ?', [limit]);
}

// --- App State ---
function setAppState(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  query('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, v]);
}

function getAppState(key) {
  const row = get('SELECT value FROM app_state WHERE key = ?', [key]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

// --- Stats ---
function getStats() {
  return {
    totalMessages: get('SELECT COUNT(*) as c FROM conversations')?.c || 0,
    totalThoughts: get('SELECT COUNT(*) as c FROM thoughts')?.c || 0,
    totalEmotions: get('SELECT COUNT(*) as c FROM emotions')?.c || 0,
    totalTasks: get('SELECT COUNT(*) as c FROM tasks')?.c || 0,
    completedTasks: get('SELECT COUNT(*) as c FROM tasks WHERE completed = 1')?.c || 0,
    pendingTasks: get('SELECT COUNT(*) as c FROM tasks WHERE completed = 0')?.c || 0,
    totalPatterns: get('SELECT COUNT(*) as c FROM patterns')?.c || 0,
    totalInsights: get('SELECT COUNT(*) as c FROM insights')?.c || 0,
    daysTracked: (get('SELECT COUNT(DISTINCT date) as c FROM daily_logs')?.c || 0),
    topEmotions: getEmotionFrequency(30).slice(0, 3),
  };
}

module.exports = {
  addMessage, getRecentConversations, getTodayConversations, clearConversations,
  addThought, getThoughts,
  addEmotion, getRecentEmotions, getEmotionFrequency,
  addTask, completeTask, getPendingTasks, getMissedTasks, getTaskStats,
  addGoal, getActiveGoals,
  saveDailyLog, getTodayLog,
  logSleep, getRecentSleep,
  addInsight, getUnreadInsights, markInsightRead, getInsights,
  addPattern, getPatterns,
  setAppState, getAppState,
  getStats, getDb,
};
