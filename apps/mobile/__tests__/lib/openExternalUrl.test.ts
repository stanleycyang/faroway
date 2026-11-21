jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { isSafeHttpsUrl, openSafeHttpsUrl } from '../../lib/openExternalUrl';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isSafeHttpsUrl', () => {
  it('accepts valid https URLs', () => {
    expect(isSafeHttpsUrl('https://faroway.ai/terms')).toBe(true);
    expect(isSafeHttpsUrl('  https://en.wikipedia.org/wiki/Tokyo?a=1#top  ')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'tel:+15551234567',
    'file:///etc/passwd',
    'mailto:support@faroway.ai',
    'data:text/html,<h1>hi</h1>',
    'http://faroway.ai/terms',
    'https://user:pass@faroway.ai/terms',
    'faroway://trip/123',
    '',
    'not a url',
  ])('rejects unsafe or non-https URL: %s', (url) => {
    expect(isSafeHttpsUrl(url)).toBe(false);
  });
});

describe('openSafeHttpsUrl', () => {
  it('opens valid https URLs with WebBrowser', async () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });
    const opened = await openSafeHttpsUrl('https://faroway.ai/privacy');
    expect(opened).toBe(true);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://faroway.ai/privacy',
      undefined
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('blocks unsafe schemes without calling WebBrowser and alerts user', async () => {
    const opened = await openSafeHttpsUrl('javascript:alert(1)');
    expect(opened).toBe(false);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Unable to open link',
      'This link is not a valid secure web address.'
    );
  });

  it('catches browser errors and surfaces a friendly fallback alert', async () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockRejectedValueOnce(new Error('No browser'));
    const opened = await openSafeHttpsUrl('https://faroway.ai/support', {
      fallbackTitle: 'Could not open support',
      fallbackMessage: 'Please try again later.',
    });
    expect(opened).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Could not open support', 'Please try again later.');
  });
});
