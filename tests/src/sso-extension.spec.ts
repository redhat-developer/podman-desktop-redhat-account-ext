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
import { expect as playExpect, ExtensionCardPage, RunnerOptions, test } from '@podman-desktop/tests-playwright';


let extensionCard: ExtensionCardPage;
const imageName = 'ghcr.io/redhat-developer/podman-desktop-redhat-account-ext:latest';
const extensionLabel = 'redhat.redhat-authentication';
const extensionLabelName = 'redhat-authentication';

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

test.describe.serial('TEST PR CHANGE', () => {
  test('PD Is started', async ({ navigationBar }) => {
    await navigationBar.openContainers();
    playExpect(1).toBeTruthy();
  });
});
