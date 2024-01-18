/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExportHoldReviewV1 } from '../models/ExportHoldReviewV1';
import type { SetExportHoldV1 } from '../models/SetExportHoldV1';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ExportHoldApiV1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * setExportHold
     * @param request request
     * @returns ExportHoldReviewV1 OK
     * @returns any Created
     * @throws ApiError
     */
    public setExportHoldUsingPost(
        request: SetExportHoldV1,
    ): CancelablePromise<ExportHoldReviewV1 | any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/v1/export-holds',
            body: request,
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
    /**
     * exportHoldStatusForAccount
     * @param rhAccountId rhAccountId
     * @returns ExportHoldReviewV1 OK
     * @throws ApiError
     */
    public exportHoldStatusForAccountUsingGet(
        rhAccountId: string,
    ): CancelablePromise<ExportHoldReviewV1> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/v1/export-holds/{rhAccountId}',
            path: {
                'rhAccountId': rhAccountId,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not Found`,
            },
        });
    }
}
