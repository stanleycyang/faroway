import { captureTripAccount } from './tripAccountScope';
import { shareTrip, revokeTripShare } from '../services/api';

export async function shareOwnedTrip(id: string) {
  const account = captureTripAccount();
  const headers = await account.headers();
  account.assertCurrent();
  const result = await shareTrip(id, headers.Authorization.slice('Bearer '.length));
  account.assertCurrent();
  if (result.error) throw new Error(result.error);
  const data = result.data;
  if (
    !data ||
    typeof data.shareUrl !== 'string' ||
    typeof data.shareToken !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(data.shareToken)
  )
    throw new Error(
      'Public link creation could not be confirmed. Check your saved trip before retrying.'
    );
  const url = new URL(data.shareUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== `/s/${data.shareToken}` ||
    url.search ||
    url.hash
  )
    throw new Error('Public link creation could not be confirmed.');
  return url.href;
}

export async function revokeOwnedTripShare(id: string) {
  const account = captureTripAccount();
  const headers = await account.headers();
  account.assertCurrent();
  const result = await revokeTripShare(id, headers.Authorization.slice('Bearer '.length));
  account.assertCurrent();
  if (result.error || result.data?.success !== true)
    throw new Error(
      result.error ||
        'Public access could not be confirmed off. Check your saved trip and try again.'
    );
}
