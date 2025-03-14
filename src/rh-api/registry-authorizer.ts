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

import createClient from 'openapi-fetch';

import type { paths } from './gen/registry-authorizer';
import { ClientHolder } from './utils';

export const REGISTRY_REDHAT_IO1 = 'registry.redhat.io';

class ServiceAccountApiV1 extends ClientHolder<paths> {
  serviceAccountByNameUsingGet1(name: string, rhAccountId: string) {
    return this.client.GET('/v1/service-accounts/{rhAccountId}/{name}', {
      params: {
        path: {
          name,
          rhAccountId,
        },
      },
    });
  }

  createServiceAccountUsingPost1(body: { name: string; description: string; redHatAccountId: string }) {
    return this.client.POST('/v1/service-accounts', {
      body,
    });
  }

  removeServiceAccountUsingDelete1(name: string, rhAccountId: string) {
    return this.client.DELETE('/v1/service-accounts/{rhAccountId}/{name}', {
      params: {
        path: {
          name,
          rhAccountId,
        },
      },
    });
  }
}

export class ContainerRegistryAuthorizerClient extends ClientHolder<paths> {
  public serviceAccountsApiV1: ServiceAccountApiV1;
  constructor(options: { BASE: string; TOKEN: string }) {
    super(createClient<paths>({ baseUrl: options.BASE }), options.TOKEN);
    this.serviceAccountsApiV1 = new ServiceAccountApiV1(this.client);
  }
}
