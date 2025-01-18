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
import * as podmanDesktopAPI from '@podman-desktop/api';
import type { PodmanExtensionApi } from '@podman-desktop/podman-extension-api';

import { ExtensionTelemetryLogger } from './telemetry';

export const PODMAN_COMMANDS = {
  smVersion: (machineName: string): string[] => `machine ssh ${machineName} sudo subscription-manager`.split(' '),
  rpmInstallSm: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo rpm-ostree install -y subscription-manager`.split(' '),
  smActgivationStatus: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager status`.split(' '),
  smActivateSubs: (machineName: string, activationKeyName: string, orgId: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager register --force --activationkey ${activationKeyName} --org ${orgId}`.split(
      ' ',
    ),
  smDeactivateSubs: (machineName: string): string[] =>
    `machine ssh ${machineName} sudo subscription-manager unregister`.split(' '),
  machineStop: (machineName: string): string[] => `machine stop ${machineName}`.split(' '),
  machineStart: (machineName: string): string[] => `machine start ${machineName}`.split(' '),
  createFactFile: (machineName: string, oneLineJson: string): string[] => [
    'machine',
    'ssh',
    machineName,
    `sudo mkdir -p /etc/rhsm/facts/ && printf '${oneLineJson}\\n' | sudo tee /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts`,
  ],
};

const podmanApiDummy = {
  exec: (): Promise<RunResult> => {
    throw Error('Podman extension API is not available.');
  },
};

function getPodmanApi(): PodmanExtensionApi {
  const podmanExports = podmanDesktopAPI.extensions.getExtension<PodmanExtensionApi>('podman-desktop.podman')?.exports;
  const podmanApi = podmanExports ? podmanExports : podmanApiDummy;
  return podmanApi;
}

type ErrorHandler<T> = (commandName: string, error: unknown) => T;
type TelemetryErrorHandler<T> = (commandName: string, telemetryEventName: string, error: unknown) => T;

async function runCommand(
  connection: podmanDesktopAPI.ProviderContainerConnection,
  commandName: string,
  command: string[],
  errorHandler: ErrorHandler<number>,
): Promise<number> {
  try {
    console.log(`Executing podman command: ${command.join(' ')}`);
    return await getPodmanApi()
      .exec(command, { connection })
      .then(() => 0);
  } catch (err) {
    return errorHandler(commandName, err);
  }
}

async function runCommandAndSendTelemetry(
  connection: podmanDesktopAPI.ProviderContainerConnection,
  commandName: string,
  telemetryEventName: string,
  command: string[],
  errorHandler: TelemetryErrorHandler<void>,
): Promise<RunResult | undefined> {
  try {
    console.log(`Executing podman command: ${command.join(' ')}`);
    return await getPodmanApi().exec(command, { connection });
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

export async function runSubscriptionManager(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<number> {
  return runCommand(
    connection,
    'Subscription manager execution',
    PODMAN_COMMANDS.smVersion(connection.connection.name),
    errToExitCodeHandler,
  );
}

export async function runRpmInstallSubscriptionManager(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Subscription manager installation',
    'subscriptionManagerInstallationError',
    PODMAN_COMMANDS.rpmInstallSm(connection.connection.name),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerActivationStatus(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<number> {
  return runCommand(
    connection,
    'Subscription manager subscription activation check',
    PODMAN_COMMANDS.smActgivationStatus(connection.connection.name),
    errToExitCodeHandler,
  );
}

export async function runSubscriptionManagerRegister(
  connection: podmanDesktopAPI.ProviderContainerConnection,
  activationKeyName: string,
  orgId: string,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Subscription manager registration',
    'subscriptionManagerRegisterError',
    PODMAN_COMMANDS.smActivateSubs(connection.connection.name, activationKeyName, orgId),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerUnregister(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Subscription manager unregister',
    'subscriptionManagerUnregisterError',
    PODMAN_COMMANDS.smDeactivateSubs(connection.connection.name),
    errTelemetryHandler,
  );
}

export async function runCreateFactsFile(
  connection: podmanDesktopAPI.ProviderContainerConnection,
  jsonText: string,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts',
    'subscriptionManagerCreateFactsFileError',
    PODMAN_COMMANDS.createFactFile(connection.connection.name, jsonText.replace('\n', '\\n')),
    errTelemetryHandler,
  );
}

export async function runStopPodmanMachine(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Podman machine stop',
    'stopPodmanMachineError',
    PODMAN_COMMANDS.machineStop(connection.connection.name),
    errTelemetryHandler,
  );
}

export async function runStartPodmanMachine(
  connection: podmanDesktopAPI.ProviderContainerConnection,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    connection,
    'Podman machine start',
    'startPodmanMachineError',
    PODMAN_COMMANDS.machineStart(connection.connection.name),
    errTelemetryHandler,
  );
}

export function getRunningPodmanMachineName(): podmanDesktopAPI.ProviderContainerConnection | undefined {
  const conns = podmanDesktopAPI.provider.getContainerConnections();
  const startedVms = conns.filter(
    conn =>
      conn.providerId === 'podman' &&
      conn.connection.status() === 'started' &&
      !conn.connection.endpoint.socketPath.startsWith('/run/user/'),
  );
  return startedVms.length >= 1 ? startedVms[0] : undefined;
}
