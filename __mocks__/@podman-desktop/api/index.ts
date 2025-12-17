/**********************************************************************
 * Copyright (C) 2022 Red Hat, Inc.
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
/* eslint-disable @typescript-eslint/no-implicit-any */

import { ProgressOptions } from "@podman-desktop/api";
import { vi } from "vitest";

/**
 * Mock the extension API for vitest.
 * This file is referenced from vitest.config.js file.
 */

export const registry = {
  suggestRegistry: vi.fn(),
  unregisterRegistry: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

export const window = {
  createStatusBarItem: () => {
    return {
      show: vi.fn(),
      iconClass: '',
    };
  },
  withProgress: (_options: ProgressOptions, callback: (option: any) => void) => {
    return callback({
      report: () => { },
    });
  },
  showInformationMessage: vi.fn(),
};

export const StatusBarAlignLeft = 'LEFT';

export const ProgressLocation = {
  TASK_WIDGET: 2,
};

export const process = {
  exec: vi.fn(),
};

export const configuration = {
  getConfiguration: () => {
    return {
      get: vi.fn(),
    };
  },
};

export const extensions = {
  getExtension: vi.fn(),
};

export const env = {
  createTelemetryLogger: vi.fn().mockImplementation(() => ({
    logUsage: vi.fn(),
    logError: vi.fn(),
  })),
};

export const authentication = {
  registerAuthenticationProvider: vi.fn(),
  getSession: vi.fn(),
  onDidChangeSessions: vi.fn(),
};

export class EventEmitter {
  constructor() { };
  fire = vi.fn();
};
