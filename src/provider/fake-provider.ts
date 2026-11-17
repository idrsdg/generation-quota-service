import type { AiProvider } from './ai-provider.js';

/**
 * Timer-based wait: the event loop stays free while we wait.
 * On abort the timer is cleared, so abandoned calls leave nothing behind.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class FakeAiProvider implements AiProvider {
  async generate(prompt: string, signal?: AbortSignal): Promise<string> {
    if (prompt.startsWith('timeout')) {
      await sleep(30_000, signal);
    } else if (prompt.startsWith('error')) {
      await sleep(300, signal);
      throw new Error('fake provider failure');
    } else if (prompt.startsWith('slow')) {
      await sleep(2_000, signal);
    } else {
      await sleep(300, signal);
    }
    return `Sonuç: ${prompt}`;
  }
}
