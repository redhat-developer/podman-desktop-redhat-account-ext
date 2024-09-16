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

import type { NavigationBar } from '@podman-desktop/tests-playwright';
import { AuthenticationPage, expect as playExpect, ExtensionCardPage, RunnerOptions, test } from '@podman-desktop/tests-playwright';

import { SSOExtensionPage } from './model/pages/sso-extension-page';

let extensionInstalled = false;
let extensionCard: ExtensionCardPage;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionLabel = 'redhat.redhat-authentication';
const extensionLabelName = 'redhat-authentication';
const authProviderName = 'Red Hat SSO';
const activeExtensionStatus = 'ACTIVE';
const disabledExtensionStatus = 'DISABLED';
const skipInstallation = process.env.SKIP_INSTALLATION ? process.env.SKIP_INSTALLATION : false;

test.use({ 
  runnerOptions: new RunnerOptions({ customFolder: 'sso-tests-pd', autoUpdate: false, autoCheckUpdates: false }),
});
test.beforeAll(async ({ runner, page, welcomePage }) => {
  runner.setVideoAndTraceName('sso-e2e');
  await welcomePage.handleWelcomePage(true);
  extensionCard = new ExtensionCardPage(page, extensionLabelName, extensionLabel);
});

test.afterAll(async ({ runner }) => {
  await runner.close();
});

test.describe.serial('Red Hat Authentication extension verification', () => {
  test.describe.serial('Red Hat Authentication extension installation', () => {
    // PR check builds extension locally and so it is available already
    test('Go to extensions and check if extension is already installed', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      if (await extensions.extensionIsInstalled(extensionLabel)) {
        extensionInstalled = true;
      }
    });

    // we want to skip removing of the extension when we are running tests from PR check
    test('Uninstall previous version of sso extension', async ({ navigationBar }) => {
      test.skip(!extensionInstalled || !!skipInstallation);
      test.setTimeout(60000);
      await removeExtension(navigationBar);
    });

    // we want to install extension from OCI image (usually using latest tag) after new code was added to the codebase
    // and extension was published already
    test('Extension can be installed using OCI image', async ({ navigationBar }) => {
      test.skip(extensionInstalled && !skipInstallation);
      test.setTimeout(200000);
      const extensions = await navigationBar.openExtensions();
      await extensions.installExtensionFromOCIImage(imageName);
      await playExpect(extensionCard.card).toBeVisible();
    });

    test('Extension (card) is installed, present and active', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      await playExpect.poll(async () => 
        await extensions.extensionIsInstalled(extensionLabel), { timeout: 30000 },
      ).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);
    });

    test('Extension\'s details show correct status, no error', async ({ page,navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await extensionCard.openExtensionDetails('Red Hat Authentication');
      const details = new SSOExtensionPage(page);
      await playExpect(details.heading).toBeVisible();
      await playExpect(details.status).toHaveText(activeExtensionStatus);
      const errorTab = details.tabs.getByRole('button', { name: 'Error' });
      // we would like to propagate the error's stack trace into test failure message
      let stackTrace = '';
      if ((await errorTab.count()) > 0) {
        await details.activateTab('Error');
        stackTrace = await details.errorStackTrace.innerText();
      }
      await playExpect(errorTab, `Error Tab was present with stackTrace: ${stackTrace}`).not.toBeVisible();
    });

    test('SSO provider is available in Authentication Page', async ({ navigationBar }) => {
      const settingsBar = await navigationBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      const provider = authPage.getProvider(authProviderName);
      await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Name')).toHaveText(authProviderName);
      await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Status')).toHaveText('Logged out');
      await playExpect(provider.getByLabel('Provider Actions').getByRole('button')).toContainText('Sign in');
    });
  });

  test.describe.serial('Red Hat Authentication extension handling', () => {
    test('Extension can be disabled', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      playExpect(await extensions.extensionIsInstalled(extensionLabel)).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);
      await extensionCard.disableExtension();
      await playExpect(extensionCard.status).toHaveText(disabledExtensionStatus);

      const settingsBar = await navigationBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      const provider = authPage.getProvider(authProviderName);
      await playExpect(provider).toHaveCount(0);
    });

    test('Extension can be re-enabled correctly', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      playExpect(await extensions.extensionIsInstalled(extensionLabel)).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(disabledExtensionStatus);
      await extensionCard.enableExtension();
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);

      const settingsBar = await navigationBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(authPage.getProvider(authProviderName)).toHaveCount(1);
    }); 
  });

  test('SSO extension can be removed', async ({ navigationBar }) => {
    await removeExtension(navigationBar);
  });
});

async function removeExtension(navBar: NavigationBar): Promise<void> {
  const extensions = await navBar.openExtensions();
  const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
  await extensionCard.disableExtension();
  await extensionCard.removeExtension();
  await playExpect.poll(async () => await extensions.extensionIsInstalled(extensionLabel), { timeout: 15000 }).toBeFalsy();
}
