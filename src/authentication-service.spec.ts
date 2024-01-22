/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
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

import { afterEach, expect, beforeEach, test, vi, vitest } from 'vitest';
import { convertToSession } from './authentication-service';

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: function() {}
  };
});

test('An authentication token is converted to a session', () => {
  const token = {
    account: {
      id: 'accountId',
      label: 'accountLabel',
    },
    scope: 'openid',
    sessionId: 'sessionId',
    refreshToken: 'refreshToken',
    accessToken: 'accessToken',
    idToken: 'idToken',
    expiresAt: Date.now() + 777777777,
    expiresIn: 777777,
  };
  const session = convertToSession(token)
  expect(session.id).equals(token.sessionId);
  expect(session.accessToken).equals(token.accessToken);
  expect(session.idToken).equals(token.idToken);
  expect(session.account).equals(token.account);;
  expect(session.scopes).contain('openid');
});