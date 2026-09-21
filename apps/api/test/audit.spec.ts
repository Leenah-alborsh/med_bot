import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../src/audit/audit.service.js';

describe('audit redaction', () => {
  it('recursively removes passwords, tokens, cookies and secrets', () => {
    const redacted = redactSecrets({
      password: 'hidden',
      profile: { setupToken: 'hidden', safe: 'kept' },
      values: [{ authorization: 'hidden', count: 2 }],
    });
    expect(redacted).toEqual({
      password: '[redacted]',
      profile: { setupToken: '[redacted]', safe: 'kept' },
      values: [{ authorization: '[redacted]', count: 2 }],
    });
    expect(JSON.stringify(redacted)).not.toContain('hidden');
  });
});
