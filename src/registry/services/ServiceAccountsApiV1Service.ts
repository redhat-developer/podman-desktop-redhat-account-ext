/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateServiceAccountV1 } from '../models/CreateServiceAccountV1';
import type { KeyV1 } from '../models/KeyV1';
import type { ServiceAccountV1 } from '../models/ServiceAccountV1';
import type { SummariesV1 } from '../models/SummariesV1';
import type { UpdateServiceAccountV1 } from '../models/UpdateServiceAccountV1';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ServiceAccountsApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * createServiceAccount
     * @param request request
     * @returns ServiceAccountV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public createServiceAccountUsingPost1(
        request: CreateServiceAccountV1,
    ): CancelablePromise<ServiceAccountV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/service-accounts',
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * signingKey
     * @returns KeyV1 OK
     * @throws ApiError
     */
    public signingKeyUsingGet(): CancelablePromise<KeyV1> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/service-accounts/token-signing-key',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * listServicesForAccount
     * @param rhAccountId rhAccountId
     * @param maxResults maxResults
     * @param offset offset
     * @returns SummariesV1 OK
     * @throws ApiError
     */
    public listServicesForAccountUsingGet(
        rhAccountId: string,
        maxResults?: number,
        offset?: number,
    ): CancelablePromise<SummariesV1> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/service-accounts/{rhAccountId}',
            path: {
                'rhAccountId': rhAccountId,
            },
            query: {
                'maxResults': maxResults,
                'offset': offset,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * serviceAccountByName
     * @param name name
     * @param rhAccountId rhAccountId
     * @returns ServiceAccountV1 OK
     * @throws ApiError
     */
    public serviceAccountByNameUsingGet1(
        name: string,
        rhAccountId: string,
    ): CancelablePromise<ServiceAccountV1> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/service-accounts/{rhAccountId}/{name}',
            path: {
                'name': name,
                'rhAccountId': rhAccountId,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * updateServiceAccount
     * @param name name
     * @param request request
     * @param rhAccountId rhAccountId
     * @returns ServiceAccountV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public updateServiceAccountUsingPost1(
        name: string,
        request: UpdateServiceAccountV1,
        rhAccountId: string,
    ): CancelablePromise<ServiceAccountV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/service-accounts/{rhAccountId}/{name}',
            path: {
                'name': name,
                'rhAccountId': rhAccountId,
            },
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * deleteServiceAccount
     * @param name name
     * @param rhAccountId rhAccountId
     * @returns any OK
     * @throws ApiError
     */
    public deleteServiceAccountUsingDelete1(
        name: string,
        rhAccountId: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/v1/service-accounts/{rhAccountId}/{name}',
            path: {
                'name': name,
                'rhAccountId': rhAccountId,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
            },
        });
    }
}
