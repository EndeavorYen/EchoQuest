import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Settings, Volume2 } from 'lucide-react';
import { LanguageSelector } from './components/LanguageSelector';
import { VocabManager } from './components/VocabManager';
import { defaultLevels, type Level } from './data/levels';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { getAvailableWords, isAnswerCorrect } from './game/gameLogic';
import { learnerProfileOptions, type LearnerProfile } from './game/challenges';
import {
  advanceEvent,
  castSpell,
  completeChallenge,
  createAdventure,
  getBossTurn,
  getCurrentEvent,
  getCurrentWordId,
  getMissionWordIds,
  recordMissionProfile,
  repairAdventureWords,
  type AdventureState,
  type MissionEvent,
  type Spell,
} from './game/adventure';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import {
  recordPracticeAttempt,
  type LearningProgressState,
  type PracticeMode,
} from './learning/progress';
import {
  loadAdventureFromStorage,
  saveAdventureToStorage,
} from './persistence/adventureStorage';
import { loadProgressFromStorage, saveProgressToStorage } from './persistence/progressStorage';
import {
  hydrateDefaultVocabArtwork,
  loadLangFromStorage,
  loadProfileFromStorage,
  loadVocabFromStorage,
  saveLangToStorage,
  saveProfileToStorage,
  saveVocabToStorage,
} from './persistence/vocabStorage';
import type { VocabItem } from './types/vocab';

type AppScreen = 'play' | 'vocab_management';
type MessageKind = 'neutral' | 'correct' | 'wrong' | 'voice';
type Tile = { id: string; letter: string; used: boolean };
type VoiceReviewResult = { heardText: string; targetWord: string; isMatch: boolean };

interface AppProps {
  initialVocab?: VocabItem[];
  initialLevels?: Level[];
}

const profileHints: Record<LearnerProfile, { mode: string; goal: string }> = {
  toddler: { mode: '2y 圖像接力', goal: '找到和目標一樣的圖。答錯可以再試一次。' },
  kid: { mode: '5y 字母接力', goal: '依序點字母，讓魔法路徑一格一格亮起來。' },
  adult: { mode: '成人/家長接力', goal: '輸入目標單字；也可以用語音加速。' },
};

const eventViews: Record<NonNullable<MissionEvent['kind']>, { title: string; cue: string; scene: string }> = {
  scout: { title: '偵察找路', cue: '點亮藏在林間的路標', scene: '/assets/generated/scene-bramble-grove.png' },
  build: { title: '魔法建造', cue: '把斷橋變成發光的通道', scene: '/assets/generated/scene-moon-bridge.png' },
  escort: { title: '護送前進', cue: '沿著發光石安全越過河流', scene: '/assets/generated/scene-river-escort.png' },
  evade: { title: '避險反制', cue: '避開倒木，沿安全路線前進', scene: '/assets/generated/scene-river-escort.png' },
  boss: { title: '荊棘救援', cue: '讀懂危機，再選出正確魔法', scene: '/assets/generated/scene-thorn-altar.png' },
};

const spellViews: Array<{ spell: Spell; name: string; detail: string }> = [
  { spell: 'fire', name: '火焰術', detail: '燒開荊棘' },
  { spell: 'shield', name: '守護盾', detail: '擋住樹枝' },
  { spell: 'heal', name: '治癒光', detail: '解除詛咒' },
];

function getWordImage(word: VocabItem | null): string | undefined {
  return word?.imageDataUrl ?? word?.imageSrc;
}

function getEnabledVocab(items: VocabItem[]): VocabItem[] {
  return items.filter((item) => item.enabled);
}

function scoreText(seed: string): number {
  return [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function createLetterTiles(word: string): Tile[] {
  return [...word]
    .map((letter, index) => ({ id: `${letter}-${index}`, letter, used: false }))
    .sort((left, right) => scoreText(`${word}:${left.id}`) - scoreText(`${word}:${right.id}`));
}

function createPictureChoices(currentWord: VocabItem | null, words: VocabItem[], count: number): VocabItem[] {
  if (!currentWord) return [];
  const distractors = words
    .filter((word) => word.id !== currentWord.id)
    .sort((left, right) => scoreText(`${currentWord.word}:${left.id}`) - scoreText(`${currentWord.word}:${right.id}`))
    .slice(0, Math.max(0, count - 1));
  return [currentWord, ...distractors]
    .sort((left, right) => scoreText(`${currentWord.id}:${left.word}`) - scoreText(`${currentWord.id}:${right.word}`));
}

function getInitialVocab(initialVocab?: VocabItem[]): VocabItem[] {
  if (initialVocab) return hydrateDefaultVocabArtwork(initialVocab);
  const stored = loadVocabFromStorage();
  return stored.length > 0 ? stored : defaultInitialVocab;
}

function skipPersistedCelebration(state: AdventureState): AdventureState {
  let next = state;
  let event = getCurrentEvent(next);
  while (event && event.kind !== 'boss' && next.completedEventIds.includes(event.id)) {
    const advanced = advanceEvent(next);
    if (advanced === next) break;
    next = advanced;
    event = getCurrentEvent(next);
  }
  return next;
}

function createMission(vocab: VocabItem[], progress: LearningProgressState, recentWordIds: string[] = []): AdventureState | null {
  if (vocab.length === 0) return null;
  return createAdventure({
    seed: Math.floor(Math.random() * 2 ** 31),
    vocab,
    progress,
    now: Date.now(),
    recentWordIds,
  });
}

export default function App({ initialVocab, initialLevels = defaultLevels }: AppProps) {
  const [screen, setScreen] = useState<AppScreen>('play');
  const [vocab, setVocab] = useState<VocabItem[]>(() => getInitialVocab(initialVocab));
  const [levels] = useState<Level[]>(initialLevels);
  const [profile, setProfile] = useState<LearnerProfile>(() => (
    localStorage.getItem('echoquest_profile_v1') ? loadProfileFromStorage() : 'toddler'
  ));
  const [recognitionLang, setRecognitionLang] = useState(() => loadLangFromStorage());
  const [progress, setProgress] = useState<LearningProgressState>(() => loadProgressFromStorage());
  const enabledVocab = useMemo(() => getEnabledVocab(vocab), [vocab]);
  const [storedMission] = useState(() => loadAdventureFromStorage());
  const [adventure, setAdventure] = useState<AdventureState | null>(() => {
    if (!storedMission) return createMission(enabledVocab, progress);
    if (enabledVocab.length === 0) return skipPersistedCelebration(storedMission);
    try {
      return skipPersistedCelebration(repairAdventureWords(storedMission, enabledVocab, progress, Date.now()));
    } catch {
      return createMission(enabledVocab, progress);
    }
  });
  const [showResumePrompt, setShowResumePrompt] = useState(Boolean(storedMission && !storedMission.rescued));
  const [celebratingEventId, setCelebratingEventId] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [letterTiles, setLetterTiles] = useState<Tile[]>([]);
  const [selectedLetters, setSelectedLetters] = useState('');
  const [voiceReview, setVoiceReview] = useState<VoiceReviewResult | null>(null);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string }>({
    kind: 'neutral',
    text: '一家人可以隨時接手，同一場救援會繼續前進。',
  });
  const celebrationTimer = useRef<number | null>(null);

  const currentEvent = adventure ? getCurrentEvent(adventure) : undefined;
  const currentWordId = adventure ? getCurrentWordId(adventure) : undefined;
  const currentWord = enabledVocab.find((word) => word.id === currentWordId) ?? null;
  const level = levels[0] ?? defaultLevels[0];
  const availableWords = useMemo(
    () => getAvailableWords(enabledVocab, level, []),
    [enabledVocab, level],
  );
  const toddlerChoiceCount = currentWord && (progress[currentWord.id]?.mastery ?? 0) >= 2 ? 3 : 2;
  const pictureChoices = useMemo(
    () => createPictureChoices(currentWord, availableWords, toddlerChoiceCount),
    [availableWords, currentWord, toddlerChoiceCount],
  );
  const eventView = currentEvent ? eventViews[currentEvent.kind] : null;
  const bossTurn = adventure && currentEvent?.kind === 'boss' && !adventure.rescued ? getBossTurn(adventure) : null;
  const canUseVoice = profile !== 'toddler';
  const submitLabel = currentEvent?.kind === 'boss' ? '魔法充能' : '施放路徑魔法';

  const resetTransientInputs = useCallback((word: VocabItem | null = currentWord) => {
    setTypedAnswer('');
    setSelectedLetters('');
    setLetterTiles(word ? createLetterTiles(word.word.toLowerCase()) : []);
    setVoiceReview(null);
  }, [currentWord]);

  const speech = useSpeechRecognition({
    onResult: (result) => {
      if (!currentWord || !canUseVoice) return;
      const heardText = result.trim();
      if (!heardText) return;
      setVoiceReview({
        heardText,
        targetWord: currentWord.word,
        isMatch: isAnswerCorrect(heardText, currentWord),
      });
      setMessage({ kind: 'voice', text: `聽到「${heardText}」，確認後送出。` });
    },
  });

  useEffect(() => {
    if (initialVocab) setVocab(hydrateDefaultVocabArtwork(initialVocab));
  }, [initialVocab]);

  useEffect(() => {
    if (!initialVocab) saveVocabToStorage(vocab);
  }, [initialVocab, vocab]);

  useEffect(() => { saveProgressToStorage(progress); }, [progress]);
  useEffect(() => { saveProfileToStorage(profile); }, [profile]);
  useEffect(() => { saveLangToStorage(recognitionLang); }, [recognitionLang]);
  useEffect(() => {
    if (adventure) saveAdventureToStorage(adventure);
  }, [adventure]);

  useEffect(() => {
    if (enabledVocab.length === 0) return;
    setAdventure((state) => {
      if (!state) return createMission(enabledVocab, progress);
      try {
        return repairAdventureWords(state, enabledVocab, progress, Date.now());
      } catch {
        return createMission(enabledVocab, progress, getMissionWordIds(state));
      }
    });
  }, [enabledVocab, progress]);

  useEffect(() => {
    speech.stop();
    speech.resetTranscript();
    speech.clearError();
    resetTransientInputs(currentWord);
  }, [adventure?.eventIndex, adventure?.bossTurn, currentWordId]);

  useEffect(() => {
    if (!speech.error) return;
    setMessage({ kind: 'voice', text: `語音暫時不可用：${getSpeechErrorMessage(speech.error)} 仍可繼續拼字或打字。` });
  }, [speech.error]);

  useEffect(() => () => {
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
  }, []);

  const updateProgress = (submittedText: string, mode: PracticeMode, isCorrect: boolean) => {
    if (!currentWord) return;
    const now = Date.now();
    setProgress((state) => recordPracticeAttempt(state, currentWord, { isCorrect, mode, now }));
  };

  const submitAnswer = (submittedText: string, mode: PracticeMode) => {
    if (!adventure || !currentEvent || !currentWord || !submittedText.trim() || adventure.rescued || celebratingEventId) return;
    const isCorrect = isAnswerCorrect(submittedText, currentWord);
    updateProgress(submittedText, mode, isCorrect);

    if (!isCorrect) {
      speech.stop();
      speech.resetTranscript();
      setVoiceReview(null);
      if (profile === 'kid') resetTransientInputs(currentWord);
      if (profile === 'adult') setTypedAnswer('');
      setMessage({
        kind: 'wrong',
        text: profile === 'toddler' ? '再找一次，救援不會倒退。' : `再試一次，目標是 ${currentWord.word}。`,
      });
      return;
    }

    speech.stop();
    speech.resetTranscript();
    setVoiceReview(null);
    setAdventure((state) => state ? completeChallenge(recordMissionProfile(state, profile)) : state);

    if (currentEvent.kind === 'boss') {
      setTypedAnswer('');
      setSelectedLetters('');
      setMessage({ kind: 'correct', text: '充能完成。根據危機提示選一個魔法。' });
      return;
    }

    const completedEventId = currentEvent.id;
    setCelebratingEventId(completedEventId);
    setMessage({ kind: 'correct', text: `${currentWord.word} 成功啟動了這段路徑！` });
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    celebrationTimer.current = window.setTimeout(() => {
      setAdventure((state) => {
        const event = state ? getCurrentEvent(state) : undefined;
        return state && event?.id === completedEventId ? advanceEvent(state) : state;
      });
      setCelebratingEventId((eventId) => eventId === completedEventId ? null : eventId);
      celebrationTimer.current = null;
    }, 600);
  };

  const selectLetter = (tileId: string) => {
    if (!currentWord) return;
    const tile = letterTiles.find((item) => item.id === tileId);
    if (!tile || tile.used) return;
    const expected = currentWord.word.toLowerCase()[selectedLetters.length];
    if (tile.letter.toLowerCase() !== expected) {
      resetTransientInputs(currentWord);
      setMessage({ kind: 'wrong', text: '這顆符文順序不對，路徑已重新亮起。' });
      return;
    }
    setSelectedLetters((value) => `${value}${tile.letter}`);
    setLetterTiles((tiles) => tiles.map((item) => item.id === tileId ? { ...item, used: true } : item));
  };

  const useSpell = (spell: Spell) => {
    if (!adventure?.spellReady) return;
    const result = castSpell(recordMissionProfile(adventure, profile), spell);
    setAdventure(result.state);
    setMessage({
      kind: result.correct ? 'correct' : 'wrong',
      text: result.correct
        ? result.state.rescued ? '荊棘消散了，森林夥伴安全獲救！' : '魔法奏效，下一波危機來了。'
        : result.hint,
    });
    if (result.correct) resetTransientInputs(null);
  };

  const startListening = () => {
    setVoiceReview(null);
    speech.resetTranscript();
    speech.clearError();
    speech.start(recognitionLang);
    setMessage({ kind: 'voice', text: '請說出目標英文單字。' });
  };

  const confirmVoiceReview = () => {
    if (!voiceReview) return;
    const heardText = voiceReview.heardText;
    setVoiceReview(null);
    submitAnswer(heardText, 'voice');
  };

  const changeProfile = (nextProfile: LearnerProfile) => {
    speech.stop();
    speech.resetTranscript();
    speech.clearError();
    resetTransientInputs(currentWord);
    setProfile(nextProfile);
    setAdventure((state) => state ? recordMissionProfile(state, nextProfile) : state);
    setMessage({ kind: 'neutral', text: `${profileHints[nextProfile].mode}接手，同一個目標繼續。` });
  };

  const startNewMission = () => {
    if (celebrationTimer.current !== null) {
      window.clearTimeout(celebrationTimer.current);
      celebrationTimer.current = null;
    }
    speech.stop();
    setCelebratingEventId(null);
    const next = createMission(enabledVocab, progress, adventure ? getMissionWordIds(adventure) : []);
    if (next && adventure && next.seed === adventure.seed) next.seed = (next.seed + 1) % (2 ** 31);
    setAdventure(next);
    setShowResumePrompt(false);
    resetTransientInputs(null);
    setMessage({
      kind: next ? 'neutral' : 'wrong',
      text: next ? '新的森林求救訊號出現了。' : '先在字庫啟用一個單字，再開始救援。',
    });
  };

  if (screen === 'vocab_management') {
    return (
      <main className="eq-adventure eq-adventure--management">
        <div className="eq-adventure-vocab">
          <button type="button" className="eq-arcade-small-button" onClick={() => setScreen('play')}>回到救援</button>
          <VocabManager vocab={vocab} onVocabChange={setVocab} onGoBack={() => setScreen('play')} />
        </div>
      </main>
    );
  }

  const relayClass = `eq-relay eq-relay--${currentEvent?.kind ?? 'empty'} eq-relay--${profile}`;
  const activeVoice = speech.requestingPermission || speech.listening;
  const voiceLabel = speech.requestingPermission ? '等待麥克風權限' : speech.listening ? '聆聽中' : '說出單字';
  const nextLetter = currentWord?.word[selectedLetters.length]?.toUpperCase();
  const runeProgress = currentWord ? selectedLetters.length / Math.max(1, currentWord.word.length) : 0;

  return (
    <main className={relayClass} aria-label="EchoQuest family relay rescue">
      <header className="eq-relay-hud">
        <div className="eq-relay-mission">
          <span>森林接力救援</span>
          <strong>{adventure?.rescued ? '救援完成' : eventView?.title ?? '等待任務'}</strong>
          <span>{adventure ? `${Math.min(adventure.eventIndex + 1, 4)} / 4` : '0 / 4'}</span>
        </div>
        <div className="eq-relay-hud-actions">
          <button type="button" className="eq-icon-button" onClick={() => setScreen('vocab_management')} aria-label="開啟字庫" title="開啟字庫">
            <Settings aria-hidden="true" />
          </button>
          <nav aria-label="選擇玩家">
            {learnerProfileOptions.map((option) => (
              <button key={option.value} type="button" aria-pressed={profile === option.value} onClick={() => changeProfile(option.value)}>
                {option.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section
        className="eq-relay-world"
        data-testid="relay-world"
        data-event={currentEvent?.kind ?? 'empty'}
        data-complete={String(celebratingEventId === currentEvent?.id)}
        aria-label={eventView?.title ?? '等待救援任務'}
      >
        <img className="eq-relay-backdrop" src={eventView?.scene ?? '/assets/generated/scene-bramble-grove.png'} alt="" />
        <div
          className="eq-relay-world-change"
          aria-hidden="true"
          style={{ '--relay-progress': runeProgress } as React.CSSProperties}
        />
        <img className="eq-relay-companion" src="/assets/generated/companion-scout.png" alt="" />
        {currentEvent?.kind === 'boss' && <img className="eq-relay-boss" src="/assets/generated/boss-wizard.png" alt="" />}
        <div className="eq-relay-scene-copy">
          <h1>{adventure?.rescued ? '救援成功' : eventView?.title ?? '森林正在等待'}</h1>
          <p>{adventure?.rescued ? '全家的魔法接力完成了。' : eventView?.cue ?? '先準備一個可以練習的單字。'}</p>
          {bossTurn && <p className="eq-boss-intent">危機提示：{bossTurn.hint}</p>}
        </div>
        <div className="eq-relay-cue" aria-label="目前目標">
          {getWordImage(currentWord) && <img src={getWordImage(currentWord)} alt="" />}
          <span data-testid="relay-target-word">{currentWord?.word ?? '—'}</span>
        </div>
      </section>

      <section className="eq-relay-deck" aria-label="接力操作">
        {enabledVocab.length === 0 ? (
          <div className="eq-relay-empty" role="status">
            <strong>需要至少一個啟用中的單字</strong>
            <button type="button" className="eq-arcade-primary" onClick={() => setScreen('vocab_management')}>開啟字庫</button>
          </div>
        ) : adventure?.rescued ? (
          <div className="eq-relay-clear" role="status">
            <strong>森林夥伴已經安全回家</strong>
            <button type="button" className="eq-arcade-primary" onClick={startNewMission}>新的救援</button>
          </div>
        ) : (
          <>
            <div className="eq-deck-heading">
              <span>{profileHints[profile].mode}</span>
              <p>{profileHints[profile].goal}</p>
            </div>

            {profile === 'toddler' && (
              <div className="eq-choice-grid" aria-label="圖片選項">
                {pictureChoices.map((choice) => (
                  <button key={choice.id} type="button" className="eq-picture-choice" onClick={() => submitAnswer(choice.word, 'image_choice')} aria-label={`選擇 ${choice.word}`}>
                    {getWordImage(choice) ? <img src={getWordImage(choice)} alt="" /> : <span aria-hidden="true">{choice.imageName}</span>}
                  </button>
                ))}
              </div>
            )}

            {profile === 'kid' && (
              <div className="eq-letter-game">
                <div className="eq-letter-status">
                  <div className="eq-letter-answer" aria-label="拼字答案">{selectedLetters || '點字母拼單字'}</div>
                  <span>{nextLetter ? `下一個字母：${nextLetter}` : '符文已排列完成'}</span>
                </div>
                <div className="eq-letter-bank" aria-label="字母選項">
                  {letterTiles.map((tile) => (
                    <button key={tile.id} type="button" className="eq-letter-tile" onClick={() => selectLetter(tile.id)} disabled={tile.used} aria-label={`letter ${tile.letter}`}>
                      {tile.letter}
                    </button>
                  ))}
                </div>
                <button type="button" className="eq-arcade-primary" disabled={!currentWord || selectedLetters.length !== currentWord.word.length} onClick={() => submitAnswer(selectedLetters, 'spelling')}>
                  {submitLabel}
                </button>
              </div>
            )}

            {profile === 'adult' && (
              <form className="eq-typing-game" onSubmit={(event) => { event.preventDefault(); submitAnswer(typedAnswer, 'spelling'); }}>
                <input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} autoComplete="off" aria-label="Type answer" />
                <button type="submit" className="eq-arcade-primary">{submitLabel}</button>
              </form>
            )}

            {currentEvent?.kind === 'boss' && (
              <div className="eq-spell-choices" aria-label="可用魔法">
                {spellViews.map((spell) => (
                  <button key={spell.spell} type="button" disabled={!adventure?.spellReady} onClick={() => useSpell(spell.spell)}>
                    <strong>{spell.name}</strong><span>{spell.detail}</span>
                  </button>
                ))}
              </div>
            )}

            {canUseVoice && (
              <div className="eq-voice-panel" aria-label="語音輸入">
                {speech.isSupported ? (
                  <>
                    <div className="eq-voice-controls">
                      <button type="button" className={activeVoice ? 'eq-arcade-danger' : 'eq-arcade-secondary'} onClick={activeVoice ? speech.stop : startListening}>
                        {activeVoice ? <Volume2 aria-hidden="true" /> : <Mic aria-hidden="true" />}
                        {voiceLabel}
                      </button>
                      <LanguageSelector selectedLang={recognitionLang} onLangChange={setRecognitionLang} />
                    </div>
                    {(speech.transcript || speech.interimTranscript) && <p className="eq-transcript-line">{speech.transcript || speech.interimTranscript}</p>}
                    {voiceReview && (
                      <div className="eq-voice-review" role="status" aria-live="polite">
                        <span>聽到：{voiceReview.heardText}</span>
                        <strong>{voiceReview.isMatch ? '可以送出' : `目標是 ${voiceReview.targetWord}`}</strong>
                        <div className="eq-row-actions">
                          <button type="button" className="eq-arcade-small-button" onClick={startListening}>重試</button>
                          <button type="button" className="eq-arcade-primary" onClick={confirmVoiceReview}>確認送出</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="eq-voice-note" role="alert">語音暫時不可用；打字或拼字仍可直接使用。</p>
                )}
              </div>
            )}

            <p className={`eq-adventure-message eq-adventure-message--${message.kind}`} role="status">{message.text}</p>
          </>
        )}
      </section>

      {showResumePrompt && (
        <div className="eq-resume-scrim">
          <section className="eq-resume-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-title">
            <span>接力訊號仍在</span>
            <h2 id="resume-title">繼續森林救援</h2>
            <p>上次的目標與世界狀態都已保留。</p>
            <div className="eq-row-actions">
              <button type="button" className="eq-arcade-primary" onClick={() => setShowResumePrompt(false)}>繼續救援</button>
              <button type="button" className="eq-arcade-secondary" onClick={startNewMission}>新的救援</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麥克風權限被阻擋。';
    case 'audio-capture':
      return '找不到可用的麥克風。';
    case 'network':
      return '瀏覽器語音服務暫時連不上。';
    case 'no-speech':
      return '沒有聽到聲音。';
    default:
      return error;
  }
}
