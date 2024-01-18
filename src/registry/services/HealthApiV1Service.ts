/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ServiceHealth } from '../models/ServiceHealth';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class HealthApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * diagnostics
     * @returns ServiceHealth OK
     * @throws ApiError
     */
    public diagnosticsUsingGet(): CancelablePromise<ServiceHealth> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/diagnostics',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * health
     * @param includeBody includeBody
     * @returns ServiceHealth OK
     * @throws ApiError
     */
    public healthUsingGet(
        includeBody?: boolean,
    ): CancelablePromise<ServiceHealth> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/health',
            query: {
                'includeBody': includeBody,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * liveness
     * @returns any OK
     * @throws ApiError
     */
    public livenessUsingGet(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/liveness',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * readiness
     * @returns any OK
     * @throws ApiError
     */
    public readinessUsingGet(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/readiness',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
}
