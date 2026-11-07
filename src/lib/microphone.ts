/** Serialize publication requests; an old slow enable must not finish after mute. */
export class MicrophoneController {
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  constructor(private setEnabled: (enabled: boolean) => Promise<unknown>) {}
  set(enabled: boolean): Promise<void> {
    const generation = ++this.generation;
    const task = async () => {
      if (generation !== this.generation && enabled) return;
      await this.setEnabled(enabled);
      if (enabled && generation !== this.generation) await this.setEnabled(false);
    };
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => {});
    return result;
  }
}