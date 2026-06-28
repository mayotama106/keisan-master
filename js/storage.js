/* storage.js — localStorage 永続化ラッパ（オフライン・端末内完結）
   設計書 §4 のデータモデルに沿った単一プロファイル構造を保存する。 */
(function (global) {
  'use strict';

  var KEY = 'keisan-master:v1';

  function defaultState() {
    var now = new Date().toISOString();
    return {
      profile: {
        id: 'local',
        nickname: 'あなた',
        totalXp: 0,
        level: 1,
        streakDays: 0,
        lastPlayedDate: null, // 'YYYY-MM-DD'
        createdAt: now
      },
      setting: {
        difficulty: 'normal', // easy | normal | hard
        questionsPerSession: 10,
        soundOn: true
      },
      // ジャンル別 累計集計（統計用）
      stats: {
        // genreId: { attempts, correct, totalMs }
      },
      sessions: [],     // 直近セッションのサマリ（最大50件）
      reviewItems: []   // 復習アイテム
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      return migrate(data);
    } catch (e) {
      console.warn('storage load failed, using defaults', e);
      return defaultState();
    }
  }

  // 将来のスキーマ変更に備えた穴埋め（欠けたキーを既定値で補完）
  function migrate(data) {
    var def = defaultState();
    data = data || {};
    data.profile = Object.assign({}, def.profile, data.profile);
    data.setting = Object.assign({}, def.setting, data.setting);
    data.stats = data.stats || {};
    data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    data.reviewItems = Array.isArray(data.reviewItems) ? data.reviewItems : [];
    return data;
  }

  function save(state) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('storage save failed', e);
      return false;
    }
  }

  function clear() {
    try { global.localStorage.removeItem(KEY); } catch (e) {}
  }

  global.Storage_ = { KEY: KEY, defaultState: defaultState, load: load, save: save, clear: clear };
})(window);
