// All code comments must be English per user requirement

export function renderBossView({ bossHp, card, onSkip }) {
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

export function renderDoorView({ cards, unlocked, selectedIndex = 0, onSelect }) {
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


