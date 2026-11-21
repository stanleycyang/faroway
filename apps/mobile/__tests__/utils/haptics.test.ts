jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

import * as Haptics from 'expo-haptics';
import { hapticFeedback } from '../../utils/haptics';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('hapticFeedback', () => {
  it('light calls impactAsync with Light style', () => {
    hapticFeedback.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
  });

  it('medium calls impactAsync with Medium style', () => {
    hapticFeedback.medium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
  });

  it('heavy calls impactAsync with Heavy style', () => {
    hapticFeedback.heavy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Heavy');
  });

  it('success calls notificationAsync with Success type', () => {
    hapticFeedback.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
  });

  it('warning calls notificationAsync with Warning type', () => {
    hapticFeedback.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Warning');
  });

  it('error calls notificationAsync with Error type', () => {
    hapticFeedback.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Error');
  });

  it('selection calls selectionAsync', () => {
    hapticFeedback.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('swallows rejected native haptic promises without unhandled rejections', async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('Unsupported device'));
    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Sync native failure');
    });

    expect(() => hapticFeedback.light()).not.toThrow();
    expect(() => hapticFeedback.selection()).not.toThrow();
    await Promise.resolve();
  });
});
