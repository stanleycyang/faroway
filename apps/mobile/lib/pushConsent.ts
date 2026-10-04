export interface PushIdentity {
  id: string;
  accessToken: string;
}
export interface PushConsentRecord {
  userId: string;
  token: string;
  enabled: boolean;
}
export interface PushConsentDependencies {
  identity: () => Promise<PushIdentity | null>;
  read: () => Promise<PushConsentRecord | null>;
  write: (record: PushConsentRecord | null) => Promise<void>;
  acquire: (
    prompt: boolean
  ) => Promise<{ token: string | null; error?: string; permissionDenied?: boolean }>;
  send: (method: 'POST' | 'DELETE', token: string, identity: PushIdentity) => Promise<void>;
}

/** Serializes permission/registration/removal so late registration cannot undo opt-out. */
export class PushConsent {
  private queue: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  constructor(private deps: PushConsentDependencies) {}
  invalidate() {
    this.epoch++;
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  private async owner() {
    const epoch = this.epoch;
    const owner = await this.deps.identity();
    if (!owner) throw new Error('Sign in to manage device notifications.');
    return { ...owner, epoch };
  }
  private async assertOwner(owner: PushIdentity & { epoch?: number }) {
    const identity = await this.deps.identity();
    if (identity?.id !== owner.id || (owner.epoch !== undefined && owner.epoch !== this.epoch))
      throw new Error('Your account changed. Try again from notification settings.');
  }
  private async recordFor(owner: PushIdentity) {
    const record = await this.deps.read();
    if (record && record.userId !== owner.id)
      throw new Error(
        'This device still has a pending notification registration for another account. Sign in to that account and turn off device notifications first.'
      );
    return record;
  }
  private async remove(record: PushConsentRecord, owner: PushIdentity) {
    // Persist intent before network I/O; an interrupted removal is retried, never
    // interpreted as permission to re-register on restoration.
    await this.deps.write({ ...record, enabled: false });
    await this.deps.send('DELETE', record.token, owner);
    await this.deps.write(null);
  }
  enable() {
    return this.run(async () => {
      const owner = await this.owner();
      const previous = await this.recordFor(owner);
      if (previous && !previous.enabled) await this.remove(previous, owner);
      const result = await this.deps.acquire(true); // Only called by the Settings button.
      await this.assertOwner(owner);
      if (!result.token)
        throw new Error(
          result.error ||
            'Notification permission was not granted. You can change it in device Settings.'
        );
      if (previous && previous.token !== result.token) await this.remove(previous, owner);
      const record = { userId: owner.id, token: result.token, enabled: false };
      await this.deps.write(record);
      await this.assertOwner(owner);
      await this.deps.send('POST', result.token, owner);
      try {
        await this.assertOwner(owner);
      } catch (error) {
        await this.remove(record, owner);
        throw error;
      }
      await this.deps.write({ ...record, enabled: true });
      return true;
    });
  }
  restore() {
    return this.run(async () => {
      if (!(await this.deps.identity())) return false;
      const owner = await this.owner();
      const record = await this.recordFor(owner);
      if (!record) return false; // Authentication/restoration is never opt-in.
      if (!record.enabled) {
        await this.remove(record, owner);
        return false;
      }
      const result = await this.deps.acquire(false);
      await this.assertOwner(owner);
      if (!result.token) {
        if (result.error && !result.permissionDenied) throw new Error(result.error);
        await this.remove(record, owner);
        return false;
      }
      if (result.token !== record.token) {
        await this.remove(record, owner);
        const next = { userId: owner.id, token: result.token, enabled: false };
        await this.deps.write(next);
        await this.assertOwner(owner);
        await this.deps.send('POST', next.token, owner);
        try {
          await this.assertOwner(owner);
        } catch (error) {
          await this.remove(next, owner);
          throw error;
        }
        await this.deps.write({ ...next, enabled: true });
      }
      return true;
    });
  }
  disable() {
    return this.run(async () => {
      let record = await this.deps.read();
      if (!record) {
        // Recover registrations created by older builds, without an OS prompt.
        if (!(await this.deps.identity())) return false;
        const owner = await this.owner();
        const previous = await this.deps.acquire(false);
        await this.assertOwner(owner);
        if (!previous.token) {
          if (previous.error && !previous.permissionDenied) throw new Error(previous.error);
          return false;
        }
        record = { userId: owner.id, token: previous.token, enabled: false };
      }
      const owner = await this.owner();
      await this.recordFor(owner);
      await this.remove(record, owner);
      return false;
    });
  }
  forgetDeletedAccount(userId: string) {
    return this.run(async () => {
      const record = await this.deps.read();
      if (record?.userId === userId) await this.deps.write(null);
    });
  }
}
