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
import { BootcExtensionPage, NavigationBar, PodmanDesktopRunner, RunnerTestContext, SettingsBar, SettingsExtensionsPage, WelcomePage, deleteImage } from 'podman-desktop-tester';
import { afterAll, beforeAll, describe, test, beforeEach } from 'vitest';

let pdRunner: PodmanDesktopRunner;
let page: Page;
let navBar: NavigationBar;
let extensionInstalled = false;
const imageName = 'quay.io/redhat-developer/podman-desktop-redhat-account-ext:0.0.2-alpha.2';
const extensionName = 'Red Hat Authentication';

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
  try {
    await deleteImage(page, imageName);
  } finally {
    await pdRunner.close();
  }
});

describe('RedHat Account extension installation', async () => {
  test('Go to settings and check if extension is already installed', async () => {
    const settingsBar = await navBar.openSettings();
    const extensions = await settingsBar.getCurrentExtensions();
    if (await extensionExists(extensions, extensionName)) {
      extensionInstalled = true;
    }
  });

  test.runIf(extensionInstalled)(
    'Uninstalled previous version of bootc extension',
    async () => {
      await removeExtension(extensionName);
    },
    200000,
  );

  test('Install extension through Settings', async () => {
    const settingsExtensionPage = new SettingsExtensionsPage(page);
    await settingsExtensionPage.installExtensionFromOCIImage(imageName);

    const settingsBar = new SettingsBar(page);
    const extensions = await settingsBar.getCurrentExtensions();
    await playExpect.poll(async () => await extensionExists(extensions, extensionName), { timeout: 30000 }).toBeTruthy();
  }, 200000);

  test.skip('Remove SSO extension through Settings', async () => {
    await removeExtension(extensionName);
  });
});

async function extensionExists(extensionList: Locator[], extensionName: string): Promise<boolean> {
  for (const extension of extensionList) {
    if ((await extension.getByText(extensionName, { exact: true }).count()) > 0) {
      console.log(`Extension ${extensionName} found under installed extensions`);
      return true;
    }
  }
  return false;
}

async function removeExtension(extensionName: string): Promise<void> {
  const settingsBar = await navBar.openSettings();
  let extensions = await settingsBar.getCurrentExtensions();
  const bootcPage = await settingsBar.openTabPage(BootcExtensionPage);
  const settingsExtensionPage = await bootcPage.removeExtension();
  await playExpect(settingsExtensionPage.heading).toBeVisible();

  extensions = await settingsBar.getCurrentExtensions();
  await playExpect.poll(async () => await extensionExists(extensions, extensionName), { timeout: 30000 }).toBeFalsy();
}