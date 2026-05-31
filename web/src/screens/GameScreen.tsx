import React from 'react';
import { Heart, HelpCircle, Mic, MicOff, Skull, SkipForward, Star, Sword, Trophy, Volume2, Zap } from 'lucide-react';
import { IconButton, Panel, QuestButton, ScreenShell, StatBadge } from '../components/QuestFrame';
import { LanguageSelector } from '../components/LanguageSelector';
import type { Level } from '../data/levels';
import type { AppState } from '../game/gameReducer';
import type { VocabItem } from '../types/vocab';

type VoiceReviewResult = {
  heardText: string;
  targetWord: string;
  isMatch: boolean;
};

type SpeechViewModel = {
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
};

type GameScreenProps = {
  level: Level;
  currentLevel: number;
  currentWord: VocabItem | null;
  userInput: string;
  score: number;
  enemyLives: number;
  collectedTools: string[];
  message: string;
  practiceMode: AppState['practiceMode'];
  levelCorrectAnswers: number;
  skippedWords: number;
  showEffect: boolean;
  combo: number;
  showHint: boolean;
  isBossShaking: boolean;
  recognitionLang: string;
  speech: SpeechViewModel;
  speechErrorMessage: string | null;
  canRetrySpeechError: boolean;
  voiceReview: VoiceReviewResult | null;
  onSubmit: (submittedText: string) => void;
  onUserInputChange: (value: string) => void;
  onTogglePracticeMode: () => void;
  onToggleListening: () => void;
  onRecognitionLangChange: (lang: string) => void;
  onShowHintChange: (show: boolean) => void;
  onSkip: () => void;
  onRetryVoiceReview: () => void;
  onConfirmVoiceReview: () => void;
};

export function GameScreen({
  level,
  currentLevel,
  currentWord,
  userInput,
  score,
  enemyLives,
  collectedTools,
  message,
  practiceMode,
  levelCorrectAnswers,
  skippedWords,
  showEffect,
  combo,
  showHint,
  isBossShaking,
  recognitionLang,
  speech,
  speechErrorMessage,
  canRetrySpeechError,
  voiceReview,
  onSubmit,
  onUserInputChange,
  onTogglePracticeMode,
  onToggleListening,
  onRecognitionLangChange,
  onShowHintChange,
  onSkip,
  onRetryVoiceReview,
  onConfirmVoiceReview,
}: GameScreenProps) {
  const speechUnavailable = !speech.isSupported;
  const totalEnemyLives = level.enemyLives ?? enemyLives;
  const objectiveText = level.type === 'puzzle'
    ? `目標: 收集 ${collectedTools.length}/${level.tools?.length || level.requiredWords} 個工具`
    : `目標: 答對 ${levelCorrectAnswers}/${level.requiredWords} 個單字，或清空生命值 ${enemyLives}/${totalEnemyLives}`;
  const currentWordImageSrc = currentWord?.imageDataUrl ?? currentWord?.imageSrc;

  return (
    <ScreenShell screen="playing" label="EchoQuest 遊戲進行中">
      <div className="eq-game-shell">
        <div className="eq-hud" aria-label="冒險狀態">
          <StatBadge icon={<Trophy className="w-6 h-6" />} label="得分" value={`分數: ${score}`} tone="gold" />
          <StatBadge icon={<Zap className="w-6 h-6" />} label="節奏" value={`連擊 x${combo}`} tone="green" />
          <StatBadge icon={<SkipForward className="w-6 h-6" />} label="選擇" value={`跳過 ${skippedWords} 次`} tone="blue" />
          <StatBadge icon={<Star className="w-6 h-6" />} label="進度" value={`關卡 ${currentLevel + 1}`} tone="red" />
        </div>

        <div className="eq-game-grid">
          <Panel className="eq-level-panel">
            <p className="text-sm font-extrabold uppercase text-[color:var(--eq-muted)]">Quest Log</p>
            <h2 className="eq-display eq-level-title">{level.name}</h2>
            <p className="mt-2 text-[color:var(--eq-muted)]">{level.description}</p>
            <p className="eq-objective">{objectiveText}</p>

            <div className={`eq-enemy-figure ${isBossShaking ? 'shake' : ''}`}>
              {level.imageSrc ? (
                <img src={level.imageSrc} alt={`${level.name} artwork`} className="eq-enemy-artwork" />
              ) : (
                <span aria-hidden="true">{level.imageEmoji}</span>
              )}
            </div>

            {level.type === 'boss' && (
              <div className="flex justify-center items-center gap-2" aria-label="Boss health">
                <Skull className="w-7 h-7 text-[color:var(--eq-rust)]" />
                <div className="flex gap-1">
                  {[...Array(level.enemyLives ?? 0)].map((_, i) => (
                    <Heart
                      key={i}
                      className={`w-7 h-7 ${i < enemyLives ? 'text-[color:var(--eq-rust)]' : 'text-stone-300'}`}
                      fill={i < enemyLives ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
              </div>
            )}

            {level.type === 'puzzle' && (
              <div className="flex justify-center items-center gap-2 text-4xl" aria-label="Puzzle progress">
                {[...Array(level.tools ? level.tools.length - collectedTools.length : 0)].map((_, i) => (
                  <span key={i}>🚪</span>
                ))}
                {[...Array(collectedTools.length)].map((_, i) => (
                  <span key={i} className="opacity-50">🔑</span>
                ))}
              </div>
            )}
          </Panel>

          {currentWord && (
            <Panel className="eq-challenge-panel">
              <div className={`eq-word-stage ${showEffect ? 'eq-word-stage--success' : ''}`}>
                {currentWordImageSrc ? (
                  <img src={currentWordImageSrc} alt={currentWord.word} className="eq-word-photo" />
                ) : (
                  <div className="eq-word-image" aria-hidden="true">{currentWord.imageName}</div>
                )}
                <div className="mt-4 flex justify-center gap-1">
                  {[...Array(currentWord.difficulty)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-[color:var(--eq-sun)]" fill="currentColor" />
                  ))}
                </div>
                <p className="mt-1 text-sm font-bold text-[color:var(--eq-muted)]">難度等級</p>
                {showHint && (
                  <div className="eq-hint-overlay">
                    <span className="eq-display text-4xl font-extrabold">{currentWord.word}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="eq-transcript w-full">
                  <p className="text-xl">
                    <span className="font-extrabold text-[color:var(--eq-river)]">{speech.transcript}</span>
                    <span className="text-[color:var(--eq-muted)]">{speech.interimTranscript}</span>
                  </p>
                </div>

                {voiceReview && practiceMode === 'voice' && (
                  <div className="eq-voice-review w-full" role="status" aria-live="polite">
                    <p className="text-lg font-extrabold text-[color:var(--eq-river)]">聽到：{voiceReview.heardText}</p>
                    <p className="text-sm font-bold text-[color:var(--eq-muted)]">目標：{voiceReview.targetWord}</p>
                    <p className="text-sm text-[color:var(--eq-muted)]">
                      {voiceReview.isMatch ? '聽起來很接近，確認後發動攻擊。' : '還沒聽準，可以重試一次。'}
                    </p>
                    <div className="eq-voice-review__actions">
                      <QuestButton
                        variant="secondary"
                        onClick={onRetryVoiceReview}
                        icon={<Mic className="w-5 h-5" />}
                      >
                        重試語音
                      </QuestButton>
                      <QuestButton
                        variant="gold"
                        onClick={onConfirmVoiceReview}
                        icon={<Sword className="w-5 h-5" />}
                      >
                        確認送出
                      </QuestButton>
                    </div>
                  </div>
                )}

                <div className="eq-control-row">
                  <QuestButton
                    variant={practiceMode === 'voice' ? 'secondary' : 'quiet'}
                    onClick={onTogglePracticeMode}
                    aria-label={practiceMode === 'voice' ? '切換到拼字模式' : '切換到語音模式'}
                    disabled={practiceMode === 'spelling' && speechUnavailable}
                    icon={practiceMode === 'voice' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  >
                    {practiceMode === 'voice' ? '語音' : '拼字'}
                  </QuestButton>

                  {practiceMode === 'voice' ? (
                    <QuestButton
                      variant={speech.listening ? 'danger' : 'primary'}
                      onClick={onToggleListening}
                      disabled={speechUnavailable}
                      icon={<Volume2 className="w-5 h-5" />}
                    >
                      {speech.listening ? '聆聽中...' : '點擊說話'}
                    </QuestButton>
                  ) : (
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => onUserInputChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSubmit(userInput)}
                      placeholder="輸入英文單字"
                      className="eq-input"
                    />
                  )}
                  <LanguageSelector selectedLang={recognitionLang} onLangChange={onRecognitionLangChange} />
                </div>

                {speech.error && speechErrorMessage && (
                  <div className="flex flex-col items-center gap-3" role="alert">
                    <p className="text-sm text-[color:var(--eq-ruby)] text-center">
                      {speechErrorMessage}
                    </p>
                    {canRetrySpeechError && (
                      <QuestButton
                        variant="secondary"
                        onClick={onRetryVoiceReview}
                        icon={<Mic className="w-5 h-5" />}
                      >
                        重試語音
                      </QuestButton>
                    )}
                  </div>
                )}
                {!speech.isSupported && (
                  <p className="text-sm text-[color:var(--eq-muted)] text-center" role="alert">
                    Speech recognition is not supported in this browser.
                  </p>
                )}

                {practiceMode === 'spelling' && (
                  <QuestButton
                    variant="gold"
                    onClick={() => onSubmit(userInput)}
                    icon={<Sword className="w-5 h-5" />}
                  >
                    攻擊!
                  </QuestButton>
                )}

                <div className="flex gap-3 items-center">
                  <IconButton
                    aria-label="Show hint"
                    onMouseDown={() => onShowHintChange(true)}
                    onMouseUp={() => onShowHintChange(false)}
                    onTouchStart={() => onShowHintChange(true)}
                    onTouchEnd={() => onShowHintChange(false)}
                  >
                    <HelpCircle className="w-6 h-6" />
                  </IconButton>
                  <IconButton aria-label="Skip word" onClick={onSkip} variant="danger">
                    <SkipForward className="w-6 h-6" />
                  </IconButton>
                </div>
              </div>

              {message && (
                <div className="text-center">
                  <p className="eq-message animate-bounce">
                    {message}
                  </p>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
