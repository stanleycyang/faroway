import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';

let mockReduceMotion = false;

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { light: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));
jest.mock('../../services/api', () => ({
  isAllowedAffiliateUrl: jest.fn((url: string) => url.startsWith('https://')),
}));
jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion,
}));

import { AffiliateHandoffSheet } from '../../components/trip/AffiliateHandoffSheet';
import type { ConfirmAffiliateOpenParams } from '../../lib/affiliateCheckout';

const sampleParams: ConfirmAffiliateOpenParams = {
  itemType: 'activity',
  itemId: 'act-1',
  itemName: 'Louvre Museum Guided Tour',
  affiliatePartner: 'viator',
  affiliateUrl: 'https://www.viator.com/tours/Paris/Louvre',
  priceLabel: '$65',
  source: 'itinerary',
};

describe('AffiliateHandoffSheet', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockReduceMotion = false;
  });

  it('returns null when params are null or inline mode has visible=false', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <AffiliateHandoffSheet
          visible={true}
          params={null}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });
    expect(tree.toJSON()).toBeNull();

    await act(async () => {
      tree.update(
        <AffiliateHandoffSheet
          visible={false}
          inline={true}
          params={sampleParams}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });
    expect(tree.toJSON()).toBeNull();
    await act(async () => tree.unmount());
  });

  it('renders inline without Modal when inline=true and visible=true', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <AffiliateHandoffSheet
          visible={true}
          inline={true}
          params={sampleParams}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );
    });

    expect(tree.root.findAllByType('Modal' as unknown as React.ComponentType)).toHaveLength(0);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Continue to Viator');
    expect(json).toContain('Louvre Museum Guided Tour');
    expect(json).toContain('Estimated price: $65');
    expect(json).toContain(AFFILIATE_DISCLOSURE_SHORT);

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Continue to Viator' }).props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith(sampleParams);

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Not now' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });

  it('disables Continue and Not now and shows ActivityIndicator while opening=true', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <AffiliateHandoffSheet
          visible={true}
          inline={true}
          opening={true}
          params={sampleParams}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const continueBtn = tree.root.findByProps({ accessibilityLabel: 'Continue to Viator' });
    const notNowBtn = tree.root.findByProps({ accessibilityLabel: 'Not now' });
    expect(continueBtn.props.disabled).toBe(true);
    expect(notNowBtn.props.disabled).toBe(true);
    expect(
      tree.root.findAllByType('ActivityIndicator' as unknown as React.ComponentType)
    ).toHaveLength(1);
    await act(async () => tree.unmount());
  });

  it('uses Modal with animationType="slide" by default and "none" when reduceMotion=true', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <AffiliateHandoffSheet
          visible={true}
          params={sampleParams}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const modalDefault = tree.root.findByType('Modal' as unknown as React.ComponentType);
    expect(modalDefault.props.animationType).toBe('slide');
    expect(modalDefault.props.visible).toBe(true);

    mockReduceMotion = true;
    await act(async () => {
      tree.update(
        <AffiliateHandoffSheet
          visible={true}
          params={sampleParams}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const modalReduced = tree.root.findByType('Modal' as unknown as React.ComponentType);
    expect(modalReduced.props.animationType).toBe('none');
    await act(async () => tree.unmount());
  });
});
