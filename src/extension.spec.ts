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

import type {
  AuthenticationGetSessionOptions,
  AuthenticationSession,
  ExtensionContext,
  ProviderContainerConnection,
} from '@podman-desktop/api';
import { authentication, commands, env, navigation, registry, window } from '@podman-desktop/api';
import { afterEach, beforeEach, describe, expect, suite, test, vi } from 'vitest';

import * as extension from './extension';
import * as podmanCli from './podman-cli';
import { AccountManagementV1 } from './rh-api/rhaccm-client';
import { SubscriptionManagerClient } from './rh-api/subscription';
import { ExtensionTelemetryLogger } from './telemetry';
import * as util from './util';

vi.mock('@podman-desktop/api');
vi.mock(import('./rh-api/rhaccm-client'));
vi.mock(import('./rh-api/subscription'));

function createExtContext(): ExtensionContext {
  return {
    subscriptions: [],
    secrets: {
      delete: vi.fn(),
      get: vi.fn(),
      onDidChange: vi.fn(),
      store: vi.fn(),
    },
  } as unknown as ExtensionContext;
}

const fakeConnection: ProviderContainerConnection = {
  providerId: 'podman',
  connection: {
    name: 'test-machine',
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: '/home/user/.local/share/containers/podman/test.sock',
    },
  },
} as unknown as ProviderContainerConnection;

function createFakeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const fakeSession: AuthenticationSession = {
  id: '1',
  accessToken: createFakeJwt({ organization: { id: 'org-123' } }),
  scopes: ['scope1', 'scope2'],
  account: {
    id: 'accountId',
    label: 'user@redhat.com',
  },
};

type CommandHandler = (...args: any[]) => Promise<any>;
let capturedCommands: Record<string, CommandHandler> = {};
let notificationCallback: (event: any) => Promise<any>;

function setupBasicMocks(options?: {
  sessionAvailable?: boolean;
  registryConfigured?: boolean;
  isLinux?: boolean;
  connection?: ProviderContainerConnection;
}) {
  const {
    sessionAvailable = true,
    registryConfigured = false,
    isLinux = false,
    connection = undefined,
  } = options ?? {};

  vi.spyOn(util, 'isLinux').mockReturnValue(isLinux);
  vi.spyOn(util, 'isRedHatRegistryConfigured').mockReturnValue(registryConfigured);
  vi.spyOn(podmanCli, 'getConnectionForRunningPodmanMachine').mockReturnValue(connection);
  vi.spyOn(ExtensionTelemetryLogger, 'logUsage').mockImplementation(() => {});
  vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {});

  vi.mocked(authentication.onDidChangeSessions).mockImplementation((callback: (event: any) => Promise<any>) => {
    notificationCallback = callback;
    return { dispose: vi.fn() };
  });

  let sessionReturned = false;
  vi.mocked(authentication.getSession).mockImplementation(
    async (
      _p1: string,
      _p2: string[],
      options: AuthenticationGetSessionOptions | undefined,
    ): Promise<AuthenticationSession | undefined> => {
      if (!sessionAvailable) return undefined;
      if (sessionReturned) return fakeSession;
      if (options?.createIfNone) {
        sessionReturned = true;
        await notificationCallback?.({
          provider: { id: 'redhat.authentication-provider' },
        });
        return fakeSession;
      }
      return undefined;
    },
  );

  vi.mocked(commands.registerCommand).mockImplementation((commandId: string, commandFunction: CommandHandler) => {
    capturedCommands[commandId] = commandFunction;
    return { dispose: vi.fn() };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  capturedCommands = {};
});

afterEach(() => {
  extension.deactivate();
});

suite('extension activation', () => {
  test('register commands declared in package.json', async () => {
    await extension.activate(createExtContext());
    expect(commands.registerCommand).toHaveBeenCalledTimes(5);
    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.signin', expect.anything());
    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.navigate.settings', expect.anything());
    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.signout', expect.anything());
    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.signup', expect.anything());
    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.isSignedIn', expect.anything());
    expect(authentication.onDidChangeSessions).toHaveBeenCalled();
  });
});

suite('deactivate', () => {
  test('logs stop message and clears session', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    extension.deactivate();
    expect(consoleSpy).toHaveBeenCalledWith('stopping redhat-authentication extension');
  });
});

suite('signin command telemetry reports', () => {
  test('unsuccessful login when podman machine is not running on windows or darwin', async () => {
    vi.spyOn(util, 'isLinux').mockReturnValue(false);

    const logSpy = vi.spyOn(ExtensionTelemetryLogger, 'logUsage').mockImplementation(() => {
      return;
    });
    let notificationCallback: (event: any) => Promise<any>;
    let session: AuthenticationSession;
    vi.mocked(authentication.onDidChangeSessions).mockImplementation((callback: (event: any) => Promise<any>) => {
      notificationCallback = callback;
      return {
        dispose: vi.fn(),
      };
    });
    vi.mocked(authentication.getSession).mockImplementation(
      async (
        _p1: string,
        _p2: string[],
        options: AuthenticationGetSessionOptions | undefined,
      ): Promise<AuthenticationSession | undefined> => {
        if (session) {
          return Promise.resolve(session);
        }
        if (options?.createIfNone) {
          session = {
            id: '1',
            accessToken: 'token',
            scopes: ['scope1', 'scope2'],
            account: {
              id: 'accountId',
              label: 'label',
            },
          };
          await notificationCallback({
            provider: {
              id: 'redhat.authentication-provider',
            },
          });
        }
      },
    );
    let commandFunctionCopy: () => Promise<void>;
    vi.mocked(commands.registerCommand).mockImplementation(
      (commandId: string, commandFunction: () => Promise<void>) => {
        if (commandId === 'redhat.authentication.signin') {
          commandFunctionCopy = commandFunction;
        }
        return {
          dispose: vi.fn(),
        };
      },
    );
    vi.spyOn(util, 'isRedHatRegistryConfigured').mockResolvedValue(true);
    vi.spyOn(podmanCli, 'getConnectionForRunningPodmanMachine').mockReturnValue(undefined);
    await extension.activate(createExtContext());
    expect(commandFunctionCopy!).toBeDefined();
    await commandFunctionCopy!();
    expect(authentication.onDidChangeSessions).toHaveBeenCalled();
    expect(logSpy).calledWith('signin', {
      successful: false,
      error: 'Error: No running podman',
      errorIn: 'subscription-activation',
    });
  });

  test('unsuccessful login shows Linux-specific message on Linux', async () => {
    setupBasicMocks({ isLinux: true, connection: undefined, registryConfigured: true });

    await extension.activate(createExtContext());
    expect(capturedCommands['redhat.authentication.signin']).toBeDefined();
    await capturedCommands['redhat.authentication.signin']();

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('not supported on a Linux host'),
    );
  });

  test('successful sign-in configures registry when not already configured', async () => {
    const mockGetAccessToken = vi.fn().mockResolvedValue({
      username: 'svc-user',
      password: 'svc-pass',
    });
    vi.mocked(AccountManagementV1).mockImplementation(function () {
      return { getAccessToken: mockGetAccessToken } as any;
    });

    setupBasicMocks({ registryConfigured: false, connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(0);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(0);

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(mockGetAccessToken).toHaveBeenCalled();
    expect(registry.registerRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: 'registry.redhat.io',
        username: 'svc-user',
        secret: 'svc-pass',
      }),
    );
  });

  test('skips registry configuration when already configured', async () => {
    setupBasicMocks({ registryConfigured: true, connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(0);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(0);

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(AccountManagementV1).not.toHaveBeenCalled();
  });

  test('installs subscription manager and restarts machine when not installed', async () => {
    setupBasicMocks({ registryConfigured: true, connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(1);
    vi.spyOn(podmanCli, 'runRpmInstallSubscriptionManager').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runStopPodmanMachine').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runStartPodmanMachine').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(0);

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(podmanCli.runRpmInstallSubscriptionManager).toHaveBeenCalledWith(fakeConnection);
    expect(podmanCli.runStopPodmanMachine).toHaveBeenCalledWith(fakeConnection);
    expect(podmanCli.runStartPodmanMachine).toHaveBeenCalledWith(fakeConnection);
  });

  test('creates activation key when subscription is not activated', async () => {
    setupBasicMocks({ registryConfigured: true, connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(0);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(1);
    vi.spyOn(podmanCli, 'runCreateFactsFile').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runSubscriptionManagerRegister').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runSubscriptionManagerUnregister').mockResolvedValue(undefined);

    const mockShowActivationKey = vi.fn().mockResolvedValue({ error: { message: 'not found' } });
    const mockCreateActivationKeys = vi.fn().mockResolvedValue({ error: undefined });
    vi.mocked(SubscriptionManagerClient).mockImplementation(function () {
      return {
        activationKey: {
          showActivationKey: mockShowActivationKey,
          createActivationKeys: mockCreateActivationKeys,
        },
      } as any;
    });

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(podmanCli.runCreateFactsFile).toHaveBeenCalledWith(fakeConnection, expect.stringContaining('aarch64'));
    expect(mockCreateActivationKeys).toHaveBeenCalledWith(expect.objectContaining({ name: 'podman-desktop' }));
    expect(podmanCli.runSubscriptionManagerRegister).toHaveBeenCalledWith(fakeConnection, 'podman-desktop', 'org-123');
  });

  test('reuses existing activation key when show succeeds', async () => {
    setupBasicMocks({ registryConfigured: true, connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(0);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(1);
    vi.spyOn(podmanCli, 'runCreateFactsFile').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runSubscriptionManagerRegister').mockResolvedValue(undefined);
    vi.spyOn(podmanCli, 'runSubscriptionManagerUnregister').mockResolvedValue(undefined);

    const mockShowActivationKey = vi.fn().mockResolvedValue({ error: undefined });
    const mockCreateActivationKeys = vi.fn();
    vi.mocked(SubscriptionManagerClient).mockImplementation(function () {
      return {
        activationKey: {
          showActivationKey: mockShowActivationKey,
          createActivationKeys: mockCreateActivationKeys,
        },
      } as any;
    });

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(mockCreateActivationKeys).not.toHaveBeenCalled();
    expect(podmanCli.runSubscriptionManagerRegister).toHaveBeenCalled();
  });

  test('reports sign-in telemetry error when signIntoRedHatDeveloperAccount throws', async () => {
    setupBasicMocks({ sessionAvailable: false });
    vi.mocked(authentication.getSession).mockRejectedValue(new Error('SSO failure'));

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();

    expect(ExtensionTelemetryLogger.logUsage).toHaveBeenCalledWith(
      'signin',
      expect.objectContaining({
        errorIn: 'sign-in',
        error: expect.stringContaining('SSO failure'),
      }),
    );
  });
});

describe('signout command', () => {
  test('fires session removed event and sends telemetry', async () => {
    setupBasicMocks({ connection: fakeConnection });
    vi.spyOn(podmanCli, 'runSubscriptionManager').mockResolvedValue(0);
    vi.spyOn(podmanCli, 'runSubscriptionManagerActivationStatus').mockResolvedValue(0);
    vi.spyOn(util, 'isRedHatRegistryConfigured').mockReturnValue(true);

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signin']();
    await capturedCommands['redhat.authentication.signout']();

    expect(ExtensionTelemetryLogger.logUsage).toHaveBeenCalledWith('signout');
  });
});

describe('signup command', () => {
  test('opens Red Hat developer sign-up page', async () => {
    setupBasicMocks();

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.signup']();

    expect(env.openExternal).toHaveBeenCalled();
  });
});

describe('isSignedIn command', () => {
  test('sets signedInToSSO context when sessions exist', async () => {
    setupBasicMocks();

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.isSignedIn']();

    expect(commands.registerCommand).toHaveBeenCalledWith('redhat.authentication.isSignedIn', expect.anything());
  });
});

describe('navigate to settings command', () => {
  test('calls navigateToAuthentication', async () => {
    setupBasicMocks();

    await extension.activate(createExtContext());
    await capturedCommands['redhat.authentication.navigate.settings']();

    expect(navigation.navigateToAuthentication).toHaveBeenCalled();
  });
});
