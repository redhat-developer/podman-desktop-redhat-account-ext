/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrgSimpleContentAccess } from '../models/OrgSimpleContentAccess';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OrganizationService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get details of the user's organization
     * Show Simple Content Access details of user's organization
     * @param include Request for system purpose attributes in response
     * @returns any Organization details
     * @throws ApiError
     */
    public checkOrgScaCapability(
        include?: string,
    ): CancelablePromise<{
        body?: OrgSimpleContentAccess;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/organization',
            query: {
                'include': include,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                500: `InternalServerError error`,
            },
        });
    }
}
