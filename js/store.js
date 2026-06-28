/* store.js — アプリ状態の中枢（永続化・セッション進行・採点・XP・復習・統計）
   設計書 §4 データモデル / §1.3 機能要件に対応。UI(app.js) から呼ばれる。 */
(function (global) {
  'use strict';

  var state = null;
  var run = null; // 進行中のセッション（メモリ上）

  /* ---------- 日付ユーティリティ（ローカル日付・ストリーク用） ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayDiff(fromStr, toStr) {
    var a = new Date(fromStr + 'T00:00:00');
    var b = new Date(toStr + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- 初期化・永続化 ---------- */
  function init() { state = global.Storage_.load(); Sound.setEnabled(state.setting.soundOn); return state; }
  function persist() { global.Storage_.save(state); }
  function getState() { return state; }

  function getSetting() { return state.setting; }
  function updateSetting(patch) {
    Object.assign(state.setting, patch);
    if ('soundOn' in patch) Sound.setEnabled(state.setting.soundOn);
    persist();
  }

  function levelInfo() { return XP.levelInfo(state.profile.totalXp); }

  /* ---------- 統計集計の更新 ---------- */
  function bumpStat(genreId, isCorrect, durationMs) {
    var s = state.stats[genreId] || { attempts: 0, correct: 0, totalMs: 0 };
    s.attempts += 1;
    if (isCorrect) s.correct += 1;
    s.totalMs += durationMs;
    state.stats[genreId] = s;
  }

  /* ---------- 復習アイテム ---------- */
  function findActiveReview(questionText) {
    for (var i = 0; i < state.reviewItems.length; i++) {
      if (state.reviewItems[i].questionText === questionText && state.reviewItems[i].status === 'active') {
        return state.reviewItems[i];
      }
    }
    return null;
  }
  function addOrBumpReview(q) {
    var existing = findActiveReview(q.questionText);
    if (existing) {
      existing.wrongCount += 1;
      existing.clearStreak = 0;
      existing.lastAttemptedAt = new Date().toISOString();
      return;
    }
    state.reviewItems.push({
      id: uid(),
      genreId: q.genreId,
      genreIcon: q.genreIcon,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      status: 'active',
      wrongCount: 1,
      clearStreak: 0,
      lastAttemptedAt: new Date().toISOString()
    });
  }
  function activeReviewItems() {
    return state.reviewItems.filter(function (r) { return r.status === 'active'; });
  }
  var CLEAR_THRESHOLD = 2; // 連続正解で卒業

  /* ---------- セッション進行 ---------- */
  // mode: 'random' | 'genre' | 'review'
  function startRun(opts) {
    var diff = state.setting.difficulty;
    var total = state.setting.questionsPerSession;
    run = {
      mode: opts.mode,
      genreId: opts.genreId || null,
      difficulty: diff,
      total: total,
      index: 0,
      correct: 0,
      xpEarned: 0,
      combo: 0,
      maxCombo: 0,
      startedAt: Date.now(),
      startLevel: levelInfo().level,
      attempts: [],
      reviewQueue: null,
      current: null,
      qStart: 0
    };

    if (opts.mode === 'review') {
      var items = activeReviewItems().slice();
      if (opts.onlyId) items = items.filter(function (r) { return r.id === opts.onlyId; });
      // シャッフル
      for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = items[i]; items[i] = items[j]; items[j] = t; }
      run.reviewQueue = items;
      run.total = items.length;
    }
    return _loadNext();
  }

  function _loadNext() {
    if (run.mode === 'review') {
      var item = run.reviewQueue[run.index];
      if (!item) { run.current = null; return null; }
      run.current = {
        reviewItemId: item.id,
        genreId: item.genreId,
        genreName: (Generator.byId(item.genreId) || {}).name || '復習',
        genreIcon: item.genreIcon || '🔁',
        questionText: item.questionText,
        correctAnswer: item.correctAnswer
      };
    } else {
      run.current = Generator.nextQuestion(run.genreId, run.difficulty);
    }
    run.qStart = performance.now();
    return run.current;
  }

  function currentQuestion() { return run ? run.current : null; }
  function runProgress() {
    return { index: run.index, total: run.total, combo: run.combo, mode: run.mode };
  }

  // ユーザー解答を採点し、結果オブジェクトを返す
  function submitAnswer(userAnswer) {
    var q = run.current;
    var durationMs = Math.round(performance.now() - run.qStart);
    var isCorrect = Number(userAnswer) === Number(q.correctAnswer);

    var beforeLevel = levelInfo().level;
    var xpAward = 0;

    if (isCorrect) {
      run.combo += 1;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.correct += 1;
      xpAward = XP.awardFor(durationMs, run.combo);
      state.profile.totalXp += xpAward;
      run.xpEarned += xpAward;
    } else {
      run.combo = 0;
    }

    // 復習の更新
    if (run.mode === 'review') {
      var item = _findReview(q.reviewItemId);
      if (item) {
        if (isCorrect) {
          item.clearStreak += 1;
          if (item.clearStreak >= CLEAR_THRESHOLD) item.status = 'cleared';
        } else {
          item.clearStreak = 0;
          item.wrongCount += 1;
        }
        item.lastAttemptedAt = new Date().toISOString();
      }
    } else if (!isCorrect) {
      addOrBumpReview(q);
    }

    bumpStat(q.genreId, isCorrect, durationMs);
    run.attempts.push({ questionText: q.questionText, correctAnswer: q.correctAnswer, userAnswer: Number(userAnswer), isCorrect: isCorrect, durationMs: durationMs });

    var afterLevel = levelInfo().level;
    persist();

    return {
      isCorrect: isCorrect,
      correctAnswer: q.correctAnswer,
      durationMs: durationMs,
      xpAward: xpAward,
      combo: run.combo,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      graduated: run.mode === 'review' && isCorrect && _findReview(q.reviewItemId) && _findReview(q.reviewItemId).status === 'cleared'
    };
  }

  function _findReview(id) {
    for (var i = 0; i < state.reviewItems.length; i++) if (state.reviewItems[i].id === id) return state.reviewItems[i];
    return null;
  }

  // 次の問題へ。{ done, question }
  function advance() {
    run.index += 1;
    if (run.index >= run.total) return { done: true };
    var q = _loadNext();
    return { done: false, question: q };
  }

  // セッション終了処理：ストリーク更新・サマリ保存
  function finishRun() {
    var endLevel = levelInfo().level;
    var durationTotal = run.attempts.reduce(function (a, x) { return a + x.durationMs; }, 0);
    var summary = {
      mode: run.mode,
      genreId: run.genreId,
      total: run.attempts.length,
      correct: run.correct,
      accuracy: run.attempts.length ? run.correct / run.attempts.length : 0,
      totalMs: durationTotal,
      avgMs: run.attempts.length ? Math.round(durationTotal / run.attempts.length) : 0,
      xpEarned: run.xpEarned,
      maxCombo: run.maxCombo,
      fromLevel: run.startLevel,
      toLevel: endLevel,
      leveledUp: endLevel > run.startLevel
    };

    // ストリーク
    var today = todayStr();
    var last = state.profile.lastPlayedDate;
    if (last !== today) {
      if (last && dayDiff(last, today) === 1) state.profile.streakDays += 1;
      else state.profile.streakDays = 1;
      state.profile.lastPlayedDate = today;
    }
    if (state.profile.streakDays === 0) state.profile.streakDays = 1;

    state.profile.level = endLevel;
    state.sessions.unshift({
      id: uid(), mode: run.mode, genreId: run.genreId,
      total: summary.total, correct: summary.correct, xpEarned: summary.xpEarned,
      endedAt: new Date().toISOString()
    });
    if (state.sessions.length > 50) state.sessions.length = 50;

    persist();
    summary.streakDays = state.profile.streakDays;
    run = null;
    return summary;
  }

  function abortRun() { run = null; }

  /* ---------- 統計参照 ---------- */
  function genreStats() {
    return Generator.GENRES.map(function (g) {
      var s = state.stats[g.id] || { attempts: 0, correct: 0, totalMs: 0 };
      return {
        id: g.id, name: g.name, icon: g.icon,
        attempts: s.attempts,
        accuracy: s.attempts ? s.correct / s.attempts : 0,
        avgMs: s.attempts ? Math.round(s.totalMs / s.attempts) : 0
      };
    });
  }
  function overallStats() {
    var attempts = 0, correct = 0;
    Object.keys(state.stats).forEach(function (k) { attempts += state.stats[k].attempts; correct += state.stats[k].correct; });
    return {
      totalAttempts: attempts,
      accuracy: attempts ? correct / attempts : 0,
      streakDays: state.profile.streakDays,
      sessions: state.sessions.length,
      activeReview: activeReviewItems().length,
      clearedReview: state.reviewItems.filter(function (r) { return r.status === 'cleared'; }).length
    };
  }

  function resetAll() {
    global.Storage_.clear();
    state = global.Storage_.defaultState();
    Sound.setEnabled(state.setting.soundOn);
    run = null;
    persist();
  }

  global.KeisanStore = {
    init: init, getState: getState,
    getSetting: getSetting, updateSetting: updateSetting,
    levelInfo: levelInfo,
    startRun: startRun, currentQuestion: currentQuestion, runProgress: runProgress,
    submitAnswer: submitAnswer, advance: advance, finishRun: finishRun, abortRun: abortRun,
    activeReviewItems: activeReviewItems,
    genreStats: genreStats, overallStats: overallStats,
    resetAll: resetAll
  };
})(window);
