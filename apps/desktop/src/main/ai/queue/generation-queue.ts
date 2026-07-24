import {
  isGenerationQueueWindowOpen,
  minutesUntilGenerationQueueWindow,
  type GenerationQueueSettings,
} from "@mangai/ai-core";

type Timer = ReturnType<typeof setTimeout>;

export type GenerationQueueDependencies = {
  getSettings: () => GenerationQueueSettings;
  run: () => void | Promise<unknown>;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

class GenerationQueue {
  private timer: Timer | undefined;
  private readonly now: () => Date;
  private readonly setTimer: (callback: () => void, delayMs: number) => Timer;
  private readonly clearTimer: (timer: Timer) => void;

  constructor(private readonly dependencies: GenerationQueueDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.setTimer = dependencies.setTimer ?? setTimeout;
    this.clearTimer = dependencies.clearTimer ?? clearTimeout;
  }

  windowDelayMs(settings = this.dependencies.getSettings()) {
    const current = this.now();
    const currentMinute = current.getHours() * 60 + current.getMinutes();
    if (isGenerationQueueWindowOpen(settings, currentMinute)) return 0;
    return Math.max(
      10,
      minutesUntilGenerationQueueWindow(settings, currentMinute) * 60_000 -
        current.getSeconds() * 1000 -
        current.getMilliseconds(),
    );
  }

  schedule(delayMs: number) {
    this.cancelScheduledWake();
    this.timer = this.setTimer(
      () => {
        this.timer = undefined;
        void this.dependencies.run();
      },
      Math.max(10, delayMs),
    );
    this.timer.unref?.();
  }

  wakeSoon() {
    queueMicrotask(() => void this.dependencies.run());
  }

  resetAndRun() {
    this.cancelScheduledWake();
    void this.dependencies.run();
  }

  cancelScheduledWake() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = undefined;
  }
}

export class LocalGenerationQueue extends GenerationQueue {}

export class DezgoGenerationQueue extends GenerationQueue {}
