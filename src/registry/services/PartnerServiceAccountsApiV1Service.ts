/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePartnerServiceAccountV1 } from '../models/CreatePartnerServiceAccountV1';
import type { PartnerServiceAccountV1 } from '../models/PartnerServiceAccountV1';
import type { UpdateServiceAccountV1 } from '../models/UpdateServiceAccountV1';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class PartnerServiceAccountsApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * createServiceAccount
     * @param partnerCode partnerCode
     * @param request request
     * @returns PartnerServiceAccountV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public createServiceAccountUsingPost(
        partnerCode: string,
        request: CreatePartnerServiceAccountV1,
    ): CancelablePromise<PartnerServiceAccountV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/partners/{partnerCode}/service-accounts',
            path: {
                'partnerCode': partnerCode,
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
     * serviceAccountByName
     * @param name name
     * @param partnerCode partnerCode
     * @returns PartnerServiceAccountV1 OK
     * @throws ApiError
     */
    public serviceAccountByNameUsingGet(
        name: string,
        partnerCode: string,
    ): CancelablePromise<PartnerServiceAccountV1> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/partners/{partnerCode}/service-accounts/{name}',
            path: {
                'name': name,
                'partnerCode': partnerCode,
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
     * @param partnerCode partnerCode
     * @param request request
     * @returns PartnerServiceAccountV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public updateServiceAccountUsingPost(
        name: string,
        partnerCode: string,
        request: UpdateServiceAccountV1,
    ): CancelablePromise<PartnerServiceAccountV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/partners/{partnerCode}/service-accounts/{name}',
            path: {
                'name': name,
                'partnerCode': partnerCode,
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
     * @param partnerCode partnerCode
     * @returns any OK
     * @throws ApiError
     */
    public deleteServiceAccountUsingDelete(
        name: string,
        partnerCode: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/v1/partners/{partnerCode}/service-accounts/{name}',
            path: {
                'name': name,
                'partnerCode': partnerCode,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
            },
        });
    }
}
