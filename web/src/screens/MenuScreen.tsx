import React from 'react';
import { Settings, Sparkles, Sword } from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { Panel, QuestButton, ScreenShell } from '../components/QuestFrame';
import { learnerProfileOptions, type LearnerProfile } from '../game/challenges';

type MenuScreenProps = {
  recognitionLang: string;
  learnerProfile: LearnerProfile;
  speechSupported: boolean;
  message: string;
  onRecognitionLangChange: (lang: string) => void;
  onLearnerProfileChange: (profile: LearnerProfile) => void;
  onStartGame: () => void;
  onOpenVocabManagement: () => void;
};

export function MenuScreen({
  recognitionLang,
  learnerProfile,
  speechSupported,
  message,
  onRecognitionLangChange,
  onLearnerProfileChange,
  onStartGame,
  onOpenVocabManagement,
}: MenuScreenProps) {
  return (
    <ScreenShell screen="menu" label="EchoQuest 主選單">
      <div className="eq-menu">
        <section>
          <div className="eq-menu__mark" aria-hidden="true">
            <Sparkles className="w-12 h-12" />
          </div>
          <h1 className="eq-display eq-menu__title">EchoQuest</h1>
          <p className="eq-menu__subtitle">學習英文，打敗怪物！</p>
        </section>

        <Panel className="p-6 sm:p-8">
          <div className="mb-6 grid gap-3">
            <LanguageSelector selectedLang={recognitionLang} onLangChange={onRecognitionLangChange} isMenu />
            <label className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[color:var(--eq-muted)]">玩家模式</span>
              <select
                value={learnerProfile}
                onChange={(event) => onLearnerProfileChange(event.target.value as LearnerProfile)}
                aria-label="選擇學習者模式"
                className="eq-select flex-1"
              >
                {learnerProfileOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="eq-menu__actions">
            <QuestButton onClick={onStartGame} className="w-full" icon={<Sword className="w-5 h-5" />}>
              開始遊戲
            </QuestButton>
            <QuestButton
              variant="quiet"
              onClick={onOpenVocabManagement}
              className="w-full"
              icon={<Settings className="w-5 h-5" />}
            >
              字彙管理
            </QuestButton>
          </div>
          {!speechSupported && (
            <p className="mt-4 text-center text-sm text-[color:var(--eq-muted)]" role="alert">
              Speech recognition is not supported in this browser.
            </p>
          )}
          {message && (
            <p className="eq-message text-center">
              {message}
            </p>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );
}
