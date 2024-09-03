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
import type { Page} from '@playwright/test';
import { expect as playExpect } from '@playwright/test';
import { AuthenticationPage, ExtensionCardPage, NavigationBar, PodmanDesktopRunner, WelcomePage } from '@podman-desktop/tests-playwright';
import { test } from '@playwright/test';

import { SSOExtensionPage } from './model/pages/sso-extension-page';

let pdRunner: PodmanDesktopRunner;
let page: Page;
let navBar: NavigationBar;
let extensionInstalled = false;
let extensionCard: ExtensionCardPage;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionLabel = 'redhat.redhat-authentication';
const extensionLabelName = 'redhat-authentication';
const authProviderName = 'Red Hat SSO';
const activeExtensionStatus = 'ACTIVE';
const disabledExtensionStatus = 'DISABLED';
const skipInstallation = process.env.SKIP_INSTALLATION ? process.env.SKIP_INSTALLATION : false;

test.beforeAll(async () => {
  pdRunner = new PodmanDesktopRunner({ customFolder: 'sso-tests-pd', autoUpdate: false, autoCheckUpdate: false });
  page = await pdRunner.start();
  pdRunner.setVideoAndTraceName('sso-e2e');

  const welcomePage = new WelcomePage(page);
  await welcomePage.handleWelcomePage(true);
  navBar = new NavigationBar(page);
  extensionCard = new ExtensionCardPage(page, extensionLabelName, extensionLabel);
});

test.afterAll(async () => {
  await pdRunner.close();
});

test.describe('Red Hat Authentication extension verification', () => {
  test.describe('Red Hat Authentication extension installation', () => {
    test('Go to extensions and check if extension is already installed', async () => {
      const extensions = await navBar.openExtensions();
      if (await extensions.extensionIsInstalled(extensionLabel)) {
        extensionInstalled = true;
      }
    });

    // we want to skip removing of the extension when we are running tests from PR check
    test('Uninstalle previous version of sso extension', async () => {
        test.skip(!extensionInstalled || !!skipInstallation);
        test.setTimeout(60000);
        await removeExtension();
      }
    );

    test('Extension can be installed using OCI image', async () => {
      test.skip(extensionInstalled && !skipInstallation);
      test.setTimeout(200000);
      const extensions = await navBar.openExtensions();
      await extensions.installExtensionFromOCIImage(imageName);
      await playExpect(extensionCard.card).toBeVisible();
    });

    test('Extension card is present and active', async () => {
      const extensions = await navBar.openExtensions();
      await playExpect.poll(async () => 
        await extensions.extensionIsInstalled(extensionLabel), { timeout: 30000 },
      ).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);
    });

    test('Extension Details show correct status', async () => {
      const extensions = await navBar.openExtensions();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await extensionCard.openExtensionDetails('Red Hat Authentication');
      const details = new SSOExtensionPage(page);
      await playExpect(details.heading).toBeVisible();
      await playExpect(details.status).toHaveText(activeExtensionStatus);
    });

    test('SSO provider is available in Authentication Page', async () => {
      const settingsBar = await navBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      const provider = authPage.getProvider(authProviderName);
      await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Name')).toHaveText(authProviderName);
      await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Status')).toHaveText('Logged out');
      await playExpect(provider.getByLabel('Provider Actions').getByRole('button')).toContainText('Sign in');
    });
  });

  test.describe('Red Hat Authentication extension handling', async () => {
    test('Extension can be disabled', async () => {
      const extensions = await navBar.openExtensions();
      playExpect(await extensions.extensionIsInstalled(extensionLabel)).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);
      await extensionCard.disableExtension();
      await playExpect(extensionCard.status).toHaveText(disabledExtensionStatus);

      const settingsBar = await navBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      const provider = authPage.getProvider(authProviderName);
      await playExpect(provider).toHaveCount(0);
    });

    test('Extension can be re-enabled correctly', async () => {
      const extensions = await navBar.openExtensions();
      playExpect(await extensions.extensionIsInstalled(extensionLabel)).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(disabledExtensionStatus);
      await extensionCard.enableExtension();
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);

      const settingsBar = await navBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(authPage.getProvider(authProviderName)).toHaveCount(1);
    }); 
  });

  test('SSO extension can be removed', async () => {
    await removeExtension();
  });
});

async function removeExtension(): Promise<void> {
  const extensions = await navBar.openExtensions();
  const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
  await extensionCard.disableExtension();
  await extensionCard.removeExtension();
  await playExpect.poll(async () => await extensions.extensionIsInstalled(extensionLabel), { timeout: 15000 }).toBeFalsy();
}
