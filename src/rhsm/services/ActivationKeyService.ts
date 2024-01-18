/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActivationKeys } from '../models/ActivationKeys';
import type { AdditionalRepositories } from '../models/AdditionalRepositories';
import type { APIPageParam } from '../models/APIPageParam';
import type { AvailableRepositories } from '../models/AvailableRepositories';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ActivationKeyService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List activation keys
     * Returns a list of activation keys on the account including service level, role, additionalRepositories, usage, and release version (if applicable). Additional Repositories and release version will be an empty set in case it is not set.
     * @returns any Array of activation keys
     * @throws ApiError
     */
    public listActivationKeys(): CancelablePromise<{
        body?: Array<ActivationKeys>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/activation_keys',
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Create activation key
     * Creates an activation key by name, release version and system purpose attributes, that are service level, role and usage. In the request body, "name" should be present and unique and can only contain letters, numbers, underscores, or hyphens. The response will have name and additionalRepositories as fixed fields. AdditionalRepositories field will always be empty for a new activation key. Role, serviceLevel, usage and releaseVersion are conditional fields, will be present in response only when they have values.
     * @param activationKey Create an activation key
     * @returns any Activation key
     * @throws ApiError
     */
    public createActivationKeys(
        activationKey?: {
            /**
             * Name should be present, unique and can only contain letters, numbers, underscores, or hyphens
             */
            name: string;
            serviceLevel?: string;
            role?: string;
            usage?: string;
            releaseVersion?: string;
            additionalRepositories?: Array<{
                repositoryLabel?: string;
            }>;
        },
    ): CancelablePromise<{
        body?: ActivationKeys;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/activation_keys',
            body: activationKey,
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Get activation key
     * Get activation key by name
     * @param name
     * @returns any Activation key
     * @throws ApiError
     */
    public showActivationKey(
        name: string,
    ): CancelablePromise<{
        body?: ActivationKeys;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/activation_keys/{name}',
            path: {
                'name': name,
            },
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Delete activation key
     * Removes the activation key from the account based on activation key name
     * @param name
     * @returns void
     * @throws ApiError
     */
    public removeActivationKeys(
        name: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/activation_keys/{name}',
            path: {
                'name': name,
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
     * Update activation key
     * Updates an existing activation key with one or more fields as provided in request. It also returns additionalRepositories field which will be empty set when it is empty
     * @param name
     * @param activationKey Update an activation key
     * @returns any Activation key
     * @throws ApiError
     */
    public updateActivationKeys(
        name: string,
        activationKey?: {
            serviceLevel?: string;
            role?: string;
            usage?: string;
            releaseVersion?: string;
        },
    ): CancelablePromise<{
        body?: ActivationKeys;
    }> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/activation_keys/{name}',
            path: {
                'name': name,
            },
            body: activationKey,
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Add Additional Repositories
     * Add additional repositories to an activation key by providing activation key name and repository labels. Customers can use any respositories listed in the `/v2/activation_keys/{name}/available_repositories` endpoint (use attribute `repositoryLabel`). Empty value is not supported and maximum length of repository label allowed is upto 255 characters.
     * @param name
     * @param activationKey Add Additional repositories
     * @returns any list of additional repositories
     * @throws ApiError
     */
    public addAdditionalRepositories(
        name: string,
        activationKey?: Array<AdditionalRepositories>,
    ): CancelablePromise<{
        body?: Array<AdditionalRepositories>;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/activation_keys/{name}/additional_repositories',
            path: {
                'name': name,
            },
            body: activationKey,
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Delete Additional Repositories
     * Removes the additional repositories from an activation key by providing activation key name and repository labels
     * @param name
     * @param additionalRepositories
     * @returns void
     * @throws ApiError
     */
    public removeActivationKeyAdditionalRepositories(
        name: string,
        additionalRepositories?: Array<AdditionalRepositories>,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/activation_keys/{name}/additional_repositories',
            path: {
                'name': name,
            },
            body: additionalRepositories,
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
     * List Available Repositories
     * Returns the list of RPM repositories available to an activation key that can be added as an additional repository. Available repositories are calculated by negating the additional repositories from the set of total RPM repositories. It can be an empty set if there are no RPM repositories or all of the repositories are already added to an activation key.
     * @param name
     * @param limit max number of results you want
     * @param offset index from which you want next items
     * @param _default Filters available repos based off default status
     * @returns any list of available repositories
     * @throws ApiError
     */
    public listAvailableRepositories(
        name: string,
        limit?: number,
        offset?: number,
        _default?: 'Disabled',
    ): CancelablePromise<{
        body?: Array<AvailableRepositories>;
        pagination?: APIPageParam;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/activation_keys/{name}/available_repositories',
            path: {
                'name': name,
            },
            query: {
                'limit': limit,
                'offset': offset,
                'default': _default,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
}
