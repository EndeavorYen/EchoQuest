export type FeedbackKind =
  | 'correct'
  | 'incorrect'
  | 'levelComplete'
  | 'comboUp'
  | 'voiceHeard'
  | 'voiceError';

export type FeedbackTone = 'neutral' | 'success' | 'caution' | 'celebration' | 'voice';

export type FeedbackEvent = {
  id: string;
  kind: FeedbackKind;
  tone: FeedbackTone;
  message: string;
  targetWord?: string;
  submitted?: string;
  createdAt: number;
};

type FeedbackEventOptions = {
  message: string;
  targetWord?: string;
  submitted?: string;
  now: number;
};

export type FeedbackPresentation = {
  dataFeedbackKind?: FeedbackKind;
  wordClassName: string;
  enemyClassName: string;
  messageClassName: string;
  statusClassName: string;
};

const FEEDBACK_TONES: Record<FeedbackKind, FeedbackTone> = {
  correct: 'success',
  incorrect: 'caution',
  levelComplete: 'celebration',
  comboUp: 'success',
  voiceHeard: 'voice',
  voiceError: 'caution',
};

export function createFeedbackEvent(kind: FeedbackKind, options: FeedbackEventOptions): FeedbackEvent {
  return {
    id: `${kind}-${options.now}`,
    kind,
    tone: FEEDBACK_TONES[kind],
    message: options.message,
    targetWord: options.targetWord,
    submitted: options.submitted,
    createdAt: options.now,
  };
}

export function getFeedbackPresentation(event: FeedbackEvent | null): FeedbackPresentation {
  if (!event) {
    return {
      dataFeedbackKind: undefined,
      wordClassName: '',
      enemyClassName: '',
      messageClassName: '',
      statusClassName: 'eq-feedback-status',
    };
  }

  const tone = event?.tone ?? 'neutral';

  return {
    dataFeedbackKind: event.kind,
    wordClassName: `eq-word-stage--feedback-${tone}`,
    enemyClassName: `eq-enemy-figure--feedback-${tone}`,
    messageClassName: `eq-message--feedback eq-message--feedback-${tone}`,
    statusClassName: `eq-feedback-status eq-feedback-status--${tone}`,
  };
}
