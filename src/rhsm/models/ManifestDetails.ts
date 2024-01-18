/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Date } from './Date';
import type { EntitlementsAttached } from './EntitlementsAttached';
/**
 * details of a manifest
 */
export type ManifestDetails = {
    simpleContentAccess?: string;
    createdBy?: string;
    createdDate?: Date;
    entitlementsAttached?: EntitlementsAttached;
    entitlementsAttachedQuantity?: number;
    lastModified?: Date;
    name?: string;
    type?: string;
    uuid?: string;
    version?: string;
};

