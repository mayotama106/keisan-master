/* generator.js — 出題エンジン（端末内の純粋関数 / ジャンル＝プラグイン的に追加可能）
   各ジャンルは { id, name, op, icon, gen(difficulty) -> {questionText, correctAnswer} }。
   設計書 §1.3 / §6.1（％は10の倍数など解きやすい数から）に準拠。 */
(function (global) {
  'use strict';

  function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var MINUS = '−'; // − 視認性の高いマイナス記号

  var GENRES = [
    {
      id: 'add', name: '足し算', op: 'add', icon: '➕', // ➕
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(1, 20); b = ri(1, 20); }
        else if (d === 'hard') { a = ri(100, 999); b = ri(100, 999); }
        else { a = ri(10, 99); b = ri(10, 99); }
        return { questionText: a + ' + ' + b, correctAnswer: a + b };
      }
    },
    {
      id: 'sub', name: '引き算', op: 'sub', icon: '➖', // ➖
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(5, 20); b = ri(1, a); }
        else if (d === 'hard') { a = ri(100, 999); b = ri(10, a); }
        else { a = ri(20, 99); b = ri(1, a); }
        return { questionText: a + ' ' + MINUS + ' ' + b, correctAnswer: a - b };
      }
    },
    {
      id: 'mul', name: '掛け算', op: 'mul', icon: '✖️', // ✖️
      gen: function (d) {
        var a, b;
        if (d === 'easy') { a = ri(1, 9); b = ri(1, 9); }
        else if (d === 'hard') { a = ri(11, 99); b = ri(3, 19); }
        else { a = ri(2, 12); b = ri(2, 12); }
        return { questionText: a + ' × ' + b, correctAnswer: a * b };
      }
    },
    {
      id: 'div', name: '割り算', op: 'div', icon: '➗', // ➗
      gen: function (d) {
        // 余りなしの割り算を生成（被除数 = 除数 × 商）
        var divisor, quotient;
        if (d === 'easy') { divisor = ri(2, 9); quotient = ri(1, 9); }
        else if (d === 'hard') { divisor = ri(3, 19); quotient = ri(3, 20); }
        else { divisor = ri(2, 9); quotient = ri(2, 12); }
        var dividend = divisor * quotient;
        return { questionText: dividend + ' ÷ ' + divisor, correctAnswer: quotient };
      }
    },
    {
      id: 'percent', name: '％計算', op: 'percent', icon: '💰', // 💰
      gen: function (d) {
        // base は20の倍数・pct は5の倍数 → 答えが必ず整数になる
        var base, pct, discount;
        if (d === 'easy') {
          base = 20 * ri(1, 5);                 // 20〜100
          pct = pick([10, 20, 25, 50]);
          discount = false;
        } else if (d === 'hard') {
          base = 20 * ri(3, 25);                // 60〜500
          pct = 5 * ri(1, 18);                  // 5〜90
          discount = Math.random() < 0.5;
        } else {
          base = 20 * ri(1, 12);                // 20〜240
          pct = pick([5, 10, 15, 20, 25, 30, 40, 50, 75]);
          discount = Math.random() < 0.35;
        }
        if (discount) {
          return {
            questionText: base + ' 円の ' + pct + '% 引きは？', // 円の Y% 引きは？
            correctAnswer: Math.round(base * (100 - pct) / 100)
          };
        }
        return {
          questionText: base + ' の ' + pct + '% は？', // X の Y% は？
          correctAnswer: Math.round(base * pct / 100)
        };
      }
    }
  ];

  var BY_ID = {};
  GENRES.forEach(function (g) { BY_ID[g.id] = g; });

  // 1問生成。genreId 未指定（ランダムモード）なら全ジャンルから無作為に。
  function nextQuestion(genreId, difficulty) {
    var g = genreId ? BY_ID[genreId] : pick(GENRES);
    var q = g.gen(difficulty || 'normal');
    return {
      genreId: g.id,
      genreName: g.name,
      genreIcon: g.icon,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer
    };
  }

  global.Generator = {
    GENRES: GENRES,
    byId: function (id) { return BY_ID[id]; },
    nextQuestion: nextQuestion
  };
})(window);
