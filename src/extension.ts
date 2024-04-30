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
import { getAuthConfig } from './configuration';
import { onDidChangeSessions, RedHatAuthenticationService } from './authentication-service';
import { ServiceAccountV1, ContainerRegistryAuthorizerClient } from '@redhat-developer/rhcra-client';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  runRpmInstallSubscriptionManager,
  runSubscriptionManager,
  runSubscriptionManagerActivationStatus,
  runSubscriptionManagerRegister,
  runSubscriptionManagerUnregister,
  runCreateFactsFile,
  runStartPodmanMachine,
  runStopPodmanMachine,
  getRunningPodmanMachineName,
} from './podman-cli';
import { SubscriptionManagerClient } from '@redhat-developer/rhsm-client';
import { isLinux } from './util';
import { SSOStatusBarItem } from './status-bar-item';
import { ExtensionTelemetryLogger as TelemetryLogger } from './telemetry';
import { signIntoRedHatDeveloperAccount } from './subscription';
import { isRedHatRegistryConfigured } from './subscription';
import { REGISTRY_REDHAT_IO } from './subscription';

let authenticationServicePromise: Promise<RedHatAuthenticationService>;
let currentSession: extensionApi.AuthenticationSession | undefined;

async function getAuthenticationService() {
  return authenticationServicePromise;
}

// function to encode file data to base64 encoded string
function fileToBase64(file: string) {
  // read binary data
  var bitmap = readFileSync(file);
  // convert binary data to base64 encoded string
  return bitmap.toString('base64');
}

function parseJwt(token: string) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(
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
  const client = new ContainerRegistryAuthorizerClient({
    BASE: 'https://access.redhat.com/hydra/rest/terms-based-registry',
    TOKEN: currentSession!.accessToken,
  });
  const saApiV1 = client.serviceAccountsApiV1;
  let selectedServiceAccount: ServiceAccountV1 | undefined;
  try {
    selectedServiceAccount = await saApiV1.serviceAccountByNameUsingGet1(
      'podman-desktop',
      accessTokenJson.organization.id,
    );
  } catch (err) {
    // ignore error when there is no podman-desktop service account yet
    selectedServiceAccount = await saApiV1.createServiceAccountUsingPost1({
      name: 'podman-desktop',
      description: 'Service account to use from Podman Desktop',
      redHatAccountId: accessTokenJson.organization.id,
    });
  }

  createRegistry(
    selectedServiceAccount!.credentials!.username!,
    selectedServiceAccount!.credentials!.password!,
    currentSession.account.label,
  );
}

async function createOrReuseActivationKey(machineName: string) {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const accessTokenJson = parseJwt(currentSession!.accessToken);
  const client = new SubscriptionManagerClient({
    BASE: 'https://console.redhat.com/api/rhsm/v2',
    TOKEN: currentSession!.accessToken,
  });

  try {
    await client.activationKey.showActivationKey('podman-desktop');
    // podman-desktop activation key exists
  } catch (err) {
    // ignore and continue with activation key creation
    // TODO: add check that used role and usage exists in organization
    await client.activationKey.createActivationKeys({
      name: 'podman-desktop',
      role: 'RHEL Server',
      usage: 'Development/Test',
      serviceLevel: 'Self-Support',
    });
  }

  await runSubscriptionManagerRegister(machineName, 'podman-desktop', accessTokenJson.organization.id);
}

async function isSimpleContentAccessEnabled(): Promise<boolean> {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const client = new SubscriptionManagerClient({
    BASE: 'https://console.redhat.com/api/rhsm/v2',
    TOKEN: currentSession!.accessToken,
  });
  const response = await client.organization.checkOrgScaCapability();
  return response.body && response.body.simpleContentAccess === 'enabled';
}

async function isSubscriptionManagerInstalled(machineName: string): Promise<boolean> {
  const exitCode = await runSubscriptionManager(machineName);
  return exitCode === 0;
}

async function installSubscriptionManger(machineName: string) {
  try {
    return await runRpmInstallSubscriptionManager(machineName);
  } catch (err) {
    console.error(`Subscription manager installation failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerInstallationError', { error: String(err) });
    throw err;
  }
}

async function isPodmanVmSubscriptionActivated(machineName: string) {
  const exitCode = await runSubscriptionManagerActivationStatus(machineName);
  return exitCode === 0;
}

async function removeSession(sessionId: string): Promise<void> {
  const machineName = getRunningPodmanMachineName();
  if (machineName) {
    runSubscriptionManagerUnregister(machineName).catch(console.error); // ignore error in case vm subscription activation failed on login
  }
  removeRegistry(); // never fails, even if registry does not exist
  const service = await getAuthenticationService();
  const session = await service.removeSession(sessionId);
  onDidChangeSessions.fire({ removed: [session!] });
}

async function buildAndInitializeAuthService(context: extensionApi.ExtensionContext, statusBarItem: SSOStatusBarItem) {
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

async function configureRegistryAndActivateSubscription() {
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
    .catch(error => {
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
        async progress => {
          const podmanRunningMachineName = getRunningPodmanMachineName();
          if (!podmanRunningMachineName) {
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
            return;
          } else {
            if (!(await isSimpleContentAccessEnabled())) {
              const choice = await extensionApi.window.showInformationMessage(
                'Simple Content Access (SCA) is not enabled for your Red Hat account. Please enable it and try again.',
                'Close',
                'Enable SCA',
              );
              if (choice === 'Enable SCA') {
                extensionApi.env.openExternal(extensionApi.Uri.parse('https://access.redhat.com/management'));
                throw new Error('SCA is not enabled and subscription management page requested');
              }
              throw new Error('SCA is not enabled and message closed');
            }
            if (!(await isSubscriptionManagerInstalled(podmanRunningMachineName))) {
              await installSubscriptionManger(podmanRunningMachineName);
              await runStopPodmanMachine(podmanRunningMachineName);
              await runStartPodmanMachine(podmanRunningMachineName);
            }
            if (!(await isPodmanVmSubscriptionActivated(podmanRunningMachineName))) {
              const facts = {
                supported_architectures: 'aarch64,x86_64',
              };
              await runCreateFactsFile(podmanRunningMachineName, JSON.stringify(facts, undefined, 2));
              await createOrReuseActivationKey(podmanRunningMachineName);
            }
          }
        },
      )
      .catch(error => {
        telemetryData.errorIn = 'subscription-activation';
        telemetryData.error = String(error);
        telemetryData.successful = false;
      });

    if (!telemetryData.successful && currentSession?.id) {
      removeSession(currentSession.id); // if at least one fail, remove session
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
      icon: fileToBase64(path.resolve(__dirname, '..', 'icon.png')),
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
        const session = await service.createSession(scopes.sort().join(' '));
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

  await signIntoRedHatDeveloperAccount(false);

  context.subscriptions.push(providerDisposable);

  const SignInCommand = extensionApi.commands.registerCommand('redhat.authentication.signin', async () => {
    const telemetryData: StepTelemetryData = {
      successful: true,
    };

    try {
      const session = await signIntoRedHatDeveloperAccount(true); //for the use case when user logged out, vm activated and registry configured
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
    service.removeSession(currentSession!.id);
    onDidChangeSessions.fire({ added: [], removed: [currentSession!], changed: [] });
    currentSession = undefined;
    TelemetryLogger.logUsage('signout');
  });

  const SignUpCommand = extensionApi.commands.registerCommand('redhat.authentication.signup', async () => {
    extensionApi.env.openExternal(
      extensionApi.Uri.parse('https://developers.redhat.com/articles/faqs-no-cost-red-hat-enterprise-linux#general'),
    );
  });

  const GotoAuthCommand = extensionApi.commands.registerCommand('redhat.authentication.navigate.settings', async () => {
    extensionApi.navigation.navigateToAuthentication();
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
