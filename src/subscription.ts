import * as extensionApi from '@podman-desktop/api';
import { accessSync, constants, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const REGISTRY_REDHAT_IO = 'registry.redhat.io';

export async function signIntoRedHatDeveloperAccount(
  createIfNone = true,
): Promise<extensionApi.AuthenticationSession | undefined> {
  return extensionApi.authentication.getSession(
    'redhat.authentication-provider',
    [
      'api.iam.registry_service_accounts', //scope that gives access to hydra service accounts API
      'api.console',
    ], // scope that gives access to console.redhat.com APIs
    { createIfNone },
  );
}

// TODO: add listRegistries to registry API to allow search by
// registry URL
export function isRedHatRegistryConfigured(): boolean {
  const pathToAuthJson = path.join(homedir(), '.config', 'containers', 'auth.json');
  let configured = false;
  try {
    // TODO: handle all kind problems with file existence, accessibility and parsable content
    accessSync(pathToAuthJson, constants.R_OK);
    const authFileContent = readFileSync(pathToAuthJson, { encoding: 'utf8' });
    const authFileJson: {
      auths?: {
        [registryUrl: string]: {
          auth: string;
        };
      };
    } = JSON.parse(authFileContent);
    configured = authFileJson?.auths?.hasOwnProperty(REGISTRY_REDHAT_IO) || false;
  } catch (_notAccessibleError) {
    // if file is not there, ignore and return default value
  }
  return configured;
}
