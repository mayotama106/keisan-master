/* app.js — 画面構築・遷移・出題フロー（設計書 §2 画面遷移 / §3 デザイン原則）
   全画面を生成し、KeisanStore の状態を描画する UI コントローラ。 */
(function (global) {
  'use strict';
  var el = UI.el, mount = UI.mount, toast = UI.toast;
  var ONBOARD_KEY = 'keisan-master:onboarded';

  /* ============================ トップバー ============================ */
  function topBar() {
    var info = KeisanStore.levelInfo();
    var st = KeisanStore.getState();
    return el('div.topbar', null, [
      el('div.level-badge', { title: 'レベル' }, 'Lv.' + info.level),
      el('div.xp-wrap', null, [
        el('div.xp-meta', null, [
          el('span', null, 'XP'),
          el('span.tnum', null, info.intoLevel + ' / ' + info.neededForNext)
        ]),
        el('div.xp-bar', null, [el('div.xp-fill', { style: 'width:' + Math.round(info.progress * 100) + '%' })])
      ]),
      el('div.streak', { title: '連続日数' }, '🔥 ' + (st.profile.streakDays || 0))
    ]);
  }

  /* ============================ ホーム ============================ */
  function homeScreen() {
    var reviewCount = KeisanStore.activeReviewItems().length;
    var screen = el('div.screen', null, [
      topBar(),
      el('div.mt6', null, [
        el('div.h1', null, 'めざせ、％マスター！'),
        el('div.muted.mt2', null, '割引もマージンも、電卓なしでスッと。')
      ]),
      el('div.cards.mt6', null, [
        modeCard('primary', '💯', '％にチャレンジ', '％計算をランダムに連続出題',
          function () { startQuiz({ mode: 'random', pool: Generator.PERCENT_IDS }); }),
        modeCard('', '🎯', 'ジャンルを選ぶ', '割引・○％増し・何％？ など', function () { navigate(genreScreen); }),
        modeCard('', '🔁', '復習', reviewCount ? reviewCount + '問の間違いを解き直す' : '間違えた問題がここに貯まります',
          function () { navigate(reviewScreen); }, reviewCount)
      ]),
      el('div.row.gap3.mt4', null, [
        el('button.btn.ghost', { onClick: function () { navigate(lectureScreen); } }, '📖 ％の使い方'),
        el('button.btn.ghost', { onClick: function () { navigate(chatScreen); } }, '💬 先生にきく')
      ]),
      el('div.row.gap3.mt3', null, [
        el('button.btn.ghost', { onClick: function () { navigate(statsScreen); } }, '📊 統計'),
        el('button.btn.ghost', { onClick: function () { navigate(settingsScreen); } }, '⚙️ 設定')
      ])
    ]);
    return screen;
  }

  function modeCard(variant, icon, title, sub, onClick, count) {
    return el('button.mode-card' + (variant ? '.' + variant : ''), { onClick: onClick }, [
      el('div.ic', null, icon),
      el('div.grow', null, [el('div.title', null, title), el('div.sub', null, sub)]),
      count ? el('div.badge-count.tnum', null, String(count)) : null
    ]);
  }

  /* ============================ ジャンル選択 ============================ */
  function genreScreen() {
    function tile(g) {
      return el('button.genre-tile', { onClick: function () { startQuiz({ mode: 'genre', genreId: g.id }); } }, [
        el('div.ic', null, g.icon),
        el('div.name', null, g.name)
      ]);
    }
    function tilesOf(ids) { return ids.map(function (id) { return tile(Generator.byId(id)); }); }

    return el('div.screen', null, [
      backHead('ジャンルを選ぶ'),
      el('div.muted.mt2', null, '鍛えたい計算を選ぼう。'),
      el('div.section-title', null, '％計算（メイン）'),
      el('div.genre-grid', null, tilesOf(Generator.PERCENT_IDS).concat([
        el('button.genre-tile.all', { onClick: function () { startQuiz({ mode: 'random', pool: Generator.PERCENT_IDS }); } }, [
          el('div.ic', null, '💯'),
          el('div', null, [el('div.name', null, '％ぜんぶランダム'), el('div.acc', null, '％の全タイプから出題')])
        ])
      ])),
      el('div.section-title', null, '基礎（四則演算）'),
      el('div.genre-grid', null, tilesOf(Generator.BASIC_IDS).concat([
        el('button.genre-tile.all', { onClick: function () { startQuiz({ mode: 'random', pool: Generator.BASIC_IDS }); } }, [
          el('div.ic', null, '🎲'),
          el('div', null, [el('div.name', null, '四則ランダム'), el('div.acc', null, '足し算〜割り算から出題')])
        ])
      ]))
    ]);
  }

  function backHead(title) {
    return el('div.row.gap3', null, [
      el('button.icon-btn', { onClick: goHome, 'aria-label': '戻る' }, '←'),
      el('div.h2', null, title)
    ]);
  }

  /* ============================ 出題画面 ============================ */
  function startQuiz(opts) {
    Sound.unlock();
    var first = KeisanStore.startRun(opts);
    if (!first) { toast('出題できる問題がありません'); return; }
    navigate(function () { return quizScreen(); });
  }

  function quizScreen() {
    var buffer = '';
    var locked = false; // フィードバック表示中は入力ロック

    var screen = el('div.screen.quiz');

    // ヘッダ（中断・進捗・残り）
    var progFill = el('div');
    var qCount = el('div.q-count.tnum');
    var head = el('div.quiz-head', null, [
      el('button.icon-btn', { onClick: confirmQuit, 'aria-label': '中断' }, '✕'),
      el('div.progress', null, [progFill]),
      qCount
    ]);

    var comboRow = el('div.combo-row');
    var genreTag = el('div.q-genre-tag');
    var qText = el('div.q-text.tnum');
    var qCard = el('div.q-card', null, [genreTag, qText]);

    var ansDisplay = el('div.answer-display.tnum');
    var keypad = buildKeypad();
    var submitBtn = el('button.submit-btn', { onClick: doSubmit }, '送信');

    screen.appendChild(head);
    screen.appendChild(comboRow);
    screen.appendChild(qCard);
    screen.appendChild(ansDisplay);
    screen.appendChild(keypad);
    screen.appendChild(submitBtn);

    function renderQuestion() {
      var q = KeisanStore.currentQuestion();
      var p = KeisanStore.runProgress();
      genreTag.textContent = q.genreIcon + ' ' + q.genreName;
      qText.textContent = q.questionText + ' = ?';
      qCount.textContent = (p.index + 1) + ' / ' + p.total;
      progFill.style.width = Math.round((p.index) / p.total * 100) + '%';
      renderCombo(p.combo);
      buffer = '';
      renderBuffer();
    }
    function renderCombo(combo) {
      UI.clear(comboRow);
      if (combo >= 2) comboRow.appendChild(el('div.combo', null, '🔥 ' + combo + ' コンボ'));
    }
    function renderBuffer() {
      ansDisplay.className = 'answer-display tnum' + (buffer ? ' filled' : '');
      UI.clear(ansDisplay);
      if (buffer === '') ansDisplay.appendChild(el('span.ph', null, '答えを入力'));
      else ansDisplay.appendChild(document.createTextNode(buffer));
      submitBtn.disabled = buffer === '';
    }

    function buildKeypad() {
      var pad = el('div.keypad');
      var keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
      keys.forEach(function (k) { pad.appendChild(keyBtn(k, function () { press(k); })); });
      pad.appendChild(el('div.key.fn', { onClick: function () { clearBuf(); } }, 'C'));
      pad.appendChild(keyBtn('0', function () { press('0'); }));
      pad.appendChild(el('div.key.fn', { onClick: function () { backspace(); } }, '⌫'));
      return pad;
    }
    function keyBtn(label, fn) { return el('div.key', { onClick: fn }, label); }

    function press(d) {
      if (locked) return;
      if (buffer.length >= 7) return;
      if (buffer === '0') buffer = d; else buffer += d;
      Sound.tap();
      renderBuffer();
    }
    function backspace() { if (locked) return; buffer = buffer.slice(0, -1); Sound.tap(); renderBuffer(); }
    function clearBuf() { if (locked) return; buffer = ''; Sound.tap(); renderBuffer(); }

    function doSubmit() {
      if (locked || buffer === '') return;
      locked = true;
      var result = KeisanStore.submitAnswer(buffer);
      progFill.style.width = Math.round((KeisanStore.runProgress().index + 1) / KeisanStore.runProgress().total * 100) + '%';
      showFeedback(result);
    }

    function showFeedback(result) {
      if (result.isCorrect) { Sound.correct(); if (result.leveledUp) setTimeout(Sound.levelup, 200); }
      else Sound.wrong();

      ansDisplay.classList.add(result.isCorrect ? 'flash-ok' : 'flash-ng');

      var overlay = el('div.fb-overlay.' + (result.isCorrect ? 'ok' : 'ng'));
      if (result.isCorrect) {
        overlay.appendChild(el('div.fb-mark.ok', null, '✓'));
        overlay.appendChild(el('div.fb-title', null, result.graduated ? '卒業！🎓' : '正解！'));
        overlay.appendChild(el('div.fb-xp', null, '+' + result.xpAward + ' XP' + (result.combo >= 2 ? '　🔥' + result.combo : '')));
        if (result.leveledUp) overlay.appendChild(el('div.levelup-banner', null, [
          el('div', null, '🎉'), el('div', null, [el('div.big', null, 'レベルアップ！'), el('div', null, 'Lv.' + result.newLevel + ' になりました')])
        ]));
      } else {
        overlay.appendChild(el('div.fb-mark.ng', null, '✕'));
        overlay.appendChild(el('div.fb-title', null, '不正解'));
        overlay.appendChild(el('div.fb-correct', null, ['正しい答えは ', el('b.tnum', null, String(result.correctAnswer))]));
        if (result.hint) overlay.appendChild(el('div.fb-tip', null, '💡 ' + result.hint));
        overlay.appendChild(el('div.fb-hint', null, 'この問題は復習リストに追加されました'));
        overlay.appendChild(el('div.fb-hint.mt2', null, 'タップで次へ →'));
      }
      qCard.appendChild(overlay);

      if (result.isCorrect) {
        var to = setTimeout(next, result.leveledUp ? 1400 : 800);
        overlay.addEventListener('click', function () { clearTimeout(to); next(); });
      } else {
        // 不正解は答えを確認させてからタップで進む（自動でも進む）
        var to2 = setTimeout(next, 3500);
        overlay.addEventListener('click', function () { clearTimeout(to2); next(); });
      }

      function next() {
        if (!locked) return; // 二重実行防止
        locked = false;
        if (overlay.parentNode) qCard.removeChild(overlay);
        ansDisplay.classList.remove('flash-ok', 'flash-ng');
        var step = KeisanStore.advance();
        if (step.done) finishAndShowResult();
        else renderQuestion();
      }
    }

    function confirmQuit() {
      if (confirm('セッションを中断してホームに戻りますか？\n（ここまでの結果は保存されません）')) {
        KeisanStore.abortRun();
        goHome();
      }
    }

    // 物理キーボード対応（PC/外付け）
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') doSubmit();
      else if (e.key === 'Escape') confirmQuit();
    }
    document.addEventListener('keydown', onKey);
    screen._cleanup = function () { document.removeEventListener('keydown', onKey); };

    renderQuestion();
    return screen;
  }

  function finishAndShowResult() {
    var summary = KeisanStore.finishRun();
    Sound.finish();
    navigate(function () { return resultScreen(summary); });
  }

  /* ============================ 結果 ============================ */
  function resultScreen(s) {
    var acc = Math.round(s.accuracy * 100);
    var emoji = acc >= 90 ? '🏆' : acc >= 70 ? '🎉' : acc >= 50 ? '👍' : '💪';
    var msg = acc >= 90 ? '素晴らしい！' : acc >= 70 ? 'よくできました！' : acc >= 50 ? 'その調子！' : 'コツコツ続けよう！';

    // 正答率リング
    var R = 52, C = 2 * Math.PI * R;
    var ring = svgNS('svg', { width: 140, height: 140, viewBox: '0 0 140 140', class: 'ring' }, [
      svgNS('circle', { class: 'ring-track', cx: 70, cy: 70, r: R, 'stroke-width': 12 }),
      svgNS('circle', { class: 'ring-fill', cx: 70, cy: 70, r: R, 'stroke-width': 12, 'stroke-dasharray': C, 'stroke-dashoffset': C })
    ]);
    var label = svgNS('text', { x: 70, y: 78, 'text-anchor': 'middle', class: 'ring-label', transform: 'rotate(90 70 70)' }, acc + '%');
    ring.appendChild(label);
    // アニメーションで埋める
    setTimeout(function () { ring.querySelector('.ring-fill').setAttribute('stroke-dashoffset', String(C * (1 - s.accuracy))); }, 80);

    var screen = el('div.screen', null, [
      el('div.result-hero', null, [
        el('div.result-emoji', null, emoji),
        el('div.h1.mt2', null, msg),
        el('div.muted', null, s.mode === 'review' ? '復習セッション完了' : 'セッション完了')
      ]),
      el('div.summary-card', null, [
        el('div.ring-wrap', null, [ring]),
        el('div.stat-grid', null, [
          stat(s.correct + ' / ' + s.total, '正答数', 'ok'),
          stat('+' + s.xpEarned, '獲得XP', 'xp'),
          stat(UI.fmtMs(s.avgMs), '平均時間', ''),
          stat('🔥' + s.maxCombo, '最大コンボ', '')
        ])
      ]),
      s.leveledUp ? el('div.levelup-banner', null, [
        el('div', { style: 'font-size:28px' }, '🎉'),
        el('div', null, [el('div.big', null, 'レベルアップ！'), el('div', null, 'Lv.' + s.fromLevel + ' → Lv.' + s.toLevel)])
      ]) : null,
      el('div.btn-stack', null, [
        el('button.btn.primary.lg', { onClick: function () { repeatLast(s); } }, '🔄 もう一度'),
        el('button.btn.ghost', { onClick: goHome }, 'ホームへ')
      ])
    ]);
    return screen;
  }
  function stat(v, l, cls) { return el('div.stat', null, [el('div.v' + (cls ? '.' + cls : ''), { class: 'tnum' }, v), el('div.l', null, l)]); }

  function repeatLast(s) {
    if (s.mode === 'review') {
      if (KeisanStore.activeReviewItems().length === 0) { toast('復習はすべて完了！'); goHome(); return; }
      startQuiz({ mode: 'review' });
    } else {
      startQuiz({ mode: s.mode, genreId: s.genreId });
    }
  }

  /* ============================ 復習一覧 ============================ */
  function reviewScreen() {
    var items = KeisanStore.activeReviewItems();
    var body;
    if (items.length === 0) {
      body = el('div.empty', null, [el('div.ic', null, '🎉'), el('div', null, '復習リストは空です'), el('div.muted.mt2', null, '間違えた問題がここに貯まります。')]);
    } else {
      body = el('div', null, [
        el('button.btn.primary.lg.mt4', { onClick: function () { startQuiz({ mode: 'review' }); } }, '🔁 まとめて復習（' + items.length + '問）'),
        el('div.section-title', null, '間違えた問題（タップで個別に復習）'),
        el('div.list', null, items.map(function (it) {
          return el('button.review-item', { onClick: function () { startQuiz({ mode: 'review', onlyId: it.id }); } }, [
            el('div', null, [
              el('div.q', null, it.questionText + ' = ?'),
              el('div.meta', null, (it.genreIcon || '') + ' 正解 ' + it.correctAnswer)
            ]),
            el('div.pill.warn', null, '×' + it.wrongCount)
          ]);
        }))
      ]);
    }
    return el('div.screen', null, [backHead('復習リスト'), body]);
  }

  /* ============================ 統計 ============================ */
  function statsScreen() {
    var o = KeisanStore.overallStats();
    var gs = KeisanStore.genreStats();
    var info = KeisanStore.levelInfo();

    var bars = gs.map(function (g) {
      var has = g.attempts > 0;
      return el('div.bar-row', null, [
        el('div.nm', null, g.icon + ' ' + g.name),
        el('div.bar-track', null, [el('div', { style: 'width:' + (has ? Math.round(g.accuracy * 100) : 0) + '%' })]),
        el('div.pct' + (has ? '.tnum' : '.empty'), null, has ? Math.round(g.accuracy * 100) + '%' : '—')
      ]);
    });

    return el('div.screen', null, [
      backHead('統計'),
      el('div.kpi-grid.mt4', null, [
        kpi('Lv.' + info.level, 'レベル'),
        kpi('🔥' + o.streakDays, '連続日数'),
        kpi(o.totalAttempts, '総回答数')
      ]),
      el('div.kpi-grid.mt3', null, [
        kpi(Math.round(o.accuracy * 100) + '%', '総合正答率'),
        kpi(o.activeReview, '復習中'),
        kpi(o.clearedReview, '克服した数')
      ]),
      el('div.section-title', null, 'ジャンル別 正答率'),
      el('div.stat-card', null, bars)
    ]);
  }
  function kpi(v, l) { return el('div.kpi', null, [el('div.v.tnum', null, String(v)), el('div.l', null, l)]); }

  /* ============================ 設定 ============================ */
  function settingsScreen() {
    var st = KeisanStore.getSetting();

    function difficultyRow() {
      var opts = [['easy', 'やさしい'], ['normal', 'ふつう'], ['hard', 'むずかしい']];
      var seg = el('div.seg');
      opts.forEach(function (o) {
        var b = el('button' + (st.difficulty === o[0] ? '.on' : ''), {
          onClick: function () {
            KeisanStore.updateSetting({ difficulty: o[0] });
            Array.prototype.forEach.call(seg.children, function (c) { c.classList.remove('on'); });
            b.classList.add('on');
          }
        }, o[1]);
        seg.appendChild(b);
      });
      return settingRow('難易度', '数字の桁数や％の難しさが変わります', seg);
    }

    function countRow() {
      var opts = [5, 10, 15, 20];
      var seg = el('div.seg');
      opts.forEach(function (n) {
        var b = el('button' + (st.questionsPerSession === n ? '.on' : ''), {
          onClick: function () {
            KeisanStore.updateSetting({ questionsPerSession: n });
            Array.prototype.forEach.call(seg.children, function (c) { c.classList.remove('on'); });
            b.classList.add('on');
          }
        }, String(n));
        seg.appendChild(b);
      });
      return settingRow('1セッションの問題数', 'ランダム／ジャンルモードの出題数', seg);
    }

    function soundRow() {
      var sw = el('div.switch' + (st.soundOn ? '.on' : ''), {
        onClick: function () {
          var v = !KeisanStore.getSetting().soundOn;
          KeisanStore.updateSetting({ soundOn: v });
          sw.classList.toggle('on', v);
          if (v) Sound.correct();
        }
      });
      return el('div.setting-row.row.between', null, [
        el('div', null, [el('div.lbl', null, 'サウンド'), el('div.desc', null, '正誤・操作音の ON / OFF')]),
        sw
      ]);
    }

    return el('div.screen', null, [
      backHead('設定'),
      el('div.setting-card.mt4', null, [difficultyRow(), countRow(), soundRow()]),
      el('div.section-title', null, 'データ'),
      el('div.setting-card', null, [
        el('button.btn.ghost', { onClick: exportData }, '⬇️ 進捗をエクスポート（バックアップ）'),
        el('div.mt3'),
        el('button.btn.ghost', { onClick: importData }, '⬆️ 進捗をインポート'),
        el('div.mt3'),
        el('button.btn.ghost', { style: 'color:var(--error)', onClick: resetData }, '🗑 データをリセット')
      ]),
      el('div.muted.center.mt6', { style: 'font-size:12px' }, 'データは端末内（localStorage）にのみ保存されます。')
    ]);
  }
  function settingRow(label, desc, control) {
    return el('div.setting-row', null, [el('div.lbl', null, label), el('div.desc', null, desc), control]);
  }

  /* ---------- データ入出力（バックアップ / 移行） ---------- */
  function exportData() {
    var data = JSON.stringify(KeisanStore.getState(), null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'keisan-master-backup.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('バックアップを書き出しました');
  }
  function importData() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = function () {
      var file = input.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          window.localStorage.setItem(Storage_.KEY, JSON.stringify(obj));
          KeisanStore.init();
          toast('インポートしました');
          goHome();
        } catch (e) { toast('読み込みに失敗しました'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  function resetData() {
    if (confirm('すべての進捗（XP・レベル・統計・復習）を削除します。よろしいですか？')) {
      KeisanStore.resetAll();
      toast('リセットしました');
      goHome();
    }
  }

  /* ============================ ％レクチャー（小学生向け） ============================ */
  function para(text) {
    return el('div', null, String(text).split('\n').map(function (line) { return el('div.mt2', null, line); }));
  }
  // 100マスのうち pct 分を塗ったバー
  function percentBar(pct, caption) {
    return el('div.pbar-wrap', null, [
      el('div.pbar', null, [
        el('div.pbar-fill', { style: 'width:' + pct + '%' }, el('span', null, pct + '%')),
        el('div.pbar-rest', null, caption || '')
      ]),
      el('div.pbar-scale', null, [el('span', null, '0'), el('span', null, '50'), el('span', null, '100')])
    ]);
  }

  function lectureScreen() {
    var pages = [
      {
        icon: '🍕', title: '① ％ってなに？',
        visual: percentBar(30, ''),
        body: '％（パーセント）は「100 を ぜんぶ としたとき、いくつ分か」を表すよ。\n上のバーは 100 のうち 30 ぬってあるから 30％。\n半分なら 50％、ぜんぶで 100％ だね。',
        ex: 'ピザを100切れにして、そのうち30切れ → 30％ 🍕'
      },
      {
        icon: '🔁', title: '② ％は「÷100」で小数に',
        visual: el('div.formula', null, '25% = 25 ÷ 100 = 0.25'),
        body: '計算するときは、％を 100 で わって 小数 に直すのがコツ。\nこれさえできれば、あとはかけ算するだけ！',
        ex: '10% → 0.1 ／ 50% → 0.5 ／ 8% → 0.08'
      },
      {
        icon: '💯', title: '③ 「○の□％」の出し方',
        visual: el('div.formula', null, '80 の 15% = 80 × 0.15 = 12'),
        body: '「もとの数 × (□÷100)」で出せるよ。\n① □％を小数にする（15% → 0.15）\n② もとの数にかける（80 × 0.15）',
        ex: '200 の 25% は？ → 200 × 0.25 = 50'
      },
      {
        icon: '🏷️', title: '④ 割引（□％引き）',
        visual: el('div.formula', null, '1000円の 20%引き = 1000 × 0.8 = 800円'),
        body: '「□％引き」は、もとの値段から □％ぶん 安くすること。\nコツ：残るのは (100 − □)％。\n20％引きなら、残り 80％ ＝ ×0.8。',
        ex: '安くなる額は 1000 × 0.2 = 200円だよ'
      },
      {
        icon: '📈', title: '⑤ ○％増し・消費税',
        visual: el('div.formula', null, '800円の 10%増し = 800 × 1.1 = 880円'),
        body: '「□％増し」は、もとに □％ぶん 足すこと。\nコツ：合計は (100 + □)％。\n消費税10％も同じで、×1.1 すればOK！',
        ex: '500円の 30%増し → 500 × 1.3 = 650円'
      },
      {
        icon: '❓', title: '⑥ 「A は B の何％？」',
        visual: el('div.formula', null, '20 は 80 の何% → 20 ÷ 80 × 100 = 25%'),
        body: 'くらべる数 ÷ もとの数 × 100 で出せるよ。\n① わり算する（20 ÷ 80 = 0.25）\n② 100 をかける（0.25 × 100 = 25）',
        ex: '「くらべる ÷ もと × 100」と覚えよう！'
      },
      {
        icon: '🎓', title: 'まとめ：これだけ覚えよう',
        visual: el('div.cheat', null, [
          el('div', null, '○の□% → ○ × (□÷100)'),
          el('div', null, '□%引き → ○ × (100−□)/100'),
          el('div', null, '□%増し → ○ × (100+□)/100'),
          el('div', null, 'AはBの何% → A ÷ B × 100')
        ]),
        body: 'まずは「％を小数に直す」クセをつければ大丈夫。\nさっそく問題で試してみよう！',
        ex: null, last: true
      }
    ];
    var i = 0;
    var host = el('div.screen');

    function render() {
      UI.clear(host);
      var p = pages[i];
      host.appendChild(backHead('％の使い方'));
      host.appendChild(el('div.lecture-card.mt4', null, [
        el('div.center', { style: 'font-size:44px' }, p.icon),
        el('div.h2.center.mt2', null, p.title),
        el('div.mt4', null, p.visual),
        el('div.lecture-body.mt4', null, para(p.body)),
        p.ex ? el('div.lecture-ex.mt4', null, ['🔎 ', p.ex]) : null
      ]));
      // ドット
      host.appendChild(el('div.row.gap2.mt4', { style: 'justify-content:center' },
        pages.map(function (_, k) { return el('div.dot' + (k === i ? '.on' : '')); })));
      // ナビ
      if (p.last) {
        host.appendChild(el('div.btn-stack', null, [
          el('button.btn.primary.lg', { onClick: function () { startQuiz({ mode: 'random', pool: Generator.PERCENT_IDS }); } }, '✏️ 問題で試す'),
          el('button.btn.ghost', { onClick: function () { navigate(chatScreen); } }, '💬 先生にきく'),
          el('button.btn.ghost', { onClick: function () { i = 0; render(); } }, '↩︎ もう一度よむ')
        ]));
      } else {
        host.appendChild(el('div.row.gap3.mt4', null, [
          i > 0 ? el('button.btn.ghost', { onClick: function () { i--; render(); } }, '← もどる') : el('div.grow'),
          el('button.btn.primary', { class: 'grow', onClick: function () { i++; render(); } }, 'つぎへ →')
        ]));
      }
      host.scrollTop = 0;
    }
    render();
    return host;
  }

  /* ============================ ％の先生チャット ============================ */
  function chatScreen() {
    var history = [];       // LLM 用の会話履歴 [{role, content}]
    var useLLM = false;     // 本格AI(TinySwallow)を使うか
    var llmReady = false;

    var host = el('div.screen.chat');
    host.appendChild(backHead('％の先生'));

    // 本格AI 切替（対応端末のみ実際に動く）
    var supported = (typeof LLM !== 'undefined') && LLM.isSupported();
    var sw = el('div.switch');
    var aiNote = el('div.desc');
    aiNote.textContent = supported
      ? '本格ローカルAI（Sakana TinySwallow）に切替。初回はWiFiで〜1GBのDLが必要です。'
      : 'この端末は本格AI非対応のため、内蔵の「％の先生」が答えます（本格AIはPC向け）。';
    var aiRow = el('div.setting-card', null, [
      el('div.row.between', null, [
        el('div', null, [el('div.lbl', null, '🤖 本格AIで答える'), aiNote]),
        supported ? sw : el('span.pill', null, '内蔵')
      ])
    ]);
    host.appendChild(aiRow);

    var log = el('div.chat-log');
    host.appendChild(log);

    var chips = el('div.chips');
    Tutor.suggestions().forEach(function (q) {
      chips.appendChild(el('button.chip', { onClick: function () { sendUser(q); } }, q));
    });

    var input = el('input.chat-input', { type: 'text', placeholder: '例）80の15%は？', enterkeyhint: 'send', autocomplete: 'off' });
    var sendBtn = el('button.chat-send', { onClick: function () { sendUser(input.value); } }, '送信');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendUser(input.value); } });
    var inputRow = el('div.chat-input-row', null, [input, sendBtn]);

    host.appendChild(chips);
    host.appendChild(inputRow);

    function bubble(role, text) {
      var b = el('div.bubble.' + role);
      setBubbleText(b, text);
      log.appendChild(el('div.bubble-row.' + role, null, b));
      log.scrollTop = log.scrollHeight;
      return b;
    }
    function setBubbleText(b, text) {
      UI.clear(b);
      String(text).split('\n').forEach(function (line, idx) {
        if (idx) b.appendChild(document.createElement('br'));
        b.appendChild(document.createTextNode(line));
      });
      log.scrollTop = log.scrollHeight;
    }

    function sendUser(text) {
      text = (text || '').trim();
      if (!text) return;
      input.value = '';
      bubble('user', text);
      history.push({ role: 'user', content: text });

      if (useLLM && llmReady) {
        var out = bubble('bot', '…');
        var acc = '';
        LLM.ask(history, function (piece, full) { acc = full; setBubbleText(out, full); })
          .then(function (full) { history.push({ role: 'assistant', content: full || acc }); })
          .catch(function () { setBubbleText(out, '（AIの応答に失敗しました。内蔵の先生に切り替えます）'); useLLM = false; sw.classList.remove('on'); });
      } else {
        var r = Tutor.reply(text);
        bubble('bot', r.text);
        history.push({ role: 'assistant', content: r.text });
      }
    }

    // 本格AI 切替
    if (supported) {
      sw.addEventListener('click', function () {
        if (useLLM) { useLLM = false; sw.classList.remove('on'); bubble('bot', '内蔵の「％の先生」に戻したよ。'); return; }
        sw.classList.add('on'); useLLM = true;
        if (llmReady) { bubble('bot', '本格AI（TinySwallow）で答えるよ！'); return; }
        var prog = bubble('bot', '🤖 モデルを準備中… 0%（初回はDLに数分かかります）');
        LLM.load(function (p) {
          var pctv = p && typeof p.progress === 'number' ? Math.round(p.progress * 100) : null;
          setBubbleText(prog, '🤖 モデルを準備中… ' + (pctv != null ? pctv + '%' : '') + '\n' + (p && p.text ? p.text : ''));
        }).then(function () {
          llmReady = true; setBubbleText(prog, '✅ 準備OK！本格AI（Sakana TinySwallow）で答えるよ。何でも聞いてね。');
        }).catch(function (err) {
          useLLM = false; sw.classList.remove('on');
          setBubbleText(prog, '⚠️ 本格AIを起動できませんでした（' + (err && err.message ? err.message : 'エラー') + '）。内蔵の先生が答えます。');
        });
      });
    }

    // 初期あいさつ
    bubble('bot', Tutor.greeting());
    return host;
  }

  /* ============================ オンボーディング ============================ */
  function maybeOnboard() {
    if (window.localStorage.getItem(ONBOARD_KEY)) return;
    var steps = [
      { icon: '💯', t: '％を得意になろう', d: '割引・○％増し・「何％？」まで、電卓なしでスッと解けるように練習します。' },
      { icon: '📖', t: 'わからなければレクチャー', d: '「％の使い方」で、小学生にもわかるように基礎から説明。まず読むのもおすすめ。' },
      { icon: '💬', t: '先生にチャットで質問', d: '「80の15%は？」のように聞くと、手順つきで答えてくれる先生ボットを内蔵。' },
      { icon: '🔥', t: 'XP・レベルで継続', d: '正解・速解・コンボでXPゲット。間違いは自動で復習に貯まります。' }
    ];
    var i = 0;
    function render() {
      var s = steps[i];
      mount(el('div.screen.center', { style: 'justify-content:center' }, [
        el('div', { style: 'font-size:64px' }, s.icon),
        el('div.h1.mt4', null, s.t),
        el('div.muted.mt3', { style: 'max-width:300px;margin-left:auto;margin-right:auto' }, s.d),
        el('div.row.gap2.mt6', { style: 'justify-content:center' },
          steps.map(function (_, k) { return el('div', { style: 'width:8px;height:8px;border-radius:50%;background:' + (k === i ? 'var(--primary)' : '#CBD5E1') }); })),
        el('div.btn-stack', { style: 'width:100%;max-width:320px;margin:32px auto 0' }, [
          el('button.btn.primary.lg', { onClick: function () { i++; if (i < steps.length) render(); else finish(); } }, i < steps.length - 1 ? '次へ' : 'はじめる！'),
          i < steps.length - 1 ? el('button.btn.ghost', { onClick: finish }, 'スキップ') : null
        ])
      ]));
    }
    function finish() { window.localStorage.setItem(ONBOARD_KEY, '1'); goHome(); }
    render();
    return true;
  }

  /* ============================ ルーター ============================ */
  var currentNode = null;
  function navigate(builder) {
    if (currentNode && currentNode._cleanup) currentNode._cleanup();
    currentNode = builder();
    mount(currentNode);
  }
  function goHome() { navigate(homeScreen); }

  function svgNS(tag, attrs, children) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  }

  /* ============================ 起動 ============================ */
  function boot() {
    KeisanStore.init();
    // スプラッシュ
    var splash = el('div', { id: 'splash' }, [
      svgImg(),
      el('div.name', null, 'めざせ、計算マスター！'),
      el('div.tag', null, '隙間時間で計算マスターに')
    ]);
    document.body.appendChild(splash);

    setTimeout(function () {
      if (!maybeOnboard()) goHome();
      splash.classList.add('hide');
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 450);
    }, 650);
  }
  function svgImg() {
    var img = document.createElement('img');
    img.src = './icons/favicon.svg'; img.alt = ''; img.className = 'logo';
    img.width = 96; img.height = 96;
    return img;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { goHome: goHome };
})(window);
