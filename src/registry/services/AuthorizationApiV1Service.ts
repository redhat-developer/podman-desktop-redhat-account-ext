/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthorizationV1 } from '../models/AuthorizationV1';
import type { GetAuthorizationV1 } from '../models/GetAuthorizationV1';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuthorizationApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * getAuthorization
     * @param request request
     * @returns AuthorizationV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public getAuthorizationUsingPost(
        request: GetAuthorizationV1,
    ): CancelablePromise<AuthorizationV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/authorization',
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
}
