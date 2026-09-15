/**********************************************************************
 * Copyright (C) 2024-2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import createClient from 'openapi-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AccountManagementV1, API_ACCOUNTS_MGMT_V1, BASE_URL } from './rhaccm-client';

const mockPost = vi.fn();
const mockUse = vi.fn();

vi.mock(import('openapi-fetch'), () => ({
  default: vi.fn(() => ({
    POST: mockPost,
    use: mockUse,
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AccountManagementV1', () => {
  test('constructor creates client with correct base URL and auth middleware', () => {
    const token = 'my-test-token';
    const client = new AccountManagementV1(token);

    expect(client).toBeDefined();
    expect(createClient).toHaveBeenCalledWith({ baseUrl: BASE_URL });
    expect(mockUse).toHaveBeenCalledWith(expect.objectContaining({ onRequest: expect.any(Function) }));
  });

  test('auth middleware sets Authorization header on requests', () => {
    const token = 'my-test-token';
    const client = new AccountManagementV1(token);

    expect(client).toBeDefined();
    const middlewareArg = mockUse.mock.calls[0][0];
    const mockRequest = new Request('https://example.com');
    const result = middlewareArg.onRequest({ request: mockRequest });

    expect(result.headers.get('Authorization')).toBe('Bearer my-test-token');
  });

  describe('getAccessToken', () => {
    test('returns username and password on success', async () => {
      const authValue = btoa('testuser:testpass');
      mockPost.mockResolvedValue({
        data: {
          auths: {
            'registry.redhat.io': {
              auth: authValue,
              email: 'test@example.com',
            },
          },
        },
        error: undefined,
      });

      const client = new AccountManagementV1('token');
      const result = await client.getAccessToken();

      expect(mockPost).toHaveBeenCalledWith(`${API_ACCOUNTS_MGMT_V1}/access_token`);
      expect(result).toEqual({ username: 'testuser', password: 'testpass' });
    });

    test('throws error with reason when API returns an error', async () => {
      mockPost.mockResolvedValue({
        data: undefined,
        error: { reason: 'Unauthorized access' },
      });

      const client = new AccountManagementV1('bad-token');
      await expect(client.getAccessToken()).rejects.toThrow('Unauthorized access');
    });

    test('throws generic error when API returns error without reason', async () => {
      mockPost.mockResolvedValue({
        data: undefined,
        error: {},
      });

      const client = new AccountManagementV1('bad-token');
      await expect(client.getAccessToken()).rejects.toThrow('Failed to obtain pull secret');
    });

    test('throws error when data is undefined', async () => {
      mockPost.mockResolvedValue({
        data: undefined,
        error: undefined,
      });

      const client = new AccountManagementV1('token');
      await expect(client.getAccessToken()).rejects.toThrow('Failed to obtain pull secret');
    });

    test('throws error when registry.redhat.io is missing from auths', async () => {
      mockPost.mockResolvedValue({
        data: {
          auths: {
            'other.registry.io': { auth: btoa('user:pass') },
          },
        },
        error: undefined,
      });

      const client = new AccountManagementV1('token');
      await expect(client.getAccessToken()).rejects.toThrow('Failed to obtain auth token for registry.redhat.io');
    });

    test('throws error when auths is empty', async () => {
      mockPost.mockResolvedValue({
        data: {
          auths: {},
        },
        error: undefined,
      });

      const client = new AccountManagementV1('token');
      await expect(client.getAccessToken()).rejects.toThrow('Failed to obtain auth token for registry.redhat.io');
    });

    test.each([
      {
        scenario: 'no password in auth token',
        authValue: btoa('usernameonly'),
        expectedError: 'Failed to obtain usename and password for registry.redhat.io',
      },
      {
        scenario: 'empty auth token string',
        authValue: btoa(''),
        expectedError: 'Failed to obtain auth token for registry.redhat.io',
      },
      {
        scenario: 'colon but empty username',
        authValue: btoa(':password'),
        expectedError: 'Failed to obtain usename and password for registry.redhat.io',
      },
    ])('throws error when decoded auth token has $scenario', async ({ authValue, expectedError }) => {
      mockPost.mockResolvedValue({
        data: {
          auths: {
            'registry.redhat.io': {
              auth: authValue,
            },
          },
        },
        error: undefined,
      });

      const client = new AccountManagementV1('token');
      await expect(client.getAccessToken()).rejects.toThrow(expectedError);
    });
  });
});
