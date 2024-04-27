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
import { isMac, isWindows } from './util';
import { process as podmanProcess, configuration, RunResult, RunError, provider } from '@podman-desktop/api';
import { ExtensionTelemetryLogger } from './telemetry';

const macosExtraPath = '/usr/local/bin:/opt/homebrew/bin:/opt/local/bin:/opt/podman/bin';

export const PODMAN_COMMANDS = {
  SM_VERSION: () => 'machine ssh sudo subscription-manager'.split(' '),
  RPM_INSTALL_SM: () => 'machine ssh sudo rpm-ostree install -y subscription-manager'.split(' '),
  SM_ACTIVATION_STATUS: () => 'machine ssh sudo subscription-manager status'.split(' '),
  SM_ACTIVATE_SUBS: (activationKeyName: string, orgId: string) =>
    `machine ssh sudo subscription-manager register --force --activationkey ${activationKeyName} --org ${orgId}`.split(
      ' ',
    ),
  SM_DEACTIVATE_SUBS: () => `machine ssh sudo subscription-manager unregister`.split(' '),
  MACHINE_STOP: () => 'machine stop'.split(' '),
  MACHINE_START: () => 'machine start'.split(' '),
  CREATE_FACTS_FILE: (oneLineJson: string) => [
    'machine',
    'ssh',
    `sudo mkdir -p /etc/rhsm/facts/ && printf '${oneLineJson}\\n' | sudo tee /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts`,
  ],
};

export function getInstallationPath(): string | undefined {
  const env = process.env;
  if (isWindows()) {
    return `c:\\Program Files\\RedHat\\Podman;${env.PATH}`;
  } else if (isMac()) {
    if (!env.PATH) {
      return macosExtraPath;
    } else {
      return env.PATH.concat(':').concat(macosExtraPath);
    }
  } else {
    return env.PATH;
  }
}

export function getPodmanCli(): string {
  // If we have a custom binary path regardless if we are running Windows or not
  const customBinaryPath = getCustomBinaryPath();
  if (customBinaryPath) {
    return customBinaryPath;
  }

  if (isWindows()) {
    return 'podman.exe';
  }
  return 'podman';
}

// Get the Podman binary path from configuration podman.binary.path
// return string or undefined
export function getCustomBinaryPath(): string | undefined {
  return configuration.getConfiguration('podman').get('binary.path');
}

export interface InstalledPodman {
  version: string;
}

type ErrorHandler<T> = (commandName: string, error: unknown) => T;
type TelemetryErrorHandler<T> = (commandName: string, telemetryEventName: string, error: unknown) => T;

async function runCommand<T>(
  commandName: string,
  command: string[],
  errorHandler: ErrorHandler<number>,
): Promise<number> {
  try {
    return await podmanProcess.exec(getPodmanCli(), command).then(() => 0);
  } catch (err) {
    return errorHandler(commandName, err);
  }
}

async function runCommandAndSendTelemetry<T>(
  commandName: string,
  telemetryEventName: string,
  command: string[],
  errorHandler: TelemetryErrorHandler<void>,
): Promise<RunResult> {
  try {
    return await podmanProcess.exec(getPodmanCli(), command);
  } catch (err) {
    errorHandler(commandName, telemetryEventName, err);
  }
}

function errToExitCodeHandler(commandName: string, err: unknown): number {
  const exitCode = (err as RunError).exitCode;
  console.error(`${commandName} returned exit code: ${exitCode}`);
  return exitCode;
}

function errTelemetryHandler(commandName: string, telemetryEventName: string, err: unknown): void {
  const runErr = err as RunError;
  console.error(`${commandName} failed.`, String(runErr), `stdout: ${runErr.stdout}`, `stderr: ${runErr.stderr}`);
  ExtensionTelemetryLogger.logError(telemetryEventName, { error: String(err) });
  throw err;
}

export async function runSubscriptionManager(): Promise<number> {
  return runCommand('Subscription manager execution', PODMAN_COMMANDS.SM_VERSION(), errToExitCodeHandler);
}

export async function runRpmInstallSubscriptionManager(): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager installation',
    'subscriptionManagerInstallationError',
    PODMAN_COMMANDS.RPM_INSTALL_SM(),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerActivationStatus(): Promise<number> {
  return runCommand(
    'Subscription manager subscription activation check',
    PODMAN_COMMANDS.SM_ACTIVATION_STATUS(),
    errToExitCodeHandler,
  );
}

export async function runSubscriptionManagerRegister(activationKeyName: string, orgId: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager registration',
    'subscriptionManagerRegisterError',
    PODMAN_COMMANDS.SM_ACTIVATE_SUBS(activationKeyName, orgId),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerUnregister(): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager unregister',
    'subscriptionManagerUnregisterError',
    PODMAN_COMMANDS.SM_DEACTIVATE_SUBS(),
    errTelemetryHandler,
  );
}

export async function runCreateFactsFile(jsonText: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts',
    'subscriptionManagerCreateFactsFileError',
    PODMAN_COMMANDS.CREATE_FACTS_FILE(jsonText.replace('\n', '\\n')),
    errTelemetryHandler,
  );
}

export async function runStopPodmanMachine(): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Podman machine stop',
    'stopPodmanMachineError',
    PODMAN_COMMANDS.MACHINE_STOP(),
    errTelemetryHandler,
  );
}

export async function runStartPodmanMachine(): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Podman machine start',
    'startPodmanMachineError',
    PODMAN_COMMANDS.MACHINE_START(),
    errTelemetryHandler,
  );
}

export function isPodmanMachineRunning(): boolean {
  const conns = provider.getContainerConnections();
  const startedPodman = conns.filter(
    conn =>
      conn.providerId === 'podman' &&
      conn.connection.status() === 'started' &&
      !conn.connection.endpoint.socketPath.startsWith('/run/user/'),
  );
  return startedPodman.length === 1;
}
