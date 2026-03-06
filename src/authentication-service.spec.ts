/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
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
/* eslint-disable sonarjs/no-nested-functions */

import type { ExtensionContext } from '@podman-desktop/api';
import { authentication, window } from '@podman-desktop/api';
import type { BaseClient, TokenSet } from 'openid-client';
import { Issuer } from 'openid-client';
import { beforeEach, expect, test, vi } from 'vitest';

import { convertToSession, RedHatAuthenticationService } from './authentication-service';
import { getAuthConfig } from './configuration';

vi.mock('@podman-desktop/api');

beforeEach(() => {
  vi.restoreAllMocks();
});

test('An authentication token is converted to a session', () => {
  const token = {
    account: {
      id: 'accountId',
      label: 'accountLabel',
    },
    scope: 'openid',
    sessionId: 'sessionId',
    refreshToken: 'refreshToken',
    accessToken: 'accessToken',
    idToken: 'idToken',
    expiresAt: Date.now() + 777777777,
    expiresIn: 777777,
  };
  const session = convertToSession(token);
  expect(session.id).equals(token.sessionId);
  expect(session.accessToken).equals(token.accessToken);
  expect(session.idToken).equals(token.idToken);
  expect(session.account).equals(token.account);
  expect(session.scopes).contain('openid');
});

test('Authentication service loads tokens form secret storage during initialization', async () => {
  vi.spyOn(Issuer, 'discover').mockImplementation(async () => {
    return {
      Client: vi.fn().mockImplementation(() => {
        return {
          refresh: vi.fn().mockImplementation((): TokenSet => {
            return {
              claims: vi.fn().mockImplementation(() => {
                return {
                  sub: 'subscriptionId',
                  preferred_username: 'username',
                };
              }),
              expired: vi.fn().mockImplementation(() => false),
              expires_in: 15 * 60, // in seconds
              id_token: 'id_token_string',
              access_token: 'access_token_string',
              refresh_token: 'refresh_token_string',
              session_state: 'session_state_string',
            };
          }),
          authorizationUrl: vi.fn().mockImplementation(() => {}),
          callback: vi.fn(),
          callbackParams: vi.fn(),
        };
      }),
    } as unknown as Issuer<BaseClient>;
  });

  vi.mocked(authentication.registerAuthenticationProvider).mockImplementation((_id, _label, _ssoProvider) => {
    return {
      dispose: vi.fn(),
    };
  });
  const extensionContext: ExtensionContext = {
    secrets: {
      get: vi.fn().mockImplementation(() => {
        return JSON.stringify([
          {
            refreshToken: 'refreshTokenString',
            scope: 'openid scope1 scope3 scope4',
            id: 'uniqueId1',
          },
        ]);
      }),
      store: vi.fn(),
      delete: vi.fn(),
      onDidChange: vi.fn(),
    },
    subscriptions: [],
  } as unknown as ExtensionContext;
  const service = await RedHatAuthenticationService.build(extensionContext, getAuthConfig());
  await service.initialize();
  expect(extensionContext.secrets.get).toHaveBeenCalledOnce();
  expect((await service.getSessions(['scope1', 'scope3', 'scope4'])).length).toBe(0);
});

test('Authentication service handles decryption errors gracefully', async () => {
  const decryptionError = new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString');

  vi.mocked(window.showWarningMessage).mockResolvedValue('OK');

  const onDidChangeCallback = vi.fn();
  const extensionContext: ExtensionContext = {
    secrets: {
      get: vi.fn().mockRejectedValue(decryptionError),
      store: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      onDidChange: onDidChangeCallback,
    },
    subscriptions: [],
  } as unknown as ExtensionContext;

  const service = await RedHatAuthenticationService.build(extensionContext, getAuthConfig());
  await service.initialize();

  // Verify secrets.get was called
  expect(extensionContext.secrets.get).toHaveBeenCalledOnce();

  // Verify warning message was shown to user
  expect(window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('could not be restored'), 'OK');

  // Verify corrupted data was deleted
  expect(extensionContext.secrets.delete).toHaveBeenCalledOnce();

  // Verify onDidChange listener was still registered
  expect(onDidChangeCallback).toHaveBeenCalledOnce();

  // Verify no sessions exist after error
  expect((await service.getSessions()).length).toBe(0);
});

test('Authentication service registers onDidChange listener even when no stored data exists', async () => {
  const onDidChangeCallback = vi.fn();
  const extensionContext: ExtensionContext = {
    secrets: {
      get: vi.fn().mockResolvedValue(undefined),
      store: vi.fn(),
      delete: vi.fn(),
      onDidChange: onDidChangeCallback,
    },
    subscriptions: [],
  } as unknown as ExtensionContext;

  const service = await RedHatAuthenticationService.build(extensionContext, getAuthConfig());
  await service.initialize();

  // Verify secrets.get was called
  expect(extensionContext.secrets.get).toHaveBeenCalledOnce();

  // Verify onDidChange listener was registered even with no stored data
  expect(onDidChangeCallback).toHaveBeenCalledOnce();

  // Verify no sessions exist
  expect((await service.getSessions()).length).toBe(0);
});

test('Authentication service handles delete error during decryption error recovery', async () => {
  const decryptionError = new Error('Error while decrypting the ciphertext');
  const deleteError = new Error('Failed to delete');

  // Clear mock from previous tests
  vi.mocked(window.showWarningMessage).mockClear();
  vi.mocked(window.showWarningMessage).mockResolvedValue('OK');

  const onDidChangeCallback = vi.fn();
  const extensionContext: ExtensionContext = {
    secrets: {
      get: vi.fn().mockRejectedValue(decryptionError),
      store: vi.fn(),
      delete: vi.fn().mockRejectedValue(deleteError),
      onDidChange: onDidChangeCallback,
    },
    subscriptions: [],
  } as unknown as ExtensionContext;

  const service = await RedHatAuthenticationService.build(extensionContext, getAuthConfig());

  // Should not throw even if delete fails
  await expect(service.initialize()).resolves.not.toThrow();

  // Verify warning was still shown
  expect(window.showWarningMessage).toHaveBeenCalledOnce();

  // Verify delete was attempted
  expect(extensionContext.secrets.delete).toHaveBeenCalledOnce();

  // Verify onDidChange listener was still registered
  expect(onDidChangeCallback).toHaveBeenCalledOnce();
});
