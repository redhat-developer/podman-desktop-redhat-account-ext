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

import type { paths } from './gen/subscription';
import { ClientHolder } from './utils';

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

export class SubscriptionManagerClient extends ClientHolder<paths> {
  activationKey: ActivationKey;
  constructor(options: { BASE: string; TOKEN: string }) {
    super(createClient<paths>({ baseUrl: options.BASE }), options.TOKEN);
    this.activationKey = new ActivationKey(this.client);
  }
}
