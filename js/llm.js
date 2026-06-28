/* llm.js — 任意機能：Sakana AI「TinySwallow-1.5B」をブラウザ内で動かす本格ローカルLLM。
   WebLLM(@mlc-ai/web-llm) を遅延ロードして利用。WebGPU 対応端末（PC / 一部Android Chrome）向け。
   ※ iPhone Safari は WebGPU/メモリ制約で非対応 → UI 側で内蔵「％の先生」にフォールバックする。
   モデル設定は Sakana 公式 TinySwallow-ChatUI に準拠。 */
(function (global) {
  'use strict';

  var WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.48';
  var engine = null;
  var status = 'idle'; // idle | loading | ready | error | unsupported

  var SYSTEM_PROMPT =
    'あなたは小学生にもわかるように教える、やさしい「％（パーセント）計算の先生」です。' +
    '日本語で、短く、ていねいに答えます。計算を求められたら、必ず途中の式を一行ずつ示し、' +
    '最後に「👉 答えは ◯◯」と書きます。％は「100ぶんのいくつ」という考え方を大切にし、' +
    '難しい言葉は使いません。算数以外の話題は、やさしく算数に戻してあげてください。';

  function isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }
  function getStatus() { return status; }

  // モデルをロード（初回はモデル重み〜1GBをダウンロード、以降はブラウザにキャッシュ）
  function load(onProgress) {
    if (status === 'ready') return Promise.resolve();
    if (!isSupported()) { status = 'unsupported'; return Promise.reject(new Error('WebGPU 非対応の端末です')); }
    status = 'loading';
    return import(/* webpackIgnore: true */ WEBLLM_URL).then(function (webllm) {
      var appConfig = {
        model_list: [{
          model: 'https://huggingface.co/SakanaAI/TinySwallow-1.5B-Instruct-q4f32_1-MLC',
          model_id: 'TinySwallow-1.5B',
          model_lib: webllm.modelLibURLPrefix + webllm.modelVersion +
            '/Qwen2-1.5B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm'
        }]
      };
      return webllm.CreateMLCEngine('TinySwallow-1.5B', {
        appConfig: appConfig,
        initProgressCallback: function (p) { if (onProgress) onProgress(p); }
      });
    }).then(function (e) {
      engine = e; status = 'ready';
    }).catch(function (err) {
      status = 'error';
      throw err;
    });
  }

  // 履歴(messages: [{role, content}]) を渡して応答をストリーミング。onToken(text) は逐次断片。
  function ask(history, onToken) {
    if (status !== 'ready' || !engine) return Promise.reject(new Error('モデル未ロード'));
    var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(history);
    return engine.chat.completions.create({
      messages: messages, temperature: 0.6, max_tokens: 512, stream: true
    }).then(function (stream) {
      var full = '';
      return (function pump(iter) {
        return iter.next().then(function (res) {
          if (res.done) return full;
          var delta = res.value && res.value.choices && res.value.choices[0] && res.value.choices[0].delta;
          var piece = delta && delta.content ? delta.content : '';
          if (piece) { full += piece; if (onToken) onToken(piece, full); }
          return pump(iter);
        });
      })(stream[Symbol.asyncIterator]());
    });
  }

  function unload() {
    if (engine && engine.unload) { try { engine.unload(); } catch (e) {} }
    engine = null; status = 'idle';
  }

  global.LLM = {
    isSupported: isSupported,
    getStatus: getStatus,
    load: load,
    ask: ask,
    unload: unload,
    MODEL_NAME: 'TinySwallow-1.5B（Sakana AI）'
  };
})(window);
