/* generator.js — 出題エンジン（％計算に特化。四則は基礎練習として保持）
   各ジャンルは { id, name, category, icon, gen(difficulty) -> {questionText, correctAnswer, hint} }。
   answer が必ず整数になるよう base=20の倍数・pct=5の倍数で生成（設計書 §6.1）。 */
(function (global) {
  'use strict';

  function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  var MINUS = '−';

  // 難易度ごとの percent パラメータ
  function pctParams(d) {
    if (d === 'easy') return { base: function () { return 20 * ri(1, 5); }, pct: function () { return pick([10, 20, 25, 50]); } };
    if (d === 'hard') return { base: function () { return 20 * ri(3, 25); }, pct: function () { return 5 * ri(1, 18); } };
    return { base: function () { return 20 * ri(1, 12); }, pct: function () { return pick([5, 10, 15, 20, 25, 30, 40, 50, 75]); } };
  }

  var GENRES = [
    /* ===== ％計算（主役） ===== */
    {
      id: 'pct_basic', name: '基本の％', category: 'percent', icon: '💯',
      gen: function (d) {
        var p = pctParams(d), base = p.base(), pct = p.pct();
        return {
          questionText: base + ' の ' + pct + '% は？',
          correctAnswer: base * pct / 100,
          hint: pct + '% = ' + (pct / 100) + ' なので ' + base + ' × ' + (pct / 100)
        };
      }
    },
    {
      id: 'pct_discount', name: '割引', category: 'percent', icon: '🏷️',
      gen: function (d) {
        var p = pctParams(d), base = p.base(), pct = p.pct();
        return {
          questionText: base + ' 円の ' + pct + '% 引きは？',
          correctAnswer: base * (100 - pct) / 100,
          hint: (100 - pct) + '% 残るので ' + base + ' × ' + ((100 - pct) / 100)
        };
      }
    },
    {
      id: 'pct_markup', name: '％増し', category: 'percent', icon: '📈',
      gen: function (d) {
        var p = pctParams(d), base = p.base(), pct = p.pct();
        return {
          questionText: base + ' 円の ' + pct + '% 増しは？',
          correctAnswer: base * (100 + pct) / 100,
          hint: (100 + pct) + '% になるので ' + base + ' × ' + ((100 + pct) / 100)
        };
      }
    },
    {
      id: 'pct_ratio', name: '何％？', category: 'percent', icon: '❓',
      gen: function (d) {
        // 「X は Y の何%？」 答え = pct（％）
        var whole, pct;
        if (d === 'easy') { whole = 20 * ri(1, 5); pct = pick([10, 25, 50, 75, 100]); }
        else if (d === 'hard') { whole = 20 * ri(2, 20); pct = 5 * ri(1, 30); }
        else { whole = 20 * ri(1, 10); pct = pick([10, 20, 25, 40, 50, 75, 100]); }
        var part = whole * pct / 100;
        return {
          questionText: part + ' は ' + whole + ' の何％？',
          correctAnswer: pct,
          hint: part + ' ÷ ' + whole + ' × 100'
        };
      }
    },

    /* ===== 四則（基礎練習） ===== */
    {
      id: 'add', name: '足し算', category: 'basic', icon: '➕',
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(1, 20); b = ri(1, 20); }
        else if (d === 'hard') { a = ri(100, 999); b = ri(100, 999); }
        else { a = ri(10, 99); b = ri(10, 99); }
        return { questionText: a + ' + ' + b, correctAnswer: a + b };
      }
    },
    {
      id: 'sub', name: '引き算', category: 'basic', icon: '➖',
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(5, 20); b = ri(1, a); }
        else if (d === 'hard') { a = ri(100, 999); b = ri(10, a); }
        else { a = ri(20, 99); b = ri(1, a); }
        return { questionText: a + ' ' + MINUS + ' ' + b, correctAnswer: a - b };
      }
    },
    {
      id: 'mul', name: '掛け算', category: 'basic', icon: '✖️',
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(1, 9); b = ri(1, 9); }
        else if (d === 'hard') { a = ri(11, 99); b = ri(3, 19); }
        else { a = ri(2, 12); b = ri(2, 12); }
        return { questionText: a + ' × ' + b, correctAnswer: a * b };
      }
    },
    {
      id: 'div', name: '割り算', category: 'basic', icon: '➗',
      gen: function (d) {
        var divisor, quotient;
        if (d === 'easy') { divisor = ri(2, 9); quotient = ri(1, 9); }
        else if (d === 'hard') { divisor = ri(3, 19); quotient = ri(3, 20); }
        else { divisor = ri(2, 9); quotient = ri(2, 12); }
        return { questionText: (divisor * quotient) + ' ÷ ' + divisor, correctAnswer: quotient };
      }
    }
  ];

  var BY_ID = {};
  GENRES.forEach(function (g) { BY_ID[g.id] = g; });
  var PERCENT_IDS = GENRES.filter(function (g) { return g.category === 'percent'; }).map(function (g) { return g.id; });
  var BASIC_IDS = GENRES.filter(function (g) { return g.category === 'basic'; }).map(function (g) { return g.id; });

  // 1問生成。pool（ジャンルID配列）が渡されればそこから無作為に。
  function nextQuestion(genreId, difficulty, pool) {
    var id = genreId || pick(pool && pool.length ? pool : PERCENT_IDS);
    var g = BY_ID[id];
    var q = g.gen(difficulty || 'normal');
    return {
      genreId: g.id, genreName: g.name, genreIcon: g.icon, genreCategory: g.category,
      questionText: q.questionText, correctAnswer: q.correctAnswer, hint: q.hint || null
    };
  }

  global.Generator = {
    GENRES: GENRES,
    PERCENT_IDS: PERCENT_IDS,
    BASIC_IDS: BASIC_IDS,
    byId: function (id) { return BY_ID[id]; },
    nextQuestion: nextQuestion
  };
})(window);
