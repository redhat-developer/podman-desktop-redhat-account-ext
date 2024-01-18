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
import { ServiceAccountV1 } from './container-registry-authorizer/data-contracts';
import { ContainerRegistryAuthorizerClient } from './generated/ContainerRegistryAuthorizerClient';

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

async function getAutenticatonService() {
  if (!loginService) {
    const config = await getAuthConfig();
    loginService = await RedHatAuthenticationService.build(config);
  }
  return loginService;
}

let authService: RedHatAuthenticationService;

async function getAuthService() {
  if (!authService) {
    authService = await getAutenticatonService();
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
    currentSession = await extensionApi.authentication.getSession('redhat.autentication-provider', ['api.iam.registry_service_accounts', 'api.console', 'id.username'], {createIfNone: true});
    const accessToken = parseJwt(currentSession.accessToken);
    console.log(accessToken);
    const client = new ContainerRegistryAuthorizerClient({BASE: 'https://access.redhat.com/hydra/rest/terms-based-registry', TOKEN: currentSession.accessToken});
    const response = await client.serviceAccountsApiV1.listServicesForAccountUsingGet(accessToken.organization.id);
    const serviceAccounts = response.services as ServiceAccountV1[];
    serviceAccounts.forEach(sa => {
      client.serviceAccountsApiV1.serviceAccountByNameUsingGet1(sa.name, accessToken.organization.id).then(detailsResponse => {
        console.log(detailsResponse);
      });
    });
    onDidChangeSessions.fire({ added: [currentSession], removed: [], changed: [] });
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
