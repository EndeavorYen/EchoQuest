import { createFeedbackEvent } from './feedbackEvents';
import { createSpeechInstruction } from './feedbackAudio';

describe('feedback audio', () => {
  it('speaks the target word for incorrect feedback using English fallback language', () => {
    const event = createFeedbackEvent('incorrect', {
      message: 'Try again',
      targetWord: 'apple',
      submitted: 'apl',
      now: 1000,
    });

    expect(createSpeechInstruction(event, 'zh-TW')).toEqual({
      text: 'apple',
      lang: 'en-US',
    });
  });

  it('uses the selected English recognition language for incorrect feedback', () => {
    const event = createFeedbackEvent('incorrect', {
      message: 'Try again',
      targetWord: 'colour',
      submitted: 'color',
      now: 1000,
    });

    expect(createSpeechInstruction(event, 'en-GB')).toEqual({
      text: 'colour',
      lang: 'en-GB',
    });
  });

  it.each(['correct', 'levelComplete', 'comboUp', 'voiceHeard', 'voiceError'] as const)(
    'does not speak for %s feedback by default',
    (kind) => {
      const event = createFeedbackEvent(kind, { message: 'Status', now: 1000 });

      expect(createSpeechInstruction(event, 'en-US')).toBeNull();
    },
  );
});
