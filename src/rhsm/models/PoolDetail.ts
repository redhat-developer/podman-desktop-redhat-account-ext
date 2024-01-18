/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Date } from './Date';
/**
 * PoolDetail is an entry in the system/allocation pools listing
 */
export type PoolDetail = {
    contractNumber?: string;
    endDate?: Date;
    entitlementsAvailable?: number;
    id?: string;
    serviceLevel?: string;
    sku?: string;
    startDate?: Date;
    subscriptionName?: string;
    subscriptionNumber?: string;
};

