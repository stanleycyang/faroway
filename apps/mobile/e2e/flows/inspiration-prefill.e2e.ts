import { by, device, element, expect } from 'detox';
import { e2eIds } from '../testIds';

describe('FlowD_InspirationPrefill', () => {
  it('navigates from inspiration to prefilled create flow', async () => {
    await device.launchApp({
      newInstance: true,
      url: 'faroway://inspiration/beach-getaway',
    });

    await expect(element(by.id(e2eIds.inspiration.screen))).toBeVisible();
    await element(by.id(e2eIds.inspiration.surpriseMeButton)).tap();
    await expect(element(by.id(e2eIds.create.screen))).toBeVisible();
  });
});
