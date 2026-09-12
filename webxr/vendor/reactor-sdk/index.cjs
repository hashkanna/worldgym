'use client';
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AbortedError: () => AbortedError,
  BadRequestError: () => BadRequestError,
  ClipDownloadButton: () => ClipDownloadButton,
  ClipPlayer: () => ClipPlayer,
  ConflictError: () => ConflictError,
  DEFAULT_PLAYLIST_POLL_SLACK_MS: () => DEFAULT_PLAYLIST_POLL_SLACK_MS,
  DecodeError: () => DecodeError,
  DisconnectedError: () => DisconnectedError,
  FileRef: () => FileRef,
  InvalidStateError: () => InvalidStateError,
  MessageTooLargeError: () => MessageTooLargeError,
  NetworkError: () => NetworkError,
  NotFoundError: () => NotFoundError,
  RateLimitedError: () => RateLimitedError,
  Reactor: () => Reactor,
  ReactorError: () => ReactorError,
  ReactorProvider: () => ReactorProvider,
  ReactorView: () => ReactorView,
  RecorderDisabledError: () => RecorderDisabledError,
  RecordingError: () => RecordingError,
  RequestTimeoutError: () => RequestTimeoutError,
  ServerError: () => ServerError,
  SessionTerminalError: () => SessionTerminalError,
  TransportError: () => TransportError,
  UnauthorizedError: () => UnauthorizedError,
  VersionMismatchError: () => VersionMismatchError,
  WebcamStream: () => WebcamStream,
  createPlayableManifestUrl: () => createPlayableManifestUrl,
  downloadClipAsFile: () => downloadClipAsFile,
  fetchPlaylist: () => fetchPlaylist,
  isFileRef: () => isFileRef,
  normalizeJwtSource: () => normalizeJwtSource,
  parsePlaylist: () => parsePlaylist,
  useClipDownload: () => useClipDownload,
  useReactor: () => useReactor,
  useReactorInternalMessage: () => useReactorInternalMessage,
  useReactorMessage: () => useReactorMessage,
  useStats: () => useStats
});
module.exports = __toCommonJS(index_exports);

// src/reactor.ts
var import_awaitqueue = require("awaitqueue");

// src/internal/capabilities.ts
function toPublicCapabilities(wire) {
  const capabilities = {
    protocolVersion: wire.protocol_version,
    tracks: wire.tracks
  };
  if (wire.commands !== void 0) {
    capabilities.commands = wire.commands;
  }
  if (wire.emission_fps !== void 0) {
    capabilities.emissionFps = wire.emission_fps;
  }
  return capabilities;
}

// src/internal/debug-log.ts
var import_meta = {};
var isDev = typeof process !== "undefined" && process?.env?.NODE_ENV === "development" || import_meta.env?.DEV === true;
function debugLog(...args) {
  if (isDev) {
    console.debug(...args);
  }
}

// src/errors.ts
var ReactorError = class extends Error {
  /** The code this class stands for. `ReactorError` itself is the fallback,
   *  so it claims none and takes whatever the payload reported. */
  static code = "INTERNAL_ERROR";
  /** `reactor-core`'s own canonical code for this failure — the same value
   *  used to pick this instance's class (see the typed subclasses below for
   *  the vocabulary). Open-ended: an unrecognized code still constructs the
   *  base class, with `code` set to whatever was reported. */
  code;
  /** Whether the same call could succeed later. */
  recoverable;
  /** The HTTP status, when the failure came from one. */
  status;
  /** Which call failed, e.g. "connect", "sendCommand". */
  operation;
  /** Backoff hint the platform sent. */
  retry_after_ms;
  /** When `reactor-core` reported this failure. For a purely local one (no
   *  payload at all — see {@link ReactorErrorOptions}), this is synthesized
   *  as the construction time instead, since there's nothing to report —
   *  not a value read off the wire. */
  timestamp_ms;
  /** Same value as `retry_after_ms`, under its previous name. Kept for
   *  compatibility — prefer `retry_after_ms`. */
  retryAfter;
  /** Same value as `timestamp_ms`, under its previous name. Kept for
   *  compatibility — prefer `timestamp_ms`. */
  timestamp;
  constructor(message, options = {}) {
    super(message);
    this.name = "ReactorError";
    this.code = options.code ?? new.target.code;
    this.recoverable = options.recoverable ?? false;
    this.status = options.status;
    this.operation = options.operation;
    this.retry_after_ms = options.retry_after_ms;
    this.retryAfter = options.retry_after_ms;
    this.timestamp_ms = options.timestamp_ms ?? Date.now();
    this.timestamp = this.timestamp_ms;
  }
};
var NetworkError = class extends ReactorError {
  static code = "NETWORK_ERROR";
};
var UnauthorizedError = class extends ReactorError {
  static code = "UNAUTHORIZED";
};
var NotFoundError = class extends ReactorError {
  static code = "NOT_FOUND";
};
var ConflictError = class extends ReactorError {
  static code = "CONFLICT";
};
var RateLimitedError = class extends ReactorError {
  static code = "RATE_LIMITED";
};
var BadRequestError = class extends ReactorError {
  static code = "BAD_REQUEST";
};
var ServerError = class extends ReactorError {
  static code = "SERVER_ERROR";
};
var VersionMismatchError = class extends ReactorError {
  static code = "VERSION_MISMATCH";
};
var DecodeError = class extends ReactorError {
  static code = "DECODE_FAILED";
};
var InvalidStateError = class extends ReactorError {
  static code = "INVALID_STATE";
};
var SessionTerminalError = class extends ReactorError {
  static code = "SESSION_TERMINAL";
};
var MessageTooLargeError = class extends ReactorError {
  static code = "MESSAGE_TOO_LARGE";
};
var TransportError = class extends ReactorError {
  static code = "TRANSPORT_ERROR";
};
var DisconnectedError = class extends ReactorError {
  static code = "DISCONNECTED";
};
var RequestTimeoutError = class extends ReactorError {
  static code = "REQUEST_TIMEOUT";
};
var AbortedError = class extends ReactorError {
  static code = "ABORTED";
};
var RecorderDisabledError = class extends ReactorError {
  static code = "RECORDER_DISABLED";
};
var ERROR_CLASSES = [
  NetworkError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  RateLimitedError,
  BadRequestError,
  ServerError,
  VersionMismatchError,
  DecodeError,
  InvalidStateError,
  SessionTerminalError,
  MessageTooLargeError,
  TransportError,
  DisconnectedError,
  RequestTimeoutError,
  AbortedError,
  RecorderDisabledError
];
var BY_CODE = new Map(
  ERROR_CLASSES.map((errorClass) => [errorClass.code, errorClass])
);
function errorForCode(code) {
  return code && BY_CODE.get(code) || ReactorError;
}
function toReactorError(cause) {
  if (cause instanceof ReactorError) {
    return cause;
  }
  const payload = cause ?? {};
  const message = typeof payload.message === "string" ? payload.message : String(cause);
  const ErrorClass = errorForCode(payload.code);
  return new ErrorClass(message, {
    code: payload.code,
    recoverable: payload.recoverable,
    status: payload.status,
    operation: payload.operation,
    retry_after_ms: payload.retry_after_ms,
    timestamp_ms: payload.timestamp_ms
  });
}

// src/internal/emitter.ts
var Emitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, handler) {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }
  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }
  once(event, handler) {
    const wrapped = ((...args) => {
      this.off(event, wrapped);
      handler(...args);
    });
    this.on(event, wrapped);
  }
  emit(event, ...args) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of [...handlers]) {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[Emitter] handler for "${String(event)}" threw:`, error);
      }
    }
  }
  /** Drops every registered handler for every event. */
  clear() {
    this.listeners.clear();
  }
};

// src/file-ref.ts
var FileRef = class {
  constructor(uploadId, name, mimeType, size) {
    this.uploadId = uploadId;
    this.name = name;
    this.mimeType = mimeType;
    this.size = size;
  }
  uploadId;
  name;
  mimeType;
  size;
};
function isFileRef(value) {
  if (value instanceof FileRef) {
    return true;
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value;
  return typeof candidate.uploadId === "string" && typeof candidate.name === "string" && typeof candidate.mimeType === "string" && typeof candidate.size === "number";
}

// src/internal/file-ref.ts
function toWireFileRef(fileRef) {
  return {
    upload_id: fileRef.uploadId,
    name: fileRef.name,
    mime_type: fileRef.mimeType,
    size: fileRef.size
  };
}
function toPublicFileRef(fileRef) {
  return new FileRef(fileRef.upload_id, fileRef.name, fileRef.mime_type, fileRef.size);
}
function extractFileRefs(data) {
  if (!data) {
    return { data, uploads: void 0 };
  }
  let uploads;
  let scalars;
  for (const [key, value] of Object.entries(data)) {
    if (isFileRef(value)) {
      uploads ??= {};
      scalars ??= { ...data };
      uploads[key] = toWireFileRef(value);
      delete scalars[key];
      continue;
    }
    const rewritten = rewriteNestedFileRefs(value);
    if (rewritten !== value) {
      scalars ??= { ...data };
      scalars[key] = rewritten;
    }
  }
  return { data: scalars ?? data, uploads };
}
function rewriteNestedFileRefs(value) {
  if (isFileRef(value)) {
    return toWireFileRef(value);
  }
  if (Array.isArray(value)) {
    const elements = value;
    let copy;
    elements.forEach((element, index) => {
      const rewritten = rewriteNestedFileRefs(element);
      if (rewritten !== element) {
        copy ??= [...elements];
        copy[index] = rewritten;
      }
    });
    return copy ?? elements;
  }
  if (isSerializedAsObject(value)) {
    let copy;
    for (const [key, element] of Object.entries(value)) {
      const rewritten = rewriteNestedFileRefs(element);
      if (rewritten !== element) {
        copy ??= { ...value };
        copy[key] = rewritten;
      }
    }
    return copy ?? value;
  }
  return value;
}
function isSerializedAsObject(value) {
  return typeof value === "object" && value !== null && !ArrayBuffer.isView(value);
}

// src/internal/recording.ts
function toPublicClip(clip) {
  return {
    sessionId: clip.session_id,
    kind: clip.kind,
    startMarker: clip.start_marker,
    endMarker: clip.end_marker,
    nowMarker: clip.now_marker,
    predictedReadyAtMs: clip.predicted_ready_at_ms,
    playlistUrl: clip.playlist_url
  };
}

// src/internal/stats.ts
var STATS_INTERVAL_MS = 2e3;
function createRTCStatsExtractor() {
  let lastBytesReceived;
  let lastBytesSent;
  let lastCandPairTimestamp;
  let lastCandPairId;
  return (report) => {
    let candPairId;
    let rtt;
    let availableOutgoingBitrate;
    let availableIncomingBitrate;
    let incomingBitrate;
    let outgoingBitrate;
    let videoInboundRtpId;
    let framesPerSecond;
    let jitter;
    let packetLossRatio;
    let candidateType;
    const reportWithLookup = report;
    report.forEach((stat) => {
      if (candPairId === void 0 && stat.type === "candidate-pair" && stat.state === "succeeded" && stat.nominated) {
        candPairId = stat.id;
        if (stat.currentRoundTripTime !== void 0) {
          rtt = stat.currentRoundTripTime * 1e3;
        }
        if (stat.availableOutgoingBitrate !== void 0) {
          availableOutgoingBitrate = stat.availableOutgoingBitrate;
        }
        if (stat.availableIncomingBitrate !== void 0) {
          availableIncomingBitrate = stat.availableIncomingBitrate;
        }
        const localCandidate = stat.localCandidateId !== void 0 ? reportWithLookup.get(stat.localCandidateId) : void 0;
        if (localCandidate?.candidateType) {
          candidateType = localCandidate.candidateType;
        }
        const samePair = lastCandPairId === candPairId;
        const timeDiff = samePair && lastCandPairTimestamp !== void 0 ? stat.timestamp - lastCandPairTimestamp : 0;
        if (stat.bytesReceived !== void 0) {
          if (samePair && lastBytesReceived !== void 0 && timeDiff > 0) {
            incomingBitrate = (stat.bytesReceived - lastBytesReceived) * 8 / timeDiff * 1e3;
          }
          lastBytesReceived = stat.bytesReceived;
        }
        if (stat.bytesSent !== void 0) {
          if (samePair && lastBytesSent !== void 0 && timeDiff > 0) {
            outgoingBitrate = (stat.bytesSent - lastBytesSent) * 8 / timeDiff * 1e3;
          }
          lastBytesSent = stat.bytesSent;
        }
        lastCandPairTimestamp = stat.timestamp;
        lastCandPairId = candPairId;
      }
      if (videoInboundRtpId === void 0 && stat.type === "inbound-rtp" && stat.kind === "video") {
        videoInboundRtpId = stat.id;
        if (stat.framesPerSecond !== void 0) {
          framesPerSecond = stat.framesPerSecond;
        }
        if (stat.jitter !== void 0) {
          jitter = stat.jitter;
        }
        if (stat.packetsReceived !== void 0 && stat.packetsLost !== void 0 && stat.packetsReceived + stat.packetsLost > 0) {
          packetLossRatio = stat.packetsLost / (stat.packetsReceived + stat.packetsLost);
        }
      }
    });
    return {
      rtt,
      candidateType,
      availableIncomingBitrate,
      availableOutgoingBitrate,
      incomingBitrate,
      outgoingBitrate,
      framesPerSecond,
      packetLossRatio,
      jitter,
      timestamp: Date.now()
    };
  };
}

// src/internal/wasm.ts
var modulePromise = null;
function loadReactorWasm() {
  if (!modulePromise) {
    modulePromise = importWasmModule().catch((cause) => {
      modulePromise = null;
      throw new Error(
        "reactor-wasm failed to load. Run `mise run build:wasm` (or, from a published install, reinstall the package) and try again.",
        { cause }
      );
    });
  }
  return modulePromise;
}
async function importWasmModule() {
  const module2 = await import(
    /* @vite-ignore */
    "./wasm/reactor_wasm.js"
  );
  await module2.default();
  return module2;
}

// package.json
var package_default = {
  name: "@reactor-team/js-sdk",
  version: "3.0.2",
  description: "Connect your JavaScript/TypeScript app to a live Reactor model in the browser.",
  license: "Apache-2.0",
  repository: {
    type: "git",
    url: "git+https://github.com/reactor-team/reactor-client-sdks.git",
    directory: "sdks/js"
  },
  type: "module",
  sideEffects: false,
  main: "./dist/index.cjs",
  module: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      require: "./dist/index.cjs"
    }
  },
  files: [
    "dist"
  ],
  engines: {
    node: ">=18"
  },
  scripts: {
    build: "tsup && node scripts/copy-wasm.mjs",
    prepack: "npm run build",
    dev: "tsup --watch",
    "type-check": "tsc --noEmit",
    lint: "eslint .",
    test: "vitest run",
    clean: "rm -rf dist"
  },
  dependencies: {
    awaitqueue: "^3.3.1",
    "hls.js": "^1.6.0",
    mp4box: "^2.4.1"
  },
  peerDependencies: {
    react: "^18.0.0 || ^19.0.0"
  },
  devDependencies: {
    "@eslint/js": "^9.39.5",
    "@stylistic/eslint-plugin": "^5.10.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    eslint: "^9.39.5",
    "eslint-plugin-react-hooks": "^5.0.0",
    jsdom: "^25.0.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    tsup: "^8.3.0",
    typescript: "^5.6.0",
    "typescript-eslint": "^8.67.0",
    vitest: "^4.1.11"
  }
};

// src/recording.ts
var RecordingError = class extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.code = code;
    this.reason = reason;
    this.name = "RecordingError";
  }
  code;
  reason;
};
var DEFAULT_PLAYLIST_POLL_SLACK_MS = 15e3;
async function fetchPlaylist(playlistUrl, options = {}) {
  const minDelay = Math.max(0, options.minRetryDelayMs ?? 200);
  const maxDelay = Math.max(minDelay, options.maxRetryDelayMs ?? 2e3);
  const hasDeadline = typeof options.slackMs === "number" && Number.isFinite(options.slackMs);
  const startedPollingAt = Date.now();
  const deadlineMs = hasDeadline ? Math.max(options.predictedReadyAtMs ?? startedPollingAt, startedPollingAt) + options.slackMs : void 0;
  const maxRetries = typeof options.maxRetries === "number" ? options.maxRetries : void 0;
  const init = {};
  if (options.signal) {
    init.signal = options.signal;
  }
  if (options.jwt) {
    init.headers = { Authorization: `Bearer ${options.jwt}` };
  }
  let attempt = 0;
  while (true) {
    let response;
    try {
      response = await fetch(playlistUrl, init);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new RecordingError(
        "PLAYLIST_FETCH_FAILED",
        `Network error fetching playlist: ${error.message}`
      );
    }
    if (response.status === 202) {
      if (deadlineMs !== void 0 && Date.now() >= deadlineMs) {
        throw new RecordingError(
          "CLIP_NOT_READY",
          `Boundary chunk still pending after ${options.slackMs}ms grace (predicted ready ${new Date(
            options.predictedReadyAtMs ?? startedPollingAt
          ).toISOString()}). Runtime may have crashed mid-clip.`
        );
      }
      if (maxRetries !== void 0 && attempt >= maxRetries) {
        throw new RecordingError(
          "CLIP_NOT_READY",
          `Manifest still pending after ${attempt + 1} attempts (last status 202)`
        );
      }
      const headerDelay = parseRetryAfter(response.headers.get("Retry-After"), minDelay);
      const delay = Math.min(maxDelay, Math.max(minDelay, headerDelay));
      const clampedDelay = deadlineMs !== void 0 ? Math.min(delay, Math.max(0, deadlineMs - Date.now())) : delay;
      await sleep(clampedDelay, options.signal);
      attempt++;
      continue;
    }
    if (response.status === 200) {
      return await response.text();
    }
    if (response.status === 410 || response.status === 404) {
      throw new RecordingError("CLIP_GONE", "Clip is no longer available or session unknown");
    }
    throw new RecordingError("PLAYLIST_FETCH_FAILED", `Manifest endpoint returned HTTP ${response.status}`);
  }
}
function parsePlaylist(manifestBody, playlistUrl) {
  let initUrl;
  const segments = [];
  for (const rawLine of manifestBody.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("#EXT-X-MAP")) {
      const match = trimmed.match(/URI="([^"]+)"/);
      if (match?.[1]) {
        initUrl = resolveAgainst(match[1], playlistUrl);
      }
      continue;
    }
    if (trimmed.startsWith("#")) {
      continue;
    }
    segments.push(resolveAgainst(trimmed, playlistUrl));
  }
  if (!initUrl) {
    throw new RecordingError("INVALID_PLAYLIST", "Playlist is missing an #EXT-X-MAP init segment URI");
  }
  if (segments.length === 0) {
    throw new RecordingError("INVALID_PLAYLIST", "Playlist contains no media segments");
  }
  return { initUrl, segmentUrls: segments };
}
function createPlayableManifestUrl(manifestBody, playlistUrl) {
  if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new RecordingError(
      "INVALID_PLAYLIST",
      "createPlayableManifestUrl requires a browser environment with URL.createObjectURL"
    );
  }
  const rewritten = absolutizeManifestUrls(manifestBody, playlistUrl);
  const blob = new Blob([rewritten], { type: "application/vnd.apple.mpegurl" });
  return URL.createObjectURL(blob);
}
function absolutizeManifestUrls(manifestBody, playlistUrl) {
  const eol = manifestBody.includes("\r\n") ? "\r\n" : "\n";
  const out = [];
  for (const line of manifestBody.split(/\r?\n/)) {
    if (line.startsWith("#EXT-X-MAP")) {
      out.push(
        line.replace(/URI="([^"]+)"/, (_, uri) => `URI="${resolveAgainst(uri, playlistUrl)}"`)
      );
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }
    out.push(resolveAgainst(trimmed, playlistUrl));
  }
  return out.join(eol);
}
async function downloadClipAsFile(clip, filename = "reactor-clip.mp4", options = {}) {
  const playlistOptions = { predictedReadyAtMs: clip.predictedReadyAtMs };
  if (options.signal) {
    playlistOptions.signal = options.signal;
  }
  if (options.jwt) {
    playlistOptions.jwt = options.jwt;
  }
  const manifestBody = await fetchPlaylist(clip.playlistUrl, playlistOptions);
  const blob = await assembleClipBlob(manifestBody, clip.playlistUrl, options);
  if (filename === null) {
    return blob;
  }
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new RecordingError(
      "DOWNLOAD_UNSUPPORTED",
      "downloadClipAsFile requires a DOM environment; pass filename=null to skip the download trigger"
    );
  }
  triggerBrowserDownload(blob, filename);
  return blob;
}
async function assembleClipBlob(manifestBody, playlistUrl, options = {}) {
  const { initUrl, segmentUrls } = parsePlaylist(manifestBody, playlistUrl);
  const orderedUrls = [initUrl, ...segmentUrls];
  const chunkInit = {};
  if (options.signal) {
    chunkInit.signal = options.signal;
  }
  const parts = [];
  let bytes = 0;
  for (const [i, url] of orderedUrls.entries()) {
    let response;
    try {
      response = await fetch(url, chunkInit);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new RecordingError("CHUNK_FETCH_FAILED", `Network error fetching chunk ${i}: ${error.message}`);
    }
    if (!response.ok) {
      throw new RecordingError("CHUNK_FETCH_FAILED", `Chunk ${i} returned HTTP ${response.status}`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    parts.push(data);
    bytes += data.byteLength;
    options.onProgress?.({ fetched: i + 1, total: orderedUrls.length, bytes });
  }
  const finalBytes = await maybeRemux(parts);
  return new Blob([finalBytes], { type: "video/mp4" });
}
async function maybeRemux(parts) {
  const input = concatUint8Arrays(parts);
  try {
    const MP4Box = await loadMp4Box();
    return await remuxFragmentedToFlat(input, MP4Box);
  } catch (error) {
    console.warn("[Reactor] Clip remux failed, returning fragmented MP4 instead.", error);
    return input;
  }
}
var __remuxInternals = {
  loadMp4Box: () => import("mp4box")
};
function loadMp4Box() {
  return __remuxInternals.loadMp4Box();
}
async function remuxFragmentedToFlat(input, MP4Box) {
  return new Promise((resolve, reject) => {
    const inFile = MP4Box.createFile();
    const outFile = MP4Box.createFile();
    outFile.init({ brands: ["isom", "mp42", "avc1", "iso2"] });
    const pendingTracks = /* @__PURE__ */ new Map();
    let settled = false;
    const fail = (err) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    };
    inFile.onError = (_module, message) => {
      fail(new Error(message));
    };
    inFile.onReady = (info) => {
      if (!info.tracks.length) {
        fail(new Error("no tracks in input"));
        return;
      }
      for (const track of info.tracks) {
        inFile.setExtractionOptions(track.id, null, { nbSamples: 1e3 });
      }
      inFile.start();
    };
    inFile.onSamples = (id, _user, samples) => {
      if (settled || samples.length === 0) {
        return;
      }
      let pending = pendingTracks.get(id);
      if (!pending) {
        const firstSample = samples[0];
        if (!firstSample) {
          return;
        }
        const sampleEntry = firstSample.description;
        const inputTrack = trackInfoById(inFile, id);
        const trackOptions = {
          type: sampleEntry.type,
          timescale: firstSample.timescale,
          // `boxes` is typed as `Box[]` but `description_boxes` wants the
          // narrower `BoxKind[]` union — at runtime they're the same
          // concrete instances, just typed loosely.
          description_boxes: sampleEntry.boxes
        };
        if (inputTrack?.track_width !== void 0) {
          trackOptions.width = inputTrack.track_width;
        }
        if (inputTrack?.track_height !== void 0) {
          trackOptions.height = inputTrack.track_height;
        }
        if (inputTrack?.language !== void 0) {
          trackOptions.language = inputTrack.language;
        }
        if (inputTrack?.video) {
          trackOptions.hdlr = "vide";
        } else if (inputTrack?.audio) {
          trackOptions.hdlr = "soun";
        }
        pending = { trackOptions, timescale: firstSample.timescale, firstDts: firstSample.dts, samples: [] };
        pendingTracks.set(id, pending);
      }
      pending.samples.push(...samples);
    };
    let buf;
    try {
      buf = MP4Box.MP4BoxBuffer.fromArrayBuffer(
        input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength),
        0
      );
    } catch (error) {
      fail(error);
      return;
    }
    try {
      inFile.appendBuffer(buf);
      inFile.flush();
    } catch (error) {
      fail(error);
      return;
    }
    if (settled) {
      return;
    }
    if (pendingTracks.size === 0) {
      fail(new Error("no samples extracted from input"));
      return;
    }
    let originSeconds = Infinity;
    for (const pending of pendingTracks.values()) {
      originSeconds = Math.min(originSeconds, pending.firstDts / pending.timescale);
    }
    try {
      for (const pending of pendingTracks.values()) {
        const outId = outFile.addTrack(pending.trackOptions);
        const dtsShift = Math.round(originSeconds * pending.timescale);
        for (const sample of pending.samples) {
          if (!sample.data) {
            continue;
          }
          outFile.addSample(outId, sample.data, {
            duration: sample.duration,
            dts: sample.dts - dtsShift,
            cts: sample.cts - dtsShift,
            is_sync: sample.is_sync
          });
        }
      }
    } catch (error) {
      fail(error);
      return;
    }
    let output;
    try {
      const stream = outFile.getBuffer();
      output = new Uint8Array(stream.buffer.slice(0, stream.byteLength));
    } catch (error) {
      fail(error);
      return;
    }
    settled = true;
    resolve(output);
  });
}
function trackInfoById(file, id) {
  const info = file.getInfo();
  return info.tracks.find((t) => t.id === id);
}
function concatUint8Arrays(parts) {
  const only = parts.length === 1 ? parts[0] : void 0;
  if (only) {
    return only;
  }
  let total = 0;
  for (const p of parts) {
    total += p.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}
function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}
function resolveAgainst(target, base) {
  try {
    return new URL(target, base).toString();
  } catch {
    return target;
  }
}
function parseRetryAfter(header, fallbackMs) {
  if (!header) {
    return fallbackMs;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1e3;
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return fallbackMs;
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function triggerBrowserDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// src/reactor.ts
var Reactor = class {
  clientOptions;
  jwt;
  client;
  clientPromise;
  disposed = false;
  _lastError;
  schema;
  /** Bumped on every `refreshSchema()` call — lets a call detect it's been
   *  superseded by a newer one even when `client` itself hasn't changed
   *  (e.g. two "ready" transitions on the same reused client). */
  schemaRefreshId = 0;
  capabilities;
  stats;
  connectionTimings;
  statsPollHandle;
  /** Bumped on every `startStatsPolling()`/`stopStatsPolling()` call — lets an
   *  in-flight `getStats()` recognize it's stale once it resolves, even if
   *  `this.client` hasn't changed in the meantime. */
  statsPollGeneration = 0;
  /** Set on the "connecting" status transition, cleared once `connectionTimings`
   *  is finalized on "ready" — see `handleStatusChanged()`. */
  connectStartTime;
  waitingStartTime;
  emitter = new Emitter();
  /** Serializes connect()/reconnect()/disconnect() (and the free() inside
   *  disconnect()/[Symbol.dispose]) against each other. Calling into the
   *  client concurrently with one of these (e.g. a user clicking Disconnect
   *  mid-connect) races its internal state and can throw ("attempted to
   *  take ownership of Rust value while it was borrowed") or corrupt it
   *  outright. */
  queue = new import_awaitqueue.AwaitQueue();
  /** In-flight calls to `withReaderAccess()` — a "reply" `.catch(() => {})`
   *  copy of each, never the caller's own promise, so one rejecting can't
   *  make `Promise.all()` in `withWriterAccess()` reject and skip waiting
   *  for the rest. See `withReaderAccess()`/`withWriterAccess()`. */
  activeReads = /* @__PURE__ */ new Set();
  /** True for the span of a `withWriterAccess()` call — after it has waited
   *  out every read active when it started, before it releases the ones
   *  that arrived while it ran. */
  writerActive = false;
  /** Readers parked in `withReaderAccess()`'s wait loop, woken once
   *  `withWriterAccess()` finishes; each re-checks `writerActive` rather
   *  than assuming its turn, since another writer already queued behind the
   *  first one may have claimed it first. */
  writerIdleWaiters = [];
  /**
   * Runs a read — sendCommand()/requestSchema()/requestClip()/
   * requestRecording() — excluded from a lifecycle op (`withWriterAccess()`)
   * but not from other reads: unlike `queue`, concurrent reads run
   * concurrently. Queuing them the same way `queue` serializes writes would
   * head-of-line block an unrelated command, or even disconnect() itself,
   * behind one slow reply (the binding correlates replies independently, so
   * nothing requires this to be serial).
   *
   * Race-free the same way the wasm binding's own `readyState` check is: the
   * `writerActive` check and this call's registration in `activeReads` both
   * happen before the first `await` inside *fn*, so nothing can run between
   * them on a single-threaded JS event loop.
   */
  async withReaderAccess(fn) {
    while (this.writerActive) {
      await new Promise((resolve) => this.writerIdleWaiters.push(resolve));
    }
    const result = fn();
    const tracked = result.catch(() => void 0);
    this.activeReads.add(tracked);
    try {
      return await result;
    } finally {
      this.activeReads.delete(tracked);
    }
  }
  /**
   * Runs a lifecycle op's client-touching body exclusively: waits out every
   * read already in flight, then blocks new ones (`writerActive`) until it
   * finishes. Only ever called from inside a `queue`-serialized task, so at
   * most one writer runs this at a time — it doesn't serialize against
   * itself, only against `activeReads`.
   */
  async withWriterAccess(fn) {
    this.writerActive = true;
    if (this.activeReads.size > 0) {
      await Promise.all(this.activeReads);
    }
    try {
      return await fn();
    } finally {
      this.writerActive = false;
      const waiters = this.writerIdleWaiters;
      this.writerIdleWaiters = [];
      for (const wake of waiters) {
        wake();
      }
    }
  }
  constructor(options) {
    const { jwt, ...clientOptions } = options;
    this.clientOptions = { sdkVersion: package_default.version, ...clientOptions };
    this.jwt = jwt ?? null;
  }
  // ── Lifecycle ───────────────────────────────────────────────────────────
  /**
   * `jwt`, when given, replaces whatever `new Reactor({ jwt })` was given —
   * including on a client that's still around from a recoverable
   * `disconnect(true)`.
   *
   * Throws if already connected or connecting; call `disconnect()` first.
   */
  async connect(jwt, options) {
    this.assertNotDisposed();
    try {
      if (this.getStatus() !== "disconnected") {
        throw new Error("Already connected or connecting.");
      }
      if (jwt !== void 0) {
        this.jwt = jwt;
        this.client?.setJwt(jwt);
      }
      await this.queue.push(
        () => this.withWriterAccess(async () => {
          const client = await this.getOrCreateClient();
          await client.connect(options);
        }),
        "connect"
      );
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /**
   * Ends the connection. By default (`recoverable = false`) this also frees
   * the wasm resource graph — the pump/dispatcher/heartbeat tasks and the
   * peer connection — in one step. Pass `recoverable: true` to keep the
   * wasm client alive so a later `connect()`/`reconnect()` doesn't have to
   * reload wasm and reconstruct it from scratch.
   *
   * Note this only governs the *local* resource graph — the binding's own
   * `disconnect()` always ends the session server-side regardless of this
   * flag, so `recoverable` isn't a way to keep the session itself alive.
   *
   * Queued behind any in-flight `connect()`/`reconnect()` — see `queue`'s
   * docs for why calling into the client concurrently with one of those is
   * unsafe.
   */
  async disconnect(recoverable = false) {
    this.assertNotDisposed();
    try {
      await this.queue.push(
        () => this.withWriterAccess(async () => {
          if (this.client) {
            await this.client.disconnect();
          }
          this.resetConnectionState();
          if (!recoverable) {
            this.freeClient();
          }
        }),
        "disconnect"
      );
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /**
   * Only `options.maxAttempts` has an effect here — the rest of
   * `ConnectOptions` (session adoption, connection id, auto-resume) only
   * makes sense when establishing a session in the first place, same as v2's
   * `reconnect()` always ignored them.
   */
  async reconnect(options) {
    this.assertNotDisposed();
    try {
      await this.queue.push(
        () => this.withWriterAccess(async () => {
          const client = await this.getOrCreateClient();
          await client.reconnect(options);
        }),
        "reconnect"
      );
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  // ── Messaging ───────────────────────────────────────────────────────────
  /**
   * Sends a command to the model and resolves with its correlated reply.
   *
   * `undefined` means the handler acknowledged the command but sent no
   * reply body. The binding's own typed signature promises `undefined` for
   * that case, but its serializer (serde_wasm_bindgen's `json_compatible`
   * mode) actually hands back `null` — normalized here so callers can rely
   * on the documented type instead of the binding's serialization quirk.
   *
   * A `FileRef` (from `uploadFile`) may be passed in `data` wherever the
   * model's schema declares a file. As a top-level value it is extracted and
   * sent as a separate upload reference rather than embedded in the JSON
   * payload; inside an array or object (a parameter that takes several files,
   * say) it is serialized as an upload reference in place.
   *
   * Unlike every other method here, this never rejects — a failure (the
   * session isn't `"ready"`, the send itself fails, …) is reported through
   * `getLastError()`/the `error` event instead, resolving with `undefined`.
   * This is a JS-only compatibility shim, kept because callers routinely
   * fire-and-forget `sendCommand(...)` without `await`/`catch`, and a
   * rejection nobody handles is an unhandled-rejection warning at best. It
   * is deliberately not applied to `publishTrack`/`uploadFile`/etc., which
   * throw normally.
   *
   * `scope` is forwarded to `sendRuntimeScopedCommand()` — see there for
   * what `"runtime"` actually does.
   *
   * `data` accepts any object, except a function.
   */
  async sendCommand(command, data, scope) {
    if (scope === "runtime") {
      return this.sendRuntimeScopedCommand(command, data);
    }
    try {
      this.assertNotDisposed();
      const extracted = extractFileRefs(data);
      const reply = await this.withReaderAccess(async () => {
        const client = await this.getOrCreateClient();
        return client.sendCommand(command, extracted.data, extracted.uploads);
      });
      return reply ?? void 0;
    } catch (cause) {
      this.emitError(cause);
      return void 0;
    }
  }
  /**
   * Handles `sendCommand(command, data, "runtime")` — this SDK has no
   * generic runtime-scope channel. `reactor-core`'s `send_command` is a
   * single channel; `requestSchema`/clip requests/heartbeat are each their
   * own dedicated RPC instead of a scoped envelope, so there's nothing
   * generic to route a scope through at the wire level.
   *
   * `requestSchema` and `requestCapabilities` route to their direct
   * equivalents below, neither of which returns a `ReactorMessage` the way a
   * normal `sendCommand()` reply would, so both resolve `undefined`; the
   * actual data surfaces through `getSchema()`/`schemaReceived` and
   * `getCapabilities()`/`capabilitiesReceived` as it already does. Anything
   * else has no runtime-scope destination to route to — rather than silently
   * doing nothing, it falls through as a normal application-scope send, with
   * a console warning.
   */
  async sendRuntimeScopedCommand(command, data) {
    switch (command) {
      case "requestSchema":
        try {
          await this.withReaderAccess(async () => {
            const client = await this.getOrCreateClient();
            await this.refreshSchema(client);
          });
        } catch (cause) {
          this.emitError(cause);
        }
        return void 0;
      case "requestCapabilities":
        return void 0;
      default:
        console.warn(
          `[Reactor] sendCommand(${JSON.stringify(command)}, \u2026, "runtime") has no runtime-scope destination in this SDK \u2014 sending as a normal application-scope command instead.`
        );
        return this.sendCommand(command, data);
    }
  }
  /** Requests the model's command schema directly. Most callers don't need
   *  this — it's already fetched once and cached as soon as the session
   *  reaches `"ready"`; use `getSchema()` for that. Resolves `undefined`
   *  when the model doesn't expose a schema — the binding replies with a
   *  wire `null` in that case rather than omitting the field. */
  async requestSchema() {
    this.assertNotDisposed();
    try {
      return await this.withReaderAccess(async () => {
        const client = await this.getOrCreateClient();
        return this.normalizeSchema(await client.requestSchema());
      });
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /** The model's command schema (an OpenAPI document), cached from the
   *  `requestSchema()` call fired automatically on `"ready"`. `undefined`
   *  until that reply has landed. */
  getSchema() {
    return this.schema;
  }
  /** The runtime's declared capabilities (negotiated tracks, and the
   *  command set when the model exposes one) — pushed once available, no
   *  explicit request needed. `undefined` until `capabilitiesReceived`
   *  fires. */
  getCapabilities() {
    return this.capabilities;
  }
  /** The session resource, as the coordinator reports it — id, state,
   *  model, cluster, server info, and (once negotiated) `capabilities`.
   *  A live read straight off the wasm client, not cached — reflects
   *  whatever's current. `undefined` before a client exists. */
  getSessionInfo() {
    return this.client?.sessionInfo();
  }
  // ── Tracks ──────────────────────────────────────────────────────────────
  /**
   * Publishes a local `MediaStreamTrack` under `name` — the counterpart to a
   * `sendonly` track the model declares. Awaitable. Queued behind
   * connect()/disconnect()/reconnect() (unlike `sendCommand()`): a track
   * operation awaits its own control round-trip, and a concurrent
   * disconnect() freeing the wasm client mid-await would otherwise resume
   * into a freed client — the same class of use-after-free `queue` exists to
   * prevent for connect/disconnect/reconnect themselves.
   */
  async publishTrack(name, track) {
    this.assertNotDisposed();
    try {
      await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        await client.publishTrack(name, track);
      }, "publishTrack");
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /**
   * Unlike every other track method, this doesn't reject — a failure is
   * reported through the `error` event instead, since this is commonly the
   * last call in a `finally` block, and raising there would replace
   * whatever exception was already propagating.
   */
  async unpublishTrack(name) {
    this.assertNotDisposed();
    try {
      await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        await client.unpublishTrack(name);
      }, "unpublishTrack");
    } catch (cause) {
      this.emitError(cause);
    }
  }
  /**
   * Stops a received track: the receiver goes inactive and the runtime stops
   * producing it. Awaitable, and queued behind connect()/disconnect()/
   * reconnect() for the same reason as `publishTrack()`.
   */
  async pauseTrack(name) {
    this.assertNotDisposed();
    try {
      await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        await client.pauseTrack(name);
      }, "pauseTrack");
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /**
   * Bounds what one sender may spend, in bits per second.
   *
   * This is the ceiling that actually caps a video encoder, and it is easy to
   * hit without knowing it exists: with nothing set, a Chromium-based browser
   * derives a sender's maximum from the frame size alone, and that maximum is
   * 2500 kbps for anything above 960x540. A 720p or 1080p publish caps at
   * 2.5 Mbps until this raises it, however good the connection is.
   *
   * ```ts
   * await reactor.publishTrack('camera', cameraTrack);
   * await reactor.setTrackBitrate('camera', { maxBps: 8_000_000 });
   * ```
   *
   * A ceiling is permission, not a target: the encoder still spends only what
   * the congestion controller allocated and what the picture needs. What
   * raising it buys is headroom for the moments that would otherwise clip.
   *
   * Needs a connected client, and a published track — there is no sender to
   * bound before `publishTrack()`.
   *
   * Omit a bound to leave it at the browser default. `minBps` is non-standard —
   * Chromium honours it, other engines ignore it.
   *
   * There is no connection-wide counterpart: browsers expose no equivalent of
   * the native SDKs' `setBitrate`, and a method that quietly did nothing would
   * be worse than its absence.
   */
  async setTrackBitrate(name, bounds = {}) {
    this.assertNotDisposed();
    try {
      await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        await client.setTrackBitrate(name, bounds.minBps, bounds.maxBps);
      }, "setTrackBitrate");
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /** Resumes a track previously stopped with `pauseTrack()`. */
  async resumeTrack(name) {
    this.assertNotDisposed();
    try {
      await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        await client.resumeTrack(name);
      }, "resumeTrack");
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  // ── Recording ───────────────────────────────────────────────────────────
  /**
   * Requests a clip covering the last `durationSeconds` of the session.
   * `reactor-core` correlates the reply itself (and enforces `"ready"`), so
   * this is a thin delegation, same as `requestSchema()`. See
   * `downloadClipAsFile()` to turn the result into a file.
   */
  async requestClip(durationSeconds) {
    this.assertNotDisposed();
    try {
      return await this.withReaderAccess(async () => {
        const client = await this.getOrCreateClient();
        return toPublicClip(await client.requestClip(durationSeconds));
      });
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /** Requests a clip covering the entire session up to now. See `requestClip()`. */
  async requestRecording() {
    this.assertNotDisposed();
    try {
      return await this.withReaderAccess(async () => {
        const client = await this.getOrCreateClient();
        return toPublicClip(await client.requestRecording());
      });
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /** Thin delegation to the standalone `downloadClipAsFile()` — see its own doc comment. */
  async downloadClipAsFile(clip, filename = "reactor-clip.mp4", options) {
    return downloadClipAsFile(clip, filename, options);
  }
  // ── Uploads ─────────────────────────────────────────────────────────────
  /**
   * Uploads a file to the session's object store, resolving with a
   * `FileRef` to pass in a `sendCommand()`'s `data`, at the top level or
   * inside an array or object (see `extractFileRefs`). The binding itself
   * takes `(file, name?)`
   * positionally and already applies the right defaulting — a bare
   * `Blob`'s name falls back to `"upload"`, and an empty/missing mime type
   * to `"application/octet-stream"` — so there's nothing to wrap here.
   *
   * Queued behind connect()/disconnect()/reconnect(), same as the track
   * ops: this awaits its own round-trip, and a concurrent disconnect()
   * freeing the wasm client mid-upload would otherwise resume into a freed
   * client — the same use-after-free class of race the queue exists to
   * prevent.
   */
  async uploadFile(file, options) {
    this.assertNotDisposed();
    try {
      const wireFileRef = await this.queue.push(async () => {
        const client = await this.getOrCreateClient();
        return client.uploadFile(file, options?.name);
      }, "uploadFile");
      return toPublicFileRef(wireFileRef);
    } catch (cause) {
      throw this.captureError(cause);
    }
  }
  /** All tracks the model declared, whether or not media has arrived for —
   *  or been published to — them yet. Empty before a client exists. */
  tracks() {
    return this.client?.tracks() ?? [];
  }
  /** Same as `tracks()`, plus each entry's negotiated `mid` — the id
   *  `trackReceived`'s `mid` argument and the `getXByMid` escape hatches key
   *  on. Only populated once SDP negotiation has assigned mids. */
  trackMapping() {
    return this.client?.trackMapping() ?? [];
  }
  pausedTracks() {
    return this.client?.pausedTracks() ?? [];
  }
  // ── Escape hatches ──────────────────────────────────────────────────────
  /** Drops to the raw `RTCPeerConnection` for anything this class doesn't
   *  wrap directly. `undefined` before a client exists. */
  getPeerConnection() {
    return this.client?.getPeerConnection();
  }
  getTrackByMid(mid) {
    return this.client?.getTrackByMid(mid);
  }
  getStreamByMid(mid) {
    return this.client?.getStreamByMid(mid);
  }
  getTrackByName(name) {
    return this.client?.getTrackByName(name);
  }
  getStreamByName(name) {
    return this.client?.getStreamByName(name);
  }
  /**
   * Supports `using reactor = new Reactor(...)`: releases the wasm resource
   * graph and drops every registered event handler for good. Unlike a plain
   * `disconnect()`, this instance is unusable afterward — construct a new
   * `Reactor` instead of trying to `connect()` again.
   */
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const client = this.client;
    this.client = void 0;
    this.clientPromise = void 0;
    this.schema = void 0;
    this.capabilities = void 0;
    this.resetConnectionState();
    this.emitter.clear();
    if (client) {
      void this.queue.push(() => this.withWriterAccess(() => Promise.resolve(client.free())), "dispose").catch(() => {
      });
    }
  }
  // ── Introspection ───────────────────────────────────────────────────────
  /** The wasm binding's own terser `status()` name can be added alongside
   *  this later if it turns out to be worth it. */
  getStatus() {
    return this.client?.status() ?? "disconnected";
  }
  /** See `getStatus()`. */
  getSessionId() {
    return this.client?.sessionId();
  }
  /** The `jwt` this instance was constructed (or last `connect()`ed) with —
   *  lets a component composed inside a `ReactorProvider` (e.g. `ClipPlayer`)
   *  authenticate its own requests without the caller repeating the resolver. */
  getJwtResolver() {
    return this.jwt ?? void 0;
  }
  /** The most recent `ReactorError`, from either an `error` event or a
   *  rejected call — whichever landed last. `undefined` until the first
   *  failure. */
  getLastError() {
    return this._lastError;
  }
  /** The most recent WebRTC connection stats, polled every `STATS_INTERVAL_MS`
   *  while "ready" — see `statsUpdate`. `undefined` before the first sample. */
  getStats() {
    return this.stats;
  }
  /** Timing breakdown from the most recent `connect()`/`reconnect()`
   *  handshake — see `ConnectionTimings`. */
  getConnectionTimings() {
    return this.connectionTimings;
  }
  // ── Events ──────────────────────────────────────────────────────────────
  on(event, handler) {
    this.emitter.on(event, handler);
  }
  off(event, handler) {
    this.emitter.off(event, handler);
  }
  once(event, handler) {
    this.emitter.once(event, handler);
  }
  // ── Internal ────────────────────────────────────────────────────────────
  getOrCreateClient() {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient().catch((cause) => {
        this.clientPromise = void 0;
        throw cause;
      });
    }
    return this.clientPromise;
  }
  async createClient() {
    const { ReactorClient: WasmReactorClient } = await loadReactorWasm();
    if (this.disposed) {
      throw new Error("Reactor was disposed while connecting.");
    }
    const client = new WasmReactorClient(this.clientOptions, this.jwt);
    client.onStatusChanged((status) => {
      this.emitter.emit("statusChanged", status);
      this.handleStatusChanged(client, status);
    });
    client.onSessionIdChanged((sessionId) => this.emitter.emit("sessionIdChanged", sessionId));
    client.onError((error) => this.emitError(error));
    client.onMessage((message) => {
      debugLog("[Reactor] message:", message);
      this.emitter.emit("message", message);
    });
    client.onRuntimeMessage((message) => {
      debugLog("[Reactor] runtimeMessage:", message);
      this.emitter.emit("runtimeMessage", message);
    });
    client.onCapabilitiesReceived((capabilities) => {
      this.capabilities = toPublicCapabilities(capabilities);
      this.emitter.emit("capabilitiesReceived", this.capabilities);
    });
    client.onTrackReceived((name, mid) => {
      const track = client.getTrackByName(name);
      const stream = client.getStreamByName(name);
      if (!track || !stream) {
        return;
      }
      this.emitter.emit("trackReceived", name, track, stream, mid);
    });
    this.client = client;
    return client;
  }
  /** Fired once per `"ready"` transition — see `getSchema()`. `getSchema()`
   *  isn't guaranteed populated by the time a `statusChanged` "ready" handler
   *  runs (this fetch is async and dispatched separately), so callers that
   *  need the schema as soon as it lands should listen for `schemaReceived`
   *  instead of reading `getSchema()` synchronously off `statusChanged`.
   *
   *  Guards against a stale reply: if `disconnect()`/a later `connect()`
   *  replaces `client` before this resolves, or a newer `refreshSchema()`
   *  call for the same client wins the race, the result is discarded rather
   *  than clobbering `this.schema` (or emitting `schema`) with old data.
   *
   *  A rejection here (e.g. the session drops mid-request) surfaces like any
   *  other binding failure, through the same `error` event as `onError`. */
  async refreshSchema(client) {
    const refreshId = ++this.schemaRefreshId;
    try {
      const schema = this.normalizeSchema(await client.requestSchema());
      if (this.client !== client || refreshId !== this.schemaRefreshId) {
        return;
      }
      if (schema === void 0) {
        return;
      }
      this.schema = schema;
      this.emitter.emit("schemaReceived", this.schema);
      this.emitter.emit("runtimeMessage", { type: "modelSchema", data: this.schema });
    } catch (cause) {
      if (this.client !== client || refreshId !== this.schemaRefreshId) {
        return;
      }
      this.emitError(cause);
    }
  }
  /** The binding replies with a wire `null` (not an omitted field) when the
   *  model doesn't expose a schema — normalized to `undefined` so callers
   *  get the same "no schema" sentinel `getSchema()` already uses instead
   *  of a document they could otherwise dereference. */
  normalizeSchema(schema) {
    return schema ?? void 0;
  }
  /** Frees the wasm resource graph, if one exists, and clears the cached
   *  schema. Reusable — unlike `[Symbol.dispose]`, this doesn't set the
   *  permanent `disposed` flag, so a later `connect()`/`reconnect()` lazily
   *  builds a fresh client.
   *
   *  Only called from within `disconnect()`'s queued task, so `client.free()`
   *  is safe to call directly here — the queue already guarantees no other
   *  operation is running concurrently against it. */
  freeClient() {
    this.client?.free();
    this.client = void 0;
    this.clientPromise = void 0;
    this.schema = void 0;
    this.capabilities = void 0;
  }
  /** Tracks `connectionTimings` off the binding's own "connecting" → "waiting"
   *  → "ready" status sequence (see `ReactorStatus`), and starts/stops stats
   *  polling around the "ready" window. */
  handleStatusChanged(client, status) {
    switch (status) {
      case "connecting":
        this.connectStartTime = performance.now();
        this.waitingStartTime = void 0;
        break;
      case "waiting":
        this.waitingStartTime = performance.now();
        break;
      case "ready": {
        const readyTime = performance.now();
        if (this.connectStartTime != null) {
          const waitingStartTime = this.waitingStartTime ?? readyTime;
          this.connectionTimings = {
            sessionCreationMs: waitingStartTime - this.connectStartTime,
            transportConnectingMs: readyTime - waitingStartTime,
            totalMs: readyTime - this.connectStartTime
          };
        }
        this.startStatsPolling(client);
        void this.refreshSchema(client);
        break;
      }
      default:
        this.stopStatsPolling();
    }
  }
  startStatsPolling(client) {
    this.stopStatsPolling();
    const generation = ++this.statsPollGeneration;
    const extractStats = createRTCStatsExtractor();
    this.statsPollHandle = setInterval(() => {
      const peerConnection = client.getPeerConnection();
      if (!peerConnection) {
        return;
      }
      peerConnection.getStats().then((report) => {
        if (generation !== this.statsPollGeneration) {
          return;
        }
        this.stats = { ...extractStats(report), connectionTimings: this.connectionTimings };
        this.emitter.emit("statsUpdate", this.stats);
      }).catch(() => {
      });
    }, STATS_INTERVAL_MS);
  }
  stopStatsPolling() {
    this.statsPollGeneration += 1;
    if (this.statsPollHandle !== void 0) {
      clearInterval(this.statsPollHandle);
      this.statsPollHandle = void 0;
    }
    this.stats = void 0;
  }
  /** Called on every `disconnect()` and on `[Symbol.dispose]`. Leaves
   *  `client`/`schema` alone — that's `freeClient()`'s job, run separately
   *  when `disconnect()` isn't recoverable. `capabilities` is cleared here
   *  regardless, though: unlike the schema, it isn't re-fetched on demand,
   *  so a recoverable disconnect that skips `freeClient()` would otherwise
   *  leave `getCapabilities()` returning the previous session's stale
   *  tracks/commands until a new `capabilitiesReceived` lands. */
  resetConnectionState() {
    this.stopStatsPolling();
    this.connectionTimings = void 0;
    this.connectStartTime = void 0;
    this.waitingStartTime = void 0;
    this.capabilities = void 0;
  }
  /** Wraps `cause` and records it as the most recent failure, for a call
   *  that's about to throw rather than emit — see `getLastError()`'s doc
   *  comment. */
  captureError(cause) {
    const error = toReactorError(cause);
    this._lastError = error;
    return error;
  }
  /** Wraps `cause`, records it as the most recent failure, and fires the
   *  `error` event — the one place recording and emitting happen together,
   *  so `getLastError()` never drifts from what listeners were told. */
  emitError(cause) {
    this.emitter.emit("error", this.captureError(cause));
  }
  assertNotDisposed() {
    if (this.disposed) {
      throw new Error("This Reactor was disposed and can't be used again \u2014 construct a new one.");
    }
  }
};

// src/jwt.ts
function normalizeJwtSource(source) {
  if (typeof source === "function") {
    return source;
  }
  return () => source;
}

// src/react/ReactorProvider.tsx
var import_react = require("react");

// src/react/store.ts
var defaultReactorState = {
  status: "disconnected",
  sessionId: void 0,
  lastError: void 0,
  lastMessage: void 0,
  tracks: {},
  jwtToken: void 0,
  connectOptions: void 0
};
function createStore(build) {
  const listeners = /* @__PURE__ */ new Set();
  let state;
  const set = (partial) => {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener());
  };
  const get = () => state;
  state = build(set, get);
  return {
    getState: get,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
function createReactorStore(options, defaultConnectOptions) {
  return createStore((set, get) => {
    const reactor = new Reactor(options);
    reactor.on("statusChanged", (status) => {
      set(status === "disconnected" ? { status, tracks: {} } : { status });
    });
    reactor.on("sessionIdChanged", (sessionId) => set({ sessionId }));
    reactor.on("error", (lastError) => set({ lastError }));
    reactor.on("message", (lastMessage) => set({ lastMessage }));
    reactor.on("trackReceived", (name, track) => set({ tracks: { ...get().tracks, [name]: track } }));
    return {
      ...defaultReactorState,
      jwtToken: options.jwt,
      connectOptions: defaultConnectOptions,
      internal: { reactor },
      connect: (jwt, callOptions) => get().internal.reactor.connect(jwt, { ...defaultConnectOptions, ...callOptions }),
      disconnect: (recoverable) => get().internal.reactor.disconnect(recoverable),
      reconnect: (callOptions) => get().internal.reactor.reconnect({ ...defaultConnectOptions, ...callOptions }),
      sendCommand: (command, data, scope) => get().internal.reactor.sendCommand(command, data, scope),
      publish: (name, track) => get().internal.reactor.publishTrack(name, track),
      unpublish: (name) => get().internal.reactor.unpublishTrack(name),
      pauseTrack: (name) => get().internal.reactor.pauseTrack(name),
      resumeTrack: (name) => get().internal.reactor.resumeTrack(name),
      uploadFile: (file, options2) => get().internal.reactor.uploadFile(file, options2),
      requestClip: (durationSeconds) => get().internal.reactor.requestClip(durationSeconds),
      requestRecording: () => get().internal.reactor.requestRecording(),
      downloadClipAsFile: (clip, filename, options2) => get().internal.reactor.downloadClipAsFile(clip, filename, options2)
    };
  });
}

// src/react/ReactorProvider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var ReactorContext = (0, import_react.createContext)(void 0);
function buildStore({
  apiUrl,
  modelName,
  local,
  modelTracks,
  jwtToken,
  connectOptions
}) {
  const options = { modelName };
  if (apiUrl !== void 0) {
    options.apiUrl = apiUrl;
  }
  if (local !== void 0) {
    options.local = local;
  }
  if (modelTracks !== void 0) {
    options.modelTracks = modelTracks;
  }
  if (jwtToken !== void 0) {
    options.jwt = jwtToken;
  }
  const { autoConnect, ...pollingOptions } = connectOptions ?? {};
  return createReactorStore(options, pollingOptions);
}
function ReactorProvider({
  apiUrl,
  modelName,
  local,
  modelTracks,
  jwtToken,
  connectOptions,
  children
}) {
  const [store, setStore] = (0, import_react.useState)(
    () => buildStore({ apiUrl, modelName, local, modelTracks, jwtToken, connectOptions })
  );
  const isFirstRun = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStore(buildStore({ apiUrl, modelName, local, modelTracks, jwtToken, connectOptions }));
  }, [apiUrl, modelName, local, JSON.stringify(modelTracks), jwtToken, JSON.stringify(connectOptions)]);
  (0, import_react.useEffect)(() => {
    const { autoConnect = false, ...pollingOptions } = connectOptions ?? {};
    if (autoConnect && store.getState().status === "disconnected") {
      store.getState().connect(jwtToken, pollingOptions).catch((error) => {
        console.error("[Reactor.ReactorProvider] autoConnect failed:", error);
      });
    }
  }, [store]);
  (0, import_react.useEffect)(() => {
    return () => {
      const reactor = store.getState().internal.reactor;
      void reactor.disconnect().finally(() => reactor[Symbol.dispose]());
    };
  }, [store]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactorContext.Provider, { value: store, children });
}
function useReactorStore(selector) {
  const store = (0, import_react.useContext)(ReactorContext);
  if (store === void 0) {
    throw new Error("useReactor must be used within a ReactorProvider");
  }
  const getSnapshot = () => selector(store.getState());
  return (0, import_react.useSyncExternalStore)(store.subscribe, getSnapshot, getSnapshot);
}

// src/react/hooks.ts
var import_react2 = require("react");
function shallowEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => Object.is(a[key], b[key]));
}
function useShallowSelector(selector) {
  const cache = (0, import_react2.useRef)(void 0);
  return (state) => {
    const next = selector(state);
    if (cache.current && shallowEqual(cache.current.value, next)) {
      return cache.current.value;
    }
    cache.current = { value: next };
    return next;
  };
}
function useReactor(selector) {
  return useReactorStore(useShallowSelector(selector));
}
function useReactorMessage(handler) {
  const reactor = useReactor((state) => state.internal.reactor);
  const handlerRef = (0, import_react2.useRef)(handler);
  handlerRef.current = handler;
  (0, import_react2.useEffect)(() => {
    const listener = (message) => handlerRef.current(message);
    reactor.on("message", listener);
    return () => reactor.off("message", listener);
  }, [reactor]);
}
function useReactorInternalMessage(handler) {
  const reactor = useReactor((state) => state.internal.reactor);
  const handlerRef = (0, import_react2.useRef)(handler);
  handlerRef.current = handler;
  (0, import_react2.useEffect)(() => {
    const listener = (message) => handlerRef.current(message);
    reactor.on("runtimeMessage", listener);
    return () => reactor.off("runtimeMessage", listener);
  }, [reactor]);
}
function useStats() {
  const reactor = useReactor((state) => state.internal.reactor);
  const [stats, setStats] = (0, import_react2.useState)(void 0);
  (0, import_react2.useEffect)(() => {
    setStats(void 0);
    reactor.on("statsUpdate", setStats);
    return () => {
      reactor.off("statsUpdate", setStats);
      setStats(void 0);
    };
  }, [reactor]);
  return stats;
}

// src/react/ReactorView.tsx
var import_react3 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function useReceivedTrack(name) {
  const reactor = useReactor((state) => state.internal.reactor);
  const [track, setTrack] = (0, import_react3.useState)(() => name ? reactor.getTrackByName(name) : void 0);
  (0, import_react3.useEffect)(() => {
    setTrack(name ? reactor.getTrackByName(name) : void 0);
    if (!name) {
      return;
    }
    const listener = (receivedName, receivedTrack) => {
      if (receivedName === name) {
        setTrack(receivedTrack);
      }
    };
    reactor.on("trackReceived", listener);
    return () => reactor.off("trackReceived", listener);
  }, [reactor, name]);
  return track;
}
function ReactorView({
  track = "main_video",
  audioTrack,
  width,
  height,
  className,
  style,
  videoObjectFit = "contain",
  muted = audioTrack === void 0
}) {
  const videoMediaTrack = useReceivedTrack(track);
  const audioMediaTrack = useReceivedTrack(audioTrack);
  const videoRef = (0, import_react3.useRef)(null);
  const mediaStream = (0, import_react3.useMemo)(() => {
    const tracks = [];
    if (videoMediaTrack) {
      tracks.push(videoMediaTrack);
    }
    if (audioMediaTrack) {
      tracks.push(audioMediaTrack);
    }
    return tracks.length > 0 ? new MediaStream(tracks) : null;
  }, [videoMediaTrack, audioMediaTrack]);
  (0, import_react3.useEffect)(() => {
    const el = videoRef.current;
    if (!el || !mediaStream) {
      return;
    }
    const attach = (reset) => {
      if (reset) {
        el.srcObject = null;
      }
      el.srcObject = mediaStream;
      void el.play().catch(() => {
      });
    };
    attach(false);
    const onUnmute = () => attach(true);
    const tracks = mediaStream.getTracks();
    for (const t of tracks) {
      t.addEventListener("unmute", onUnmute);
    }
    return () => {
      for (const t of tracks) {
        t.removeEventListener("unmute", onUnmute);
      }
      el.srcObject = null;
    };
  }, [mediaStream]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "relative",
        background: "#000",
        ...width !== void 0 && { width },
        ...height !== void 0 && { height },
        ...style
      },
      className,
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "video",
        {
          ref: videoRef,
          style: {
            width: "100%",
            height: "100%",
            objectFit: videoObjectFit,
            display: videoMediaTrack ? "block" : "none"
          },
          muted,
          playsInline: true
        }
      )
    }
  );
}

// src/react/WebcamStream.tsx
var import_react4 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var DEFAULT_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 }
};
function WebcamStream({
  track,
  audio = false,
  audioTrack,
  className,
  style,
  videoConstraints = DEFAULT_VIDEO_CONSTRAINTS,
  showWebcam = true,
  videoObjectFit = "contain",
  onPermissionDenied,
  onPublished,
  onError
}) {
  const [stream, setStream] = (0, import_react4.useState)(null);
  const [published, setPublished] = (0, import_react4.useState)(null);
  const [permissionDenied, setPermissionDenied] = (0, import_react4.useState)(false);
  const { status, publish, unpublish, reactor } = useReactor((state) => ({
    status: state.status,
    publish: state.publish,
    unpublish: state.unpublish,
    reactor: state.internal.reactor
  }));
  const videoRef = (0, import_react4.useRef)(null);
  const onPermissionDeniedRef = (0, import_react4.useRef)(onPermissionDenied);
  const onPublishedRef = (0, import_react4.useRef)(onPublished);
  const onErrorRef = (0, import_react4.useRef)(onError);
  onPermissionDeniedRef.current = onPermissionDenied;
  onPublishedRef.current = onPublished;
  onErrorRef.current = onError;
  const audioRequested = audio !== false;
  const audioEnabled = audioRequested && audioTrack !== void 0;
  const latestRef = (0, import_react4.useRef)({ published, unpublish, stream });
  latestRef.current = { published, unpublish, stream };
  (0, import_react4.useEffect)(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioEnabled ? audio : false
    }).then((mediaStream) => {
      if (cancelled) {
        for (const t of mediaStream.getTracks()) {
          t.stop();
        }
        return;
      }
      setStream(mediaStream);
      setPermissionDenied(false);
    }).catch((err) => {
      if (cancelled) {
        return;
      }
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setPermissionDenied(true);
        onPermissionDeniedRef.current?.();
      } else {
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    });
    return () => {
      cancelled = true;
      const current = latestRef.current;
      const tasks = [];
      if (current.published) {
        tasks.push(current.unpublish(current.published.video));
        if (current.published.audio) {
          tasks.push(current.unpublish(current.published.audio));
        }
      }
      if (tasks.length > 0) {
        void Promise.allSettled(tasks).then((results) => {
          for (const r of results) {
            if (r.status === "rejected") {
              onErrorRef.current?.(r.reason instanceof Error ? r.reason : new Error(String(r.reason)));
            }
          }
        });
      }
      current.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    const el = videoRef.current;
    if (!el) {
      return;
    }
    el.srcObject = stream;
  }, [stream]);
  (0, import_react4.useEffect)(() => {
    if (!stream) {
      return;
    }
    let cancelled = false;
    const desiredAudio = audioEnabled ? audioTrack : void 0;
    const activeStream = stream;
    async function sync() {
      if (status === "ready") {
        if (published && published.video === track && published.audio === desiredAudio) {
          return;
        }
        if (published) {
          const rollback = [unpublish(published.video)];
          if (published.audio) {
            rollback.push(unpublish(published.audio));
          }
          await Promise.allSettled(rollback);
          if (cancelled) {
            return;
          }
          setPublished(null);
        }
        const videoMediaTrack = activeStream.getVideoTracks()[0];
        const audioMediaTrack = desiredAudio ? activeStream.getAudioTracks()[0] : void 0;
        const attempts = [];
        if (videoMediaTrack) {
          attempts.push({ name: track, task: publish(track, videoMediaTrack) });
        }
        if (audioMediaTrack && desiredAudio) {
          attempts.push({ name: desiredAudio, task: publish(desiredAudio, audioMediaTrack) });
        }
        if (attempts.length === 0) {
          return;
        }
        const results = await Promise.allSettled(attempts.map((a) => a.task));
        if (cancelled) {
          return;
        }
        const failureIndex = results.findIndex((r) => r.status === "rejected");
        if (failureIndex !== -1) {
          const succeeded = attempts.filter((_, i) => results[i]?.status === "fulfilled");
          await Promise.allSettled(succeeded.map((a) => unpublish(a.name)));
          if (cancelled) {
            return;
          }
          const failure = results[failureIndex];
          onErrorRef.current?.(failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason)));
          return;
        }
        const newPublished = { video: track };
        if (audioMediaTrack && desiredAudio) {
          newPublished.audio = desiredAudio;
        }
        setPublished(newPublished);
        onPublishedRef.current?.();
      } else if (published) {
        const tasks = [unpublish(published.video)];
        if (published.audio) {
          tasks.push(unpublish(published.audio));
        }
        const results = await Promise.allSettled(tasks);
        if (cancelled) {
          return;
        }
        for (const r of results) {
          if (r.status === "rejected") {
            onErrorRef.current?.(r.reason instanceof Error ? r.reason : new Error(String(r.reason)));
          }
        }
        setPublished(null);
      }
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [status, stream, published, publish, unpublish, track, audioEnabled, audioTrack]);
  (0, import_react4.useEffect)(() => {
    const handleError = (error) => {
      if (error.code === "TRACK_PUBLISH_FAILED") {
        setPublished(null);
      }
    };
    reactor.on("error", handleError);
    return () => reactor.off("error", handleError);
  }, [reactor]);
  const showPlaceholder = !stream;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        display: showWebcam ? "block" : "none",
        position: "relative",
        background: "#000",
        ...style
      },
      className,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "video",
          {
            ref: videoRef,
            style: {
              width: "100%",
              height: "100%",
              objectFit: videoObjectFit,
              display: showPlaceholder ? "none" : "block"
            },
            muted: true,
            playsInline: true,
            autoPlay: true
          }
        ),
        showPlaceholder && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontFamily: "monospace",
              textAlign: "center",
              padding: "20px",
              boxSizing: "border-box",
              flexDirection: "column",
              gap: "12px"
            },
            children: permissionDenied ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { fontSize: "12px", fontFamily: "monospace" }, children: [
              "Camera access denied.",
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
              "Please allow access in your browser settings."
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: "12px", fontFamily: "monospace" }, children: "Starting camera..." })
          }
        )
      ]
    }
  );
}

// src/react/ClipPlayer.tsx
var import_react5 = require("react");

// src/clip-playback.ts
function attachClipPlayback(video, source, {
  autoPlay,
  onReady,
  onError,
  loadHls = () => import("hls.js").then((mod) => mod.default)
}) {
  let destroyed = false;
  let failed = false;
  let ready = false;
  let hls = null;
  let mp4Url = null;
  const fail = (error) => {
    if (destroyed || failed) {
      return;
    }
    failed = true;
    onError(error);
  };
  const handleLoadedMetadata = () => {
    if (destroyed || failed || ready) {
      return;
    }
    ready = true;
    onReady();
    if (autoPlay) {
      video.play().catch(() => {
      });
    }
  };
  const handleElementError = () => {
    fail(new Error(describeMediaError(video.error)));
  };
  video.addEventListener("loadedmetadata", handleLoadedMetadata);
  video.addEventListener("error", handleElementError);
  const handle = {
    destroy: () => {
      destroyed = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleElementError);
      hls?.destroy();
      hls = null;
      if (mp4Url) {
        URL.revokeObjectURL(mp4Url);
        mp4Url = null;
      }
    }
  };
  const selectPath = async () => {
    const HlsCtor = hasMediaSource() ? await loadHls().catch(() => null) : null;
    if (destroyed) {
      return;
    }
    if (HlsCtor?.isSupported()) {
      const instance = new HlsCtor();
      instance.loadSource(source.manifestUrl);
      instance.attachMedia(video);
      instance.on(HlsCtor.Events.ERROR, (_evt, data) => {
        if (destroyed) {
          return;
        }
        if (data.fatal) {
          fail(new Error(`Playback error: ${data.details ?? "unknown"}`));
          return;
        }
        console.warn("[Reactor.ClipPlayer] hls.js non-fatal error", data);
      });
      hls = instance;
      return;
    }
    const blob = await source.assembleMp4();
    if (destroyed) {
      return;
    }
    mp4Url = URL.createObjectURL(blob);
    video.src = mp4Url;
  };
  selectPath().catch((err) => {
    fail(err instanceof Error ? err : new Error(String(err)));
  });
  return handle;
}
function hasMediaSource() {
  const scope = globalThis;
  return Boolean(scope.ManagedMediaSource ?? scope.MediaSource ?? scope.WebKitMediaSource);
}
var MEDIA_ERROR_MESSAGES = {
  1: "Playback was aborted.",
  2: "A network error interrupted playback.",
  3: "This clip could not be decoded.",
  4: "This browser cannot play this clip. Use Download instead."
};
function describeMediaError(error) {
  const message = (error && MEDIA_ERROR_MESSAGES[error.code]) ?? "This clip failed to play in this browser. Use Download instead.";
  return error?.message ? `${message} (${error.message})` : message;
}

// src/internal/jwt-resolver.ts
async function resolveJwtSource(source) {
  return typeof source === "function" ? source() : source;
}

// src/react/ClipPlayer.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function ClipPlayer({
  clip,
  getJwt,
  slackMs,
  autoPlay = true,
  muted = true,
  className,
  style,
  onError
}) {
  const videoRef = (0, import_react5.useRef)(null);
  const [phase, setPhase] = (0, import_react5.useState)({ kind: "waiting" });
  const store = (0, import_react5.useContext)(ReactorContext);
  const getJwtRef = (0, import_react5.useRef)(getJwt);
  const autoPlayRef = (0, import_react5.useRef)(autoPlay);
  const slackMsRef = (0, import_react5.useRef)(slackMs);
  const onErrorRef = (0, import_react5.useRef)(onError);
  const storeRef = (0, import_react5.useRef)(store);
  getJwtRef.current = getJwt;
  autoPlayRef.current = autoPlay;
  slackMsRef.current = slackMs;
  onErrorRef.current = onError;
  storeRef.current = store;
  (0, import_react5.useEffect)(() => {
    if (phase.kind === "error") {
      onErrorRef.current?.(phase.error);
    }
  }, [phase]);
  (0, import_react5.useEffect)(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const abort = new AbortController();
    let cancelled = false;
    let playback = null;
    let manifestBlobUrl = null;
    const fail = (error) => {
      if (cancelled) {
        return;
      }
      const message = error instanceof RecordingError ? `${error.code}: ${error.reason}` : error.message;
      setPhase({ kind: "error", message, error });
    };
    const setup = async () => {
      try {
        setPhase({ kind: "waiting" });
        const explicit = getJwtRef.current;
        const fallback = storeRef.current?.getState().internal.reactor.getJwtResolver();
        const jwt = explicit ? await explicit() : fallback !== void 0 ? await resolveJwtSource(fallback) : void 0;
        if (cancelled) {
          return;
        }
        const playlistOptions = {
          predictedReadyAtMs: clip.predictedReadyAtMs,
          signal: abort.signal
        };
        if (slackMsRef.current !== void 0) {
          playlistOptions.slackMs = slackMsRef.current;
        }
        if (jwt !== void 0) {
          playlistOptions.jwt = jwt;
        }
        const body = await fetchPlaylist(clip.playlistUrl, playlistOptions);
        if (cancelled) {
          return;
        }
        setPhase({ kind: "loading" });
        manifestBlobUrl = createPlayableManifestUrl(body, clip.playlistUrl);
        playback = attachClipPlayback(
          video,
          {
            manifestUrl: manifestBlobUrl,
            assembleMp4: () => assembleClipBlob(body, clip.playlistUrl, { signal: abort.signal })
          },
          {
            autoPlay: autoPlayRef.current,
            onReady: () => {
              if (!cancelled) {
                setPhase({ kind: "ready" });
              }
            },
            onError: fail
          }
        );
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    };
    void setup();
    return () => {
      cancelled = true;
      abort.abort();
      playback?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (manifestBlobUrl) {
        URL.revokeObjectURL(manifestBlobUrl);
      }
    };
  }, [clip]);
  const overlayText = phase.kind === "waiting" ? "Waiting for clip\u2026" : phase.kind === "loading" ? "Loading player\u2026" : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      className,
      style: {
        position: "relative",
        background: "#000",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "video",
          {
            ref: videoRef,
            controls: true,
            playsInline: true,
            muted,
            style: {
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: "100%"
            }
          }
        ),
        overlayText && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.6)",
              font: "11px ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              pointerEvents: "none"
            },
            children: overlayText
          }
        ),
        phase.kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(0,0,0,0.8)",
              color: "#ef4444",
              font: "11px ui-monospace, SFMono-Regular, Menlo, monospace",
              textAlign: "center"
            },
            children: phase.message
          }
        )
      ]
    }
  );
}

// src/react/ClipDownloadButton.tsx
var import_react7 = require("react");

// src/react/useClipDownload.ts
var import_react6 = require("react");
function useClipDownload(clip, options = {}) {
  const [state, setState] = (0, import_react6.useState)({ kind: "idle" });
  const store = (0, import_react6.useContext)(ReactorContext);
  const clipRef = (0, import_react6.useRef)(clip);
  const filenameRef = (0, import_react6.useRef)(options.filename ?? "reactor-clip.mp4");
  const getJwtRef = (0, import_react6.useRef)(options.getJwt);
  const storeRef = (0, import_react6.useRef)(store);
  clipRef.current = clip;
  filenameRef.current = options.filename === void 0 ? "reactor-clip.mp4" : options.filename;
  getJwtRef.current = options.getJwt;
  storeRef.current = store;
  const inFlightRef = (0, import_react6.useRef)(false);
  const abortRef = (0, import_react6.useRef)(null);
  (0, import_react6.useEffect)(() => () => abortRef.current?.abort(), []);
  const download = (0, import_react6.useCallback)(async () => {
    if (inFlightRef.current) {
      return void 0;
    }
    inFlightRef.current = true;
    const abort = new AbortController();
    abortRef.current = abort;
    setState({ kind: "downloading", fetched: 0, total: 0 });
    try {
      const explicit = getJwtRef.current;
      const fallback = storeRef.current?.getState().internal.reactor.getJwtResolver();
      const jwt = explicit ? await explicit() : fallback !== void 0 ? await resolveJwtSource(fallback) : void 0;
      const downloadOptions = {
        signal: abort.signal,
        onProgress: ({ fetched, total }) => setState({ kind: "downloading", fetched, total })
      };
      if (jwt !== void 0) {
        downloadOptions.jwt = jwt;
      }
      const blob = await downloadClipAsFile(clipRef.current, filenameRef.current, downloadOptions);
      setState({ kind: "idle" });
      return blob;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return void 0;
      }
      const message = err instanceof RecordingError ? `${err.code}: ${err.reason}` : err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
      return void 0;
    } finally {
      inFlightRef.current = false;
    }
  }, []);
  const reset = (0, import_react6.useCallback)(() => setState({ kind: "idle" }), []);
  return { state, download, reset };
}

// src/react/ClipDownloadButton.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function ClipDownloadButton({
  clip,
  getJwt,
  filename = "reactor-clip.mp4",
  children,
  className,
  style,
  disabled,
  onSuccess,
  onError
}) {
  const downloadOptions = { filename };
  if (getJwt !== void 0) {
    downloadOptions.getJwt = getJwt;
  }
  const { state, download } = useClipDownload(clip, downloadOptions);
  const downloading = state.kind === "downloading";
  const isDisabled = downloading || !!disabled;
  const onSuccessRef = (0, import_react7.useRef)(onSuccess);
  const onErrorRef = (0, import_react7.useRef)(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  (0, import_react7.useEffect)(() => {
    if (state.kind === "error") {
      onErrorRef.current?.(new Error(state.message));
    }
  }, [state]);
  const content = typeof children === "function" ? children(state) : children !== void 0 ? children : defaultLabel(state);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "button",
    {
      type: "button",
      onClick: () => {
        void download().then((blob) => {
          if (blob) {
            onSuccessRef.current?.(blob);
          }
        });
      },
      disabled: isDisabled,
      title: state.kind === "error" ? state.message : void 0,
      className,
      style: {
        padding: "5px 12px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        font: "11px ui-monospace, SFMono-Regular, Menlo, monospace",
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "background-color 120ms ease",
        ...style
      },
      children: content
    }
  );
}
function defaultLabel(state) {
  if (state.kind === "downloading") {
    if (state.total > 0) {
      return `Downloading ${state.fetched}/${state.total}\u2026`;
    }
    return "Downloading\u2026";
  }
  return "Download";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AbortedError,
  BadRequestError,
  ClipDownloadButton,
  ClipPlayer,
  ConflictError,
  DEFAULT_PLAYLIST_POLL_SLACK_MS,
  DecodeError,
  DisconnectedError,
  FileRef,
  InvalidStateError,
  MessageTooLargeError,
  NetworkError,
  NotFoundError,
  RateLimitedError,
  Reactor,
  ReactorError,
  ReactorProvider,
  ReactorView,
  RecorderDisabledError,
  RecordingError,
  RequestTimeoutError,
  ServerError,
  SessionTerminalError,
  TransportError,
  UnauthorizedError,
  VersionMismatchError,
  WebcamStream,
  createPlayableManifestUrl,
  downloadClipAsFile,
  fetchPlaylist,
  isFileRef,
  normalizeJwtSource,
  parsePlaylist,
  useClipDownload,
  useReactor,
  useReactorInternalMessage,
  useReactorMessage,
  useStats
});
//# sourceMappingURL=index.cjs.map