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

import type { Disposable, StatusBarItem } from '@podman-desktop/api';
import { StatusBarAlignLeft, window } from '@podman-desktop/api';

export class SSOStatusBarItem implements Disposable {
  #statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignLeft, 50);

  constructor() {
    this.#statusBarItem.iconClass = '${redhat-icon}';
    this.logOut();
  }

  public dispose(): void {
    this.#statusBarItem.dispose();
  }

  public logInAs(email: string): void {
    this.#statusBarItem.tooltip = `Red Hat SSO: Logged in as ${email}`;
    this.#statusBarItem.command = 'redhat.authentication.navigate.settings';
  }

  public logOut(): void {
    this.#statusBarItem.tooltip = 'Red Hat SSO: Logged Out';
    this.#statusBarItem.command = 'redhat.authentication.signin';
  }

  public show(): void {
    this.#statusBarItem.show();
  }
}
