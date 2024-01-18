/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { AxiosHttpRequest } from './core/AxiosHttpRequest';
import { AdminApiV1Service } from './services/AdminApiV1Service';
import { AuthorizationApiV1Service } from './services/AuthorizationApiV1Service';
import { ExportHoldApiV1Service } from './services/ExportHoldApiV1Service';
import { HealthApiV1Service } from './services/HealthApiV1Service';
import { PartnerServiceAccountsApiV1Service } from './services/PartnerServiceAccountsApiV1Service';
import { ServiceAccountsApiV1Service } from './services/ServiceAccountsApiV1Service';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class ContainerRegistryAuthorizerClient {
    public readonly adminApiV1: AdminApiV1Service;
    public readonly authorizationApiV1: AuthorizationApiV1Service;
    public readonly exportHoldApiV1: ExportHoldApiV1Service;
    public readonly healthApiV1: HealthApiV1Service;
    public readonly partnerServiceAccountsApiV1: PartnerServiceAccountsApiV1Service;
    public readonly serviceAccountsApiV1: ServiceAccountsApiV1Service;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:8443',
            VERSION: config?.VERSION ?? '1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.adminApiV1 = new AdminApiV1Service(this.request);
        this.authorizationApiV1 = new AuthorizationApiV1Service(this.request);
        this.exportHoldApiV1 = new ExportHoldApiV1Service(this.request);
        this.healthApiV1 = new HealthApiV1Service(this.request);
        this.partnerServiceAccountsApiV1 = new PartnerServiceAccountsApiV1Service(this.request);
        this.serviceAccountsApiV1 = new ServiceAccountsApiV1Service(this.request);
    }
}

