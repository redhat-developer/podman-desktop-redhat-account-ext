/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { AxiosHttpRequest } from './core/AxiosHttpRequest';
import { ActivationKeyService } from './services/ActivationKeyService';
import { ManifestService } from './services/ManifestService';
import { OrganizationService } from './services/OrganizationService';
import { ProductsService } from './services/ProductsService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class RhsmClient {
    public readonly activationKey: ActivationKeyService;
    public readonly manifest: ManifestService;
    public readonly organization: OrganizationService;
    public readonly products: ProductsService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'https://api.access.redhat.com/management/v2',
            VERSION: config?.VERSION ?? '2',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.activationKey = new ActivationKeyService(this.request);
        this.manifest = new ManifestService(this.request);
        this.organization = new OrganizationService(this.request);
        this.products = new ProductsService(this.request);
    }
}

