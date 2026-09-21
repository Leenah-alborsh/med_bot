import { describe, expect, it } from 'vitest';
import { redactHeaders } from '../src/common/request-logging.middleware.js';

describe('request logging', () => {
  it('redacts authentication and CSRF headers', () => {
    expect(
      redactHeaders({
        authorization: 'Bearer secret',
        cookie: 'session=secret',
        'x-api-key': 'secret',
        'x-csrf-token': 'secret',
        'user-agent': 'test',
      }),
    ).toEqual({
      authorization: '[redacted]',
      cookie: '[redacted]',
      'x-api-key': '[redacted]',
      'x-csrf-token': '[redacted]',
      'user-agent': 'test',
    });
  });
});
