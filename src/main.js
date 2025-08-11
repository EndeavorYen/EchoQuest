// All code comments must be English per user requirement

import { loadVocabulary } from './vocabLoader.js';
import { Game } from './systems/game.js';
import { SpeechController } from './systems/speech.js';
import { createBossLevel, createDoorLevel } from './systems/levels.js';
import { createToast } from './ui/toast.js';

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
  // Support typed spelling with spaces: "a p p l e" -> "apple"
  return raw.toLowerCase().replace(/\s+/g, '');
}

function fuzzyEquals(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  let same = 0;
  for (let i = 0; i < min; i++) if (a[i] === b[i]) same++;
  const ratio = same / Math.max(1, Math.max(a.length, b.length));
  return ratio >= 0.7;
}

function preloadImages(items) {
  const tasks = items.map((it) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = it.image;
  }));
  return Promise.all(tasks);
}

async function bootstrap() {
  try {
    // Load vocab with timeout and then preload images to avoid blank renders
    const vocab = await loadVocabulary({ timeoutMs: 3000 });
    await Promise.race([
      preloadImages(vocab),
      new Promise((resolve) => setTimeout(resolve, 1500)), // soft timeout to avoid long waits
    ]);

    const speech = new SpeechController({
      onResult: (text) => {
        dom.lastHeard.textContent = `Heard: ${text}`;
      },
      getLocale: () => dom.selectVoice.value,
    });

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

    // Register demo levels
    game.registerLevel(createBossLevel());
    game.registerLevel(createDoorLevel());

    dom.btnStart.addEventListener('click', () => game.start());

    dom.btnListen.addEventListener('click', async () => {
      if (dom.toggleSilent.checked) {
        game.toast.show('Silent mode is on. Use text input.');
        return;
      }
      if (!speech.isSupported()) {
        game.toast.show('Speech Recognition is not supported in this browser.');
        return;
      }
      try {
        const heard = await speech.listenOnce();
        dom.lastHeard.textContent = `Heard: ${heard}`;
        game.submitAnswer(heard);
      } catch (err) {
        game.toast.show(`Speech error: ${err?.message || err}`);
      }
    });

    dom.btnSubmit.addEventListener('click', () => {
      const text = normalizeTypedWord(dom.input.value);
      if (!text) return;
      game.submitAnswer(text);
      dom.input.value = '';
    });

    dom.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.btnSubmit.click();
    });

    dom.loader.classList.add('fade-out');
    setTimeout(() => {
      dom.loader.style.display = 'none';
      dom.message.textContent = 'Press Start to play';
    }, 200);
  } catch (e) {
    console.error(e);
    dom.loader.textContent = 'Failed to load. See console.';
  }
}

bootstrap();


