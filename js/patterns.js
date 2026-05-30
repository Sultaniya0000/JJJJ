/* ============================================
   ADHD Pattern Recognition Engine
   Analyzes stored data to detect:
   - Missed task patterns
   - Mood changes & triggers
   - Hyperfocus episodes
   - Sleep correlations
   - Emotional recurrence
   - Rejection sensitivity patterns
   ============================================ */

const PatternEngine = {
  analyzeAll() {
    const results = [];

    results.push(...this._analyzeSleepPatterns());
    results.push(...this._analyzeEmotionalPatterns());
    results.push(...this._analyzeTaskPatterns());
    results.push(...this._analyzeThoughtPatterns());
    results.push(...this._analyzeRejectionPatterns());
    results.push(...this._analyzeTimeOfDayPatterns());

    return results;
  },

  _analyzeSleepPatterns() {
    const insights = [];
    const sleepData = Memory.getRecentSleep(14);

    if (sleepData.length < 3) return insights;

    const lowSleepDays = sleepData.filter(s => s.hours < 6);
    const avgSleep = sleepData.reduce((s, e) => s + e.hours, 0) / sleepData.length;

    if (lowSleepDays.length >= 3) {
      insights.push({
        text: `You've had ${lowSleepDays.length} nights with less than 6 hours of sleep in the past 2 weeks. Low sleep correlates strongly with emotional dysregulation in ADHD.`,
        type: 'sleep',
        severity: 'warning',
      });
    }

    if (avgSleep < 6.5) {
      insights.push({
        text: `Your average sleep is ${avgSleep.toFixed(1)} hours. Most adults need 7-9 hours for optimal executive function.`,
        type: 'sleep',
        severity: 'info',
      });
    }

    // Check for emotional logs after low sleep
    const emotionData = Memory.getRecentEmotions(14);
    const lowSleepDates = new Set(lowSleepDays.map(d => d.date));
    const emotionsAfterLowSleep = emotionData.filter(e => {
      const eDate = new Date(e.timestamp).toISOString().slice(0, 10);
      // Check if emotion was logged on the same day or day after low sleep
      const eDateObj = new Date(eDate);
      for (const lsDate of lowSleepDates) {
        const lsDateObj = new Date(lsDate);
        const diffDays = Math.abs((eDateObj - lsDateObj) / 86400000);
        if (diffDays <= 1) return true;
      }
      return false;
    });

    if (emotionsAfterLowSleep.length >= 3) {
      const negEmotions = emotionsAfterLowSleep.filter(e =>
        ['Anxiety', 'Sadness', 'Anger', 'Frustration', 'Overwhelm', 'Irritability'].includes(e.emotion)
      );
      if (negEmotions.length >= 2) {
        insights.push({
          text: `After low-sleep nights, negative emotions appear more frequently. This is a known ADHD pattern.`,
          type: 'sleep',
          severity: 'warning',
        });
      }
    }

    return insights;
  },

  _analyzeEmotionalPatterns() {
    const insights = [];
    const emotions = Memory.getRecentEmotions(30);
    if (emotions.length < 5) return insights;

    const freq = {};
    const dailyMap = {};

    for (const e of emotions) {
      freq[e.emotion] = (freq[e.emotion] || 0) + 1;
      const date = new Date(e.timestamp).toISOString().slice(0, 10);
      if (!dailyMap[date]) dailyMap[date] = [];
      dailyMap[date].push(e);
    }

    // Find recurring emotions
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 5) {
      insights.push({
        text: `"${sorted[0][0]}" is your most frequent emotion (${sorted[0][1]} times this month). Understanding its triggers could be valuable.`,
        type: 'emotion',
        severity: 'info',
      });
    }

    // Emotional volatility - check for rapid mood shifts within same day
    const volatileDays = Object.entries(dailyMap).filter(([_, entries]) => {
      const uniqueEmotions = new Set(entries.map(e => e.emotion));
      return uniqueEmotions.size >= 3;
    });

    if (volatileDays.length >= 3) {
      insights.push({
        text: `You've experienced 3+ different emotions in a single day on ${volatileDays.length} occasions. Emotional variability is common with ADHD.`,
        type: 'emotion',
        severity: 'info',
      });
    }

    return insights;
  },

  _analyzeTaskPatterns() {
    const insights = [];
    const tasks = Memory.get('tasks');
    if (tasks.length < 5) return insights;

    const completed = tasks.filter(t => t.completed);
    const missed = tasks.filter(t => !t.completed);
    const completionRate = tasks.length > 0 ? (completed.length / tasks.length * 100).toFixed(0) : 0;

    if (missed.length > completed.length) {
      insights.push({
        text: `Your task completion rate is ${completionRate}%. Consider breaking tasks into smaller steps.`,
        type: 'task',
        severity: 'info',
      });
    }

    // Check for time-based patterns
    const tasksByHour = {};
    for (const t of completed) {
      const hour = new Date(t.createdAt).getHours();
      tasksByHour[hour] = (tasksByHour[hour] || 0) + 1;
    }

    const productiveHours = Object.entries(tasksByHour).sort((a, b) => b[1] - a[1]);
    if (productiveHours.length > 0) {
      const [bestHour] = productiveHours[0];
      const ampm = bestHour >= 12 ? 'PM' : 'AM';
      const hour12 = bestHour % 12 || 12;
      insights.push({
        text: `You seem more productive when starting tasks around ${hour12}${ampm}.`,
        type: 'task',
        severity: 'insight',
      });
    }

    return insights;
  },

  _analyzeThoughtPatterns() {
    const insights = [];
    const thoughts = Memory.get('thoughts');
    if (thoughts.length < 5) return insights;

    // Find recurring themes
    const tagFreq = {};
    for (const t of thoughts) {
      for (const tag of t.tags) {
        tagFreq[tag] = (tagFreq[tag] || 0) + 1;
      }
    }

    const sortedTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]);
    if (sortedTags.length > 0 && sortedTags[0][1] >= 3) {
      const [topTag, count] = sortedTags[0];
      insights.push({
        text: `"${topTag}" is a recurring theme in your thoughts (${count} times). This pattern may be worth exploring.`,
        type: 'thought',
        severity: 'info',
      });
    }

    if (sortedTags.length >= 3) {
      const top3 = sortedTags.slice(0, 3).map(([tag]) => tag).join(', ');
      insights.push({
        text: `Your dominant thought patterns: ${top3}. These appear to be central themes in your cognitive landscape.`,
        type: 'thought',
        severity: 'insight',
      });
    }

    return insights;
  },

  _analyzeRejectionPatterns() {
    const insights = [];
    const emotions = Memory.getRecentEmotions(30);
    const rejectionEntries = emotions.filter(e => e.emotion === 'Rejection');

    if (rejectionEntries.length < 2) return insights;

    // Check if rejection often occurs after certain times
    const hours = rejectionEntries.map(e => new Date(e.timestamp).getHours());
    const eveningRejection = hours.filter(h => h >= 18).length;

    if (eveningRejection >= 2) {
      insights.push({
        text: `Rejection-sensitive feelings often appear in the evening for you. This could be related to cognitive fatigue.`,
        type: 'rejection',
        severity: 'info',
      });
    }

    if (rejectionEntries.length >= 4) {
      insights.push({
        text: `You've experienced feelings of rejection ${rejectionEntries.length} times this month. Rejection Sensitivity Dysphoria (RSD) is common with ADHD.`,
        type: 'rejection',
        severity: 'warning',
      });
    }

    // Check if rejection is followed by other emotions
    const rejectionTimestamps = rejectionEntries.map(e => e.timestamp);
    const followUpEmotions = emotions.filter(e => {
      if (e.emotion === 'Rejection') return false;
      return rejectionTimestamps.some(rt => {
        const diff = e.timestamp - rt;
        return diff > 0 && diff < 86400000; // within 24 hours after
      });
    });

    if (followUpEmotions.length >= 3) {
      const followUpFreq = {};
      followUpEmotions.forEach(e => {
        followUpFreq[e.emotion] = (followUpFreq[e.emotion] || 0) + 1;
      });
      const mostCommon = Object.entries(followUpFreq).sort((a, b) => b[1] - a[1])[0];
      if (mostCommon) {
        insights.push({
          text: `Rejection feelings are often followed by "${mostCommon[0]}". This chain reaction is valuable to recognize.`,
          type: 'rejection',
          severity: 'info',
        });
      }
    }

    return insights;
  },

  _analyzeTimeOfDayPatterns() {
    const insights = [];
    const conversations = Memory.get('conversations');
    if (conversations.length < 20) return insights;

    const hourCount = {};
    const emotionByHour = {};

    for (const msg of conversations) {
      if (msg.role !== 'user') continue;
      const hour = new Date(msg.timestamp).getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }

    const emotions = Memory.getRecentEmotions(30);
    for (const e of emotions) {
      const hour = new Date(e.timestamp).getHours();
      if (!emotionByHour[hour]) emotionByHour[hour] = {};
      emotionByHour[hour][e.emotion] = (emotionByHour[hour][e.emotion] || 0) + 1;
    }

    // Find most active hour
    const sortedHours = Object.entries(hourCount).sort((a, b) => b[1] - a[1]);
    if (sortedHours.length > 0) {
      const [peakHour] = sortedHours[0];
      const ampm = peakHour >= 12 ? 'PM' : 'AM';
      const hour12 = peakHour % 12 || 12;
      insights.push({
        text: `You tend to reflect most around ${hour12}${ampm}. This could be a good time for daily check-ins.`,
        type: 'time',
        severity: 'insight',
      });
    }

    return insights;
  },

  generateReport() {
    const patterns = this.analyzeAll();
    Memory.set('patterns', patterns);
    return patterns;
  },
};
