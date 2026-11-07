export type VoiceConnection<K> = { key: K; disconnect: () => Promise<void>; remove: () => Promise<void>; failure?: unknown };

/** A stale connection must be fully removed before the same identity can join again. */
export class VoiceSession<K> {
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private active: VoiceConnection<K> | null = null;

  constructor(private join: (key: K, current: () => boolean) => Promise<VoiceConnection<K>>) {}

  switchTo(key: K | null, report: (key: K | null, error?: unknown) => void): Promise<void> {
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    const task = async () => {
      try {
        if (this.active) {
          await this.active.disconnect();
          // Retain active on failure: a retry must confirm server removal before any join.
          await this.active.remove();
          this.active = null;
        }
        if (!current()) return;
        report(null);
        if (key === null) return;
        this.active = await this.join(key, current);
        if (this.active.failure) throw this.active.failure;
        if (!current()) {
          await this.active.disconnect();
          await this.active.remove();
          this.active = null;
          return;
        }
        report(key);
      } catch (error) {
        if (current()) report(null, error);
      }
    };
    this.queue = this.queue.then(task, task);
    return this.queue;
  }
}