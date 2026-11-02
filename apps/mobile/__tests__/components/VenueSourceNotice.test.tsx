import React from 'react';
jest.mock('react-native', () => ({
  View: ({ children }: { children: unknown }) =>
    require('react').createElement('div', null, children),
  Text: ({ children }: { children: unknown }) =>
    require('react').createElement('span', null, children),
  TouchableOpacity: ({ children }: { children: unknown }) =>
    require('react').createElement('a', null, children),
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
}));
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { VenueSourceNotice } from '../../components/VenueSourceNotice';
const { renderToStaticMarkup } = require('react-dom/server');
const source = { url: 'https://restaurant.example/', retrievedOn: '2026-11-02' };
it('shows attribution and uncertainty without a booking claim', () => {
  const html = renderToStaticMarkup(<VenueSourceNotice source={source} />);
  expect(html).toContain('View source');
  expect(html).toContain('Retrieved 2026-11-02');
  expect(html).toContain('Confirm opening hours and availability');
  expect(html).not.toContain('verified');
  expect(VenueSourceNotice({ source: { ...source, url: 'javascript:alert(1)' } })).toBeNull();
  expect(VenueSourceNotice({ source: { ...source, retrievedOn: '2026-02-30' } })).toBeNull();
});
it('opens only on tap and reports an opening failure', async () => {
  jest.clearAllMocks();
  const view = VenueSourceNotice({ source })!;
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  await view.props.children[0].props.onPress();
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(source.url);
  (WebBrowser.openBrowserAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await view.props.children[0].props.onPress();
  expect(Alert.alert).toHaveBeenCalledWith('Could not open source', expect.any(String));
});
