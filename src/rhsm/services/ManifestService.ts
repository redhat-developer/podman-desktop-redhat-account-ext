/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { APIPageParam } from '../models/APIPageParam';
import type { exportJobResponse } from '../models/exportJobResponse';
import type { exportResponse } from '../models/exportResponse';
import type { Manifest } from '../models/Manifest';
import type { ManifestDetails } from '../models/ManifestDetails';
import type { ManifestSummary } from '../models/ManifestSummary';
import type { ManifestVersion } from '../models/ManifestVersion';
import type { poolsListMock } from '../models/poolsListMock';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ManifestService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Satellite versions
     * Returns list of Satellite version 6.0 and above
     * @returns any list of Satellite version
     * @throws ApiError
     */
    public listVersionsManifest(): CancelablePromise<{
        body?: Array<ManifestVersion>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/versions',
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Get an Manifest by UUID
     * System, RHUI, Hypervisor, SAM are unsupported manifest types
     * @param uuid
     * @param include Show more details about a manifest
     * @returns any success response
     * @throws ApiError
     */
    public showManifest(
        uuid: string,
        include?: 'entitlements',
    ): CancelablePromise<{
        body?: ManifestDetails;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/{uuid}',
            path: {
                'uuid': uuid,
            },
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
    /**
     * Remove manifest profile
     * The default success response will be 204
     *
     * System, RHUI, Hypervisor, SAM are unsupported manifet types
     * @param uuid
     * @param force Deleting a subscription manifest can have significant impacts on your hosts and activation keys.
     * We require a force parameter to make sure the delete operation is intentional.
     * @returns void
     * @throws ApiError
     */
    public removeManifest(
        uuid: string,
        force: boolean,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/manifests/{uuid}',
            path: {
                'uuid': uuid,
            },
            query: {
                'force': force,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                500: `InternalServerError error`,
                504: `GatewayTimeout error`,
            },
        });
    }
    /**
     * Update a manifest
     * Allows to update simpleContentAccess for Satellite of version 6.3 and
     * above
     * Possible value for simpleContentAccess are:
     *
     * - enabled
     * - disabled
     * @param uuid
     * @param manifest
     * @returns void
     * @throws ApiError
     */
    public updateManifest(
        uuid: string,
        manifest?: {
            simpleContentAccess: string;
        },
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/manifests/{uuid}',
            path: {
                'uuid': uuid,
            },
            body: manifest,
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Attach entitlement to Manifest
     * Satellite 5.6 or higher versions are only supported.
     * @param pool
     * @param uuid
     * @param quantity quantity you want to attach
     * @returns any Success
     * @throws ApiError
     */
    public attachEntitlementManifest(
        pool: string,
        uuid: string,
        quantity?: number,
    ): CancelablePromise<{
        body?: ManifestDetails;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/manifests/{uuid}/entitlements',
            path: {
                'uuid': uuid,
            },
            query: {
                'pool': pool,
                'quantity': quantity,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                500: `InternalServerError error`,
                504: `GatewayTimeout error`,
            },
        });
    }
    /**
     * Remove entitlement from the manifest
     * The default success response will be 204.
     * @param uuid
     * @param entitlementId
     * @returns void
     * @throws ApiError
     */
    public removeManifestEntitlement(
        uuid: string,
        entitlementId: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/manifests/{uuid}/entitlements/{EntitlementID}',
            path: {
                'uuid': uuid,
                'EntitlementID': entitlementId,
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
    /**
     * Update attached entitlement to manifest
     * The default success response will be 200.
     *
     * System, RHUI, Hypervisor, SAM are unsupported manifest types
     * @param uuid
     * @param entitlementId
     * @param quantity maxItem: quantity must be less than or equal to the maximum number of allowed entitlements in the entitlement pool
     * minItem: 1
     * @returns any Success response
     * @throws ApiError
     */
    public updateEntitlementManifest(
        uuid: string,
        entitlementId: string,
        quantity?: number,
    ): CancelablePromise<{
        body?: ManifestDetails;
    }> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/manifests/{uuid}/entitlements/{EntitlementID}',
            path: {
                'uuid': uuid,
                'EntitlementID': entitlementId,
            },
            query: {
                'quantity': quantity,
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
    /**
     * List all manifests for a user
     * The default and max number of results in a response are 100.
     * Satellite 6.0 or higher versions are only supported.
     * @param limit max number of results you want
     * @param offset index from which you want next items
     * @returns any list of manifests
     * @throws ApiError
     */
    public listManifests(
        limit?: number,
        offset?: number,
    ): CancelablePromise<{
        body?: Array<Manifest>;
        pagination?: APIPageParam;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests',
            query: {
                'limit': limit,
                'offset': offset,
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
    /**
     * Create Manifest
     * Create Manifest by name and version(optional).
     * Customers can use any version listed in the `/v2/manifests/versions`
     * endpoint (use attribute `value`).
     * If no version is specified, it will take the latest available version
     * for Manifest.
     * @param name must be less than 100 characters and use only numbers, letters, underscores, hyphens, and periods
     * @param version
     * @returns any Success
     * @throws ApiError
     */
    public createManifest(
        name: string,
        version?: string,
    ): CancelablePromise<{
        body?: ManifestSummary;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/manifests',
            query: {
                'Name': name,
                'version': version,
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
    /**
     * List all pools for a manifest
     * Satellite 5.6 or higher versions are only supported.
     * @param uuid
     * @param limit max number of results you want
     * @param offset index from which you want next items
     * @param future include future dated pools for satellite 6.3 or higher
     * @returns poolsListMock list of pools available for the manifest
     * @throws ApiError
     */
    public listManifestPools(
        uuid: string,
        limit?: number,
        offset?: number,
        future?: boolean,
    ): CancelablePromise<poolsListMock> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/{uuid}/pools',
            path: {
                'uuid': uuid,
            },
            query: {
                'limit': limit,
                'offset': offset,
                'future': future,
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
    /**
     * Trigger manifest export
     * Starts job to generate export for a manifest. To check the status of the export job visit the href in the response.
     *
     * Satellite 6.0 or higher versions are only supported.
     * @param uuid
     * @returns any ExportManifest200 is the success response
     * @throws ApiError
     */
    public exportManifest(
        uuid: string,
    ): CancelablePromise<{
        body?: exportResponse;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/{uuid}/export',
            path: {
                'uuid': uuid,
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
    /**
     * Check status of manifest export
     * Returns export download link in response.
     * @param uuid
     * @param exportJobId
     * @returns any ExportJobManifest200 is the success response
     * @throws ApiError
     */
    public exportJobManifest(
        uuid: string,
        exportJobId: string,
    ): CancelablePromise<{
        body?: exportJobResponse;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/{uuid}/exportJob/{ExportJobID}',
            path: {
                'uuid': uuid,
                'ExportJobID': exportJobId,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                404: `NotFound error`,
                406: `NotAcceptable error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Download manifest
     * Success response contains a zip file. The link is one-time download and expires after one try. Trigger export job to get another download link.
     *
     * Content-Type: application/zip
     * @param uuid
     * @param exportId
     * @returns number GetExportManifest200 is the success response
     * @throws ApiError
     */
    public getExportManifest(
        uuid: string,
        exportId: string,
    ): CancelablePromise<Array<number>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/manifests/{uuid}/export/{ExportID}',
            path: {
                'uuid': uuid,
                'ExportID': exportId,
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
