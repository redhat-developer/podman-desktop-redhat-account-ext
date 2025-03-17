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

import { platform } from 'node:os';

import type { AuthenticationSession } from '@podman-desktop/api';
import { authentication } from '@podman-desktop/api';

const windows = platform() === 'win32';
export function isWindows(): boolean {
  return windows;
}
const mac = platform() === 'darwin';
export function isMac(): boolean {
  return mac;
}
const linux = platform() === 'linux';
export function isLinux(): boolean {
  return linux;
}

export async function signIntoRedHatDeveloperAccount(createIfNone = true): Promise<AuthenticationSession | undefined> {
  return authentication.getSession(
    'redhat.authentication-provider',
    [
      'api.iam.registry_service_accounts', //scope that gives access to hydra service accounts API
      'api.console',
    ], // scope that gives access to console.redhat.com APIs
    { createIfNone },
  );
}
