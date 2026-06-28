import type { VocabItem } from '../types/vocab';
import type { WordProgress } from '../learning/progress';
import { createChallenge, getChallengeMode } from './challenges';

function vocab(word: string, overrides: Partial<VocabItem> = {}): VocabItem {
  return {
    id: word,
    word,
    difficulty: 1,
    enabled: true,
    imageName: word,
    size: 0,
    type: '',
    ...overrides,
  };
}

const words = [vocab('apple'), vocab('ball'), vocab('cat')];

function progress(word: string, mastery: WordProgress['mastery']): WordProgress {
  return {
    wordId: word,
    word,
    attempts: mastery,
    correct: mastery,
    misses: 0,
    streak: mastery,
    mastery,
    lastPracticedAt: 1,
    lastMissedAt: null,
    lastMode: 'spelling',
    dueAt: 1,
  };
}

describe('learner challenges', () => {
  it('uses picture choice for toddlers regardless of practice mode', () => {
    expect(getChallengeMode('toddler', 'voice')).toBe('image_choice');
    expect(getChallengeMode('toddler', 'spelling')).toBe('image_choice');
  });

  it('uses guided typing for kid spelling practice', () => {
    const challenge = createChallenge({
      profile: 'kid',
      practiceMode: 'spelling',
      currentWord: words[0],
      availableWords: words,
    });

    expect(challenge).toMatchObject({
      mode: 'guided_typing',
      answerWord: 'apple',
      hintText: 'a____',
    });
  });

  it('keeps adult spelling as free typing', () => {
    expect(createChallenge({
      profile: 'adult',
      practiceMode: 'spelling',
      currentWord: words[0],
      availableWords: words,
    }).mode).toBe('free_typing');
  });

  it('builds toddler image choices with the target and one distractor', () => {
    const challenge = createChallenge({
      profile: 'toddler',
      practiceMode: 'spelling',
      currentWord: words[0],
      availableWords: words,
    });

    expect(challenge.mode).toBe('image_choice');
    expect(challenge.choices).toHaveLength(2);
    expect(challenge.choices.map((choice) => choice.word)).toContain('apple');
  });

  it('adds a third toddler choice for mastered words', () => {
    const challenge = createChallenge({
      profile: 'toddler',
      practiceMode: 'spelling',
      currentWord: words[0],
      availableWords: words,
      wordProgress: progress('apple', 2),
    });

    expect(challenge.choices).toHaveLength(3);
    expect(challenge.choices.map((choice) => choice.word)).toContain('apple');
  });

  it('uses a shorter kid hint for mastered words', () => {
    const challenge = createChallenge({
      profile: 'kid',
      practiceMode: 'spelling',
      currentWord: words[0],
      availableWords: words,
      wordProgress: progress('apple', 2),
    });

    expect(challenge.hintText).toBe('a');
  });
});
