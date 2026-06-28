/* xp.js — 経験値・レベル計算（設計書 §1.3 / §3.1④ ゲーミフィケーション）
   正解で基礎XP、速解・連続正解（コンボ）でボーナス。 */
(function (global) {
  'use strict';

  var BASE_CORRECT = 10;

  // 1問正解あたりの獲得XPを算出
  function awardFor(durationMs, combo) {
    var xp = BASE_CORRECT;
    // 速解ボーナス
    if (durationMs < 1500) xp += 8;
    else if (durationMs < 3000) xp += 4;
    // コンボボーナス（2連続以上、上限+20）
    if (combo >= 2) xp += Math.min((combo - 1) * 2, 20);
    return xp;
  }

  // あるレベル L から L+1 へ上がるのに必要なXP
  function reqForLevel(level) {
    return 100 + (level - 1) * 50;
  }

  // 累計XP -> { level, intoLevel, neededForNext, progress(0..1) }
  function levelInfo(totalXp) {
    var level = 1;
    var remaining = totalXp;
    while (remaining >= reqForLevel(level)) {
      remaining -= reqForLevel(level);
      level++;
    }
    var needed = reqForLevel(level);
    return {
      level: level,
      intoLevel: remaining,
      neededForNext: needed,
      progress: needed > 0 ? remaining / needed : 0
    };
  }

  global.XP = { awardFor: awardFor, levelInfo: levelInfo, reqForLevel: reqForLevel };
})(window);
