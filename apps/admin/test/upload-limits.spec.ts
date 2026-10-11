import { expect, it } from 'vitest';
import { uploadTooLargeMessage } from '../src/lib/upload-limits';

it('shows the server limit without redirecting large dashboard uploads to Telegram', () => {
  expect(uploadTooLargeMessage(2_000_000_000)).toContain('2000MB');
  expect(uploadTooLargeMessage(50_000_000)).toContain('50MB');
});
