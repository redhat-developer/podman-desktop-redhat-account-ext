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
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { accessSync, constants, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import createClient from 'openapi-fetch';

import type { paths } from './gen/subscription';
import { ClientHolder } from './utils';

export const REGISTRY_REDHAT_IO = 'registry.redhat.io';

// TODO: add listRegistries to registry API to allow search by
// registry URL
export function isRedHatRegistryConfigured(): boolean {
  const pathToAuthJson = path.join(homedir(), '.config', 'containers', 'auth.json');
  let configured = false;
  try {
    // TODO: handle all kind problems with file existence, accessibility and parsable content
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
  } catch (_notAccessibleError) {
    // if file is not there, ignore and return default value
  }
  return configured;
}

export class ActivationKey extends ClientHolder<paths> {
  async createActivationKeys(body: { name: string; role: string; usage: string; serviceLevel: string }) {
    return this.client.POST('/activation_keys', { body });
  }
  showActivationKey(name: string) {
    return this.client.GET('/activation_keys/{name}', {
      params: {
        path: {
          name,
        },
      },
    });
  }
}

export class Organization extends ClientHolder<paths> {
  async checkOrgScaCapability() {
    const response = await this.client.GET('/organization');
    return response.data;
  }
}

export class SubscriptionManagerClient extends ClientHolder<paths> {
  activationKey: ActivationKey;
  organization: Organization;
  constructor(options: { BASE: string; TOKEN: string }) {
    super(createClient<paths>({ baseUrl: options.BASE }), options.TOKEN);
    this.activationKey = new ActivationKey(this.client);
    this.organization = new Organization(this.client);
  }
}
