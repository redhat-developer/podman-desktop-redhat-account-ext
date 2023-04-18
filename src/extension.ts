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
import { onDidChangeSessions, RedHatAuthenticationService, RedHatAuthenticationSession } from './authentication-service';

const menuItemsRegistered: extensionApi.Disposable[] = [];

const SignUpMenuItem = (enabled = true) => ({
  id: 'redhat.authentication.signup',
  label: 'Sign Up',
  enabled
});

const SignInMenuItem = (enabled = true) => ({
  id: 'redhat.authentication.signin',
  label: 'Sign In',
  enabled
});

const SignOutMenuItem = (enabled = false) =>({
  id: 'redhat.authentication.signout',
  label: 'Sign Out',
  enabled
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
  AuthMenuItem.
    submenu = [SignInMenuItem(), SignOutMenuItem(), Separator, SignUpMenuItem()];

  const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
  extensionContext.subscriptions.push(subscription);
}

let loginService:RedHatAuthenticationService;
let currentSession: RedHatAuthenticationSession;

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

export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  console.log('starting redhat-authentication extension');
  
  await initMenu(extensionContext);
  
  extensionApi.authentication.registerAuthenticationProvider(
    'redhat.autentication-provider',
    'Red Hat', {
      onDidChangeSessions: onDidChangeSessions.event,
      createSession: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession> {
        const service = await getAuthService();
        const session = await service.createSession(scopes.sort().join(' '));
        onDidChangeSessions.fire({added: [session]});
        return session;
      },
      getSessions: async function (scopes: string[]): Promise<extensionApi.AuthenticationSession[]> {
        const service = await getAuthService();
        return service.getSessions(scopes)
      },
      removeSession: async function (sessionId: string): Promise<void> {
        const service = await getAuthService();
        const session = await service.removeSession(sessionId);
        onDidChangeSessions.fire({removed: [session]});
      }
    });

  const SignInCommand = extensionApi.commands.registerCommand('redhat.authentication.signin', async () => {
    loginService = await getAutenticatonService();
    currentSession = await loginService.createSession('openid');
    onDidChangeSessions.fire({added: [currentSession], removed:[], changed:[]});
    AuthMenuItem.label = `Red Hat (${currentSession.account.label})`;
    AuthMenuItem.
      submenu = [SignInMenuItem(false), SignOutMenuItem(true), Separator, SignUpMenuItem()];
    const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
    extensionContext.subscriptions.push(subscription);
  });

  const SignOutCommand = extensionApi.commands.registerCommand('redhat.authentication.signout', async () => {
    loginService.removeSession(currentSession.id);
    onDidChangeSessions.fire({added: [], removed:[currentSession], changed:[]});
    currentSession = undefined;
    AuthMenuItem.label = `Red Hat`;
    AuthMenuItem.
      submenu = [SignInMenuItem(true), SignOutMenuItem(false), Separator, SignUpMenuItem()];
    const subscription = extensionApi.tray.registerMenuItem(AuthMenuItem);
    extensionContext.subscriptions.push(subscription);
  });

  const SignUpCommand = extensionApi.commands.registerCommand('redhat.authentication.signup', async () => {
    extensionApi.env.openExternal(extensionApi.Uri.parse('https://developers.redhat.com/articles/faqs-no-cost-red-hat-enterprise-linux#general'));
  });

  extensionContext.subscriptions.push(SignInCommand, SignOutCommand, SignUpCommand);
}

export function deactivate(): void {
  console.log('stopping redhat-authentication extension');
}
