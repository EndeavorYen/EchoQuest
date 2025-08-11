// All code comments must be English per user requirement

export class SpeechController {
  constructor({ onResult, getLocale }) {
    this.onResult = onResult;
    this.getLocale = getLocale;
    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  }

  isSupported() {
    const hasApi = !!this.Recognition;
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return hasApi && isSecure;
  }

  listenOnce() {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) return reject(new Error('Web Speech API not supported'));
      const recognition = new this.Recognition();
      recognition.lang = this.getLocale?.() || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let resolved = false;
      recognition.onresult = (event) => {
        const text = String(event.results[0][0].transcript || '').trim().toLowerCase();
        this.onResult?.(text);
        if (!resolved) {
          resolved = true;
          resolve(text);
        }
      };
      recognition.onerror = (e) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(e.error || 'speech error'));
        }
      };
      recognition.onend = () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('no speech'));
        }
      };

      try {
        recognition.start();
      } catch (e) {
        reject(e);
      }
    });
  }
}


