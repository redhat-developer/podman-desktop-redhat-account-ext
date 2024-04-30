/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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

import { beforeEach, afterEach, expect, suite, test, vi } from 'vitest';
import * as extension from './extension';
import {
  AuthenticationGetSessionOptions,
  TelemetryLogger,
  ExtensionContext,
  AuthenticationSession,
  ProgressLocation,
} from '@podman-desktop/api';
import { authentication, commands } from '@podman-desktop/api';
import * as podmanCli from './podman-cli';
import * as subscription from './subscription';
import { ExtensionTelemetryLogger } from './telemetry';
import { OrganizationService } from '@redhat-developer/rhsm-client';

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn().mockImplementation(() => {
      return {
        fire: vi.fn(),
      };
    }),
    registry: {
      suggestRegistry: vi.fn(),
      unregisterRegistry: vi.fn(),
    },
    authentication: {
      registerAuthenticationProvider: vi.fn(),
      getSession: vi.fn(),
      onDidChangeSessions: vi.fn(),
    },
    commands: {
      registerCommand: vi.fn(),
      executeCommand: vi.fn(),
    },
    window: {
      createStatusBarItem: () => ({
        show: vi.fn(),
        iconClass: '',
      }),
      withProgress: (
        options: { location: ProgressLocation; title: string },
        callback: (progress: { report: (m: string) => void }) => void,
      ) => {
        return callback({
          report: (message: string) => {},
        });
      },
      showInformationMessage: vi.fn(),
    },
    env: {
      createTelemetryLogger: vi.fn().mockImplementation(
        () =>
          ({
            logUsage: vi.fn(),
            logError: vi.fn(),
          }) as unknown as TelemetryLogger,
      ),
    },
    StatusBarAlignLeft: 'LEFT',
    ProgressLocation: {
      TASK_WIDGET: 2,
    },
    process: {
      exec: vi.fn(),
    },
    configuration: {
      getConfiguration: () => {
        return {
          get: vi.fn(),
        };
      },
    },
  };
});

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

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  extension.deactivate();
});

suite('extension activation', () => {
  test('register commands declared in package.json', async () => {
    await extension.activate(createExtContext());
    expect(commands.registerCommand).toBeCalledTimes(4);
    expect(commands.registerCommand).toBeCalledWith('redhat.authentication.signin', expect.anything());
    expect(commands.registerCommand).toBeCalledWith('redhat.authentication.navigate.settings', expect.anything());
    expect(commands.registerCommand).toBeCalledWith('redhat.authentication.signout', expect.anything());
    expect(commands.registerCommand).toBeCalledWith('redhat.authentication.signup', expect.anything());
    expect(authentication.onDidChangeSessions).toBeCalled();
  });
});

suite('signin command telemetry reports', () => {
  test('unsuccessful login when podman machine is not running', async () => {
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
        return;
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
    vi.spyOn(subscription, 'isRedHatRegistryConfigured').mockResolvedValue(true);
    vi.spyOn(podmanCli, 'getRunningPodmanMachineName').mockReturnValue(undefined);
    await extension.activate(createExtContext());
    expect(commandFunctionCopy!).toBeDefined();
    await commandFunctionCopy!();
    expect(authentication.onDidChangeSessions).toBeCalled();
    expect(logSpy).toBeCalledWith('signin', {
      successful: false,
      error: 'Error: No running podman',
      errorIn: 'subscription-activation',
    });
  });

  test('unsuccessful login when simple content access is not enabled for account', async () => {
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
        return;
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
    vi.spyOn(subscription, 'isRedHatRegistryConfigured').mockReturnValue(true);
    vi.spyOn(podmanCli, 'getRunningPodmanMachineName').mockReturnValue('machine1');
    vi.spyOn(OrganizationService.prototype, 'checkOrgScaCapability').mockResolvedValue({ body: {} });
    await extension.activate(createExtContext());
    expect(commandFunctionCopy!).toBeDefined();
    await commandFunctionCopy!();
    expect(authentication.onDidChangeSessions).toBeCalled();
    expect(logSpy).toBeCalledWith('signin', {
      successful: false,
      error: 'Error: SCA is not enabled and message closed',
      errorIn: 'subscription-activation',
    });
  });
});
