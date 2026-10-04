import { PushConsent, type PushConsentRecord, type PushIdentity } from '../../lib/pushConsent';

let record: PushConsentRecord | null;
let account: PushIdentity | null;
let manager: PushConsent;
const acquire = jest.fn();
const send = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  record = null;
  account = { id: 'a', accessToken: 'a-session' };
  acquire.mockResolvedValue({ token: 'ExpoPushToken[device]' });
  send.mockResolvedValue(undefined);
  manager = new PushConsent({
    identity: async () => account,
    read: async () => record,
    write: async (next) => {
      record = next;
    },
    acquire,
    send,
  });
});

it('never prompts or registers after sign-in or fresh session restoration', async () => {
  expect(await manager.restore()).toBe(false);
  expect(acquire).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it('only explicit enable may prompt, and a restored grant only checks existing permission', async () => {
  expect(await manager.enable()).toBe(true);
  expect(acquire).toHaveBeenCalledWith(true);
  expect(record).toEqual({ userId: 'a', token: 'ExpoPushToken[device]', enabled: true });
  expect(send).toHaveBeenCalledWith(
    'POST',
    'ExpoPushToken[device]',
    expect.objectContaining({ id: 'a', accessToken: 'a-session' })
  );
  acquire.mockClear();
  send.mockClear();
  expect(await manager.restore()).toBe(true);
  expect(acquire).toHaveBeenCalledWith(false);
  expect(send).not.toHaveBeenCalled();
});

it('does not register when permission is declined and allows a deliberate retry', async () => {
  acquire.mockResolvedValueOnce({ token: null, error: 'Permission denied' });
  await expect(manager.enable()).rejects.toThrow('Permission denied');
  expect(record).toBeNull();
  expect(send).not.toHaveBeenCalled();
  await expect(manager.enable()).resolves.toBe(true);
});

it('does not reuse permission granted during an account switch', async () => {
  acquire.mockImplementationOnce(async () => {
    account = { id: 'b', accessToken: 'b-session' };
    return { token: 'ExpoPushToken[device]' };
  });
  await expect(manager.enable()).rejects.toThrow('account changed');
  expect(send).not.toHaveBeenCalled();
  expect(record).toBeNull();
});

it('invalidates a pending prompt across logout and sign-in to the same account', async () => {
  acquire.mockImplementationOnce(async () => {
    manager.invalidate();
    return { token: 'ExpoPushToken[device]' };
  });
  await expect(manager.enable()).rejects.toThrow('account changed');
  expect(send).not.toHaveBeenCalled();
});

it('does not transfer a restored device record to another account', async () => {
  await manager.enable();
  account = { id: 'b', accessToken: 'b-session' };
  acquire.mockClear();
  send.mockClear();
  await expect(manager.restore()).rejects.toThrow('another account');
  await expect(manager.enable()).rejects.toThrow('another account');
  expect(acquire).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it('cleans up a late registration using its original account, never the replacement session', async () => {
  send.mockImplementationOnce(async () => {
    account = { id: 'b', accessToken: 'b-session' };
  });
  await expect(manager.enable()).rejects.toThrow('account changed');
  expect(send.mock.calls[1]).toEqual([
    'DELETE',
    'ExpoPushToken[device]',
    expect.objectContaining({ id: 'a', accessToken: 'a-session' }),
  ]);
  expect(record).toBeNull();
});

it('keeps failed registration pending cleanup rather than granting consent', async () => {
  send.mockRejectedValueOnce(new Error('offline'));
  await expect(manager.enable()).rejects.toThrow('offline');
  expect(record?.enabled).toBe(false);
  await expect(manager.restore()).resolves.toBe(false);
  expect(send.mock.calls.map(([method]) => method)).toEqual(['POST', 'DELETE']);
  expect(record).toBeNull();
});

it('records offline opt-out and retries removal without prompting or re-registering', async () => {
  await manager.enable();
  acquire.mockClear();
  send.mockClear();
  send.mockRejectedValueOnce(new Error('offline'));
  await expect(manager.disable()).rejects.toThrow('offline');
  expect(record?.enabled).toBe(false);
  await manager.restore();
  expect(acquire).not.toHaveBeenCalled();
  expect(send.mock.calls.map(([method]) => method)).toEqual(['DELETE', 'DELETE']);
  expect(record).toBeNull();
});

it('removes the token when system permission is revoked, without asking again', async () => {
  await manager.enable();
  acquire.mockResolvedValueOnce({ token: null, error: 'denied', permissionDenied: true });
  send.mockClear();
  await expect(manager.restore()).resolves.toBe(false);
  expect(acquire).toHaveBeenLastCalledWith(false);
  expect(send).toHaveBeenCalledWith(
    'DELETE',
    'ExpoPushToken[device]',
    expect.objectContaining({ id: 'a' })
  );
});

it('serializes opt-out after a late registration so removal wins', async () => {
  let finish!: () => void;
  send.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const enabling = manager.enable();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const disabling = manager.disable();
  finish();
  await enabling;
  await disabling;
  expect(send.mock.calls.map(([method]) => method)).toEqual(['POST', 'DELETE']);
  expect(record).toBeNull();
});

it('removes old-build tokens without prompting before logout/account switching', async () => {
  await manager.disable();
  expect(acquire).toHaveBeenCalledWith(false);
  expect(send).toHaveBeenCalledWith(
    'DELETE',
    'ExpoPushToken[device]',
    expect.objectContaining({ id: 'a' })
  );
});

it('clears only the confirmed deleted account record', async () => {
  await manager.enable();
  await manager.forgetDeletedAccount('b');
  expect(record).not.toBeNull();
  await manager.forgetDeletedAccount('a');
  expect(record).toBeNull();
});

it('keeps an existing grant on a transient token lookup failure without registering or prompting', async () => {
  await manager.enable();
  send.mockClear();
  acquire.mockResolvedValueOnce({ token: null, error: 'offline lookup' });
  await expect(manager.restore()).rejects.toThrow('offline lookup');
  expect(record?.enabled).toBe(true);
  expect(send).not.toHaveBeenCalled();
  expect(acquire).toHaveBeenLastCalledWith(false);
});

it('does not claim old-build logout cleanup succeeded when token lookup is offline', async () => {
  acquire.mockResolvedValueOnce({ token: null, error: 'offline lookup' });
  await expect(manager.disable()).rejects.toThrow('offline lookup');
  expect(send).not.toHaveBeenCalled();
});

it('never replaces the owner after legacy token discovery', async () => {
  let checks = 0;
  const original = { id: 'a', accessToken: 'a-session' };
  const switched = { id: 'b', accessToken: 'b-session' };
  manager = new PushConsent({
    identity: async () => (++checks <= 3 ? original : switched),
    read: async () => null,
    write: async () => {},
    acquire,
    send,
  });
  await expect(manager.disable()).rejects.toThrow('account changed');
  expect(send).not.toHaveBeenCalled();
});

it('rotates a restored token only under its existing account consent', async () => {
  await manager.enable();
  send.mockClear();
  acquire.mockResolvedValueOnce({ token: 'ExpoPushToken[rotated]' });
  await expect(manager.restore()).resolves.toBe(true);
  expect(send.mock.calls.map(([method, token]) => [method, token])).toEqual([
    ['DELETE', 'ExpoPushToken[device]'],
    ['POST', 'ExpoPushToken[rotated]'],
  ]);
  expect(record?.token).toBe('ExpoPushToken[rotated]');
  expect(acquire).toHaveBeenLastCalledWith(false);
});
