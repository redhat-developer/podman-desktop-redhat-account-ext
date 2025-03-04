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
import { createClient, Client, Auth } from '@hey-api/client-axios';
import * as extensionApi from '@podman-desktop/api';
import { ActivationKeys, checkOrgScaCapability, createActivationKeys, CreateActivationKeysData, ListActivationKeysData, showActivationKey } from '@redhat-developer/rhsm-client';

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

const security: Auth[] = [{
  type: 'http',
  scheme: 'bearer',
}];

class ClientOptionsHolder {
  protected options: {
    client: Client,
    security: Auth[],
    throwOnError: boolean,
  };
  constructor(client: Client) {
    this.options = {
      client,
      security,
      throwOnError: true,
    }
  }
}

class ActivationKey extends ClientOptionsHolder{

  async showActivationKey(name: string): Promise<ActivationKeys | undefined> {
    return showActivationKey({
      path: {name},
      ...this.options,
    }).then(response => response?.data?.body);
  };
  async createActivationKeys(name: string): Promise<ActivationKeys | undefined> {
    return createActivationKeys({
      ...this.options,
      body: {
        name,
        role: 'RHEL Server',
        usage: 'Development/Test',
        serviceLevel: 'Self-Support',
      },
    }).then(response => response?.data?.body);
  }
};

class Organization extends ClientOptionsHolder {
  async checkOrgScaCapability(): Promise<boolean> {
    const response = await checkOrgScaCapability({
      ...this.options,
    });
    return response.data?.body?.simpleContentAccess === 'enabled';
  }
}

export class SubscriptionManagerClient {
  #client:Client;
  readonly activationKey: ActivationKey;
  readonly organization: Organization;
  constructor(options: {BASE: string, TOKEN: string}) {
    this.#client = createClient({baseURL: options.BASE, auth: options.TOKEN,});
    this.activationKey = new ActivationKey(this.#client)
    this.organization = new Organization(this.#client);
  }
}