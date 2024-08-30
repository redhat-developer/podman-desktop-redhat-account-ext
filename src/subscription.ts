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

import { accessSync, constants, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import * as extensionApi from '@podman-desktop/api';

export const REGISTRY_REDHAT_IO = 'registry.redhat.io';

export async function signIntoRedHatDeveloperAccount(
  createIfNone = true,
): Promise<extensionApi.AuthenticationSession | undefined> {
  return extensionApi.authentication.getSession(
    'redhat.authentication-provider',
    [
      'api.iam.registry_service_accounts', //scope that gives access to hydra service accounts API
      'api.console',
    ], // scope that gives access to console.redhat.com APIs
    { createIfNone },
  );
}

export function isRedHatRegistryConfigured(): boolean {
  const pathToAuthJson = path.join(homedir(), '.config', 'containers', 'auth.json');
  let configured = false;
  try {
    accessSync(pathToAuthJson, constants.R_OK);
    const authFileContent = readFileSync(pathToAuthJson, { encoding: 'utf8' });
    const authFileJson: {
      auths?: {
        [registryUrl: string]: {
          auth: string;
        };
      };
    } = JSON.parse(authFileContent);
    configured = authFileJson?.auths?.prototype.hasOwnProperty.call(authFileJson?.auths, REGISTRY_REDHAT_IO) || false;
  } catch (notAccessibleError) {
    // if file is not there, ignore and return default value
    console.log(`${pathToAuthJson} is not accessible: ${String(notAccessibleError)}`);
  }
  return configured;
}
