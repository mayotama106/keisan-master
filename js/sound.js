/* sound.js — WebAudio による軽量な効果音（外部ファイル不要・オフライン対応）
   設計書 §1.3 設定: サウンド ON/OFF。 */
(function (global) {
  'use strict';

  var ctx = null;
  function ac() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 単音を鳴らす
  function tone(freq, start, dur, type, gainVal) {
    var c = ac();
    if (!c) return;
    var t0 = c.currentTime + start;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  var enabled = true;
  function setEnabled(v) { enabled = !!v; }

  var Sound = {
    setEnabled: setEnabled,
    // ユーザー操作で一度呼び出してオーディオを有効化（モバイルのautoplay制約対策）
    unlock: function () { ac(); },
    correct: function () { if (!enabled) return; tone(660, 0, 0.12, 'sine'); tone(990, 0.08, 0.16, 'sine'); },
    wrong: function () { if (!enabled) return; tone(220, 0, 0.22, 'sawtooth', 0.14); },
    tap: function () { if (!enabled) return; tone(520, 0, 0.05, 'square', 0.06); },
    levelup: function () {
      if (!enabled) return;
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.1, 0.2, 'triangle', 0.16); });
    },
    finish: function () { if (!enabled) return; [392, 523, 659].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'sine'); }); }
  };

  global.Sound = Sound;
})(window);
