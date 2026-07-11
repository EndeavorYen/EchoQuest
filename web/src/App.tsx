import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { LanguageSelector } from './components/LanguageSelector';
import { VocabManager } from './components/VocabManager';
import { defaultLevels, type Level } from './data/levels';
import { initialVocab as defaultInitialVocab } from './data/vocab';
import { getAvailableWords, isAnswerCorrect, selectWord } from './game/gameLogic';
import { learnerProfileOptions, type LearnerProfile } from './game/challenges';
import {
  castSpell,
  completeRoomChallenge,
  createAdventure,
  getBossTurn,
  type AdventureRoom,
  type Spell,
} from './game/adventure';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import {
  createAnswerFeedback,
  getTopReviewCandidates,
  recordPracticeAttempt,
  type AnswerFeedback,
  type LearningProgressState,
  type PracticeMode,
} from './learning/progress';
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
  toddler: { mode: '認圖冒險', goal: '點同一張圖，答錯不扣血。' },
  kid: { mode: '字母施法', goal: '用字母拼出圖片的英文單字。' },
  adult: { mode: '成人/家長練習', goal: '快速打字練習；語音是可選加速輸入。' },
};

const roomViews: Record<AdventureRoom, { number: number; kicker: string; title: string; instruction: string }> = {
  orchard: { number: 1, kicker: 'ROOM 1 · 探索', title: '果園探索', instruction: '找到蘋果，取得治療魔法。' },
  bridge: { number: 2, kicker: 'ROOM 2 · 修復', title: '修復魔法橋', instruction: '完成單字，讓每個字母變成橋板。' },
  rescue: { number: 3, kicker: 'ROOM 3 · 救援', title: '森林救援', instruction: '先完成學習挑戰充能，再觀察意圖選魔法。' },
  complete: { number: 3, kicker: 'QUEST CLEAR', title: '救援成功', instruction: '森林巫師加入家庭收藏。' },
};

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

function createPictureChoices(currentWord: VocabItem | null, words: VocabItem[], count = 2): VocabItem[] {
  if (!currentWord) return [];

  const distractors = words
    .filter((word) => word.id !== currentWord.id)
    .sort((left, right) => scoreText(`${currentWord.word}:${left.id}`) - scoreText(`${currentWord.word}:${right.id}`))
    .slice(0, Math.max(0, count - 1));

  return [currentWord, ...distractors]
    .sort((left, right) => scoreText(`${currentWord.id}:${left.word}`) - scoreText(`${currentWord.id}:${right.word}`));
}

function chooseNextWord({
  vocab,
  level,
  progress,
  previousWordId,
}: {
  vocab: VocabItem[];
  level: Level;
  progress: LearningProgressState;
  previousWordId?: string;
}): VocabItem | null {
  const levelWords = getAvailableWords(vocab, level, []);
  const reviewCandidates = getTopReviewCandidates(levelWords, progress, Date.now());
  return selectWord(reviewCandidates.length > 0 ? reviewCandidates : levelWords, Math.random, previousWordId);
}

function getInitialVocab(initialVocab?: VocabItem[]): VocabItem[] {
  if (initialVocab) return hydrateDefaultVocabArtwork(initialVocab);
  const stored = loadVocabFromStorage();
  return stored.length > 0 ? stored : defaultInitialVocab;
}

function getWordClue(profile: LearnerProfile, word: VocabItem | null): string {
  if (profile === 'toddler') return '找一樣的圖';
  if (!word) return '';
  return profile === 'kid'
    ? [word.word[0], ...Array(Math.max(0, word.word.length - 1)).fill('_')].join(' ')
    : Array(word.word.length).fill('_').join(' ');
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
  const [currentWord, setCurrentWord] = useState<VocabItem | null>(null);
  const [adventure, setAdventure] = useState(createAdventure);
  const [spellReady, setSpellReady] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [letterTiles, setLetterTiles] = useState<Tile[]>([]);
  const [selectedLetters, setSelectedLetters] = useState('');
  const [voiceReview, setVoiceReview] = useState<VoiceReviewResult | null>(null);
  const [lastAnswerFeedback, setLastAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string }>({
    kind: 'neutral',
    text: '選一個玩家，開始森林救援。',
  });

  const enabledVocab = useMemo(() => getEnabledVocab(vocab), [vocab]);
  const level = levels[0] ?? defaultLevels[0];
  const currentImageSrc = getWordImage(currentWord);
  const toddlerChoiceCount = currentWord && (progress[currentWord.id]?.mastery ?? 0) >= 2 ? 3 : 2;
  const pictureChoices = useMemo(
    () => createPictureChoices(currentWord, getAvailableWords(enabledVocab, level, []), toddlerChoiceCount),
    [currentWord, enabledVocab, level, toddlerChoiceCount],
  );
  const selectedProfileHint = profileHints[profile];
  const canUseVoice = profile !== 'toddler';
  const roomView = roomViews[adventure.room];
  const bossTurn = adventure.room === 'rescue' ? getBossTurn(adventure) : null;
  const submitLabel = adventure.room === 'rescue' ? '魔法充能' : adventure.room === 'bridge' ? '修好橋梁' : '完成探索';

  const pickWord = useCallback((nextProgress: LearningProgressState, previousWordId?: string) => chooseNextWord({
    vocab: enabledVocab,
    level,
    progress: nextProgress,
    previousWordId,
  }), [enabledVocab, level]);

  const resetRoundInputs = useCallback((word: VocabItem | null) => {
    setTypedAnswer('');
    setSelectedLetters('');
    setLetterTiles(word ? createLetterTiles(word.word) : []);
    setVoiceReview(null);
  }, []);

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
      setMessage({ kind: 'voice', text: `聽到「${heardText}」，確認後才會送出。` });
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
    if (currentWord || enabledVocab.length === 0) return;
    const nextWord = pickWord(progress);
    setCurrentWord(nextWord);
    resetRoundInputs(nextWord);
  }, [currentWord, enabledVocab.length, pickWord, progress, resetRoundInputs]);

  useEffect(() => {
    setMessage({
      kind: 'neutral',
      text: profile === 'toddler'
        ? '2y 模式只要點圖片，答錯也不扣血。'
        : '語音可以用，但拼字/打字永遠可以繼續玩。',
    });
  }, [profile]);

  useEffect(() => {
    if (profile === 'toddler' && speech.listening) speech.stop();
  }, [profile, speech.listening, speech.stop]);

  useEffect(() => {
    if (!speech.error) return;
    setMessage({ kind: 'voice', text: `語音暫時不可用：${getSpeechErrorMessage(speech.error)} 你仍可用拼字或打字。` });
  }, [speech.error]);

  const moveToNextWord = (nextProgress: LearningProgressState, previousWordId?: string) => {
    const nextWord = pickWord(nextProgress, previousWordId);
    setCurrentWord(nextWord);
    resetRoundInputs(nextWord);
    speech.resetTranscript();
    speech.clearError();
  };

  const finishLearningChallenge = () => {
    setAdventure((state) => completeRoomChallenge(state));
  };

  const useSpell = (spell: Spell) => {
    if (!spellReady) return;
    setAdventure((state) => {
      const result = castSpell(state, spell);
      if (result.correct) setSpellReady(false);
      setMessage({
        kind: result.correct ? 'correct' : 'wrong',
        text: result.correct ? '魔法成功！' : result.hint,
      });
      return result.state;
    });
  };

  const submitAnswer = (submittedText: string, mode: PracticeMode) => {
    if (!currentWord || !submittedText.trim()) return;

    const now = Date.now();
    const isCorrect = isAnswerCorrect(submittedText, currentWord);
    const nextProgress = recordPracticeAttempt(progress, currentWord, { isCorrect, mode, now });
    setProgress(nextProgress);
    setLastAnswerFeedback(createAnswerFeedback({
      word: currentWord,
      submitted: submittedText,
      isCorrect,
      mode,
      progress: nextProgress[currentWord.id],
      now,
    }));

    if (!isCorrect) {
      setVoiceReview(null);
      speech.resetTranscript();
      if (profile === 'kid') resetRoundInputs(currentWord);
      if (profile === 'adult') setTypedAnswer('');
      setMessage({
        kind: 'wrong',
        text: profile === 'toddler' ? '再找一次，這個模式不扣血。' : `還差一點，目標是 ${currentWord.word}。`,
      });
      return;
    }

    if (adventure.room === 'rescue') {
      setSpellReady(true);
      setMessage({ kind: 'correct', text: '魔法充能完成，選擇合適的魔法。' });
    } else {
      finishLearningChallenge();
      setMessage({ kind: 'correct', text: `${currentWord.word} 答對了，前往下一個房間。` });
    }
    moveToNextWord(nextProgress, currentWord.id);
  };

  const selectLetter = (tileId: string) => {
    const tile = letterTiles.find((item) => item.id === tileId);
    if (!tile || tile.used) return;
    setSelectedLetters((value) => `${value}${tile.letter}`);
    setLetterTiles((tiles) => tiles.map((item) => item.id === tileId ? { ...item, used: true } : item));
  };

  const clearLetters = () => resetRoundInputs(currentWord);

  const startListening = () => {
    setVoiceReview(null);
    speech.resetTranscript();
    speech.clearError();
    speech.start(recognitionLang);
    setMessage({ kind: 'voice', text: '請說出圖片的英文單字。' });
  };

  const confirmVoiceReview = () => {
    if (!voiceReview) return;
    const heardText = voiceReview.heardText;
    setVoiceReview(null);
    submitAnswer(heardText, 'voice');
  };

  const retryVoice = () => {
    setVoiceReview(null);
    startListening();
  };

  const changeProfile = (nextProfile: LearnerProfile) => {
    setProfile(nextProfile);
    setVoiceReview(null);
    speech.resetTranscript();
    speech.clearError();
  };

  if (screen === 'vocab_management') {
    return (
      <main className="eq-adventure eq-adventure--management">
        <div className="eq-adventure-vocab">
          <button type="button" className="eq-arcade-small-button" onClick={() => setScreen('play')}>回到冒險</button>
          <VocabManager vocab={vocab} onVocabChange={setVocab} onGoBack={() => setScreen('play')} />
        </div>
      </main>
    );
  }

  return (
    <main className={`eq-adventure eq-adventure--${adventure.room} eq-adventure--${profile}`} aria-label="EchoQuest family magic adventure">
      <header className="eq-adventure-hud">
        <div><span>森林救援</span><strong>{roomView.number}/3</strong></div>
        <div className="eq-adventure-hud-actions">
          <button type="button" className="eq-arcade-small-button" onClick={() => setScreen('vocab_management')}>字庫</button>
          <nav aria-label="選擇玩家">
            {learnerProfileOptions.map((option) => (
              <button key={option.value} type="button" aria-pressed={profile === option.value} onClick={() => changeProfile(option.value)}>
                {option.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <section className="eq-adventure-scene" aria-live="polite">
        <div className="eq-scene-copy">
          <p>{roomView.kicker}</p>
          <h1>{roomView.title}</h1>
          <p>{roomView.instruction}</p>
          {bossTurn && <p className="eq-boss-intent">森林危機：{bossTurn.hint}</p>}
        </div>
        <div className="eq-scene-character">
          <img src={adventure.room === 'rescue' ? '/assets/generated/boss-wizard.png' : '/assets/generated/level-magic-gate.png'} alt="" />
        </div>
        {adventure.room !== 'complete' && (
          <div className="eq-world-challenge">
            <div className="eq-target-card">
              {currentImageSrc ? <img src={currentImageSrc} alt={currentWord?.word ?? 'current word'} /> : <span aria-hidden="true">{currentWord?.imageName ?? '?'}</span>}
            </div>
            <div className="eq-word-clue">
              <p>{selectedProfileHint.mode}</p>
              <h2>{getWordClue(profile, currentWord)}</h2>
              <span>{selectedProfileHint.goal}</span>
            </div>
            {profile === 'toddler' && (
              <div className="eq-choice-grid" aria-label="圖片選項">
                {pictureChoices.map((choice) => {
                  const choiceImage = getWordImage(choice);
                  return (
                    <button key={choice.id} type="button" className="eq-picture-choice" onClick={() => submitAnswer(choice.word, 'image_choice')} aria-label={`選擇 ${choice.word}`}>
                      {choiceImage ? <img src={choiceImage} alt="" /> : <span aria-hidden="true">{choice.imageName}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {profile === 'kid' && (
              <div className="eq-letter-game">
                <div className="eq-letter-answer" aria-label="拼字答案">{selectedLetters || '點字母拼單字'}</div>
                <div className="eq-letter-bank" aria-label="字母選項">
                  {letterTiles.map((tile) => (
                    <button key={tile.id} type="button" className="eq-letter-tile" onClick={() => selectLetter(tile.id)} disabled={tile.used} aria-label={`letter ${tile.letter}`}>
                      {tile.letter}
                    </button>
                  ))}
                </div>
                <div className="eq-row-actions">
                  <button type="button" className="eq-arcade-small-button" onClick={clearLetters}>清除</button>
                  <button type="button" className="eq-arcade-primary" onClick={() => submitAnswer(selectedLetters, 'spelling')}>{submitLabel}</button>
                </div>
              </div>
            )}
            {profile === 'adult' && (
              <form className="eq-typing-game" onSubmit={(event) => { event.preventDefault(); submitAnswer(typedAnswer, 'spelling'); }}>
                <input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="fast typing practice" aria-label="Type answer" />
                <button type="submit" className="eq-arcade-primary">{submitLabel}</button>
              </form>
            )}
            {canUseVoice && (
              <div className="eq-voice-panel" aria-label="語音輸入">
                {speech.isSupported ? (
                  <>
                    <div className="eq-voice-controls">
                      <button type="button" className={speech.listening ? 'eq-arcade-danger' : 'eq-arcade-secondary'} onClick={speech.listening ? speech.stop : startListening}>
                        {speech.listening ? <Volume2 aria-hidden="true" /> : <Mic aria-hidden="true" />}
                        {speech.listening ? '聆聽中' : '說出單字'}
                      </button>
                      <LanguageSelector selectedLang={recognitionLang} onLangChange={setRecognitionLang} />
                    </div>
                    <p className="eq-transcript-line">{speech.transcript || speech.interimTranscript || '語音是可選輸入，失敗也可以繼續拼字/打字。'}</p>
                    {voiceReview && (
                      <div className="eq-voice-review" role="status" aria-live="polite">
                        <span>聽到：{voiceReview.heardText}</span>
                        <strong>{voiceReview.isMatch ? '可確認送出' : `目標是 ${voiceReview.targetWord}`}</strong>
                        <div className="eq-row-actions">
                          <button type="button" className="eq-arcade-small-button" onClick={retryVoice}>重試</button>
                          <button type="button" className="eq-arcade-primary" onClick={confirmVoiceReview}>確認送出</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="eq-voice-note" role="alert">語音暫時不可用；打字/拼字已可直接使用。</p>
                )}
              </div>
            )}
            <p className={`eq-adventure-message eq-adventure-message--${message.kind}`} role="status">{message.text}</p>
          </div>
        )}
      </section>
      {adventure.room === 'rescue' && (
        <div className="eq-spell-dock" aria-label="可用魔法">
          <button type="button" disabled={!spellReady} onClick={() => useSpell('fire')}>火球</button>
          <button type="button" disabled={!spellReady} onClick={() => useSpell('shield')}>護盾</button>
          <button type="button" disabled={!spellReady} onClick={() => useSpell('heal')}>治療</button>
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
