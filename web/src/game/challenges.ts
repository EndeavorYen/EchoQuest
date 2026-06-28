import type { VocabItem } from '../types/vocab';
import type { WordProgress } from '../learning/progress';
import type { AppState } from './gameReducer';

export type LearnerProfile = 'toddler' | 'kid' | 'adult';
export type ChallengeMode = 'image_choice' | 'guided_typing' | 'free_typing' | 'voice';

export type ChallengeChoice = Pick<VocabItem, 'id' | 'word' | 'imageName' | 'imageSrc' | 'imageDataUrl'>;

export type Challenge = {
  profile: LearnerProfile;
  mode: ChallengeMode;
  answerWord: string;
  prompt: string;
  hintText?: string;
  choices: ChallengeChoice[];
};

export const learnerProfileOptions: Array<{ value: LearnerProfile; label: string; description: string }> = [
  { value: 'toddler', label: '2y 圖像', description: '看圖點選' },
  { value: 'kid', label: '5y 單字', description: '提示打字' },
  { value: 'adult', label: 'Adult', description: '自由練習' },
];

function hashText(text: string): number {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function choiceScore(seed: string, word: VocabItem): number {
  return hashText(`${seed}:${word.id}:${word.word}`);
}

function createImageChoices(currentWord: VocabItem, availableWords: VocabItem[], count: number): ChallengeChoice[] {
  const distractors = availableWords
    .filter((word) => word.id !== currentWord.id)
    .sort((left, right) => choiceScore(currentWord.id, left) - choiceScore(currentWord.id, right))
    .slice(0, Math.max(0, count - 1));

  return [currentWord, ...distractors]
    .sort((left, right) => choiceScore(currentWord.word, left) - choiceScore(currentWord.word, right))
    .map(({ id, word, imageName, imageSrc, imageDataUrl }) => ({ id, word, imageName, imageSrc, imageDataUrl }));
}

function getGuidedHint(word: string, wordProgress?: WordProgress): string {
  const firstLetter = word[0] ?? '';
  return wordProgress && wordProgress.mastery >= 2
    ? firstLetter
    : `${firstLetter}${'_'.repeat(Math.max(0, word.length - 1))}`;
}

export function getChallengeMode(profile: LearnerProfile, practiceMode: AppState['practiceMode']): ChallengeMode {
  if (profile === 'toddler') return 'image_choice';
  if (practiceMode === 'voice') return 'voice';
  return profile === 'kid' ? 'guided_typing' : 'free_typing';
}

export function createChallenge({
  profile,
  practiceMode,
  currentWord,
  availableWords,
  wordProgress,
}: {
  profile: LearnerProfile;
  practiceMode: AppState['practiceMode'];
  currentWord: VocabItem;
  availableWords: VocabItem[];
  wordProgress?: WordProgress;
}): Challenge {
  const mode = getChallengeMode(profile, practiceMode);

  if (mode === 'image_choice') {
    const choiceCount = wordProgress && wordProgress.mastery >= 2 ? 3 : 2;

    return {
      profile,
      mode,
      answerWord: currentWord.word,
      prompt: '找一樣的圖片',
      choices: createImageChoices(currentWord, availableWords, choiceCount),
    };
  }

  if (mode === 'guided_typing') {
    return {
      profile,
      mode,
      answerWord: currentWord.word,
      prompt: '看圖，照提示輸入單字',
      hintText: getGuidedHint(currentWord.word, wordProgress),
      choices: [],
    };
  }

  return {
    profile,
    mode,
    answerWord: currentWord.word,
    prompt: mode === 'voice' ? '看圖，說出英文單字' : '看圖，輸入英文單字',
    choices: [],
  };
}
