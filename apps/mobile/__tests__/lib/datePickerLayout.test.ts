import { getDatePickerModalHeight } from '../../lib/datePickerLayout';

describe('date picker viewport sizing', () => {
  it.each([300, 420, 539])('stays inside a short %ipx viewport', (viewportHeight) => {
    expect(getDatePickerModalHeight(viewportHeight)).toBeLessThan(viewportHeight);
  });

  it('caps the sheet on tall screens', () => {
    expect(getDatePickerModalHeight(1_200)).toBe(680);
  });
});
