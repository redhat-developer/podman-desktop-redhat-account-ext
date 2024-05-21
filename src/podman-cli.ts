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
import type { RunError, RunResult } from '@podman-desktop/api';
import { configuration, process as podmanProcess, provider } from '@podman-desktop/api';

import { ExtensionTelemetryLogger } from './telemetry';
import { isMac, isWindows } from './util';

const macosExtraPath = '/usr/local/bin:/opt/homebrew/bin:/opt/local/bin:/opt/podman/bin';

export const PODMAN_COMMANDS = {
  SM_VERSION: (machineName: string): string[] => `machine ssh ${machineName} sudo subscription-manager`.split(' '),
  RPM_INSTALL_SM: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo rpm-ostree install -y subscription-manager`.split(' '),
  SM_ACTIVATION_STATUS: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager status`.split(' '),
  SM_ACTIVATE_SUBS: (machineName: string, activationKeyName: string, orgId: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager register --force --activationkey ${activationKeyName} --org ${orgId}`.split(
      ' ',
    ),
  SM_DEACTIVATE_SUBS: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager unregister`.split(' '),
  MACHINE_STOP: (machineName: string): string[] => `machine stop ${machineName}`.split(' '),
  MACHINE_START: (machineName: string): string[] => `machine start ${machineName}`.split(' '),
  CREATE_FACTS_FILE: (machineName: string, oneLineJson: string): string[] => [
    'machine',
    'ssh',
    machineName,
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

async function runCommand(commandName: string, command: string[], errorHandler: ErrorHandler<number>): Promise<number> {
  try {
    console.log(`Executing: ${getPodmanCli()} ${command.join(' ')}`);
    return await podmanProcess.exec(getPodmanCli(), command).then(() => 0);
  } catch (err) {
    return errorHandler(commandName, err);
  }
}

async function runCommandAndSendTelemetry(
  commandName: string,
  telemetryEventName: string,
  command: string[],
  errorHandler: TelemetryErrorHandler<void>,
): Promise<RunResult> {
  try {
    console.log(`Executing: ${getPodmanCli()} ${command.join(' ')}`);
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

export async function runSubscriptionManager(machineName: string): Promise<number> {
  return runCommand('Subscription manager execution', PODMAN_COMMANDS.SM_VERSION(machineName), errToExitCodeHandler);
}

export async function runRpmInstallSubscriptionManager(machineName: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager installation',
    'subscriptionManagerInstallationError',
    PODMAN_COMMANDS.RPM_INSTALL_SM(machineName),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerActivationStatus(machineName: string): Promise<number> {
  return runCommand(
    'Subscription manager subscription activation check',
    PODMAN_COMMANDS.SM_ACTIVATION_STATUS(machineName),
    errToExitCodeHandler,
  );
}

export async function runSubscriptionManagerRegister(
  machineName: string,
  activationKeyName: string,
  orgId: string,
): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager registration',
    'subscriptionManagerRegisterError',
    PODMAN_COMMANDS.SM_ACTIVATE_SUBS(machineName, activationKeyName, orgId),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerUnregister(machineName: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Subscription manager unregister',
    'subscriptionManagerUnregisterError',
    PODMAN_COMMANDS.SM_DEACTIVATE_SUBS(machineName),
    errTelemetryHandler,
  );
}

export async function runCreateFactsFile(machineName: string, jsonText: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts',
    'subscriptionManagerCreateFactsFileError',
    PODMAN_COMMANDS.CREATE_FACTS_FILE(machineName, jsonText.replace('\n', '\\n')),
    errTelemetryHandler,
  );
}

export async function runStopPodmanMachine(machineName: string): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Podman machine stop',
    'stopPodmanMachineError',
    PODMAN_COMMANDS.MACHINE_STOP(machineName),
    errTelemetryHandler,
  );
}

export async function runStartPodmanMachine(machineName): Promise<RunResult> {
  return runCommandAndSendTelemetry(
    'Podman machine start',
    'startPodmanMachineError',
    PODMAN_COMMANDS.MACHINE_START(machineName),
    errTelemetryHandler,
  );
}

export function getRunningPodmanMachineName(): string | undefined {
  const conns = provider.getContainerConnections();
  const startedPodman = conns.filter(
    conn =>
      conn.providerId === 'podman' &&
      conn.connection.status() === 'started' &&
      !conn.connection.endpoint.socketPath.startsWith('/run/user/'),
  );
  const tempName = startedPodman.length === 1 ? startedPodman[0].connection.name : undefined;
  return tempName === 'Podman Machine' ? 'podman-machine-default' : tempName;
}
