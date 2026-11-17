export interface AiProvider {
  generate(prompt: string, signal?: AbortSignal): Promise<string>;
}

export class ProviderTimeoutError extends Error {
  constructor() {
    super('provider timed out');
  }
}

/**
 * Calls the provider and gives up after timeoutMs.
 * The signal lets a well-behaved provider stop its own work; the race guarantees
 * we stop waiting even if the provider ignores the signal.
 */
export async function generateWithTimeout(
  provider: AiProvider,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ProviderTimeoutError();
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([provider.generate(prompt, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
