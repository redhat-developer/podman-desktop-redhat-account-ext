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

import { exec } from 'node:child_process';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { ConfirmInputValue, NavigationBar} from '@podman-desktop/tests-playwright';
import { 
  ArchitectureType,
  AuthenticationPage, 
  expect as playExpect, 
  ExtensionCardPage, 
  findPageWithTitleInBrowser,
  getEntryFromConsoleLogs,
  handleConfirmationDialog,
  handleCookies,  isCI,
  isLinux,
  isMac, 
  isWindows, 
  performBrowserLogin,
  podmanExtension, 
  RegistriesPage,
  RunnerOptions, 
  startChromium, 
  StatusBar, 
  test, 
  TroubleshootingPage} from '@podman-desktop/tests-playwright';

import { SSOAuthenticationProviderCardPage } from './model/pages/sso-authentication-page';
import { SSOExtensionPage } from './model/pages/sso-extension-page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let extensionInstalled = false;
let extensionCard: ExtensionCardPage;
let ssoProvider: SSOAuthenticationProviderCardPage;
let authPage: AuthenticationPage;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionLabel = 'redhat.redhat-authentication';
const extensionLabelName = 'redhat-authentication';
const authProviderName = 'Red Hat SSO';
const activeExtensionStatus = 'ACTIVE';
const disabledExtensionStatus = 'DISABLED';
const skipInstallation = process.env.SKIP_INSTALLATION ? process.env.SKIP_INSTALLATION : false;
const chromePort = '9222';
const urlRegex = new RegExp(/((http|https):\/\/.*$)/);
let browserOutputPath: string;
const expectedAuthPageTitle = 'Log In';
const AUTH_E2E_TESTS = process.env.AUTH_E2E_TESTS === 'true';
const toolboxImage = 'registry.redhat.io/rhel9/toolbox:latest';
const containerfilePath = path.resolve(__dirname, '..', 'resources', 'toolbox.containerfile');
const contextDirectory = path.resolve(__dirname, '..', 'resources');
const builtImageName = 'quay.io/podman-desktop-redhat-account-ext/toolbox';

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
  browserOutputPath = test.info().project.outputDir;
  console.log(`Saving browser test artifacts to: '${browserOutputPath}'`);
});

test.afterAll(async ({ runner }) => {
  if (isCI && AUTH_E2E_TESTS) {
    await terminateExternalBrowser();
  }
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

    test('Uninstall previous version of sso extension', async ({ navigationBar }) => {
      test.skip(!extensionInstalled || !!skipInstallation);
      test.setTimeout(60000);
      await removeExtension(navigationBar);
    });

    test('Podman Extension is activated', async ({ navigationBar, page }) => {
      const extensions = await navigationBar.openExtensions();
      await extensions.openInstalledTab();
      await playExpect.poll(
        async () => await extensions.extensionIsInstalled(podmanExtension.extensionFullLabel),
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
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;

    test.afterAll(async () => {
      if (browser) {
        console.log('Stopping tracing and closing browser...');
        await context?.tracing.stop({ path: join(path.join(browserOutputPath), 'traces', 'browser-authentication-trace.zip') });
        if (chromiumPage) {
          await chromiumPage.close();
        }
        await browser.close();
      }
    });

    test('Can open authentication page in browser', async ({ navigationBar, page }) => {
      test.setTimeout(120_000);
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(ssoProvider.parent).toBeVisible();
      // open the link from PD
      await page.bringToFront();
      await ssoProvider.signIn();
      await page.bringToFront();
      const urlMatch = await getEntryFromConsoleLogs(page, /\[redhat-authentication\].*openid-connect.*/, urlRegex, 'sso.redhat.com', 25_000);
      // start up chrome instance and return browser object
      if (urlMatch) {
        browser = await startChromium(chromePort, path.join(browserOutputPath));
        context = await browser.newContext();
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        const newPage = await context.newPage();
        await newPage.goto(urlMatch);
        await newPage.waitForURL(/sso.redhat.com/);
        chromiumPage = newPage;

        // Handle Cookies in the popup iframe
        const cookiesManager = 'TrustArc Cookie Consent Manager';
        const consentManager = 'TrustArc Consent Manager Frame';
        await handleCookies(chromiumPage, consentManager, 'Proceed with Required Cookies only', 10_000);
        await handleCookies(chromiumPage, cookiesManager, 'Accept default', 10_000);
        if (browser) {
          await findPageWithTitleInBrowser(browser, expectedAuthPageTitle);
        }
        console.log(`Found page with title: ${await chromiumPage?.title()}`);
      } else {
        throw new Error('Did not find Initial SSO Login Page');
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
      const usernameAction: ConfirmInputValue = {
        inputLocator: chromiumPage.getByRole('textbox', { name: 'Red Hat login' }),
        inputValue: process.env.DVLPR_USERNAME ?? 'unknown',
        confirmLocator: chromiumPage.getByRole('button', { name: 'Next' }),
      };
      const passwordAction: ConfirmInputValue = {
        inputLocator: chromiumPage.getByRole('textbox', { name: 'Password' }),
        inputValue: process.env.DVLPR_PASSWORD ?? 'unknown',
        confirmLocator: chromiumPage.getByRole('button', { name: 'Log in' }),
      };
      const usernameBox = chromiumPage.getByRole('textbox', { name: 'Red Hat login' });
      await playExpect(usernameBox).toBeVisible({ timeout: 5_000 });
      await usernameBox.focus();
      await performBrowserLogin(chromiumPage, /Log In/, usernameAction, passwordAction, async (chromiumPage) => {
        const backButton = chromiumPage.getByRole('button', { name: 'Go back to Podman Desktop' });
        await playExpect(backButton).toBeEnabled();
        await chromiumPage.screenshot({ path: join(path.join(browserOutputPath), 'screenshots', 'after_login_in_browser.png'), type: 'png', fullPage: true });
        console.log(`Logged in, go back...`);
        await backButton.click();
        await chromiumPage.screenshot({ path: join(path.join(browserOutputPath), 'screenshots', 'after_clck_go_back.png'), type: 'png', fullPage: true });
      });
    });

    test('User signed in status is propagated into Podman Desktop', async ({ page, navigationBar }) => {
      // activate Podman Desktop again
      await page.bringToFront();
      if (isLinux) {
        try {
        await handleConfirmationDialog(page, 'Red Hat Authentication', true, 'OK', '', 10_000);
        } catch (error: unknown) {
          console.log('Podman Machine dialog did not appear.');
        }
      }
      // verify the Signed in user
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(authPage.heading).toHaveText('Authentication');
      // on linux we need to avoid issue with auth. providers store
      // in case of need, refresh auth. providers store in troubleshooting
      await page.screenshot({ path: join(browserOutputPath, 'screenshots', 'back_pd_after_authentication.png'), type: 'png' });
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
    });

    test('Tasks Configuring Red Hat Registry and Activating Red Hat Subscription are completed', async ({ page }) => {
      test.setTimeout(120_000);
      test.skip(isCI && (isMac || isLinux), 'Mac/Linux issue on CI: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      console.log('Finding Tasks in status Bar');
      const statusBar = new StatusBar(page);
      await statusBar.tasksButton.click();
      console.log('Opened Tasks in status Bar');
      const tasksManager = page.getByTitle('Tasks Manager');
      await playExpect(tasksManager).toBeVisible();
      // tasks are present in the Tasks Manager
      const taskRegistry = tasksManager.getByTitle('Configuring Red Hat Registry');
      await playExpect(taskRegistry).toBeVisible();
      const taskSubscription = tasksManager.getByTitle('Activating Red Hat Subscription');
      await playExpect(taskSubscription).toBeVisible();
      // Registry is added
      const successImgRegistry = tasksManager.getByRole('img', { name: 'success icon of task Configuring Red Hat Registry' });
      await playExpect(successImgRegistry).toBeVisible({ timeout: 20_000 });
      // subscription activation is finished
      // this runs endless on CI windows
      if (isWindows && isCI) {
        console.log('Skipping waiting for subscription activation on Windows CI');
      } else {
        const successImgSubscription = tasksManager.getByRole('img', { name: 'success icon of task Activating Red Hat Subscription' });
        await playExpect(successImgSubscription).toBeVisible({ timeout: 60_000 });
      }
      // close tasks manager
      const hideButton = tasksManager.getByRole('button').and(tasksManager.getByTitle('Hide'));
      await playExpect(hideButton).toBeVisible();
      await hideButton.click();
    });

    test.fail('Logged in state in authentication page persists for at least 30 seconds', async ({ navigationBar }) => {
      test.skip(isCI && isMac, 'Mac needs to solve issue: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(ssoProvider.parent).toBeVisible();
      await playExpect.poll(async () => {
        await ssoProvider.checkUserIsLoggedIn(false);
      }, { timeout: 35_000 }).toBeTruthy();
    });

    test('Red Hat Registry is configured in the Registries Page', async ({ navigationBar }) => {
      test.skip(isCI && (isMac || isLinux), 'Mac needs to solve issue: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      const settingsBar = await navigationBar.openSettings();
      const registryPage = await settingsBar.openTabPage(RegistriesPage);
  
      await playExpect(registryPage.heading).toBeVisible({ timeout: 5_000 });
      const registryBox = registryPage.registriesTable.getByLabel('Red Hat Container Registry');
      await playExpect(registryBox).toBeVisible({ timeout: 5_000 });
      const configureButton = registryBox.getByRole('button', { name: 'Configure' });
      await playExpect(configureButton).not.toBeVisible({ timeout: 5_000 });
    });

    test('Can pull from Red Hat Registry', async ({ navigationBar }) => {
      test.skip(isCI && (isMac || isLinux), 'Mac needs to solve issue: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      test.setTimeout(120_000);
      const imagesPage = await navigationBar.openImages();
      const imageUrl = toolboxImage.substring(0, toolboxImage.indexOf(':'));
      console.log(`Pulling image from Red Hat Registry without Tag: ${imageUrl}`);

      const pullImagePage = await imagesPage.openPullImage();
      const updatedImages = await pullImagePage.pullImage(toolboxImage);

      await playExpect.poll(async () => 
        await updatedImages.waitForImageExists(toolboxImage.substring(0, toolboxImage.indexOf(':'))), 
      { timeout: 90_000 }).toBeTruthy();
    });

    test('Can build Rhel Toolbox image from containerfile', async ({ navigationBar }) => {
      test.skip(isCI && isMac, 'Mac needs to solve issue: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      test.skip(isCI && isWindows, 'Skipping on Windows due to: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/864');
      test.skip(isLinux, 'Linux not supported yet: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/71');
      test.setTimeout(360_000);
      let imagesPage = await navigationBar.openImages();
      await playExpect(imagesPage.heading).toBeVisible();
      const buildImagePage = await imagesPage.openBuildImage();
      await playExpect(buildImagePage.heading).toBeVisible();

      imagesPage = await buildImagePage.buildImage(
        builtImageName,
        containerfilePath,
        contextDirectory,
        [ArchitectureType.Default],
        300_000);
      await playExpect.poll(async () => 
        await imagesPage.waitForImageExists(builtImageName, 30_000), 
      { timeout: 60_000 }).toBeTruthy();
    });

    test('Can log out from SSO', async ({ page, navigationBar }) => {
      test.skip(isCI && isMac, 'Mac needs to solve issue: https://github.com/redhat-developer/podman-desktop-redhat-account-ext/issues/898');
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.openTabPage(AuthenticationPage);
      await playExpect(ssoProvider.parent).toBeVisible();
      await ssoProvider.checkUserIsLoggedIn(true);
      await ssoProvider.logout();
      await handleConfirmationDialog(page, 'Sign Out Request', true, 'Sign Out', '', 10_000);
      await playExpect(ssoProvider.signinButton).toBeVisible();
      await ssoProvider.checkUserIsLoggedIn(false);
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
  let command = 'pkill -o firefox';
  if (isMac) {
    command = 'pkill Safari';
  } else if (isWindows) {
    command = 'TaskKill /im msedge.exe /f /t';
  }
  try {
    // eslint-disable-next-line
    exec(command);
  } catch (error: unknown) {
    console.log(`Error while terminating the browser using '${command}': ${error}`);
  }
}
