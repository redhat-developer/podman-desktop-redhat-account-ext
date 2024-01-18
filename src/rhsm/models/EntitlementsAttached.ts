/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EntitlementsAttachedValue } from './EntitlementsAttachedValue';
/**
 * Details of all the entitlements attached and their status.
 */
export type EntitlementsAttached = {
    reason?: string;
    valid?: boolean;
    value?: Array<EntitlementsAttachedValue>;
};

