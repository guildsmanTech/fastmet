import axios from "axios";

/** True when the request never got a response (dropped/stale connection, offline). */
export const isNetworkError = (err: unknown): boolean =>
  axios.isAxiosError(err) && !err.response;

/**
 * Runs `fn`, retrying once after a short delay if it failed with no response.
 * Android reuses idle keep-alive sockets the server already closed, so the
 * first request after sitting on a screen can fail while the next one works.
 */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  delayMs = 500,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}
