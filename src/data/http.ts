/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { Gunzip } from "fflate";
import { BUILD_PLATFORM } from "../config";

/**
 * Network access to providers.
 *
 * On a TV the packaged app may talk to any host (Tizen `<access origin="*">`, webOS packaged
 * apps), so requests go straight to the provider. In a desktop browser the same requests would
 * be blocked by CORS, so the dev build routes them through the local dev server's `/proxy`.
 *
 * Browsers do not let page script set `User-Agent`, so a per-provider agent is only honoured
 * through the proxy. On the TVs the platform's own agent is sent.
 */
export class HttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface RequestOptions {
  userAgent?: string;
  timeoutMs?: number;
}

export function requestUrl(url: string, opts: RequestOptions = {}): string {
  if (BUILD_PLATFORM !== "browser") return url;
  let proxied = "/proxy?url=" + encodeURIComponent(url);
  if (opts.userAgent) proxied += "&ua=" + encodeURIComponent(opts.userAgent);
  return proxied;
}

/**
 * A URL the video element should load. Streams are proxied in the browser build too, since
 * HLS playlists and segments are fetched by hls.js with XHR and hit the same CORS wall.
 */
export function playableUrl(url: string, opts: RequestOptions = {}): string {
  return requestUrl(url, opts);
}

/** fetch with a timeout. AbortController is used when the platform has it (webOS 4 does not). */
export function fetchWithTimeout(url: string, opts: RequestOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs || 30000;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new HttpError("The server did not answer in time. Check the address and your connection."));
    }, timeoutMs);
    fetch(requestUrl(url, opts), controller ? { signal: controller.signal } : undefined).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(new HttpError(describeNetworkError(err)));
      },
    );
  });
}

export async function getText(url: string, opts: RequestOptions = {}): Promise<string> {
  const res = await fetchWithTimeout(url, opts);
  if (!res.ok) throw new HttpError(describeHttpFailure(res.status), res.status);
  return res.text();
}

export async function getJson<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
  const text = await getText(url, opts);
  if (!text.trim()) throw new HttpError("The server returned an empty response.");
  try {
    return JSON.parse(text) as T;
  } catch {
    // Panels behind a captive portal or Cloudflare return HTML here. Say what it means.
    throw new HttpError(
      "The server replied with something that is not a valid catalogue. Check the address and port are correct.",
    );
  }
}

/**
 * Streams a (possibly gzipped) text resource chunk by chunk, so a 150 MB guide never has to
 * exist as one string. Gzip is detected from the first bytes rather than trusted from the URL.
 */
export async function streamText(
  url: string,
  onText: (chunk: string) => void,
  opts: RequestOptions = {},
): Promise<void> {
  const res = await fetchWithTimeout(url, { timeoutMs: opts.timeoutMs || 60000, userAgent: opts.userAgent });
  if (!res.ok) throw new HttpError(describeHttpFailure(res.status), res.status);
  const decoder = new TextDecoder("utf-8");
  let gunzip: Gunzip | null = null;
  let sniffed = false;

  const emitBytes = (bytes: Uint8Array, final: boolean) => {
    const text = decoder.decode(bytes, { stream: !final });
    if (text) onText(text);
  };
  const feed = (bytes: Uint8Array, final: boolean) => {
    if (!sniffed) {
      sniffed = true;
      if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        gunzip = new Gunzip((data, last) => emitBytes(data, !!last));
      }
    }
    if (gunzip) gunzip.push(bytes, final);
    else emitBytes(bytes, final);
  };

  if (!res.body || typeof res.body.getReader !== "function") {
    feed(new Uint8Array(await res.arrayBuffer()), true);
    return;
  }
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      feed(new Uint8Array(0), true);
      return;
    }
    if (value && value.length) feed(value, false);
  }
}

export function describeHttpFailure(code: number): string {
  if (code === 401 || code === 403)
    return `The server refused the request (HTTP ${code}). The username or password may be wrong, or the provider may be blocking this device.`;
  if (code === 404) return "Nothing found at that address (HTTP 404). Check the URL and port.";
  if (code === 405)
    return "The server rejected the request (HTTP 405). The address may be a plain playlist rather than an Xtream panel.";
  if (code === 429) return "The server is rate-limiting this device (HTTP 429). Try again shortly.";
  if (code >= 500 && code < 600) return `The provider's server is having problems (HTTP ${code}).`;
  return `The server returned HTTP ${code}.`;
}

function describeNetworkError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as Error).name) : "";
  if (name === "AbortError") return "The request took too long and was cancelled.";
  return "Could not reach the server. Check the address and that the TV is online.";
}
