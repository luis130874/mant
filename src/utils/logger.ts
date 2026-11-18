/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const isDev = import.meta.env.DEV;

export function devWarn(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(message, ...args);
  }
}

export function devError(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.error(message, ...args);
  }
}
