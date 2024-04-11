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
import { Page, Locator, expect as playExpect } from '@playwright/test';
import { AuthenticationPage, NavigationBar, PodmanDesktopRunner, RunnerTestContext, SSOExtensionPage, SettingsExtensionsPage, WelcomePage } from '@podman-desktop/tests-playwright';
import { afterAll, beforeAll, describe, test, beforeEach } from 'vitest';

let pdRunner: PodmanDesktopRunner;
let page: Page;
let navBar: NavigationBar;
let extensionInstalled = false;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionName = 'Red Hat Authentication';
const extensionLabelName = 'redhat-authentication';
const authProviderName = 'Red Hat SSO';

beforeEach<RunnerTestContext>(async ctx => {
  ctx.pdRunner = pdRunner;
});

beforeAll(async () => {
  pdRunner = new PodmanDesktopRunner();
  page = await pdRunner.start();
  pdRunner.setVideoAndTraceName('sso-e2e');

  const welcomePage = new WelcomePage(page);
  await welcomePage.handleWelcomePage(true);
  navBar = new NavigationBar(page);
});

afterAll(async () => {
  await pdRunner.close();
});

describe('Red Hat Authentication extension verification', async () => {

  test('Go to settings and check if extension is already installed', async () => {
    const settingsBar = await navBar.openSettings();
    const extensions = await settingsBar.getCurrentExtensions();
    if (await extensionExists(extensions, extensionName)) {
      extensionInstalled = true;
    }
  });

  test.runIf(extensionInstalled)(
    'Uninstalled previous version of sso extension',
    async () => {
      await removeExtension(extensionName);
    },
    60000,
  );

  test('Extension can be installed using OCI image', async () => {
    const settingsBar = await navBar.openSettings();
    const settingsExtensionPage = await settingsBar.openTabPage(SettingsExtensionsPage);
    await playExpect(settingsExtensionPage.heading).toBeVisible();
    await settingsExtensionPage.installExtensionFromOCIImage(imageName);
  }, 200000);

  test('Extension record is added under installed extensions', async () => {
    const settingsBar = await navBar.openSettings();
    const settingsExtensionPage = await settingsBar.openTabPage(SettingsExtensionsPage);
    const extension = settingsExtensionPage.getExtensionRowFromTable(extensionLabelName);
    await playExpect(extension).toBeVisible();
    await extension.scrollIntoViewIfNeeded();
    const extensionDetails = extension.getByRole('cell', { name: 'Extension Details' });
    await playExpect(extensionDetails.getByLabel('Connection Status Label')).toHaveText('RUNNING');
  });

  test('Extension appears under Settings bar extensions', async () => {
    const settingsBar = await navBar.openSettings();
    const extensions = await settingsBar.getCurrentExtensions();
    await playExpect.poll(async () => await extensionExists(extensions, extensionName), { timeout: 30000 }).toBeTruthy();
  });

  test('SSO provider is available in Authentication Page', async (context) => {
    console.log(`Running Test: ${context.task.name}`);
    console.log(`Opening settings`);
    const settingsBar = await navBar.openSettings();
    const authPage = await settingsBar.openTabPage(AuthenticationPage);
    await playExpect(authPage.heading).toHaveText('Authentication');
    const provider = authPage.getProvider(authProviderName);
    await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Name')).toHaveText(authProviderName);
    await playExpect(provider.getByLabel('Provider Information').getByLabel('Provider Status')).toHaveText('Logged out');
    await playExpect(provider.getByLabel('Provider Actions').getByRole('button')).toContainText('Sign in');
  });

  describe('Red Hat Authentication extension handling', async () => {
    test('Extension can be disabled', async () => {
      const settingsBar = await navBar.openSettings();
      const settingsExtensionPage = await settingsBar.openTabPage(SettingsExtensionsPage);
      const extension = settingsExtensionPage.getExtensionRowFromTable(extensionLabelName);
      await extension.scrollIntoViewIfNeeded();
      await settingsExtensionPage.getExtensionStopButton(extension).click();
      const extensionDetails = extension.getByRole('cell', { name: 'Extension Details' });
      await playExpect(extensionDetails.getByLabel('Connection Status Label')).toHaveText('OFF');

      await navBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      const provider = authPage.getProvider(authProviderName);
      await playExpect(provider).toHaveCount(0);
    });

    test('Extension can be re-enabled correctly', async () => {
      const settingsBar = await navBar.openSettings();
      const settingsExtensionPage = await settingsBar.openTabPage(SettingsExtensionsPage);
      const extension = settingsExtensionPage.getExtensionRowFromTable(extensionLabelName);
      await extension.scrollIntoViewIfNeeded();
      await settingsExtensionPage.getExtensionStartButton(extension).click();
      const extensionDetails = extension.getByRole('cell', { name: 'Extension Details' });
      await playExpect(extensionDetails.getByLabel('Connection Status Label')).toHaveText('RUNNING');

      await navBar.openSettings();
      const authPage = await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(authPage.getProvider(authProviderName)).toHaveCount(1);
    }); 
  });

  test('SSO extension can be removed', async () => {
    await removeExtension(extensionName);
  });
});

async function extensionExists(extensionList: Locator[], extensionName: string): Promise<boolean> {
  for (const extension of extensionList) {
    if ((await extension.getByText(extensionName, { exact: true }).count()) > 0) {
      return true;
    }
  }
  return false;
}

async function removeExtension(extensionName: string): Promise<void> {
  const settingsBar = await navBar.openSettings();
  let extensions = await settingsBar.getCurrentExtensions();
  const authPage = await settingsBar.openTabPage(SSOExtensionPage);
  const settingsExtensionPage = await authPage.removeExtension();
  await playExpect(settingsExtensionPage.heading).toBeVisible();

  extensions = await settingsBar.getCurrentExtensions();
  await playExpect.poll(async () => await extensionExists(extensions, extensionName), { timeout: 30000 }).toBeFalsy();
}