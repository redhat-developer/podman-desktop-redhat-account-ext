/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import type { Locator, Page } from '@playwright/test';
import test, { expect as playExpect } from '@playwright/test';
import { BasePage } from '@podman-desktop/tests-playwright';

export class SSOAuthenticationProviderCardPage extends BasePage {
    readonly parent: Locator;
    readonly providerInformation: Locator;
    readonly providerActions: Locator;
    readonly signinButton: Locator;
    readonly providerName: Locator;
    readonly providerStatus: Locator;
    readonly logoutButton: Locator;
    readonly userName: Locator;
    readonly signoutButton: Locator;

    constructor(page: Page) {
        super(page);
        this.parent = this.page.getByRole('listitem', { name: 'Red Hat SSO' });
        this.providerInformation = this.parent.getByLabel('Provider Information');
        this.providerActions = this.parent.getByLabel('Provider Actions');
        this.signinButton = this.providerActions.getByRole('button', { name: 'Sign in' });
        this.providerName = this.providerInformation.getByLabel('Provider Name');
        this.providerStatus = this.providerInformation.getByLabel('Provider Status');
        this.userName = this.providerInformation.getByLabel('Logged In Username');
        this.signoutButton = this.providerInformation.getByRole('button', { name: 'Sign out of ', exact: false });
    }

    public async signIn(): Promise<void> {
        await test.step('Perform Sign In', async () => {
            console.log(`Signin Button is enabled`);
            await playExpect(this.signinButton).toBeEnabled();
            console.log(`Clicking on the button...`);
            await this.signinButton.click();
            console.log(`Button clicked`);
        });
    }

    public async logout(): Promise<void> {
        await test.step('Perform Sign Out', async () => {
            await playExpect(this.signoutButton).toBeEnabled();
            await this.signoutButton.click();
        });
    }

    public async checkUserIsLoggedIn(loggedIn = true): Promise<void> {
        await test.step(loggedIn ? 'User si logged In' : 'User is logged out', async () => {
            await playExpect(this.providerStatus).toBeVisible();
            console.log(`Status text: ${await this.providerStatus.innerText()}`);
            await playExpect(this.providerStatus).toContainText(loggedIn ? 'logged in' : 'logged out', { ignoreCase: true });
        });
    }
}