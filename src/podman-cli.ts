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

async function runCommand(commandName: string, command: string[], errorHandler: ErrorHandler<number>): Promise<number> {
  try {
    console.log(`Executing podman command: ${command.join(' ')}`);
    return await getPodmanApi()
      .exec(command)
      .then(() => 0);
  } catch (err) {
    return errorHandler(commandName, err);
  }
}

async function runCommandAndSendTelemetry(
  commandName: string,
  telemetryEventName: string,
  command: string[],
  errorHandler: TelemetryErrorHandler<void>,
): Promise<RunResult | undefined> {
  try {
    console.log(`Executing podman command: ${command.join(' ')}`);
    return await getPodmanApi().exec(command);
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
  return runCommand('Subscription manager execution', PODMAN_COMMANDS.smVersion(machineName), errToExitCodeHandler);
}

export async function runRpmInstallSubscriptionManager(machineName: string): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Subscription manager installation',
    'subscriptionManagerInstallationError',
    PODMAN_COMMANDS.rpmInstallSm(machineName),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerActivationStatus(machineName: string): Promise<number> {
  return runCommand(
    'Subscription manager subscription activation check',
    PODMAN_COMMANDS.smActgivationStatus(machineName),
    errToExitCodeHandler,
  );
}

export async function runSubscriptionManagerRegister(
  machineName: string,
  activationKeyName: string,
  orgId: string,
): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Subscription manager registration',
    'subscriptionManagerRegisterError',
    PODMAN_COMMANDS.smActivateSubs(machineName, activationKeyName, orgId),
    errTelemetryHandler,
  );
}

export async function runSubscriptionManagerUnregister(machineName: string): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Subscription manager unregister',
    'subscriptionManagerUnregisterError',
    PODMAN_COMMANDS.smDeactivateSubs(machineName),
    errTelemetryHandler,
  );
}

export async function runCreateFactsFile(machineName: string, jsonText: string): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts',
    'subscriptionManagerCreateFactsFileError',
    PODMAN_COMMANDS.createFactFile(machineName, jsonText.replace('\n', '\\n')),
    errTelemetryHandler,
  );
}

export async function runStopPodmanMachine(machineName: string): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Podman machine stop',
    'stopPodmanMachineError',
    PODMAN_COMMANDS.machineStop(machineName),
    errTelemetryHandler,
  );
}

export async function runStartPodmanMachine(machineName: string): Promise<RunResult | undefined> {
  return runCommandAndSendTelemetry(
    'Podman machine start',
    'startPodmanMachineError',
    PODMAN_COMMANDS.machineStart(machineName),
    errTelemetryHandler,
  );
}

export function getRunningPodmanMachineName(): string | undefined {
  const conns = podmanDesktopAPI.provider.getContainerConnections();
  const startedPodman = conns.filter(
    conn =>
      conn.providerId === 'podman' &&
      conn.connection.status() === 'started' &&
      !conn.connection.endpoint.socketPath.startsWith('/run/user/'),
  );
  const tempName = startedPodman.length === 1 ? startedPodman[0].connection.name : undefined;
  return tempName === 'Podman Machine' ? 'podman-machine-default' : tempName;
}
