/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ResponseEntity } from '../models/ResponseEntity';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AdminApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * ensureDataIndexed
     * @returns ResponseEntity OK
     * @returns any Created
     * @throws ApiError
     */
    public ensureDataIndexedUsingPost(): CancelablePromise<ResponseEntity | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/_admin/ensureDataIndexed',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * environment
     * @param property property
     * @returns any OK
     * @throws ApiError
     */
    public environmentUsingGet(
        property: string,
    ): CancelablePromise<Record<string, any>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/_admin/environment/{property}',
            path: {
                'property': property,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
}
