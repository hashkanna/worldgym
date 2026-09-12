import * as react from 'react';
import { ReactNode, CSSProperties, VideoHTMLAttributes } from 'react';

/**
 * Every Reactor failure carries `code`, `recoverable`, `status`, `operation`,
 * `retry_after_ms` and `timestamp_ms` — `reactor-core`'s canonical shape,
 * shared by every SDK on it. `timestamp`/`retryAfter` are kept alongside
 * under their previous names for compatibility — see their own doc comments
 * below — rather than dropped, since this package's public API may only
 * grow.
 *
 * There is **one class**, not two: the `error` event payload and a rejected
 * call's error are the same shape and the same instance type.
 *
 * `ReactorError` is the base of a typed hierarchy keyed by `code` —
 * `reactor-core`'s own per-failure-kind classification — so `instanceof
 * UnauthorizedError` and `code === 'UNAUTHORIZED'` are equivalent, one just
 * typed. Codes are open-ended (the platform can send its own), so an
 * unrecognized one falls back to the base class itself rather than
 * throwing.
 */
/** Fields a `ReactorError` constructor accepts, all optional — an
 *  unrecognized code still constructs cleanly on the base class, and a
 *  purely local failure (no payload at all) still constructs cleanly too. */
interface ReactorErrorOptions {
    code?: string | undefined;
    recoverable?: boolean | undefined;
    status?: number | undefined;
    operation?: string | undefined;
    retry_after_ms?: number | undefined;
    timestamp_ms?: number | undefined;
}
declare class ReactorError extends Error {
    /** The code this class stands for. `ReactorError` itself is the fallback,
     *  so it claims none and takes whatever the payload reported. */
    static readonly code: string;
    /** `reactor-core`'s own canonical code for this failure — the same value
     *  used to pick this instance's class (see the typed subclasses below for
     *  the vocabulary). Open-ended: an unrecognized code still constructs the
     *  base class, with `code` set to whatever was reported. */
    readonly code: string;
    /** Whether the same call could succeed later. */
    readonly recoverable: boolean;
    /** The HTTP status, when the failure came from one. */
    readonly status: number | undefined;
    /** Which call failed, e.g. "connect", "sendCommand". */
    readonly operation: string | undefined;
    /** Backoff hint the platform sent. */
    readonly retry_after_ms: number | undefined;
    /** When `reactor-core` reported this failure. For a purely local one (no
     *  payload at all — see {@link ReactorErrorOptions}), this is synthesized
     *  as the construction time instead, since there's nothing to report —
     *  not a value read off the wire. */
    readonly timestamp_ms: number;
    /** Same value as `retry_after_ms`, under its previous name. Kept for
     *  compatibility — prefer `retry_after_ms`. */
    readonly retryAfter: number | undefined;
    /** Same value as `timestamp_ms`, under its previous name. Kept for
     *  compatibility — prefer `timestamp_ms`. */
    readonly timestamp: number;
    constructor(message: string, options?: ReactorErrorOptions);
}
/** The request never got a reply — DNS, TLS, a refused socket. */
declare class NetworkError extends ReactorError {
    static readonly code = "NETWORK_ERROR";
}
/** 401 or 403: the token is missing, expired, or not scoped for this call. */
declare class UnauthorizedError extends ReactorError {
    static readonly code = "UNAUTHORIZED";
}
/** 404: no such model, session or upload. */
declare class NotFoundError extends ReactorError {
    static readonly code = "NOT_FOUND";
}
/** 409: the session is in a state that does not allow this — usually a
 *  session left orphaned by a previous run that went away without
 *  disconnecting. */
declare class ConflictError extends ReactorError {
    static readonly code = "CONFLICT";
}
/** 429: too many requests. `retry_after_ms` carries the server's
 *  `Retry-After` when it sent one; `undefined` means back off on your own
 *  terms rather than retrying immediately. */
declare class RateLimitedError extends ReactorError {
    static readonly code = "RATE_LIMITED";
}
/** A 4xx other than the ones above: the request itself was wrong. */
declare class BadRequestError extends ReactorError {
    static readonly code = "BAD_REQUEST";
}
/** 5xx: the coordinator failed, and the same request may work later. */
declare class ServerError extends ReactorError {
    static readonly code = "SERVER_ERROR";
}
/** This client and the platform disagree on the protocol — upgrade the SDK. */
declare class VersionMismatchError extends ReactorError {
    static readonly code = "VERSION_MISMATCH";
}
/** A reply arrived and could not be understood. */
declare class DecodeError extends ReactorError {
    static readonly code = "DECODE_FAILED";
}
/** The operation is not allowed from the state the client is in — most often
 *  a call that needs a live session, made before `connect()` or after the
 *  status left `"ready"`. */
declare class InvalidStateError extends ReactorError {
    static readonly code = "INVALID_STATE";
}
/** The session reached a state it cannot leave. Start a new one. */
declare class SessionTerminalError extends ReactorError {
    static readonly code = "SESSION_TERMINAL";
}
/** The payload exceeds what the data channel accepts — send large content
 *  with `uploadFile()` and pass the `FileRef` instead of embedding it
 *  inline in a command. */
declare class MessageTooLargeError extends ReactorError {
    static readonly code = "MESSAGE_TOO_LARGE";
}
/** The media transport failed. */
declare class TransportError extends ReactorError {
    static readonly code = "TRANSPORT_ERROR";
}
/** The connection went away, either dropped mid-request or lost after being
 *  established. `reconnect()` is the way back. */
declare class DisconnectedError extends ReactorError {
    static readonly code = "DISCONNECTED";
}
/** The operation was sent and nothing came back in time. */
declare class RequestTimeoutError extends ReactorError {
    static readonly code = "REQUEST_TIMEOUT";
}
/** The operation was abandoned before it finished. */
declare class AbortedError extends ReactorError {
    static readonly code = "ABORTED";
}
/**
 * A `requestClip()`/`requestRecording()` call failed because the model's
 * recorder is disabled or has crashed.
 *
 * Unlike every other code here, `RECORDER_DISABLED` isn't platform-sent —
 * `reactor-core` produces it by matching known reason strings on an
 * otherwise free-text `ClipFailed` message, as a stopgap until that message
 * carries a structured reason (tracked as REA-5403). Treat it as best-effort:
 * a clip failure for the same underlying reason may still arrive as the
 * base `ReactorError` (`code: "INTERNAL_ERROR"`) if the reason text ever
 * changes upstream.
 *
 * `recoverable` is `false`: the recorder being disabled or crashed isn't
 * something retrying the same `requestClip()`/`requestRecording()` call can
 * fix — it needs an operator to re-enable or restart the recorder on the
 * model side first.
 */
declare class RecorderDisabledError extends ReactorError {
    static readonly code = "RECORDER_DISABLED";
}

/**
 * Reference to a file uploaded via `Reactor.uploadFile()`. Pass it back in
 * `sendCommand()`'s `data` wherever the model's schema declares a file: as a
 * top-level value it's extracted and sent as a separate upload reference,
 * and inside an array or object it's serialized as one — see
 * `extractFileRefs()`.
 */
declare class FileRef {
    readonly uploadId: string;
    readonly name: string;
    readonly mimeType: string;
    readonly size: number;
    constructor(uploadId: string, name: string, mimeType: string, size: number);
}
/**
 * Structural check for anything shaped like a `FileRef`, for callers who'd
 * rather duck-type than rely on `instanceof` (e.g. across two copies of this
 * package bundled into the same page). `extractFileRefs()` uses this too,
 * for the same reason.
 */
declare function isFileRef(value: unknown): value is FileRef;

/**
 * The `reactor-wasm` contract, mirrored by hand.
 *
 * `crates/reactor-wasm` generates the real `reactor_wasm.d.ts` at
 * `mise run build:wasm` time (see `crates/reactor-wasm/src/types.rs` and
 * `client.rs`), but that output isn't committed — the JS SDK depends on a
 * build step, not a checked-in file. This file re-states that same contract
 * so `sdks/js` type-checks on a fresh checkout too, before anyone has run the
 * wasm build. Node resolution always prefers a real, installed module over an
 * ambient ad-hoc declaration, so once `reactor_wasm.js`/`.d.ts` exist next to
 * this at runtime, they're what actually loads — this file only fills the gap
 * until then.
 *
 * Keep in sync with the two files above. Field naming follows the wire, not
 * JavaScript: payloads that come out of the core keep snake_case
 * (`protocol_version`, `retry_after_ms`, `playlist_url`, ...); only the
 * options this crate defines itself are camelCase.
 */
type ReactorStatus = 'disconnected' | 'connecting' | 'waiting' | 'ready';
type TrackKind = 'audio' | 'video';
type TrackDirection = 'recvonly' | 'sendonly';
interface ClientOptions {
    modelName: string;
    apiUrl?: string;
    local?: boolean;
    sdkType?: string;
    sdkVersion?: string;
    autoResumeTracks?: boolean;
    extraArgs?: Record<string, unknown>;
    heartbeatIntervalMs?: number;
    readyTimeoutMs?: number;
    controlRequestTimeoutMs?: number;
    clipRequestTimeoutMs?: number;
    maxSessionAttempts?: number;
    maxSdpAttempts?: number;
    sdpBackoffInitialMs?: number;
    sdpBackoffMaxMs?: number;
    sdpBackoffMultiplier?: number;
    modelTracks?: TrackCapability[];
    logLevel?: 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}
interface ConnectOptions {
    sessionId?: string;
    connectionId?: number;
    autoResumeTracks?: boolean;
    maxAttempts?: number;
}
/** A token, or a resolver called before every authenticated request.
 *  Returning "" sends no Authorization header. */
type JwtSource = string | (() => string | Promise<string>);
interface TrackCapability {
    name: string;
    kind: TrackKind;
    direction: TrackDirection;
}
interface TrackMappingEntry extends TrackCapability {
    mid: string;
}
interface CommandCapability$1 {
    name: string;
    description?: string;
    schema?: unknown;
}
interface Capabilities$1 {
    protocol_version: string;
    tracks: TrackCapability[];
    commands?: CommandCapability$1[];
    emission_fps?: number;
}
interface SessionInfo {
    session_id: string;
    state: string;
    model?: {
        name: string;
        version?: string;
    };
    cluster?: string;
    server_info?: {
        server_version: string;
    };
    selected_transport?: {
        protocol: string;
        version: string;
    };
    capabilities?: Capabilities$1;
    [key: string]: unknown;
}
interface ReactorMessage {
    type: string;
    data: unknown;
}

/** The session resource, as the coordinator reports it — see
 *  `Reactor.getSessionInfo()`. */
type SessionResponse = SessionInfo;
/**
 * Scope tag for `sendCommand()`. This SDK has no generic runtime-scope
 * channel — see `Reactor`'s private `sendRuntimeScopedCommand()` for what
 * `"runtime"` actually does here (routes a couple of recognized commands to
 * their direct equivalents, warns and falls through to a normal send for
 * anything else).
 */
type MessageScope = 'application' | 'runtime';
/** Any object, except a function. */
type NotFunction<T> = T extends (...args: never[]) => unknown ? never : T;
/** One command the model declares in its capabilities. */
interface CommandCapability {
    name: string;
    description?: string;
    schema?: unknown;
}
/**
 * The runtime's declared capabilities for the session — negotiated tracks,
 * and the command set when the model exposes one. Pushed once available (no
 * explicit request needed) — see `Reactor.getCapabilities()`/
 * `capabilitiesReceived`.
 *
 * camelCase — the wasm binding's own wire shape is snake_case
 * (`protocol_version`, `emission_fps`), translated at the boundary in
 * `internal/capabilities.ts` rather than exposed directly here.
 */
interface Capabilities {
    protocolVersion: string;
    tracks: TrackCapability[];
    commands?: CommandCapability[];
    emissionFps?: number;
}
/** One OpenAPI operation (the `post` of an event/webhook path item). */
interface ModelSchemaOperation {
    operationId?: string;
    summary?: string;
    description?: string;
    requestBody?: {
        required?: boolean;
        content?: Record<string, {
            schema?: Record<string, unknown>;
        }>;
    };
    responses?: Record<string, unknown>;
    [key: string]: unknown;
}
/** An OpenAPI path item; the runtime only populates `post`. */
interface ModelSchemaPathItem {
    post?: ModelSchemaOperation;
    [key: string]: unknown;
}
/**
 * The model's OpenAPI 3.1 schema, returned by `requestSchema()`/cached by
 * `getSchema()`. A pass-through of the runtime's document, not a shape this
 * SDK reshapes: client-triggerable events live under `paths` as
 * `POST /events/<name>` operations, outbound model messages under
 * `webhooks`, and media tracks under `x-reactor.tracks`. Read the parts you
 * need.
 */
interface ModelSchema {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    paths?: Record<string, ModelSchemaPathItem>;
    webhooks?: Record<string, ModelSchemaPathItem>;
    'x-reactor'?: {
        tracks?: Array<{
            name: string;
            kind: string;
            direction: string;
        }>;
    };
    components?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Severity tier of a content-moderation event delivered as the inner
 * payload of a `runtimeMessage` with `type === "moderation"`. `"warn"`
 * continues the session (informational only); `"terminate"` ends it shortly
 * after the message is dispatched.
 */
type ModerationAction = 'warn' | 'terminate';
/**
 * Inner payload of a `runtimeMessage` with `type === "moderation"`. Surfaces
 * a content-moderation outcome to the client app on any moderatable input
 * (free-text fields, file uploads) the configured policy flags — subscribe
 * via `reactor.on("runtimeMessage", ...)` and filter on `type`.
 */
interface ModerationEvent {
    action: ModerationAction;
    /** Modality of the flagged input. `"text"` for string fields, `"image"`
     *  for file-upload payloads with an image MIME type. */
    input_kind: 'text' | 'image';
    /** Name of the inbound command/event whose payload was flagged. */
    command: string;
    /** Category labels that flagged (e.g. `["sexual"]`, `["violence/graphic"]`). */
    categories: string[];
    /** Short human-readable summary suitable for UI rendering. */
    message: string;
}
/**
 * `Reactor` construction options. Only `modelName` is required.
 *
 * Everything but `jwt` passes straight through to the wasm binding's
 * `ClientOptions` — see `crates/reactor-wasm/src/types.rs` for what each
 * field does. `jwt` lives here instead because the binding takes it as a
 * second constructor argument, not a field; `Reactor` accepts one options
 * object and splits it internally.
 */
interface ReactorOptions extends ClientOptions {
    /** A token, or a resolver called before every authenticated request.
     *  Omit for an unauthenticated local runtime. Replaceable later by passing
     *  a new one to `connect()`. */
    jwt?: JwtSource;
}
/**
 * Timing breakdown of the `connect()` handshake, recorded once per connection
 * and included in every subsequent `ConnectionStats` update. All durations
 * are in milliseconds (from `performance.now()`).
 *
 * `sessionCreationMs` covers session creation/adoption (the binding's
 * `"connecting"` phase); `transportConnectingMs` covers the session-ready
 * wait and transport handshake together (the `"waiting"` phase) — that
 * handshake happens entirely inside `reactor-core`, so this can only split
 * on the phase boundaries the binding's status events expose, not on the
 * finer steps within each one.
 */
interface ConnectionTimings {
    sessionCreationMs: number;
    transportConnectingMs: number;
    /** End-to-end: connect() invocation → status "ready". */
    totalMs: number;
}
interface ConnectionStats {
    /** ICE candidate-pair round-trip time in milliseconds */
    rtt?: number | undefined;
    /** ICE candidate type: "host", "srflx", "prflx", or "relay" (TURN) */
    candidateType?: string | undefined;
    /** Estimated available incoming bitrate in bits/second */
    availableIncomingBitrate?: number | undefined;
    /** Estimated available outgoing bitrate in bits/second */
    availableOutgoingBitrate?: number | undefined;
    /** Real-time incoming bitrate in bits/second */
    incomingBitrate?: number | undefined;
    /** Real-time outgoing bitrate in bits/second */
    outgoingBitrate?: number | undefined;
    /** Received video frames per second */
    framesPerSecond?: number | undefined;
    /** Ratio of packets lost (0-1) */
    packetLossRatio?: number | undefined;
    /** Network jitter in seconds (from inbound-rtp) */
    jitter?: number | undefined;
    /** Timing breakdown of the initial connection handshake (set once, persisted until disconnect) */
    connectionTimings?: ConnectionTimings | undefined;
    timestamp: number;
}
/** Discriminator on a {@link Clip}. `"snap"` from `requestClip()`, `"recording"` from `requestRecording()`. */
type ClipKind = 'snap' | 'recording';
/**
 * A finished (or soon-available) clip, from `requestClip()` / `requestRecording()`.
 *
 * The runtime returns immediately on every request — it does not block until
 * the in-progress chunk finalizes. `predictedReadyAtMs` is the runtime's own
 * estimate of when `playlistUrl` becomes fetchable; `fetchPlaylist()` and
 * `downloadClipAsFile()` poll past it until the manifest is actually ready.
 */
interface Clip {
    sessionId: string;
    kind: ClipKind;
    /** Session-relative seconds since recorder start. */
    startMarker: number;
    endMarker: number;
    nowMarker: number;
    /** Unix epoch in milliseconds. */
    predictedReadyAtMs: number;
    /** Absolute HLS manifest URL — short-lived; re-issuing the request produces a fresh one. */
    playlistUrl: string;
}
interface ReactorEventMap {
    statusChanged: (status: ReactorStatus) => void;
    sessionIdChanged: (sessionId: string | undefined) => void;
    error: (error: ReactorError) => void;
    /** Application-scope payload from the model. */
    message: (message: ReactorMessage) => void;
    /** Platform-scope payload, same name as the Python SDK's `runtime_message`. */
    runtimeMessage: (message: ReactorMessage) => void;
    /** The model's command schema, fired once the auto-request on `"ready"`
     *  lands — see `getSchema()`. */
    schemaReceived: (schema: ModelSchema) => void;
    /** The runtime's declared capabilities, fired once available — see
     *  `getCapabilities()`. */
    capabilitiesReceived: (capabilities: Capabilities) => void;
    /** Fired when the model side of a track's media becomes available.
     *  `Reactor` resolves the wasm binding's raw `(name, mid)` through
     *  `getTrackByName`/`getStreamByName` before emitting, so callers don't
     *  need an extra step. `reactor-core` only ever dispatches this once the
     *  track is already resolvable (it drops the underlying event entirely
     *  otherwise), so `track`/`stream` are always real values here, never
     *  `undefined`; `mid` rides along as an extra escape hatch for callers
     *  that want the binding's own identifier (e.g. for
     *  `getTrackByMid`/`getStreamByMid`). */
    trackReceived: (name: string, track: MediaStreamTrack, stream: MediaStream, mid: string | undefined) => void;
    /** Fired every `STATS_INTERVAL_MS` while the session is "ready" — see
     *  `getStats()`. */
    statsUpdate: (stats: ConnectionStats) => void;
}
type ReactorEventName = keyof ReactorEventMap;

/**
 * Browser-side primitives for turning a `Clip` (from `requestClip()` /
 * `requestRecording()`) into playable or downloadable media.
 *
 * `Clip.playlistUrl` names an HLS media playlist — `#EXT-X-VERSION:7`
 * fragmented MP4, an `#EXT-X-MAP` init segment followed by `.m4s` media
 * fragments — that the caller fetches and assembles; Reactor itself doesn't
 * host clips. This module owns fetching and parsing that playlist
 * (`fetchPlaylist` / `parsePlaylist`), wrapping it for a `<video>` element or
 * `hls.js` (`createPlayableManifestUrl`), and assembling the referenced
 * chunks into a flat, downloadable MP4 (`downloadClipAsFile`).
 */

/**
 * Error thrown when a clip's playlist or chunks can't be fetched, parsed, or
 * assembled into a file. Scoped to this module — a failure in
 * `requestClip()` / `requestRecording()` themselves surfaces as a
 * `ReactorError`, since those go through `reactor-core`'s own error channel.
 *
 * `code` is a stable, machine-readable identifier; `reason` is the raw
 * string behind it (an HTTP status, a parse complaint, …).
 */
declare class RecordingError extends Error {
    readonly code: 'CLIP_GONE' | 'CLIP_NOT_READY' | 'PLAYLIST_FETCH_FAILED' | 'CHUNK_FETCH_FAILED' | 'INVALID_PLAYLIST' | 'DOWNLOAD_UNSUPPORTED';
    readonly reason: string;
    constructor(code: 'CLIP_GONE' | 'CLIP_NOT_READY' | 'PLAYLIST_FETCH_FAILED' | 'CHUNK_FETCH_FAILED' | 'INVALID_PLAYLIST' | 'DOWNLOAD_UNSUPPORTED', reason: string);
}
/** Segments referenced by an HLS manifest, in playback order. */
interface ParsedPlaylist {
    initUrl: string;
    segmentUrls: string[];
}
/**
 * Suggested grace period for callers that opt into a bounded wait by passing
 * it as `FetchPlaylistOptions.slackMs`. Not a default — `fetchPlaylist()`
 * polls indefinitely unless a bound is supplied.
 */
declare const DEFAULT_PLAYLIST_POLL_SLACK_MS = 15000;
interface FetchPlaylistOptions {
    /**
     * Unix epoch (ms) when the runtime predicts the boundary chunk will be
     * servable — pass `clip.predictedReadyAtMs`. On its own this doesn't stop
     * polling; it only anchors the optional `slackMs` deadline.
     */
    predictedReadyAtMs?: number;
    /**
     * Opt-in grace period that turns polling into a bounded wait: a stuck
     * `202` produces `CLIP_NOT_READY` once `max(predictedReadyAtMs, pollStart)
     * + slackMs` passes. Omit (the default) to poll indefinitely until the
     * manifest is ready or the caller aborts via `signal`.
     */
    slackMs?: number;
    /** Hard cap on the per-poll wait. `Retry-After` is honored but clamped. Default 2000 ms. */
    maxRetryDelayMs?: number;
    /** Floor on the per-poll wait so a cheap network doesn't hot-loop. Default 200 ms. */
    minRetryDelayMs?: number;
    /**
     * Opt-in cap on the number of `202` responses tolerated before
     * `CLIP_NOT_READY`. Omit (the default) to poll indefinitely.
     */
    maxRetries?: number;
    /**
     * Aborts in-flight fetches and the inter-poll sleep — the primary way to
     * end an unbounded wait (a timeout, a user cancel, a component unmount).
     */
    signal?: AbortSignal;
    /**
     * Coordinator JWT, attached as `Authorization: Bearer <jwt>` on the
     * manifest GET. Omit in local mode (HttpRuntime).
     */
    jwt?: string;
}
/**
 * Fetch `playlistUrl`, polling on `202 Accepted` — returned while the
 * boundary chunk is still uploading.
 *
 * - `200` → the manifest body.
 * - `410` / `404` → `CLIP_GONE`.
 * - other → `PLAYLIST_FETCH_FAILED` (no retry).
 * - `202` past an opt-in `slackMs` deadline or `maxRetries` cap → `CLIP_NOT_READY`.
 * - aborted `signal` → rejects with the fetch/sleep `AbortError`.
 */
declare function fetchPlaylist(playlistUrl: string, options?: FetchPlaylistOptions): Promise<string>;
/**
 * Parse an HLS `.m3u8` body into the init segment URL plus the ordered media
 * segment URLs, resolving relative URLs against `playlistUrl` itself.
 */
declare function parsePlaylist(manifestBody: string, playlistUrl: string): ParsedPlaylist;
/**
 * Wrap an HLS manifest body in a `blob:` URL suitable for `<video src>` or
 * `hls.js`. Bypasses "the player can't set an Authorization header": the
 * manifest is served from memory, and its chunk URLs are already-signed S3
 * GETs. Path-only chunk URLs in the body are absolutized against
 * `playlistUrl` first — without that, the browser would resolve them against
 * the `blob:` URL's own origin instead of the runtime's.
 *
 * Caller owns the returned URL — revoke it via `URL.revokeObjectURL` when
 * playback tears down. Browser-only; throws `INVALID_PLAYLIST` outside a DOM
 * environment.
 */
declare function createPlayableManifestUrl(manifestBody: string, playlistUrl: string): string;
interface DownloadClipOptions {
    /** Coordinator JWT for the manifest GET. The chunks it references are S3
     *  presigned URLs, fetched unauthenticated. */
    jwt?: string;
    /** Cancels both the playlist poll and any in-flight chunk fetches. */
    signal?: AbortSignal;
    /** Called after each chunk completes — useful for progress UI. */
    onProgress?: (info: {
        fetched: number;
        total: number;
        bytes: number;
    }) => void;
}
/**
 * Fetch the chunks `clip.playlistUrl` references, remux them into a flat
 * MP4, and (when `filename` is non-null) trigger a browser `<a download>`.
 * Pass `filename: null` to skip the download trigger and just get the Blob.
 *
 * See {@link assembleClipBlob} for the remux and memory-bound caveats.
 */
declare function downloadClipAsFile(clip: Clip, filename?: string | null, options?: DownloadClipOptions): Promise<Blob>;

/**
 * A live connection to a Reactor model.
 */
declare class Reactor implements Disposable {
    private readonly clientOptions;
    private jwt;
    private client;
    private clientPromise;
    private disposed;
    private _lastError;
    private schema;
    /** Bumped on every `refreshSchema()` call — lets a call detect it's been
     *  superseded by a newer one even when `client` itself hasn't changed
     *  (e.g. two "ready" transitions on the same reused client). */
    private schemaRefreshId;
    private capabilities;
    private stats;
    private connectionTimings;
    private statsPollHandle;
    /** Bumped on every `startStatsPolling()`/`stopStatsPolling()` call — lets an
     *  in-flight `getStats()` recognize it's stale once it resolves, even if
     *  `this.client` hasn't changed in the meantime. */
    private statsPollGeneration;
    /** Set on the "connecting" status transition, cleared once `connectionTimings`
     *  is finalized on "ready" — see `handleStatusChanged()`. */
    private connectStartTime;
    private waitingStartTime;
    private readonly emitter;
    /** Serializes connect()/reconnect()/disconnect() (and the free() inside
     *  disconnect()/[Symbol.dispose]) against each other. Calling into the
     *  client concurrently with one of these (e.g. a user clicking Disconnect
     *  mid-connect) races its internal state and can throw ("attempted to
     *  take ownership of Rust value while it was borrowed") or corrupt it
     *  outright. */
    private readonly queue;
    /** In-flight calls to `withReaderAccess()` — a "reply" `.catch(() => {})`
     *  copy of each, never the caller's own promise, so one rejecting can't
     *  make `Promise.all()` in `withWriterAccess()` reject and skip waiting
     *  for the rest. See `withReaderAccess()`/`withWriterAccess()`. */
    private readonly activeReads;
    /** True for the span of a `withWriterAccess()` call — after it has waited
     *  out every read active when it started, before it releases the ones
     *  that arrived while it ran. */
    private writerActive;
    /** Readers parked in `withReaderAccess()`'s wait loop, woken once
     *  `withWriterAccess()` finishes; each re-checks `writerActive` rather
     *  than assuming its turn, since another writer already queued behind the
     *  first one may have claimed it first. */
    private writerIdleWaiters;
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
    private withReaderAccess;
    /**
     * Runs a lifecycle op's client-touching body exclusively: waits out every
     * read already in flight, then blocks new ones (`writerActive`) until it
     * finishes. Only ever called from inside a `queue`-serialized task, so at
     * most one writer runs this at a time — it doesn't serialize against
     * itself, only against `activeReads`.
     */
    private withWriterAccess;
    constructor(options: ReactorOptions);
    /**
     * `jwt`, when given, replaces whatever `new Reactor({ jwt })` was given —
     * including on a client that's still around from a recoverable
     * `disconnect(true)`.
     *
     * Throws if already connected or connecting; call `disconnect()` first.
     */
    connect(jwt?: JwtSource, options?: ConnectOptions): Promise<void>;
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
    disconnect(recoverable?: boolean): Promise<void>;
    /**
     * Only `options.maxAttempts` has an effect here — the rest of
     * `ConnectOptions` (session adoption, connection id, auto-resume) only
     * makes sense when establishing a session in the first place, same as v2's
     * `reconnect()` always ignored them.
     */
    reconnect(options?: ConnectOptions): Promise<void>;
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
    sendCommand<T extends object = Record<string, unknown>>(command: string, data?: NotFunction<T>, scope?: MessageScope): Promise<ReactorMessage | undefined>;
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
    private sendRuntimeScopedCommand;
    /** Requests the model's command schema directly. Most callers don't need
     *  this — it's already fetched once and cached as soon as the session
     *  reaches `"ready"`; use `getSchema()` for that. Resolves `undefined`
     *  when the model doesn't expose a schema — the binding replies with a
     *  wire `null` in that case rather than omitting the field. */
    requestSchema(): Promise<ModelSchema | undefined>;
    /** The model's command schema (an OpenAPI document), cached from the
     *  `requestSchema()` call fired automatically on `"ready"`. `undefined`
     *  until that reply has landed. */
    getSchema(): ModelSchema | undefined;
    /** The runtime's declared capabilities (negotiated tracks, and the
     *  command set when the model exposes one) — pushed once available, no
     *  explicit request needed. `undefined` until `capabilitiesReceived`
     *  fires. */
    getCapabilities(): Capabilities | undefined;
    /** The session resource, as the coordinator reports it — id, state,
     *  model, cluster, server info, and (once negotiated) `capabilities`.
     *  A live read straight off the wasm client, not cached — reflects
     *  whatever's current. `undefined` before a client exists. */
    getSessionInfo(): SessionResponse | undefined;
    /**
     * Publishes a local `MediaStreamTrack` under `name` — the counterpart to a
     * `sendonly` track the model declares. Awaitable. Queued behind
     * connect()/disconnect()/reconnect() (unlike `sendCommand()`): a track
     * operation awaits its own control round-trip, and a concurrent
     * disconnect() freeing the wasm client mid-await would otherwise resume
     * into a freed client — the same class of use-after-free `queue` exists to
     * prevent for connect/disconnect/reconnect themselves.
     */
    publishTrack(name: string, track: MediaStreamTrack): Promise<void>;
    /**
     * Unlike every other track method, this doesn't reject — a failure is
     * reported through the `error` event instead, since this is commonly the
     * last call in a `finally` block, and raising there would replace
     * whatever exception was already propagating.
     */
    unpublishTrack(name: string): Promise<void>;
    /**
     * Stops a received track: the receiver goes inactive and the runtime stops
     * producing it. Awaitable, and queued behind connect()/disconnect()/
     * reconnect() for the same reason as `publishTrack()`.
     */
    pauseTrack(name: string): Promise<void>;
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
    setTrackBitrate(name: string, bounds?: {
        minBps?: number;
        maxBps?: number;
    }): Promise<void>;
    /** Resumes a track previously stopped with `pauseTrack()`. */
    resumeTrack(name: string): Promise<void>;
    /**
     * Requests a clip covering the last `durationSeconds` of the session.
     * `reactor-core` correlates the reply itself (and enforces `"ready"`), so
     * this is a thin delegation, same as `requestSchema()`. See
     * `downloadClipAsFile()` to turn the result into a file.
     */
    requestClip(durationSeconds: number): Promise<Clip>;
    /** Requests a clip covering the entire session up to now. See `requestClip()`. */
    requestRecording(): Promise<Clip>;
    /** Thin delegation to the standalone `downloadClipAsFile()` — see its own doc comment. */
    downloadClipAsFile(clip: Clip, filename?: string | null, options?: DownloadClipOptions): Promise<Blob>;
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
    uploadFile(file: File | Blob, options?: {
        name?: string;
    }): Promise<FileRef>;
    /** All tracks the model declared, whether or not media has arrived for —
     *  or been published to — them yet. Empty before a client exists. */
    tracks(): TrackCapability[];
    /** Same as `tracks()`, plus each entry's negotiated `mid` — the id
     *  `trackReceived`'s `mid` argument and the `getXByMid` escape hatches key
     *  on. Only populated once SDP negotiation has assigned mids. */
    trackMapping(): TrackMappingEntry[];
    pausedTracks(): string[];
    /** Drops to the raw `RTCPeerConnection` for anything this class doesn't
     *  wrap directly. `undefined` before a client exists. */
    getPeerConnection(): RTCPeerConnection | undefined;
    getTrackByMid(mid: string): MediaStreamTrack | undefined;
    getStreamByMid(mid: string): MediaStream | undefined;
    getTrackByName(name: string): MediaStreamTrack | undefined;
    getStreamByName(name: string): MediaStream | undefined;
    /**
     * Supports `using reactor = new Reactor(...)`: releases the wasm resource
     * graph and drops every registered event handler for good. Unlike a plain
     * `disconnect()`, this instance is unusable afterward — construct a new
     * `Reactor` instead of trying to `connect()` again.
     */
    [Symbol.dispose](): void;
    /** The wasm binding's own terser `status()` name can be added alongside
     *  this later if it turns out to be worth it. */
    getStatus(): ReactorStatus;
    /** See `getStatus()`. */
    getSessionId(): string | undefined;
    /** The `jwt` this instance was constructed (or last `connect()`ed) with —
     *  lets a component composed inside a `ReactorProvider` (e.g. `ClipPlayer`)
     *  authenticate its own requests without the caller repeating the resolver. */
    getJwtResolver(): JwtSource | undefined;
    /** The most recent `ReactorError`, from either an `error` event or a
     *  rejected call — whichever landed last. `undefined` until the first
     *  failure. */
    getLastError(): ReactorError | undefined;
    /** The most recent WebRTC connection stats, polled every `STATS_INTERVAL_MS`
     *  while "ready" — see `statsUpdate`. `undefined` before the first sample. */
    getStats(): ConnectionStats | undefined;
    /** Timing breakdown from the most recent `connect()`/`reconnect()`
     *  handshake — see `ConnectionTimings`. */
    getConnectionTimings(): ConnectionTimings | undefined;
    on<Name extends keyof ReactorEventMap>(event: Name, handler: ReactorEventMap[Name]): void;
    off<Name extends keyof ReactorEventMap>(event: Name, handler: ReactorEventMap[Name]): void;
    once<Name extends keyof ReactorEventMap>(event: Name, handler: ReactorEventMap[Name]): void;
    private getOrCreateClient;
    private createClient;
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
    private refreshSchema;
    /** The binding replies with a wire `null` (not an omitted field) when the
     *  model doesn't expose a schema — normalized to `undefined` so callers
     *  get the same "no schema" sentinel `getSchema()` already uses instead
     *  of a document they could otherwise dereference. */
    private normalizeSchema;
    /** Frees the wasm resource graph, if one exists, and clears the cached
     *  schema. Reusable — unlike `[Symbol.dispose]`, this doesn't set the
     *  permanent `disposed` flag, so a later `connect()`/`reconnect()` lazily
     *  builds a fresh client.
     *
     *  Only called from within `disconnect()`'s queued task, so `client.free()`
     *  is safe to call directly here — the queue already guarantees no other
     *  operation is running concurrently against it. */
    private freeClient;
    /** Tracks `connectionTimings` off the binding's own "connecting" → "waiting"
     *  → "ready" status sequence (see `ReactorStatus`), and starts/stops stats
     *  polling around the "ready" window. */
    private handleStatusChanged;
    private startStatsPolling;
    private stopStatsPolling;
    /** Called on every `disconnect()` and on `[Symbol.dispose]`. Leaves
     *  `client`/`schema` alone — that's `freeClient()`'s job, run separately
     *  when `disconnect()` isn't recoverable. `capabilities` is cleared here
     *  regardless, though: unlike the schema, it isn't re-fetched on demand,
     *  so a recoverable disconnect that skips `freeClient()` would otherwise
     *  leave `getCapabilities()` returning the previous session's stale
     *  tracks/commands until a new `capabilitiesReceived` lands. */
    private resetConnectionState;
    /** Wraps `cause` and records it as the most recent failure, for a call
     *  that's about to throw rather than emit — see `getLastError()`'s doc
     *  comment. */
    private captureError;
    /** Wraps `cause`, records it as the most recent failure, and fires the
     *  `error` event — the one place recording and emitting happen together,
     *  so `getLastError()` never drifts from what listeners were told. */
    private emitError;
    private assertNotDisposed;
}

/** Lazy resolver for a Coordinator/runtime bearer token, called immediately
 *  before each authenticated request — see `JwtSource`. */
type JwtResolver = () => string | Promise<string>;
/**
 * Wraps a `JwtSource` into a `JwtResolver`: a static string becomes a
 * resolver that always returns it, a resolver passes through unchanged.
 * Useful for feeding a source that may be either form (e.g. a
 * `ReactorProvider`'s `jwtToken`) into a `getJwt` prop that expects a
 * resolver.
 */
declare function normalizeJwtSource(source: JwtSource): JwtResolver;

/** State kept reactive for `useReactor` selectors. Stats/schema/capabilities
 *  aren't mirrored here — reach them through the `internal.reactor` escape
 *  hatch. */
interface ReactorState {
    status: ReactorStatus;
    sessionId: string | undefined;
    lastError: ReactorError | undefined;
    /** Most recent app-scope `message` payload; `runtimeMessage` isn't mirrored
     *  here — subscribe on `internal.reactor` for that. */
    lastMessage: ReactorMessage | undefined;
    /** Media tracks received from the model, keyed by track name. Reset to
     *  `{}` on every "disconnected" status transition — a fresh connection
     *  invalidates whatever arrived under the previous one. Append-only within
     *  a session: a track pausing/unpublishing mid-session doesn't remove its
     *  entry, so a stale `MediaStreamTrack` can linger until the next
     *  disconnect. Matches v2's identical behavior (`core/store.ts`). */
    tracks: Record<string, MediaStreamTrack>;
    /** The `jwt` the store was created with — see `createReactorStore`'s
     *  `options.jwt`. Set once at creation, not resynced afterward. */
    jwtToken: JwtSource | undefined;
    /** The `defaultConnectOptions` the store was created with — set once at
     *  creation, not resynced afterward. Lets a component read the
     *  provider-level defaults (e.g. `autoResumeTracks`) without threading
     *  them through props of its own. */
    connectOptions: ConnectOptions | undefined;
}
interface ReactorActions {
    connect: (jwt?: JwtSource, options?: ConnectOptions) => Promise<void>;
    disconnect: (recoverable?: boolean) => Promise<void>;
    reconnect: (options?: ConnectOptions) => Promise<void>;
    sendCommand: <T extends object = Record<string, unknown>>(command: string, data?: NotFunction<T>, scope?: MessageScope) => Promise<ReactorMessage | undefined>;
    publish: (name: string, track: MediaStreamTrack) => Promise<void>;
    unpublish: (name: string) => Promise<void>;
    pauseTrack: (name: string) => Promise<void>;
    resumeTrack: (name: string) => Promise<void>;
    uploadFile: (file: File | Blob, options?: {
        name?: string;
    }) => Promise<FileRef>;
    requestClip: (durationSeconds: number) => Promise<Clip>;
    requestRecording: () => Promise<Clip>;
    downloadClipAsFile: (clip: Clip, filename?: string | null, options?: DownloadClipOptions) => Promise<Blob>;
}
interface ReactorInternal {
    /** Escape hatch: the underlying `Reactor` instance, for anything the
     *  selector state / action bindings above don't cover. */
    reactor: Reactor;
}
type ReactorStore = ReactorState & ReactorActions & {
    internal: ReactorInternal;
};

/** `connectOptions` for the provider — adds `autoConnect` to the core
 *  `ConnectOptions`. Live, same as every other `ReactorProviderProps` field —
 *  see `ReactorProvider`'s doc comment. */
interface ReactorConnectOptions extends ConnectOptions {
    /** Connect automatically once a Reactor is built — initial mount, or any
     *  later rebuild. Default `false`. */
    autoConnect?: boolean;
}
interface ReactorProviderProps {
    apiUrl?: string | undefined;
    modelName: string;
    local?: boolean | undefined;
    /** Media tracks to declare up front, so the transport can prepare the SDP
     *  offer in parallel with session polling instead of waiting to discover
     *  them from the model's schema. */
    modelTracks?: TrackCapability[] | undefined;
    /** Static token, or a resolver called before every authenticated request
     *  — see `JwtSource`. Required for `autoConnect` against a non-local
     *  runtime; can also be supplied later via an explicit `connect()` call
     *  instead. */
    jwtToken?: JwtSource | undefined;
    connectOptions?: ReactorConnectOptions | undefined;
    children?: ReactNode;
}
/**
 * Owns a `Reactor` instance and exposes it to `useReactor` below.
 *
 * `apiUrl`/`modelName`/`local`/`modelTracks`/`jwtToken`/`connectOptions`
 * (including `autoConnect`) are live: changing any of them tears down the
 * current `Reactor` (`disconnect()` then `[Symbol.dispose]()`) and builds a
 * fresh one — the same way `useLiveKitRoom` rebuilds its `Room` when its
 * construction `options` change. `Reactor` has no equivalent of LiveKit's
 * `token`/`serverUrl` split (reconnecting the *same* instance with new
 * credentials) or its live `connect` boolean (toggling the same `Room`'s
 * connection without rebuilding it) — its constructor bundles everything, so
 * any change, `autoConnect` included, means a fresh instance rather than
 * reconnecting/disconnecting the existing one. Pass a stable `jwtToken`
 * (e.g. via `useCallback` for a resolver) and stable `modelTracks`/
 * `connectOptions` references if you don't want an unrelated parent render to
 * rebuild the connection — object/array props are compared by reference
 * (`modelTracks`/`connectOptions` via a `JSON.stringify` snapshot, same as
 * `useLiveKitRoom` does for its own `options`).
 *
 * Unmounting tears down the same way — see `Reactor.disconnect()`/
 * `[Symbol.dispose]()` for what that frees.
 */
declare function ReactorProvider({ apiUrl, modelName, local, modelTracks, jwtToken, connectOptions, children, }: ReactorProviderProps): react.JSX.Element;

/** Reads from the nearest `ReactorProvider`'s store, with a shallow-equality
 *  check on the selector's result — so a selector returning a fresh object
 *  each call doesn't cause a re-render on every unrelated store update. */
declare function useReactor<T>(selector: (state: ReactorStore) => T): T;
/** Subscribes to app-scope `message` payloads sent by the model via
 *  `get_ctx().send()`. `handler` is kept in a ref so identity churn on
 *  every render doesn't retrigger the subscription effect. */
declare function useReactorMessage(handler: (message: ReactorMessage) => void): void;
/** Subscribes to platform-scope `runtimeMessage` payloads (moderation,
 *  clip/recording lifecycle, ...) — see `useReactorMessage` for app-scope
 *  payloads instead. */
declare function useReactorInternalMessage(handler: (message: ReactorMessage) => void): void;
/** The most recent `statsUpdate` sample; `undefined` until the first one
 *  arrives, and reset back to `undefined` on unmount or reactor change. */
declare function useStats(): ConnectionStats | undefined;

interface ReactorViewProps {
    /** Name of the recvonly video track to render. Must match a track name
     *  declared in the model's capabilities. Defaults to `"main_video"`. */
    track?: string;
    /** Name of a recvonly audio track to mix into the same `<video>` element
     *  alongside `track`. */
    audioTrack?: string;
    width?: number;
    height?: number;
    className?: string;
    style?: CSSProperties;
    videoObjectFit?: NonNullable<VideoHTMLAttributes<HTMLVideoElement>['style']>['objectFit'];
    /** Defaults to `true` when no `audioTrack` is set (keeps the element within
     *  browser autoplay policies), `false` otherwise. Pass an explicit value to
     *  override either default. */
    muted?: boolean;
}
declare function ReactorView({ track, audioTrack, width, height, className, style, videoObjectFit, muted, }: ReactorViewProps): react.JSX.Element;

interface WebcamStreamProps {
    /** Name of the sendonly video track to publish the webcam to. Must match a
     *  track name declared in the model's capabilities. */
    track: string;
    /** Capture and publish the microphone alongside the webcam. `true` for
     *  default constraints, or explicit `MediaTrackConstraints`. Requires
     *  `audioTrack`. Defaults to `false`. */
    audio?: boolean | MediaTrackConstraints;
    /** Name of the sendonly audio track to publish the mic to. Ignored unless
     *  `audio` is set. */
    audioTrack?: string;
    className?: string;
    style?: CSSProperties;
    /** Read once, at mount — changing this after mount doesn't re-request
     *  `getUserMedia`. Matches v2. */
    videoConstraints?: MediaTrackConstraints;
    showWebcam?: boolean;
    videoObjectFit?: NonNullable<VideoHTMLAttributes<HTMLVideoElement>['style']>['objectFit'];
    /** Fires once `getUserMedia` is rejected with `NotAllowedError` or
     *  `PermissionDeniedError`. */
    onPermissionDenied?: () => void;
    /** Fires after the local media has been published (video, and audio when
     *  `audio` is enabled). Re-fires after a reconnect. */
    onPublished?: () => void;
    /** Fires on non-permission `getUserMedia` failures and on publish/unpublish
     *  rejections. Permission denials route to `onPermissionDenied` instead. */
    onError?: (error: Error) => void;
}
declare function WebcamStream({ track, audio, audioTrack, className, style, videoConstraints, showWebcam, videoObjectFit, onPermissionDenied, onPublished, onError, }: WebcamStreamProps): react.JSX.Element;

/**
 * Video preview for a captured {@link Clip}. Streams the clip with `hls.js`
 * wherever Media Source Extensions exist — every current browser, iOS
 * Safari 17.1 and later included. `hls.js` is dynamically imported, so
 * bundlers give it a chunk of its own that an app importing this component
 * fetches on first play, and one that never renders a player drops
 * entirely. Where Media Source Extensions don't exist — iOS before 17.1 —
 * the clip is assembled into a single MP4 and played from memory instead.
 * Failures surface in an inline error overlay; the chunks remain
 * downloadable via {@link useClipDownload}/`ClipDownloadButton` either way.
 *
 * Preview only — this component doesn't render a download UI. Compose it
 * with `ClipDownloadButton`, or build a custom download surface around
 * `useClipDownload`.
 *
 * Unlike `ReactorView`/`WebcamStream`, this doesn't require a
 * `ReactorProvider` in the tree — it operates on the `Clip` value alone, so
 * it stays usable after `reactor.disconnect()` and works with clips loaded
 * from fixtures or any other source. When a `ReactorProvider` is mounted
 * above, an omitted `getJwt` inherits the provider's resolver.
 */
interface ClipPlayerProps {
    /** The captured clip to play. Re-fetches the manifest and re-attaches the
     *  player when this changes by reference. */
    clip: Clip;
    /**
     * Lazy resolver for the Coordinator JWT used on the manifest GET, called
     * at request time so token refreshes are picked up automatically.
     *
     * Required outside a `ReactorProvider` in production; optional inside one
     * (inherits the provider's resolver). Omit in local-dev mode (HttpRuntime)
     * — the manifest endpoint there is auth-free.
     */
    getJwt?: () => string | Promise<string>;
    /**
     * Opt into a bounded wait: give up polling the manifest with
     * `CLIP_NOT_READY` once `max(clip.predictedReadyAtMs, pollStart) + slackMs`
     * passes. Unset by default — the player polls indefinitely until the clip
     * is ready, stopping only when it unmounts or `clip` changes. Forwarded
     * directly to `fetchPlaylist()`'s `slackMs` option.
     */
    slackMs?: number;
    /** Play automatically once the manifest is attached. Default `true`. */
    autoPlay?: boolean;
    /** Start muted. Default `true` — browser autoplay policies block
     *  audio-bearing video from playing without a user gesture; the user can
     *  unmute via the native controls. */
    muted?: boolean;
    className?: string;
    style?: CSSProperties;
    /** Fires when the player enters its inline error state. A `RecordingError`
     *  for manifest-fetch failures, a plain `Error` for hls.js/element playback
     *  failures. */
    onError?: (error: Error) => void;
}
declare function ClipPlayer({ clip, getJwt, slackMs, autoPlay, muted, className, style, onError, }: ClipPlayerProps): react.JSX.Element;

/**
 * State machine for an in-progress clip download.
 *
 * - `idle`: no download in flight (initial state, and what the hook returns
 *   to after a successful save).
 * - `downloading`: chunks are being fetched. `fetched`/`total` count the
 *   chunks (init segment + media segments) — useful for a progress bar.
 *   `total` is 0 until the manifest is parsed and the chunk count is known.
 * - `error`: most recent attempt failed; `message` is suitable for
 *   surfacing inline. `RecordingError`s are formatted as `"<CODE>: <reason>"`.
 */
type ClipDownloadState = {
    kind: 'idle';
} | {
    kind: 'downloading';
    fetched: number;
    total: number;
} | {
    kind: 'error';
    message: string;
};
interface UseClipDownloadOptions {
    /** Filename used when the browser save dialog opens. Pass `null` to skip
     *  the `<a download>` trigger entirely — the returned Blob is still
     *  resolved so the caller can `URL.createObjectURL` it or re-upload it.
     *  Default `"reactor-clip.mp4"`. */
    filename?: string | null;
    /**
     * Lazy resolver for the Coordinator JWT used on the manifest GET. Called
     * on every {@link UseClipDownloadResult.download} invocation, so token
     * refreshes are picked up automatically.
     *
     * Optional inside a `ReactorProvider` (inherits the provider's resolver)
     * and in local-dev mode.
     */
    getJwt?: () => string | Promise<string>;
}
interface UseClipDownloadResult {
    /** Current state of the most recent download attempt. */
    state: ClipDownloadState;
    /**
     * Trigger a download. Resolves with the assembled fragmented-MP4 Blob, or
     * `undefined` if a download was already in flight (a no-op in that case)
     * or the attempt failed. Errors are surfaced via {@link state} rather than
     * a rejection — check `state.kind === "error"` to drive failure UI.
     */
    download: () => Promise<Blob | undefined>;
    /** Reset to `idle`. Does *not* cancel an in-flight download. */
    reset: () => void;
}
/**
 * Headless download primitive for a {@link Clip}. Wraps `downloadClipAsFile`
 * in a React state machine so the consumer can render any button they want,
 * anywhere they want, and still get progress + error feedback. Used
 * internally by `ClipDownloadButton` — reach for this hook directly when you
 * need custom placement or styling.
 *
 * `download`/`reset` are stable callback identities across renders, so
 * they're safe to pass through memoized children without forcing re-renders.
 */
declare function useClipDownload(clip: Clip, options?: UseClipDownloadOptions): UseClipDownloadResult;

/**
 * Standalone download button for a captured {@link Clip}. Drops anywhere in
 * your UI — modal headers, list rows, hover menus, floating action buttons
 * — and is responsible for nothing more than triggering a download and
 * reflecting its state. Wraps `useClipDownload` internally; for completely
 * custom UIs (progress bars, menu items, post-download blob handling) call
 * that hook directly.
 *
 * Styling is intentionally minimal — override via `className`/`style`, or
 * replace the inner content with the `children` render-prop. No CSS file is
 * shipped; every default style is inline so it loses to anything the
 * consumer provides.
 */
interface ClipDownloadButtonProps {
    /** The clip to download. */
    clip: Clip;
    /** Lazy JWT resolver. Optional inside a `ReactorProvider` (inherits the
     *  provider's resolver) and in local-dev mode. See `ClipPlayerProps.getJwt`. */
    getJwt?: () => string | Promise<string>;
    /** Filename for the saved MP4. Default `"reactor-clip.mp4"`. */
    filename?: string;
    /**
     * Inner content of the button. Three forms:
     *
     * - Omitted — renders a default label that follows the state
     *   (`"Download"` / `"Downloading 3/8…"` / etc.).
     * - `ReactNode` — static label, no state-driven text.
     * - `(state) => ReactNode` — state-aware render function, for custom
     *   progress strings, spinners, etc.
     */
    children?: ReactNode | ((state: ClipDownloadState) => ReactNode);
    /** Forwarded to the underlying `<button>`. */
    className?: string;
    /** Forwarded to the underlying `<button>` — merges after the defaults so
     *  each property overrides. */
    style?: CSSProperties;
    /** Forwarded to the underlying `<button>`. ORed with the internal
     *  "downloading" state. */
    disabled?: boolean;
    /** Fires when the download completes with the assembled MP4 Blob. */
    onSuccess?: (blob: Blob) => void;
    /** Fires when the download fails. Message mirrors the in-button state —
     *  `"<CODE>: <reason>"` for `RecordingError`s, the plain error message
     *  otherwise. */
    onError?: (error: Error) => void;
}
declare function ClipDownloadButton({ clip, getJwt, filename, children, className, style, disabled, onSuccess, onError, }: ClipDownloadButtonProps): react.JSX.Element;

export { AbortedError, BadRequestError, type Capabilities, type Clip, ClipDownloadButton, type ClipDownloadButtonProps, type ClipDownloadState, type ClipKind, ClipPlayer, type ClipPlayerProps, type CommandCapability, ConflictError, type ConnectOptions, type ConnectionStats, type ConnectionTimings, DEFAULT_PLAYLIST_POLL_SLACK_MS, DecodeError, DisconnectedError, type DownloadClipOptions, type FetchPlaylistOptions, FileRef, InvalidStateError, type JwtResolver, type JwtSource, type MessageScope, MessageTooLargeError, type ModelSchema, type ModelSchemaOperation, type ModelSchemaPathItem, type ModerationAction, type ModerationEvent, NetworkError, NotFoundError, RateLimitedError, Reactor, type ReactorActions, type ReactorConnectOptions, ReactorError, type ReactorEventMap, type ReactorEventName, type ReactorMessage, type ReactorOptions, ReactorProvider, type ReactorProviderProps, type ReactorState, type ReactorStatus, type ReactorStore, ReactorView, type ReactorViewProps, RecorderDisabledError, RecordingError, RequestTimeoutError, ServerError, type SessionResponse, SessionTerminalError, type TrackCapability, type TrackDirection, type TrackKind, type TrackMappingEntry, TransportError, UnauthorizedError, type UseClipDownloadOptions, type UseClipDownloadResult, VersionMismatchError, WebcamStream, type WebcamStreamProps, createPlayableManifestUrl, downloadClipAsFile, fetchPlaylist, isFileRef, normalizeJwtSource, parsePlaylist, useClipDownload, useReactor, useReactorInternalMessage, useReactorMessage, useStats };
