export type ToolConnection = {
  checked: boolean;
  available: boolean;
  registered: number;
  failed: number;
  errors: string[];
};

export type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

export type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
};

type Scheduler = {
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

type RegistrationOptions = {
  tools: WebMcpTool[];
  getModelContext: () => ModelContext | undefined;
  createAbortController: () => AbortController;
  onConnection: (connection: ToolConnection) => void;
  retryIntervalMs?: number;
  timeoutMs?: number;
  scheduler?: Scheduler;
};

const MAX_RECORDED_ERRORS = 4;
const MAX_ERROR_NAME_LENGTH = 48;
const MAX_ERROR_MESSAGE_LENGTH = 180;

const defaultScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
};

function boundedError(reason: unknown) {
  const candidate = reason as { name?: unknown; message?: unknown } | null;
  const rawName = typeof candidate?.name === 'string' ? candidate.name : 'Error';
  const rawMessage =
    typeof candidate?.message === 'string'
      ? candidate.message
      : typeof reason === 'string'
        ? reason
        : 'Tool registration was rejected.';
  const name = rawName.slice(0, MAX_ERROR_NAME_LENGTH);
  const message = rawMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return `${name}: ${message}`;
}

/**
 * Starts provider discovery immediately, retries for a bounded period, and only
 * reports tools as registered after every registerTool promise has settled.
 */
export function registerWebMcpTools({
  tools,
  getModelContext,
  createAbortController,
  onConnection,
  retryIntervalMs = 500,
  timeoutMs = 10_000,
  scheduler = defaultScheduler,
}: RegistrationOptions) {
  const controller = createAbortController();
  const startedAt = scheduler.now();
  let retryHandle: unknown;
  let stopped = false;
  let registrationStarted = false;
  let sawIncompleteProvider = false;

  const reportUnavailable = () => {
    if (stopped || controller.signal.aborted) return;
    onConnection({
      checked: true,
      available: false,
      registered: 0,
      failed: 0,
      errors: sawIncompleteProvider
        ? ['TypeError: document.modelContext.registerTool is not a function.']
        : [],
    });
  };

  const scheduleRetry = () => {
    const elapsed = scheduler.now() - startedAt;
    if (elapsed >= timeoutMs) {
      reportUnavailable();
      return;
    }
    retryHandle = scheduler.setTimeout(tryProvider, Math.min(retryIntervalMs, timeoutMs - elapsed));
  };

  const register = (modelContext: ModelContext) => {
    registrationStarted = true;
    onConnection({
      checked: true,
      available: true,
      registered: 0,
      failed: 0,
      errors: [],
    });

    // Deliberately call every tool synchronously before observing the promises.
    // A synchronous throw becomes one rejected result rather than aborting the map.
    const registrations = tools.map((tool) => {
      try {
        return Promise.resolve(
          modelContext.registerTool(tool, { signal: controller.signal }),
        );
      } catch (error) {
        return Promise.reject(error);
      }
    });

    void Promise.allSettled(registrations).then((results) => {
      if (stopped || controller.signal.aborted) return;
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      onConnection({
        checked: true,
        available: true,
        registered: results.length - rejected.length,
        failed: rejected.length,
        errors: rejected.slice(0, MAX_RECORDED_ERRORS).map((result) => boundedError(result.reason)),
      });
    });
  };

  function tryProvider() {
    if (stopped || controller.signal.aborted || registrationStarted) return;

    let modelContext: ModelContext | undefined;
    try {
      modelContext = getModelContext();
    } catch {
      modelContext = undefined;
    }

    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      sawIncompleteProvider ||= Boolean(modelContext);
      scheduleRetry();
      return;
    }

    register(modelContext);
  }

  onConnection({
    checked: false,
    available: false,
    registered: 0,
    failed: 0,
    errors: [],
  });
  tryProvider();

  return () => {
    if (stopped) return;
    stopped = true;
    if (retryHandle !== undefined) scheduler.clearTimeout(retryHandle);
    controller.abort();
  };
}
