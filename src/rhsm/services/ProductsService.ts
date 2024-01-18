/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EusProductList } from '../models/EusProductList';
import type { ProductList } from '../models/ProductList';
import type { StatusCount } from '../models/StatusCount';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ProductsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all the products from user's subscription
     * Get list of all the products of user's subscription. The products are from subscriptions that have not expired or expired within last 30 days.
     *
     * @param status Filters products based on subscription status
     * @returns any Product list
     * @throws ApiError
     */
    public listProducts(
        status?: 'expired' | 'expiringSoon' | 'active' | 'futureDated',
    ): CancelablePromise<{
        body?: Array<ProductList>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products',
            query: {
                'status': status,
            },
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Export subscriptions
     * Export a csv file of all subscriptions
     * @returns binary Export
     * @throws ApiError
     */
    public getProductsExport(): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products/export',
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Show product
     * Get a single product by SKU
     * @param sku SKU of the product to show
     * @returns any Product
     * @throws ApiError
     */
    public showProduct(
        sku: string,
    ): CancelablePromise<{
        body?: ProductList;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products/{SKU}',
            path: {
                'SKU': sku,
            },
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * Get user's subscription quantities by status
     * Get counts of user's subscriptions by status such as
     * - active
     * - expired
     * - expiring soon
     * - future dated
     * @returns any Status counts
     * @throws ApiError
     */
    public statusCounts(): CancelablePromise<{
        body?: StatusCount;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products/status',
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * List RHEL EUS versions
     * Returns the list of currently supported RHEL versions for Extended Update Support
     * @returns any Extended Update Support versions
     * @throws ApiError
     */
    public getProductsRhelExtendedUpdateSupportVersions(): CancelablePromise<{
        body?: Array<string>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products/RHEL/extended-update-support-versions',
            errors: {
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
    /**
     * List RHEL EUS products
     * Returns the list of currently supported RHEL product-repo mappings for Extended Update Support
     * @returns any Extended Update Support versions
     * @throws ApiError
     */
    public getProductsRhelExtendedUpdateSupportProducts(): CancelablePromise<{
        body?: Array<EusProductList>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/products/RHEL/extended-update-support-products',
            errors: {
                400: `BadRequest error`,
                401: `Unauthorized error`,
                403: `Forbidden error`,
                500: `InternalServerError error`,
            },
        });
    }
}
