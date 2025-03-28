/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { execSync } from 'node:child_process';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import type { NavigationBar} from '@podman-desktop/tests-playwright';
import { AuthenticationPage, expect as playExpect, ExtensionCardPage, isLinux,podmanExtension, RunnerOptions, StatusBar, test, TroubleshootingPage  } from '@podman-desktop/tests-playwright';

import { SSOAuthenticationProviderCardPage } from './model/pages/sso-authentication-page';
import { SSOExtensionPage } from './model/pages/sso-extension-page';
import { findPageWithTitleInBrowser, getSSOUrlFromLogs, performBrowserLogin, startChromium } from './utility/auth-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let extensionInstalled = false;
let extensionCard: ExtensionCardPage;
let ssoProvider: SSOAuthenticationProviderCardPage;
let authPage: AuthenticationPage;
const chromePort = '9222';
let browser: Browser;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionLabel = 'redhat.redhat-authentication';
const extensionLabelName = 'redhat-authentication';
const authProviderName = 'Red Hat SSO';
const activeExtensionStatus = 'ACTIVE';
const disabledExtensionStatus = 'DISABLED';
const expectedAuthPageTitle = 'Log In';
const skipInstallation = process.env.SKIP_INSTALLATION ? process.env.SKIP_INSTALLATION : false;
const regex = new RegExp(/((http|https):\/\/.*$)/);
const browserOutputPath = [__dirname, '..', 'playwright', 'output', 'browser'];

const isGHActions = process.env.GITHUB_ACTIONS === 'true';
const AUTH_E2E_TESTS = process.env.AUTH_E2E_TESTS === 'true';

test.use({ 
  runnerOptions: new RunnerOptions({ customFolder: 'sso-tests-pd', autoUpdate: false, autoCheckUpdates: false }),
});
test.beforeAll(async ({ runner, page, welcomePage }) => {
  runner.setVideoAndTraceName('sso-e2e');
  process.env.KEEP_VIDEOS_ON_PASS = 'true';
  await welcomePage.handleWelcomePage(true);
  extensionCard = new ExtensionCardPage(page, extensionLabelName, extensionLabel);
  authPage = new AuthenticationPage(page);
  ssoProvider = new SSOAuthenticationProviderCardPage(page);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(90_000);
  // handle the browser closure, might be not triggered if there was a test failure/error
  try {
    if (browser) {
      await browser.close();
    }
  } catch (error) {
    console.log(`Something went wrong when closing browser: ${error}`);
  } finally {
    await terminateExternalBrowser();
    await runner.close();
  }
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

    test('Uninstall previous version of sso extension', async ({ navigationBar }) => {
      test.skip(!extensionInstalled || !!skipInstallation);
      test.setTimeout(60000);
      await removeExtension(navigationBar);
    });

    test('Podman Extension is activated', async ({ navigationBar, page }) => {
      const extensions = await navigationBar.openExtensions();
      await extensions.openInstalledTab();
      await playExpect.poll(
        async () => await extensions.extensionIsInstalled(podmanExtension.extensionLabel),
        { timeout: 15_000}).toBeTruthy();
      const podmanExtensionCard = new ExtensionCardPage(page, podmanExtension.extensionName, podmanExtension.extensionFullLabel);
      await playExpect(podmanExtensionCard.card).toBeVisible({ timeout: 20_000 });
      await podmanExtensionCard.card.scrollIntoViewIfNeeded();
      await playExpect(podmanExtensionCard.status).toHaveText(activeExtensionStatus, { timeout: 20_000 });
    });

    // we want to install extension from OCI image (usually using latest tag) after new code was added to the codebase
    // and extension was published already
    test('Extension can be installed using OCI image', async ({ navigationBar }) => {
      test.skip(extensionInstalled);
      test.setTimeout(200000);
      const extensions = await navigationBar.openExtensions();
      await extensions.installExtensionFromOCIImage(imageName);
      await extensionCard.card.scrollIntoViewIfNeeded();
      await playExpect(extensionCard.card).toBeVisible({ timeout: 15_000 });
    });

    test('Extension (card) is installed, present and active', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      await playExpect.poll(async () => 
        await extensions.extensionIsInstalled(extensionLabel), { timeout: 30_000 },
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
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(ssoProvider.parent).toBeVisible();
      await playExpect(ssoProvider.providerName).toHaveText(authProviderName);
      await playExpect(ssoProvider.signinButton).toBeVisible();
      await ssoProvider.checkUserIsLoggedIn(false);
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
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(ssoProvider.parent).not.toBeVisible();
    });

    test('Extension can be re-enabled correctly', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      playExpect(await extensions.extensionIsInstalled(extensionLabel)).toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(extensionLabelName, extensionLabel);
      await playExpect(extensionCard.status).toHaveText(disabledExtensionStatus);
      await extensionCard.enableExtension();
      await playExpect(extensionCard.status).toHaveText(activeExtensionStatus);

      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      await playExpect(ssoProvider.parent).toBeVisible();
    }); 
  });

  test.describe.serial('Verify authentication of the user via browser', () => {

    test.skip(!AUTH_E2E_TESTS, 'Authentication E2E tests are being skipped');
    let chromiumPage: Page | undefined;

    test('Can open authentication page in browser', async ({ navigationBar, page }) => {
      test.setTimeout(120_000);
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(ssoProvider.parent).toBeVisible();

      // start up chrome instance and return browser object
      browser = await startChromium(chromePort, path.join(...browserOutputPath));

      // open the link from PD
      await page.bringToFront();
      await ssoProvider.signIn();
      await page.waitForTimeout(5000);
      // get to a default page -> the sso
      chromiumPage = await findPageWithTitleInBrowser(browser, expectedAuthPageTitle);
      if (!chromiumPage) {
        console.log(`Did not find a page in default browser, trying to open new page with proper url...`);
        // try to open custom url to perform a login
        // get url from podman-desktop logs
        const urlMatch = await getSSOUrlFromLogs(page, regex);
        if (urlMatch) {
          const context = await browser.newContext();
          const newPage = await context.newPage();
          await newPage.goto(urlMatch);
          await newPage.waitForURL(/sso.redhat.com/);
          chromiumPage = newPage;
        } else {
          throw new Error('Did not find Initial SSO Login Page');
        }
      }
    });

    test('User can authenticate via browser', async () => {
      // Activate the browser window and perform login
      playExpect(chromiumPage).toBeDefined();
      if (!chromiumPage) {
        throw new Error('Chromium browser page was not initialized');
      }
      await chromiumPage.bringToFront();
      console.log(`Switched to Chrome tab with title: ${await chromiumPage.title()}`);
      await performBrowserLogin(chromiumPage, process.env.DVLPR_USERNAME ?? 'unknown', process.env.DVLPR_PASSWORD ?? 'unknown', path.join(...browserOutputPath));
      await chromiumPage.close();
    });

    test('User signed in status is propagated into Podman Desktop', async ({ page, navigationBar }) => {
      // activate Podman Desktop again
      await page.bringToFront();
      // verify the Signed in user
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      // on linux we need to avoid issue with auth. providers store
      // in case of need, refresh auth. providers store in troubleshooting
      await page.screenshot({ path: join(...browserOutputPath, 'screenshots', 'back_pd_after_authentication.png'), type: 'png' });
      if (await ssoProvider.signinButton.count() >= 0) {
        console.log('SignIn Button still visible, we are hitting issue with linux');
        const status = new StatusBar(page);
        await status.troubleshootingButton.click();
        const troubleshooting = new TroubleshootingPage(page);
        await troubleshooting.refreshStore('auth providers');
        await navigationBar.openSettings();
        await settingsBar.openTabPage(AuthenticationPage);
      }
      await playExpect(ssoProvider.signinButton).not.toBeVisible();
      await ssoProvider.checkUserIsLoggedIn(true);

      // TODO continue with the tests
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

export async function terminateExternalBrowser(): Promise<void> {
  if (isGHActions && isLinux) { 
    try {
      // eslint-disable-next-line
      execSync('pkill -o firefox');
    } catch (error) {
      console.log(`Error while killing the firefox: ${error}`);
    }
  }
}
