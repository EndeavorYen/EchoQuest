import {
  createFeedbackEvent,
  getFeedbackPresentation,
} from './feedbackEvents';

describe('feedback events', () => {
  it('creates a correct feedback event with stable identity and tone', () => {
    expect(createFeedbackEvent('correct', { message: 'Nice hit', now: 1000 })).toEqual({
      id: 'correct-1000',
      kind: 'correct',
      tone: 'success',
      message: 'Nice hit',
      createdAt: 1000,
    });
  });

  it('keeps submitted and target details for incorrect feedback', () => {
    expect(createFeedbackEvent('incorrect', {
      message: 'Try again',
      targetWord: 'apple',
      submitted: 'apl',
      now: 1000,
    })).toEqual({
      id: 'incorrect-1000',
      kind: 'incorrect',
      tone: 'caution',
      message: 'Try again',
      targetWord: 'apple',
      submitted: 'apl',
      createdAt: 1000,
    });
  });

  it('maps event kind to purposeful presentation classes', () => {
    const event = createFeedbackEvent('levelComplete', { message: 'Goal complete', now: 1000 });

    expect(getFeedbackPresentation(event)).toEqual({
      dataFeedbackKind: 'levelComplete',
      wordClassName: 'eq-word-stage--feedback-celebration',
      enemyClassName: 'eq-enemy-figure--feedback-celebration',
      messageClassName: 'eq-message--feedback eq-message--feedback-celebration',
      statusClassName: 'eq-feedback-status eq-feedback-status--celebration',
    });
  });

  it('creates voice feedback with readable status tones', () => {
    expect(createFeedbackEvent('voiceHeard', { message: 'Heard apple', now: 1000 }).tone).toBe('voice');
    expect(createFeedbackEvent('voiceError', { message: 'Try voice again', now: 1001 }).tone).toBe('caution');
  });
});
