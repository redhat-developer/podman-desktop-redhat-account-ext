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
import * as extensionApi from '@podman-desktop/api';
import { ExtensionTelemetryLogger as TelemetryLogger } from './telemetry';

const macosExtraPath = '/usr/local/bin:/opt/homebrew/bin:/opt/local/bin:/opt/podman/bin';

const PODMAN_COMMANDS = {
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
  return extensionApi.configuration.getConfiguration('podman').get('binary.path');
}

export interface InstalledPodman {
  version: string;
}

export async function runSubscriptionManager(): Promise<number | undefined> {
  try {
    await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.SM_VERSION());
    return 0;
  } catch (err) {
    const exitCode = (err as extensionApi.RunError).exitCode;
    console.error(`Subscription manager execution returned exit code: ${exitCode}`);
    // do not send telemetry because it is a check for it to be installed and
    // it might fail pretty often
    return exitCode;
  }
}

export async function runRpmInstallSubscriptionManager(): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.RPM_INSTALL_SM());
  } catch (err) {
    console.error(`Subscription manager installation failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerInstallationError', { error: String(err) });
    throw err;
  }
}

export async function runSubscriptionManagerActivationStatus(): Promise<number | undefined> {
  try {
    await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.SM_ACTIVATION_STATUS());
    return 0;
  } catch (err) {
    const exitCode = (err as extensionApi.RunError).exitCode;
    console.error(`Subscription manager subscription activation check returned exit code: ${exitCode}`);
    // do not send telemetry because it is a check for subscription status and
    // it might fail pretty often
    return exitCode;
  }
}

export async function runSubscriptionManagerRegister(
  activationKeyName: string,
  orgId: string,
): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.SM_ACTIVATE_SUBS(activationKeyName, orgId));
  } catch (err) {
    console.error(`Subscription manager registration failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerRegisterError', { error: String(err) });
    throw err;
  }
}

export async function runSubscriptionManagerUnregister(): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.SM_DEACTIVATE_SUBS());
  } catch (err) {
    console.error(`Subscription manager unregister failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerUnregisterError', { error: String(err) });
    throw err;
  }
}

export async function runCreateFactsFile(jsonText: string): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(
      getPodmanCli(),
      PODMAN_COMMANDS.CREATE_FACTS_FILE(jsonText.replace('\n', '\\n')),
    );
  } catch (err) {
    console.error(`Writing /etc/rhsm/facts/podman-desktop-redhat-account-ext.facts failed. ${String(err)}`);
    TelemetryLogger.logError('subscriptionManagerCreateFactsFileError', { error: String(err) });
    throw err;
  }
}

export async function runStopPodmanMachine(): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.MACHINE_STOP());
  } catch (err) {
    console.error(`Podman machine stop failed. ${String(err)}`);
    TelemetryLogger.logError('stopPodmanMachineError', { error: String(err) });
    throw err;
  }
}

export async function runStartPodmanMachine(): Promise<extensionApi.RunResult> {
  try {
    return await extensionApi.process.exec(getPodmanCli(), PODMAN_COMMANDS.MACHINE_START());
  } catch (err) {
    console.error(`Podman machine start failed. ${String(err)}`);
    TelemetryLogger.logError('startPodmanMachineError', { error: String(err) });
    throw err;
  }
}

export function isPodmanMachineRunning(): boolean {
  const conns = extensionApi.provider.getContainerConnections();
  const startedPodman = conns.filter(
    conn =>
      conn.providerId === 'podman' &&
      conn.connection.status() === 'started' &&
      !conn.connection.endpoint.socketPath.startsWith('/run/user/'),
  );
  return startedPodman.length === 1;
}
