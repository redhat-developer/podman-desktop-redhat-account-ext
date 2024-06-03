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
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { process as podmanProcess } from '@podman-desktop/api';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  getPodmanCli,
  PODMAN_COMMANDS,
  runCreateFactsFile,
  runRpmInstallSubscriptionManager,
  runStartPodmanMachine,
  runStopPodmanMachine,
  runSubscriptionManager,
  runSubscriptionManagerActivationStatus,
  runSubscriptionManagerRegister,
} from './podman-cli';
import { ExtensionTelemetryLogger } from './telemetry';

vi.mock('@podman-desktop/api');

const runResult = { command: 'command line', stdout: 'stdout output', stderr: 'stderr output' };
const runError = {
  exitCode: 1,
  stdout: 'stdout output',
  stderr: 'stderr output',
  toString: (): string => 'error message',
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('runSubscriptionManager returns 0 when it is installed', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runSubscriptionManager('machine1');
  expect(result).toBe(0);
});

test('runSubscriptionManager returns 1 when it is not installed', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue({
    exitCode: 1,
    stdout: 'stdout output',
    stderr: 'stderr output',
    toString: () => 'error message',
  });
  const result = await runSubscriptionManager('machine1');
  expect(result).toBe(1);
});

test('runRpmInstallSubscription manager returns 0 when successful', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runRpmInstallSubscriptionManager('machine1');
  expect(result).toBe(runResult);
  expect(podmanProcess.exec).toBeCalledWith(getPodmanCli(), PODMAN_COMMANDS.RPM_INSTALL_SM('machine1'));
});

test('runRpmInstallSubscription manager returns none 0 error code when failed and send telemetry', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue(runError);
  const logErrorSpy = vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {
    return;
  });
  const consoleError = vi.spyOn(console, 'error');
  let error: unknown;
  await runRpmInstallSubscriptionManager('machine1').catch((err: unknown) => {
    error = err;
  });
  expect(String(error)).toBe(String(runError));
  expect(logErrorSpy).toBeCalledWith('subscriptionManagerInstallationError', { error: 'error message' });
  expect(consoleError).toBeCalledWith(
    'Subscription manager installation failed.',
    runError.toString(),
    `stdout: ${runError.stdout}`,
    `stderr: ${runError.stderr}`,
  );
});

test('runSubscriptionManagerActivationStatus returns 0 when it has subscription activated', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runSubscriptionManagerActivationStatus('machine1');
  expect(result).toBe(0);
});

test('runSubscriptionManagerActivationStatus returns 1 when it has no active subscription', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue({
    exitCode: 1,
    stdout: 'stdout output',
    stderr: 'stderr output',
    toString: () => 'error message',
  });
  const result = await runSubscriptionManagerActivationStatus('machine1');
  expect(result).toBe(1);
});

test('runSubscriptionManagerRegister returns 0 when successful', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runSubscriptionManagerRegister('machine1', 'activation-key-name', 'orgId');
  expect(result).toBe(runResult);
  expect(podmanProcess.exec).toBeCalledWith(
    getPodmanCli(),
    PODMAN_COMMANDS.SM_ACTIVATE_SUBS('machine1', 'activation-key-name', 'orgId'),
  );
});

test('runSubscriptionManagerRegister manager returns none 0 error code when failed and send telemetry', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue(runError);
  const logErrorSpy = vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {
    return;
  });
  const consoleError = vi.spyOn(console, 'error');
  let error: unknown;
  await runSubscriptionManagerRegister('machine1', 'activation-key-name', 'orgId').catch((err: unknown) => {
    error = err;
  });
  expect(String(error)).toBe(String(runError));
  expect(logErrorSpy).toBeCalledWith('subscriptionManagerRegisterError', { error: 'error message' });
  expect(consoleError).toBeCalledWith(
    'Subscription manager registration failed.',
    runError.toString(),
    `stdout: ${runError.stdout}`,
    `stderr: ${runError.stderr}`,
  );
});

test('runCreateFactsFile returns 0 when successful', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runCreateFactsFile('machine1', '{"field":"value"}');
  expect(result).toBe(runResult);
  expect(podmanProcess.exec).toBeCalledWith(
    getPodmanCli(),
    PODMAN_COMMANDS.CREATE_FACTS_FILE('machine1', '{"field":"value"}'),
  );
});

test('runCreateFactsFile manager returns none 0 error code when failed and send telemetry', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue(runError);
  const logErrorSpy = vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {
    return;
  });
  const consoleError = vi.spyOn(console, 'error');
  let error: unknown;
  await runCreateFactsFile('machine1', '{"field":"value"}').catch((err: unknown) => {
    error = err;
  });
  expect(String(error)).toBe(String(runError));
  expect(logErrorSpy).toBeCalledWith('subscriptionManagerCreateFactsFileError', { error: 'error message' });
  expect(consoleError).toBeCalledWith(
    'Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts failed.',
    runError.toString(),
    `stdout: ${runError.stdout}`,
    `stderr: ${runError.stderr}`,
  );
});

test('runStopPodmanMachine returns 0 when successful', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runStopPodmanMachine('machine1');
  expect(result).toBe(runResult);
  expect(podmanProcess.exec).toBeCalledWith(getPodmanCli(), PODMAN_COMMANDS.MACHINE_STOP('machine1'));
});

test('runStopPodmanMachine manager returns none 0 error code when failed and send telemetry', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue(runError);
  const logErrorSpy = vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {
    return;
  });
  const consoleError = vi.spyOn(console, 'error');
  let error: unknown;
  await runStopPodmanMachine('machine1').catch((err: unknown) => {
    error = err;
  });
  expect(String(error)).toBe(String(runError));
  expect(logErrorSpy).toBeCalledWith('stopPodmanMachineError', { error: 'error message' });
  expect(consoleError).toBeCalledWith(
    'Podman machine stop failed.',
    runError.toString(),
    `stdout: ${runError.stdout}`,
    `stderr: ${runError.stderr}`,
  );
});

test('runStartPodmanMachine returns 0 when successful', async () => {
  vi.mocked(podmanProcess.exec).mockResolvedValue(runResult);
  const result = await runStartPodmanMachine('machine1');
  expect(result).toBe(runResult);
  expect(podmanProcess.exec).toBeCalledWith(getPodmanCli(), PODMAN_COMMANDS.MACHINE_START('machine1'));
});

test('runStartPodmanMachine manager returns none 0 error code when failed and send telemetry', async () => {
  vi.mocked(podmanProcess.exec).mockRejectedValue(runError);
  const logErrorSpy = vi.spyOn(ExtensionTelemetryLogger, 'logError').mockImplementation(() => {
    return;
  });
  const consoleError = vi.spyOn(console, 'error');
  let error: unknown;
  await runStartPodmanMachine('machine1').catch((err: unknown) => {
    error = err;
  });
  expect(String(error)).toBe(String(runError));
  expect(logErrorSpy).toBeCalledWith('startPodmanMachineError', { error: 'error message' });
  expect(consoleError).toBeCalledWith(
    'Podman machine start failed.',
    runError.toString(),
    `stdout: ${runError.stdout}`,
    `stderr: ${runError.stderr}`,
  );
});
