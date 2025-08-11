// All code comments must be English per user requirement

import { renderBossView, renderDoorView } from './views.js';

export class Game {
  constructor({ root, vocab, fuzzyMatch, equals, onUiUpdate, toast }) {
    this.root = root;
    this.vocab = vocab;
    this.equals = equals;
    this.fuzzyMatch = fuzzyMatch;
    this.onUiUpdate = onUiUpdate;
    this.toast = toast;

    this.levels = [];
    this.state = {
      levelIndex: 0,
      levelCount: 0,
      score: 0,
      bossHp: null,
      doorLocks: null,
    };
  }

  registerLevel(levelFactory) {
    this.levels.push(levelFactory);
    this.state.levelCount = this.levels.length;
  }

  start() {
    this.state.levelIndex = 0;
    this.state.score = 0;
    this._runLevel();
  }

  submitAnswer(raw) {
    const text = String(raw || '').trim().toLowerCase();
    if (!this.currentLevel) return;
    this.currentLevel.onAnswer(text);
  }

  _runLevel() {
    const levelFactory = this.levels[this.state.levelIndex];
    if (!levelFactory) {
      this.root.innerHTML = '<div class="card"><h2>All levels completed!</h2><p>Great job!</p></div>';
      this.onUiUpdate(this.state);
      return;
    }

    const context = {
      vocab: this.vocab,
      equals: this.equals,
      fuzzyEnabled: this.fuzzyMatch,
      updateUi: (patch) => {
        Object.assign(this.state, patch);
        this.onUiUpdate(this.state);
      },
      addScore: (points) => {
        this.state.score += points;
        this.onUiUpdate(this.state);
      },
      toast: this.toast,
      render: (node) => {
        this.root.replaceChildren(node);
      },
      next: () => {
        this.state.levelIndex += 1;
        this._runLevel();
      },
    };

    this.currentLevel = levelFactory(context);
    this.currentLevel.start();
  }
}

export function createBossLevel() {
  return (ctx) => {
    const bossHpMax = 5;
    let bossHp = bossHpMax;
    // Pick random vocab each turn
    let currentCard = randomCard(ctx.vocab);

    function reroll() {
      currentCard = randomCard(ctx.vocab);
      render();
    }

    function render() {
      ctx.updateUi({ bossHp, doorLocks: null });
      const node = renderBossView({
        bossHp,
        card: currentCard,
        onSkip: reroll,
      });
      ctx.render(node);
    }

    return {
      start() {
        render();
      },
      onAnswer(text) {
        if (ctx.equals(text, currentCard.word)) {
          const damage = Math.max(1, currentCard.level);
          bossHp = Math.max(0, bossHp - damage);
          ctx.addScore(10 * damage);
          ctx.toast.show(`Correct! Damage ${damage}.`);
          if (bossHp <= 0) {
            ctx.toast.show('Boss defeated!');
            setTimeout(() => ctx.next(), 600);
          } else {
            reroll();
          }
        } else {
          ctx.toast.show('Try again.');
        }
      },
    };
  };
}

export function createDoorLevel() {
  return (ctx) => {
    const required = 3;
    let unlocked = 0;
    const picked = pickUnique(ctx.vocab, required);

    function render() {
      ctx.updateUi({ bossHp: null, doorLocks: required - unlocked });
      const node = renderDoorView({
        cards: picked,
        unlocked,
        selectedIndex: state.selected,
        onSelect: (index) => {
          state.selected = index;
          render();
        },
      });
      ctx.render(node);
    }

    const state = { selected: 0 };

    return {
      start() {
        render();
      },
      onAnswer(text) {
        const card = picked[state.selected];
        if (!card) return;
        if (ctx.equals(text, card.word)) {
          if (!card.__done) {
            card.__done = true;
            unlocked += 1;
            ctx.addScore(15 * Math.max(1, card.level));
            ctx.toast.show('Unlocked a lock!');
          }
          if (unlocked >= required) {
            ctx.toast.show('Door opened!');
            setTimeout(() => ctx.next(), 600);
          } else {
            render();
          }
        } else {
          ctx.toast.show('Not this one.');
        }
      },
    };
  };
}

function randomCard(vocab) {
  return vocab[Math.floor(Math.random() * vocab.length)];
}

function pickUnique(vocab, count) {
  const pool = [...vocab];
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}


