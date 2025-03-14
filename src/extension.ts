/**********************************************************************
 * Copyright (C) 2022 - 2024 Red Hat, Inc.
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

import * as extensionApi from '@podman-desktop/api';

import icon from '../icon.png';
import { onDidChangeSessions, RedHatAuthenticationService } from './authentication-service';
import { getAuthConfig } from './configuration';
import {
  getConnectionForRunningPodmanMachine,
  runCreateFactsFile,
  runRpmInstallSubscriptionManager,
  runStartPodmanMachine,
  runStopPodmanMachine,
  runSubscriptionManager,
  runSubscriptionManagerActivationStatus,
  runSubscriptionManagerRegister,
  runSubscriptionManagerUnregister,
} from './podman-cli';
import { ContainerRegistryAuthorizerClient } from './rh-api/registry-authorizer';
import { isRedHatRegistryConfigured, REGISTRY_REDHAT_IO, SubscriptionManagerClient } from './rh-api/subscription';
import { SSOStatusBarItem } from './status-bar-item';
import { ExtensionTelemetryLogger as TelemetryLogger } from './telemetry';
import { isLinux, signIntoRedHatDeveloperAccount } from './util';

interface JwtToken {
  organization: {
    id: string;
  };
}

let authenticationServicePromise: Promise<RedHatAuthenticationService>;
let currentSession: extensionApi.AuthenticationSession | undefined;

async function getAuthenticationService(): Promise<RedHatAuthenticationService> {
  return authenticationServicePromise;
}

function parseJwt(token: string): JwtToken {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    Buffer.from(base64, 'base64')
      .toString()
      .split('')
      .map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(''),
  );

  return JSON.parse(jsonPayload);
}

async function createRegistry(
  username: string,
  secret: string,
  alias: string,
  serverUrl: string = REGISTRY_REDHAT_IO,
): Promise<void> {
  extensionApi.registry.registerRegistry({
    serverUrl,
    username,
    secret,
    source: 'podman',
    alias,
  });
}

function removeRegistry(serverUrl: string = REGISTRY_REDHAT_IO): void {
  extensionApi.registry.unregisterRegistry({
    serverUrl,
    username: '',
    secret: '',
    source: 'podman',
  });
}

async function createOrReuseRegistryServiceAccount(): Promise<void> {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const accessTokenJson = parseJwt(currentSession!.accessToken);
  const { serviceAccountsApiV1: saApiV1 } = new ContainerRegistryAuthorizerClient({
    BASE: 'https://access.redhat.com/hydra/rest/terms-based-registry',
    TOKEN: currentSession!.accessToken,
  });
  let { data: serviceAccount } = await saApiV1.serviceAccountByNameUsingGet1(
    'podman-desktop',
    accessTokenJson.organization.id,
  );

  if (!serviceAccount) {
    // ignore error when there is no podman-desktop service account yet
    const { data: createdServiceAccount } = await saApiV1.createServiceAccountUsingPost1({
      name: 'podman-desktop',
      description: 'Service account to use from Podman Desktop',
      redHatAccountId: accessTokenJson.organization.id,
    });
    if (createdServiceAccount) {
      serviceAccount = createdServiceAccount;
    } else {
      throw new Error(`Can't create registry authorizer service account.`);
    }
  }

  await createRegistry(
    serviceAccount!.credentials!.username!,
    serviceAccount!.credentials!.password!,
    currentSession.account.label,
  );
}

async function createOrReuseActivationKey(connection: extensionApi.ProviderContainerConnection): Promise<void> {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const accessTokenJson = parseJwt(currentSession!.accessToken);
  const client = new SubscriptionManagerClient({
    BASE: 'https://console.redhat.com/api/rhsm/v2',
    TOKEN: currentSession!.accessToken,
  });

  const { error: showKeyErr } = await client.activationKey.showActivationKey('podman-desktop');

  if (showKeyErr) {
    // error is undefined when activation key already exists
    const { error: createKeyErr } = await client.activationKey.createActivationKeys({
      name: 'podman-desktop',
      role: 'RHEl Workstation',
      usage: 'Development/Test',
      serviceLevel: 'Self-Support',
    });
    if (createKeyErr) {
      throw new Error(createKeyErr.error?.message);
    }
  }
  await runSubscriptionManagerRegister(connection, 'podman-desktop', accessTokenJson.organization.id);
}

async function isSimpleContentAccessEnabled(): Promise<boolean> {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const client = new SubscriptionManagerClient({
    BASE: 'https://console.redhat.com/api/rhsm/v2',
    TOKEN: currentSession!.accessToken,
  });
  const data = await client.organization.checkOrgScaCapability();
  return data?.body?.simpleContentAccess === 'enabled';
}

async function isSubscriptionManagerInstalled(connection: extensionApi.ProviderContainerConnection): Promise<boolean> {
  const exitCode = await runSubscriptionManager(connection);
  return exitCode === 0;
}

async function installSubscriptionManger(
  connection: extensionApi.ProviderContainerConnection,
): Promise<extensionApi.RunResult | undefined> {
  try {
    return await runRpmInstallSubscriptionManager(connection);
  } catch (err) {
    console.error(`Subscription manager installation failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerInstallationError', { error: String(err) });
    throw err;
  }
}

async function isPodmanVmSubscriptionActivated(connection: extensionApi.ProviderContainerConnection): Promise<boolean> {
  const exitCode = await runSubscriptionManagerActivationStatus(connection);
  return exitCode === 0;
}

async function removeSession(sessionId: string): Promise<void> {
  const connection = getConnectionForRunningPodmanMachine();
  if (connection) {
    runSubscriptionManagerUnregister(connection).catch(console.error); // ignore error in case vm subscription activation failed on login
  }
  removeRegistry(); // never fails, even if registry does not exist
  const service = await getAuthenticationService();
  const session = await service.removeSession(sessionId);
  onDidChangeSessions.fire({ removed: [session!] });
}

async function buildAndInitializeAuthService(
  context: extensionApi.ExtensionContext,
  statusBarItem: SSOStatusBarItem,
): Promise<RedHatAuthenticationService> {
  const service = await RedHatAuthenticationService.build(context, getAuthConfig());
  context.subscriptions.push(service);
  await service.initialize();
  const storedSessions = await service.getSessions();
  if (storedSessions.length > 0) {
    statusBarItem.logInAs(storedSessions[0].account.label);
  }
  return service;
}

interface StepTelemetryData {
  errorIn?: 'sign-in' | 'registry-configuration' | 'subscription-activation';
  error?: string;
  successful: boolean;
}

async function configureRegistryAndActivateSubscription(): Promise<void> {
  const telemetryData: StepTelemetryData = {
    successful: true,
  };

  await extensionApi.window
    .withProgress(
      {
        location: extensionApi.ProgressLocation.TASK_WIDGET,
        title: 'Configuring Red Hat Registry',
      },
      async progress => {
        // Checking if registry account for https://registry.redhat.io is already configured
        if (!isRedHatRegistryConfigured()) {
          progress.report({ increment: 30 });
          await createOrReuseRegistryServiceAccount();
        }
      },
    )
    .then(() => false)
    .catch((error: unknown) => {
      telemetryData.errorIn = 'registry-configuration';
      telemetryData.error = String(error);
      telemetryData.successful = false;
    });

  if (telemetryData.successful) {
    await extensionApi.window
      .withProgress(
        {
          location: extensionApi.ProgressLocation.TASK_WIDGET,
          title: 'Activating Red Hat Subscription',
        },
        async () => {
          const runningConnection = getConnectionForRunningPodmanMachine();
          if (!runningConnection) {
            if (isLinux()) {
              await extensionApi.window.showInformationMessage(
                'Signing into a Red Hat account requires a running Podman machine, and is currently not supported on a Linux host. Please start a Podman machine and try again.',
              );
            } else {
              await extensionApi.window.showInformationMessage(
                'Signing into a Red Hat account requires a running Podman machine.  Please start one and try again.',
              );
              throw new Error('No running podman');
            }
          } else {
            if (!(await isSimpleContentAccessEnabled())) {
              const choice = await extensionApi.window.showInformationMessage(
                'Simple Content Access (SCA) is not enabled for your Red Hat account. Please enable it and try again.',
                'Close',
                'Enable SCA',
              );
              if (choice === 'Enable SCA') {
                await extensionApi.env.openExternal(extensionApi.Uri.parse('https://access.redhat.com/management'));
                throw new Error('SCA is not enabled and subscription management page requested');
              }
              throw new Error('SCA is not enabled and message closed');
            }
            if (!(await isSubscriptionManagerInstalled(runningConnection))) {
              await installSubscriptionManger(runningConnection);
              await runStopPodmanMachine(runningConnection);
              await runStartPodmanMachine(runningConnection);
            }
            if (!(await isPodmanVmSubscriptionActivated(runningConnection))) {
              const facts = {
                supported_architectures: 'aarch64,x86_64',
              };
              await runCreateFactsFile(runningConnection, JSON.stringify(facts, undefined, 2));
              await createOrReuseActivationKey(runningConnection);
            }
          }
        },
      )
      .catch((error: unknown) => {
        telemetryData.errorIn = 'subscription-activation';
        telemetryData.error = String(error);
        telemetryData.successful = false;
      });

    if (!telemetryData.successful && currentSession?.id) {
      await removeSession(currentSession.id); // if at least one fail, remove session
    }
  }
  TelemetryLogger.logUsage('signin', telemetryData);
}

export async function activate(context: extensionApi.ExtensionContext): Promise<void> {
  console.log('starting redhat-authentication extension');

  // create status bar item for Red Hat SSO Provider
  const statusBarItem = new SSOStatusBarItem();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // build and initialize auth service and update status bar state
  authenticationServicePromise = buildAndInitializeAuthService(context, statusBarItem);

  context.subscriptions.push(
    extensionApi.registry.suggestRegistry({
      name: 'Red Hat Container Registry',
      icon,
      url: 'registry.redhat.io',
    }),
  );

  const providerDisposable = extensionApi.authentication.registerAuthenticationProvider(
    'redhat.authentication-provider',
    'Red Hat SSO',
    {
      onDidChangeSessions: onDidChangeSessions.event,
      createSession: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession> {
        const service = await getAuthenticationService();
        // eslint-disable-next-line sonarjs/no-alphabetical-sort
        const session = await service.createSession([...scopes].sort().join(' '));
        onDidChangeSessions.fire({ added: [session] });
        return session;
      },
      getSessions: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession[]> {
        const service = await getAuthenticationService();
        return service.getSessions(scopes);
      },
      removeSession,
    },
    {
      images: {
        icon: 'icon.png',
      },
    },
  );

  const onDidChangeSessionDisposable = extensionApi.authentication.onDidChangeSessions(async e => {
    if (e.provider.id === 'redhat.authentication-provider') {
      const newSession = await signIntoRedHatDeveloperAccount(false);
      if (!currentSession && newSession) {
        currentSession = newSession;
        statusBarItem.logInAs(newSession.account.label);
        return configureRegistryAndActivateSubscription();
      }
      currentSession = newSession;
      if (!newSession) {
        statusBarItem.logOut();
      }
    }
  });

  signIntoRedHatDeveloperAccount(false).catch(console.log);

  context.subscriptions.push(providerDisposable);

  const SignInCommand = extensionApi.commands.registerCommand('redhat.authentication.signin', async () => {
    const telemetryData: StepTelemetryData = {
      successful: true,
    };

    try {
      await signIntoRedHatDeveloperAccount(true); //for the use case when user logged out, vm activated and registry configured
    } catch (err) {
      telemetryData.errorIn = 'sign-in';
      telemetryData.error = String(err);
      // Send telemetry only for error.
      // Successful or unsuccessful signin is reported in on onDidChangeSessions listener
      // after registry configuration and subscription activation finished
      TelemetryLogger.logUsage('signin', telemetryData);
    }
  });

  const SignOutCommand = extensionApi.commands.registerCommand('redhat.authentication.signout', async () => {
    const service = await getAuthenticationService();
    await service.removeSession(currentSession!.id);
    onDidChangeSessions.fire({ added: [], removed: [currentSession!], changed: [] });
    currentSession = undefined;
    TelemetryLogger.logUsage('signout');
  });

  const SignUpCommand = extensionApi.commands.registerCommand('redhat.authentication.signup', async () => {
    return extensionApi.env.openExternal(
      extensionApi.Uri.parse('https://developers.redhat.com/articles/faqs-no-cost-red-hat-enterprise-linux#general'),
    );
  });

  const GotoAuthCommand = extensionApi.commands.registerCommand('redhat.authentication.navigate.settings', async () => {
    return extensionApi.navigation.navigateToAuthentication();
  });

  context.subscriptions.push(
    SignInCommand,
    SignOutCommand,
    SignUpCommand,
    onDidChangeSessionDisposable,
    GotoAuthCommand,
  );
}

export function deactivate(): void {
  console.log('stopping redhat-authentication extension');
  currentSession = undefined;
}
