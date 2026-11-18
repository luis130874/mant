/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const recaptchaSiteKey = (
  (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey ||
  import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
  ''
).trim();

if (typeof window !== 'undefined' && recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const isProd = import.meta.env.PROD;
  const errMessage = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: isProd
      ? {
          emailVerified: auth.currentUser?.emailVerified ?? null,
          isAnonymous: auth.currentUser?.isAnonymous ?? null,
          providerInfo:
            auth.currentUser?.providerData?.map((provider) => ({
              providerId: provider.providerId,
            })) || [],
        }
      : {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          tenantId: auth.currentUser?.tenantId,
          providerInfo:
            auth.currentUser?.providerData?.map((provider) => ({
              providerId: provider.providerId,
              email: provider.email,
            })) || [],
        },
    operationType,
    path,
  };

  if (import.meta.env.DEV) {
    console.error('Firestore Error:', JSON.stringify(errInfo));
  } else {
    console.error(
      `Firestore Error [${operationType}]${path ? ` (${path})` : ''}: ${errMessage}`
    );
  }
  throw new Error(JSON.stringify(errInfo));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}
