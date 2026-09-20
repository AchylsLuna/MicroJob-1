/**
 * uploadFile.ts
 *
 * Reliable multipart file upload for React Native / Expo.
 *
 * React Native 0.79+ (Hermes/JSI) no longer accepts plain JS objects
 * `{ uri, type, name }` as FormData parts — they throw:
 *   "Unsupported FormDataPart implementation"
 *
 * `FileSystem.uploadAsync` bypasses the JS fetch layer and sends the
 * file through a native HTTP task, which correctly handles multipart
 * uploads on both Android and iOS.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { API_REQUEST_TIMEOUT_MS } from '../config';

export type UploadFileOptions = {
  /** The full URL to POST to. */
  url: string;
  /** Local file URI (must start with `file://`). */
  fileUri: string;
  /** The multipart field name the server expects. */
  fieldName: string;
  /** MIME type of the file, e.g. `'image/jpeg'`. */
  mimeType: string;
  /** Bearer token for the Authorization header. */
  token: string;
  /** Additional multipart parameters to include alongside the file. */
  parameters?: Record<string, string>;
  /** Timeout in ms. Defaults to the global API_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
};

export type UploadFileResult = {
  ok: boolean;
  status: number;
  body: string;
};

/**
 * Uploads a single file as `multipart/form-data` using the native
 * Expo FileSystem upload task. This avoids the Hermes JSI limitation
 * that rejects plain-object FormData parts in `fetch`.
 */
export async function uploadFile({
  url,
  fileUri,
  fieldName,
  mimeType,
  token,
  parameters,
  timeoutMs,
}: UploadFileOptions): Promise<UploadFileResult> {
  const timeout = Number.isFinite(timeoutMs) && (timeoutMs as number) > 0
    ? (timeoutMs as number)
    : API_REQUEST_TIMEOUT_MS;

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new Error('The upload took too long to respond. Please try again.'));
    }, timeout);
  });

  try {
    const uploadPromise = FileSystem.uploadAsync(url, fileUri, {
      uploadType: FileSystemUploadType.MULTIPART,
      httpMethod: 'POST',
      fieldName,
      mimeType,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-microjobs-client': 'native',
      },
      parameters,
    });

    const result = await Promise.race([uploadPromise, timeoutPromise]);

    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      body: result.body,
    };
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}
