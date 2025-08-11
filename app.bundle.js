// EchoQuest single-file bundle to work on file:// and GitHub Pages
// All code comments are English only as required

(function () {
  const dom = {
    root: document.getElementById('game-root'),
    loader: document.getElementById('loader'),
    message: document.getElementById('message'),
    btnStart: document.getElementById('btn-start'),
    btnListen: document.getElementById('btn-listen'),
    btnSubmit: document.getElementById('btn-submit'),
    input: document.getElementById('text-input'),
    toggleSilent: document.getElementById('toggle-silent'),
    toggleFuzzy: document.getElementById('toggle-fuzzy'),
    selectVoice: document.getElementById('select-voice'),
    lastHeard: document.getElementById('last-heard'),
    status: {
      level: document.getElementById('status-level'),
      bossHp: document.getElementById('status-boss-hp'),
      door: document.getElementById('status-door'),
      score: document.getElementById('status-score'),
    },
  };

  function normalizeTypedWord(raw) {
    if (!raw) return '';
    return String(raw).toLowerCase().replace(/\s+/g, '');
  }

  function fuzzyEquals(a, b) {
    if (a === b) return true;
    const min = Math.min(a.length, b.length);
    let same = 0;
    for (let i = 0; i < min; i++) if (a[i] === b[i]) same++;
    const ratio = same / Math.max(1, Math.max(a.length, b.length));
    return ratio >= 0.7;
  }

  function createToast() {
    let node = null;
    function ensure() {
      if (!node) {
        node = document.createElement('div');
        node.className = 'toast';
        document.body.appendChild(node);
      }
      return node;
    }
    let timer = null;
    return {
      show(message, ms = 1500) {
        const el = ensure();
        el.textContent = message;
        el.style.display = 'block';
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          el.style.display = 'none';
        }, ms);
      },
    };
  }

  function renderBossView({ bossHp, card, onSkip }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card vocab-panel';
    const title = document.createElement('h2');
    title.textContent = 'Boss Fight';
    const bossBar = document.createElement('div');
    bossBar.className = 'boss-bar';
    for (let i = 0; i < 5; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart' + (i < bossHp ? ' alive' : '');
      bossBar.appendChild(heart);
    }
    const img = document.createElement('img');
    img.className = 'vocab-image';
    img.src = card.image;
    img.alt = card.word;
    const hint = document.createElement('div');
    hint.className = 'vocab-word';
    hint.textContent = 'Say the word';
    const hud = document.createElement('div');
    hud.className = 'hud';
    const skip = document.createElement('button');
    skip.textContent = 'Skip';
    skip.addEventListener('click', onSkip);
    hud.appendChild(skip);
    wrapper.append(title, bossBar, img, hint, hud);
    return wrapper;
  }

  function renderDoorView({ cards, unlocked, selectedIndex = 0, onSelect }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card vocab-panel';
    const title = document.createElement('h2');
    title.textContent = 'Locked Door';
    const locks = document.createElement('div');
    locks.className = 'door-locks';
    for (let i = 0; i < 3; i++) {
      const lock = document.createElement('div');
      lock.className = 'lock' + (i < unlocked ? ' open' : '');
      locks.appendChild(lock);
    }
    const grid = document.createElement('div');
    grid.className = 'tools-grid';
    cards.forEach((card, idx) => {
      const tool = document.createElement('div');
      tool.className = 'tool-card' + (idx === selectedIndex ? ' selected' : '');
      tool.tabIndex = 0;
      const img = document.createElement('img');
      img.className = 'vocab-image';
      img.src = card.image;
      img.alt = card.word;
      const cap = document.createElement('div');
      cap.className = 'vocab-word';
      cap.textContent = 'Say the word for this tool';
      tool.append(img, cap);
      tool.addEventListener('click', () => onSelect(idx));
      grid.appendChild(tool);
    });
    wrapper.append(title, locks, grid);
    return wrapper;
  }

  class SpeechController {
    constructor({ onResult, getLocale }) {
      this.onResult = onResult;
      this.getLocale = getLocale;
      this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    }
    isSupported() {
      const hasApi = !!this.Recognition;
      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      return hasApi && isSecure;
    }
    listenOnce() {
      return new Promise((resolve, reject) => {
        if (!this.isSupported()) return reject(new Error('Web Speech API not supported'));
        const recognition = new this.Recognition();
        recognition.lang = this.getLocale?.() || 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        let resolved = false;
        recognition.onresult = (event) => {
          const text = String(event.results[0][0].transcript || '').trim().toLowerCase();
          this.onResult?.(text);
          if (!resolved) { resolved = true; resolve(text); }
        };
        recognition.onerror = (e) => { if (!resolved) { resolved = true; reject(new Error(e.error || 'speech error')); } };
        recognition.onend = () => { if (!resolved) { resolved = true; reject(new Error('no speech')); } };
        try { recognition.start(); } catch (e) { reject(e); }
      });
    }
  }

  class Game {
    constructor({ root, vocab, fuzzyMatch, equals, onUiUpdate, toast }) {
      this.root = root;
      this.vocab = vocab;
      this.equals = equals;
      this.fuzzyMatch = fuzzyMatch;
      this.onUiUpdate = onUiUpdate;
      this.toast = toast;
      this.levels = [];
      this.state = { levelIndex: 0, levelCount: 0, score: 0, bossHp: null, doorLocks: null };
    }
    registerLevel(levelFactory) { this.levels.push(levelFactory); this.state.levelCount = this.levels.length; }
    start() { this.state.levelIndex = 0; this.state.score = 0; this._runLevel(); }
    submitAnswer(raw) { const text = String(raw || '').trim().toLowerCase(); if (!this.currentLevel) return; this.currentLevel.onAnswer(text); }
    _runLevel() {
      const levelFactory = this.levels[this.state.levelIndex];
      if (!levelFactory) { this.root.innerHTML = '<div class="card"><h2>All levels completed!</h2><p>Great job!</p></div>'; this.onUiUpdate(this.state); return; }
      const ctx = {
        vocab: this.vocab,
        equals: this.equals,
        fuzzyEnabled: this.fuzzyMatch,
        updateUi: (patch) => { Object.assign(this.state, patch); this.onUiUpdate(this.state); },
        addScore: (points) => { this.state.score += points; this.onUiUpdate(this.state); },
        toast: this.toast,
        render: (node) => { this.root.replaceChildren(node); },
        next: () => { this.state.levelIndex += 1; this._runLevel(); },
      };
      this.currentLevel = levelFactory(ctx); this.currentLevel.start();
    }
  }

  function createBossLevel() {
    return (ctx) => {
      const bossHpMax = 5; let bossHp = bossHpMax; let currentCard = randomCard(ctx.vocab);
      function reroll() { currentCard = randomCard(ctx.vocab); render(); }
      function render() {
        ctx.updateUi({ bossHp, doorLocks: null });
        const node = renderBossView({ bossHp, card: currentCard, onSkip: reroll });
        ctx.render(node);
      }
      return {
        start() { render(); },
        onAnswer(text) {
          if (ctx.equals(text, currentCard.word)) {
            const damage = Math.max(1, currentCard.level); bossHp = Math.max(0, bossHp - damage);
            ctx.addScore(10 * damage); ctx.toast.show(`Correct! Damage ${damage}.`);
            if (bossHp <= 0) { ctx.toast.show('Boss defeated!'); setTimeout(() => ctx.next(), 600); } else { reroll(); }
          } else { ctx.toast.show('Try again.'); }
        },
      };
    };
  }

  function createDoorLevel() {
    return (ctx) => {
      const required = 3; let unlocked = 0; const picked = pickUnique(ctx.vocab, required); const state = { selected: 0 };
      function render() {
        ctx.updateUi({ bossHp: null, doorLocks: required - unlocked });
        const node = renderDoorView({ cards: picked, unlocked, selectedIndex: state.selected, onSelect: (i) => { state.selected = i; render(); } });
        ctx.render(node);
      }
      return {
        start() { render(); },
        onAnswer(text) {
          const card = picked[state.selected]; if (!card) return;
          if (ctx.equals(text, card.word)) {
            if (!card.__done) { card.__done = true; unlocked += 1; ctx.addScore(15 * Math.max(1, card.level)); ctx.toast.show('Unlocked a lock!'); }
            if (unlocked >= required) { ctx.toast.show('Door opened!'); setTimeout(() => ctx.next(), 600); } else { render(); }
          } else { ctx.toast.show('Not this one.'); }
        },
      };
    };
  }

  function randomCard(vocab) { return vocab[Math.floor(Math.random() * vocab.length)]; }
  function pickUnique(vocab, count) { const pool = [...vocab]; const out = []; while (out.length < count && pool.length) { const i = Math.floor(Math.random() * pool.length); out.push(pool.splice(i, 1)[0]); } return out; }

  function readInlineVocab() {
    try {
      const el = document.getElementById('vocab-inline'); if (!el) return null; const text = el.textContent?.trim(); if (!text) return null; const data = JSON.parse(text); return normalizeVocab(data);
    } catch { return null; }
  }
  function normalizeVocab(items) {
    return items.map((x) => ({ id: x.id || x.word, word: String(x.word || '').toLowerCase(), image: x.image, level: Number(x.level || 1) })).filter((x) => x.word && x.image && Number.isFinite(x.level));
  }
  function demoVocab() {
    return normalizeVocab([
      { id: '001-basic/apple', word: 'apple', image: 'pics/001-basic/apple.svg', level: 1 },
      { id: '001-basic/cat', word: 'cat', image: 'pics/001-basic/cat.svg', level: 1 },
      { id: '002-animals/elephant', word: 'elephant', image: 'pics/002-animals/elephant.svg', level: 2 },
      { id: '003-objects/umbrella', word: 'umbrella', image: 'pics/003-objects/umbrella.svg', level: 3 },
    ]);
  }

  function preloadImages(items) {
    const tasks = items.map((it) => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = it.image; }));
    return Promise.all(tasks);
  }

  async function bootstrap() {
    try {
      const isFile = location.protocol === 'file:';
      const inline = readInlineVocab();
      let vocab = inline && inline.length ? inline : (isFile ? demoVocab() : demoVocab());
      await Promise.race([preloadImages(vocab), new Promise((r) => setTimeout(r, 1200))]);

      const speech = new SpeechController({ onResult: (t) => { dom.lastHeard.textContent = `Heard: ${t}`; }, getLocale: () => dom.selectVoice.value });
      const game = new Game({
        root: dom.root,
        vocab,
        fuzzyMatch: () => dom.toggleFuzzy.checked,
        equals: (a, b) => (dom.toggleFuzzy.checked ? fuzzyEquals(a, b) : a === b),
        onUiUpdate: (state) => {
          dom.status.level.textContent = `${state.levelIndex + 1}/${state.levelCount}`;
          dom.status.score.textContent = `${state.score}`;
          dom.status.bossHp.textContent = state.bossHp != null ? `${state.bossHp}` : '-';
          dom.status.door.textContent = state.doorLocks != null ? `${state.doorLocks}` : '-';
        },
        toast: createToast(),
      });

      game.registerLevel(createBossLevel());
      game.registerLevel(createDoorLevel());

      dom.btnStart.addEventListener('click', () => game.start());
      dom.btnListen.addEventListener('click', async () => {
        if (dom.toggleSilent.checked) { game.toast.show('Silent mode is on. Use text input.'); return; }
        if (!speech.isSupported()) { game.toast.show('Speech Recognition is not supported in this browser.'); return; }
        try { const heard = await speech.listenOnce(); dom.lastHeard.textContent = `Heard: ${heard}`; game.submitAnswer(heard); } catch (err) { game.toast.show(`Speech error: ${err?.message || err}`); }
      });
      dom.btnSubmit.addEventListener('click', () => { const text = normalizeTypedWord(dom.input.value); if (!text) return; game.submitAnswer(text); dom.input.value = ''; });
      dom.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') dom.btnSubmit.click(); });

      dom.loader.classList.add('fade-out'); setTimeout(() => { dom.loader.style.display = 'none'; dom.message.textContent = 'Press Start to play'; }, 200);
      window.__EchoQuestBootOk = true;
    } catch (e) {
      console.error(e);
      dom.loader.textContent = 'Failed to load. See console.';
    }
  }

  bootstrap();
})();


