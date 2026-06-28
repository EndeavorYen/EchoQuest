import type { FeedbackEvent } from './feedbackEvents';

export type SpeechInstruction = {
  text: string;
  lang: string;
};

function getSpeechLang(recognitionLang: string): string {
  return recognitionLang.startsWith('en-') ? recognitionLang : 'en-US';
}

export function createSpeechInstruction(
  event: FeedbackEvent,
  recognitionLang: string,
): SpeechInstruction | null {
  if (event.kind !== 'incorrect' || !event.targetWord) {
    return null;
  }

  return {
    text: event.targetWord,
    lang: getSpeechLang(recognitionLang),
  };
}
