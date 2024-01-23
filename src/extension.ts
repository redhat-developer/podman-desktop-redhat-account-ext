/**********************************************************************
 * Copyright (C) 2022 - 2023 Red Hat, Inc.
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
import {
  onDidChangeSessions,
  RedHatAuthenticationService,
} from './authentication-service';
import { ServiceAccountV1 } from './registry/models/ServiceAccountV1';
import { ContainerRegistryAuthorizerClient } from './registry/ContainerRegistryAuthorizerClient';
import path from 'node:path';
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { restartPodmanMachine, runRpmInstallSubscriptionManager, runSubscriptionManager, runSubscriptionManagerActivationStatus, runSubscriptionManagerRegister } from './podman-cli';
import { RhsmClient } from './rhsm';

const menuItemsRegistered: extensionApi.Disposable[] = [];

const SignUpMenuItem = (enabled = true) => ({
  id: 'redhat.authentication.signup',
  label: 'Sign Up',
  enabled,
});

const SignInMenuItem = (enabled = true) => ({
  id: 'redhat.authentication.signin',
  label: 'Sign In',
  enabled,
});

const SignOutMenuItem = (enabled = false) => ({
  id: 'redhat.authentication.signout',
  label: 'Sign Out',
  enabled,
});

const Separator: extensionApi.MenuItem = {
  type: 'separator',
  id: 'redhat.authentication.separator',
};

const AuthMenuItem: extensionApi.MenuItem = {
  id: 'redhat.authentication',
  label: 'Red Hat',
};

async function initMenu(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  AuthMenuItem.submenu = [SignInMenuItem(), SignOutMenuItem(), Separator, SignUpMenuItem()];

  const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
  extensionContext.subscriptions.push(subscription);
}

let loginService: RedHatAuthenticationService;
let currentSession: extensionApi.AuthenticationSession;

async function getAuthenticationService() {
  if (!loginService) {
    const config = await getAuthConfig();
    loginService = await RedHatAuthenticationService.build(config);
  }
  return loginService;
}

let authService: RedHatAuthenticationService;

async function getAuthService() {
  if (!authService) {
    authService = await getAuthenticationService();
  }
  return authService;
}

function parseJwt (token: string) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

async function signIntoRedHatDeveloperAccount(): Promise<extensionApi.AuthenticationSession> {
  return extensionApi.authentication.getSession(
    'redhat.authentication-provider',
    ['api.iam.registry_service_accounts', //scope that gives access to hydra service accounts API
    'api.console', // scope that gives access to console.redhat.com APIs
    'id.username'], // adds claim to accessToken that used to render account label
    {createIfNone: true} // will request to login in browser if session does not exists
  );
}

async function createRegistry(username: string, secret: string, serverUrl: string = 'registry.redhat.io'): Promise<void> {
  extensionApi.registry.registerRegistry({
    serverUrl,
    username,
    secret,
    source: ''
  });
}

// TODO: add listRegistries to registry API to allow search by 
// registry URL
function isRedHatRegistryConfigured(): boolean {
  const homeFolderPath = process.env.HOME ? process.env.HOME : process.env.USER_PROFILE;
  const pathToAuthJson = path.join(homeFolderPath, '.config', 'containers', 'auth.json');
  let configured = false;
  try {
    // TODO: handle all kind problems with file existence, accessibility and parsable content
    accessSync(pathToAuthJson, constants.R_OK)
    const authFileContent = readFileSync(pathToAuthJson, {'encoding': 'utf8'});
    const authFileJson: {
      auths? : {
        [registryUrl:string]: {
          auth: string,
        }  
      }
    } = JSON.parse(authFileContent);
    configured =  authFileJson?.auths?.hasOwnProperty('registry.redhat.io');
  } catch(_notAccessibleError) {
    // if file is not there, ignore and return default value
  }
  return configured;
}

async function createOrReuseRegistryServiceAccount(): Promise<void> {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const accessTokenJson = parseJwt(currentSession.accessToken);
  const client = new ContainerRegistryAuthorizerClient({
    BASE: 'https://access.redhat.com/hydra/rest/terms-based-registry',
    TOKEN: currentSession.accessToken
  });
  const saApiV1 = client.serviceAccountsApiV1;
  const response = await saApiV1.listServicesForAccountUsingGet(accessTokenJson.organization.id);
  const sas = response.services as ServiceAccountV1[];
  let selectedServiceAccount: ServiceAccountV1;
  
  // Check if service account record exists
  if(sas.length === 1) {
    selectedServiceAccount = await saApiV1.serviceAccountByNameUsingGet1(
      sas[0].name,
      accessTokenJson.organization.id
    );
  } else if (sas.length === 0) {
    selectedServiceAccount = await saApiV1.createServiceAccountUsingPost1({
      name: 'podman-desktop',
      description: 'Service account to use from Podman Desktop',
      redHatAccountId: accessTokenJson.organization.id,
    });
  } else {
    // there are several service accounts already 
    // ask user which one to use
    const qps:extensionApi.QuickPickItem[] = sas.map(sa=> ({label: sa.name, description: sa.description}));
    const selectedName = await extensionApi.window.showQuickPick(qps, { title: 'Select Service Account to configure registry.redhat.io authentication', placeHolder: 'Service Account Name'});
    if  (!selectedName) {
      throw new Error('Cancelled');
    }
    selectedServiceAccount = await saApiV1.serviceAccountByNameUsingGet1(
      selectedName.label,
      accessTokenJson.organization.id
    );
  }
    createRegistry(selectedServiceAccount.credentials.username, selectedServiceAccount.credentials.password);
}

async function  createOrReuseActivationKey() {
  const currentSession = await signIntoRedHatDeveloperAccount();
  const accessTokenJson = parseJwt(currentSession.accessToken);
  const client = new RhsmClient({
    BASE: 'https://console.redhat.com/api/rhsm/v2',
    TOKEN: currentSession.accessToken
  });

  let noAk = true;

  try {
    await client.activationKey.showActivationKey('podman-desktop');
    noAk = false;
    // podman-desktop activation key exists
  } catch(err) {
    // ignore and continue with activation key creation
  }

  if (noAk) {
    await client.activationKey.createActivationKeys({
      name: 'podman-desktop',
      role: 'RHEL Server',
      usage: 'Development/Test',
      serviceLevel: 'Self-Support',
    });
  }

  await runSubscriptionManagerRegister('podman-desktop', accessTokenJson.organization.id)
}

function isPodmanMachineRunning(): boolean {
  const conns = extensionApi.provider.getContainerConnections();
  const startedPodman = conns.filter(conn => conn.providerId === 'podman' && conn.connection.status() === 'started');
  return startedPodman.length === 1;
}

async function isSubscriptionManagerInstalled(): Promise<boolean> {
  const exitCode = await runSubscriptionManager();
  if (exitCode === undefined) {
    throw new Error('Error running podman ssh to detect subscription-manager, please make sure podman machine is running!');
  } 
  return exitCode === 0;
}

async function installSubscriptionManger() {
  const exitCode = await runRpmInstallSubscriptionManager();
  if (exitCode === undefined) {
    throw new Error('Error running podman to install subscription-manager, please make sure podman machine is running!');
  } 
  return exitCode === 0;
}

async function isPodmanVmSubscriptionActivated() {
  const exitCode = await runSubscriptionManagerActivationStatus();
  if (exitCode === undefined) {
    throw new Error('Error running subscription-manager in podman machine to get subscription status, please make sure podman machine is running!');
  } 
  return exitCode === 0;
}

async function restartPodmanVM() {
  await restartPodmanMachine();
}

export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  console.log('starting redhat-authentication extension');

  await initMenu(extensionContext);

  const providerDisposable = extensionApi.authentication.registerAuthenticationProvider(
    'redhat.authentication-provider',
    'Red Hat SSO', {
      onDidChangeSessions: onDidChangeSessions.event,
      createSession: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession> {
        const service = await getAuthService();
        const session = await service.createSession(scopes.sort().join(' '));
        onDidChangeSessions.fire({ added: [session] });
        return session;
      },
      getSessions: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession[]> {
        const service = await getAuthService();
        return service.getSessions(scopes);
      },
      removeSession: async function (sessionId: string): Promise<void> {
        const service = await getAuthService();
        const session = await service.removeSession(sessionId);
        onDidChangeSessions.fire({ removed: [session] });
      },
    },
    {
      images: {
        icon: 'icon.png',
      },
    },
  );
  extensionContext.subscriptions.push(providerDisposable);

  const SignInCommand = extensionApi.commands.registerCommand('redhat.authentication.signin', async () => {
    currentSession = await signIntoRedHatDeveloperAccount();
    if (!isRedHatRegistryConfigured()) {
      await createOrReuseRegistryServiceAccount();
    }

    await extensionApi.window.showInformationMessage('Check if Podman machine is running','Continue');
    if (!isPodmanMachineRunning()) {
      await extensionApi.window.showInformationMessage('Podman machine is not running','Exit');
      return;
    }
    if (isPodmanMachineRunning()) {
      await extensionApi.window.showInformationMessage('Podman machine is running','Continue');
      const smIntalled = await isSubscriptionManagerInstalled();
      if (!smIntalled) {
        await extensionApi.window.showInformationMessage('Podman machine subscription-manager is not installed. Install?', 'Continue');
        await installSubscriptionManger();
        await extensionApi.window.showInformationMessage('The subscription-manager has been installed Podman machine is restarting', 'Continue');
        await restartPodmanVM();
        await extensionApi.window.showInformationMessage('Podman machine has restarted', 'Continue');
      } else {
        await extensionApi.window.showInformationMessage('Podman machine subscription-manager is installed');
      }
      await extensionApi.window.showInformationMessage('Check if developer subscription is activated', 'Continue');
      const smRegistered = await isPodmanVmSubscriptionActivated();
      if (!smRegistered) {
        await extensionApi.window.showInformationMessage('Podman machine developer subscription is not activated. Activate?', 'Continue');
        await createOrReuseActivationKey();
        await extensionApi.window.showInformationMessage('Podman machine developer subscription has been activated');
      }
    }

    AuthMenuItem.label = `Red Hat (${currentSession.account.label})`;
    AuthMenuItem.submenu = [SignInMenuItem(false), SignOutMenuItem(true), Separator, SignUpMenuItem()];
    const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
    extensionContext.subscriptions.push(subscription);
  });

  const SignOutCommand = extensionApi.commands.registerCommand('redhat.authentication.signout', async () => {
    loginService.removeSession(currentSession.id);
    onDidChangeSessions.fire({ added: [], removed: [currentSession], changed: [] });
    currentSession = undefined;
    AuthMenuItem.label = `Red Hat`;
    AuthMenuItem.submenu = [SignInMenuItem(true), SignOutMenuItem(false), Separator, SignUpMenuItem()];
    const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
    extensionContext.subscriptions.push(subscription);
  });

  const SignUpCommand = extensionApi.commands.registerCommand('redhat.authentication.signup', async () => {
    extensionApi.env.openExternal(
      extensionApi.Uri.parse('https://developers.redhat.com/articles/faqs-no-cost-red-hat-enterprise-linux#general'),
    );
  });

  extensionContext.subscriptions.push(SignInCommand, SignOutCommand, SignUpCommand);
}

export function deactivate(): void {
  console.log('stopping redhat-authentication extension');
}
