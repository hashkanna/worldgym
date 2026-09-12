/* tslint:disable */
/* eslint-disable */

export type ReactorStatus = "disconnected" | "connecting" | "waiting" | "ready";
export type TrackKind = "audio" | "video";
export type TrackDirection = "recvonly" | "sendonly";

/** Construction options. Only `modelName` is required. */
export interface ClientOptions {
    modelName: string;
    /** Coordinator base URL. Defaults to the cloud coordinator, or to
     *  http://localhost:8080 when `local` is set. */
    apiUrl?: string;
    /** Talk to a local runtime's HTTP API instead of the cloud coordinator. */
    local?: boolean;
    /** Reported to the coordinator in `client_info`. Defaults to "js". */
    sdkType?: string;
    sdkVersion?: string;
    /** Resume every recvonly track on connect. Default true. */
    autoResumeTracks?: boolean;
    /** Free-form model arguments, sent on session creation. */
    extraArgs?: Record<string, unknown>;
    /** Keep-alive period. 0 disables the heartbeat. Default 10000. */
    heartbeatIntervalMs?: number;
    /** How long to wait for the transport to come up. Default 30000. */
    readyTimeoutMs?: number;
    controlRequestTimeoutMs?: number;
    clipRequestTimeoutMs?: number;
    /** Session-readiness poll attempts. Default 20. */
    maxSessionAttempts?: number;
    /** SDP-answer poll attempts. Default 6. */
    maxSdpAttempts?: number;
    /** Initial delay before the first SDP-answer poll retry, in ms. Default 200. */
    sdpBackoffInitialMs?: number;
    /** Cap on the exponential backoff between SDP-answer poll retries, in ms. Default 15000. */
    sdpBackoffMaxMs?: number;
    /** Growth factor applied to the delay between SDP-answer poll retries. Default 2. */
    sdpBackoffMultiplier?: number;
    /** Preset tracks, when known ahead of time — builds the SDP offer
     *  concurrently with the session-ready poll rather than after. */
    modelTracks?: TrackCapability[];
    /** Console log level. Default "warn". */
    logLevel?: "off" | "error" | "warn" | "info" | "debug" | "trace";
}

/** Per-connect options. Every field optional. Also accepted by `reconnect()`,
 *  which only honors `maxAttempts` — the rest only make sense when
 *  establishing a session in the first place. */
export interface ConnectOptions {
    /** Adopt an existing session instead of creating one. An adopting client
     *  never ends the session it joined. */
    sessionId?: string;
    /** Use a connection id already registered under that session. */
    connectionId?: number;
    /** Override `ClientOptions.autoResumeTracks` for this connection and the
     *  reconnects that follow it. */
    autoResumeTracks?: boolean;
    /** SDP-answer poll attempts before giving up. */
    maxAttempts?: number;
}

/** A token, or a resolver called before every authenticated request.
 *  Returning "" sends no Authorization header. */
export type JwtSource = string | (() => string | Promise<string>);

export interface TrackCapability {
    name: string;
    kind: TrackKind;
    direction: TrackDirection;
}

export interface TrackMappingEntry extends TrackCapability {
    /** The SDP media-section id this track negotiated onto. */
    mid: string;
}

export interface CommandCapability {
    name: string;
    description?: string;
    schema?: unknown;
}

export interface Capabilities {
    protocol_version: string;
    tracks: TrackCapability[];
    commands?: CommandCapability[];
    emission_fps?: number;
}

/** The session resource, as the coordinator reports it. */
export interface SessionInfo {
    session_id: string;
    state: string;
    model?: { name: string; version?: string };
    cluster?: string;
    server_info?: { server_version: string };
    selected_transport?: { protocol: string; version: string };
    capabilities?: Capabilities;
    /** Fields newer servers add are preserved rather than dropped. */
    [key: string]: unknown;
}

/** A completed upload, to pass in a command's `uploads`. */
export interface FileRef {
    upload_id: string;
    name: string;
    mime_type: string;
    size: number;
}

/** A captured clip or recording. */
export interface Clip {
    session_id: string;
    /** "snap" for requestClip, "recording" for requestRecording. */
    kind: string;
    start_marker: number;
    end_marker: number;
    now_marker: number;
    predicted_ready_at_ms: number;
    /** Absolute HLS manifest URL. */
    playlist_url: string;
}

export interface ReactorMessage {
    type: string;
    data: unknown;
}

/** A failure, in the terms a caller can act on. Rejected calls throw an `Error`
 *  carrying these same fields, with `name === "ReactorError"`. */
export interface ReactorError {
    /** A stable code — DISCONNECTED, REQUEST_TIMEOUT, UNAUTHORIZED, … — or one
     *  the platform sent, so unknown values must be tolerated. */
    code: string;
    message: string;
    /** Whether the same call could succeed later. */
    recoverable: boolean;
    /** The HTTP status, when the failure came from one. */
    status?: number;
    /** Which call failed, e.g. "connect", "sendCommand". */
    operation?: string;
    /** Backoff hint the platform sent. */
    retry_after_ms?: number;
    timestamp_ms: number;
}

export type StatusListener = (status: ReactorStatus) => void;
export type SessionIdListener = (sessionId: string | undefined) => void;
export type MessageListener = (message: ReactorMessage) => void;
export type TrackListener = (name: string, mid: string | undefined) => void;
export type ErrorListener = (error: ReactorError) => void;
export type CapabilitiesListener = (capabilities: Capabilities) => void;



/**
 * The Reactor client, as JavaScript sees it.
 *
 * ```js
 * import init, { ReactorClient } from "@reactor-team/reactor-wasm";
 *
 * await init();
 * const client = new ReactorClient({ modelName: "my-model" }, () => getToken());
 * client.onStatusChanged((status) => console.log(status));
 * client.onTrackReceived((name, mid) => {
 *   video.srcObject = client.getStreamByMid(mid);
 * });
 * await client.connect();
 * await client.sendCommand("set_prompt", { prompt: "a cat" });
 * ```
 */
export class ReactorClient {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The runtime's capabilities, or `undefined` before they arrive.
     */
    capabilities(): Capabilities | undefined;
    /**
     * Create (or adopt) a session and bring up the transport.
     */
    connect(options?: ConnectOptions | null): Promise<void>;
    /**
     * Tear down the transport and end the session server-side — unless this
     * client only adopted the session, in which case it stays alive for
     * whoever created it.
     */
    disconnect(): Promise<void>;
    /**
     * The live `RTCPeerConnection` — for `getStats()`, or anything else the
     * binding does not wrap. `undefined` before the first connect.
     */
    getPeerConnection(): RTCPeerConnection | undefined;
    /**
     * The `MediaStream` a received track arrived on — what a `<video>` or
     * `<audio>` element's `srcObject` wants.
     */
    getStreamByMid(mid: string): MediaStream | undefined;
    /**
     * The stream of a received track, by declared name.
     */
    getStreamByName(name: string): MediaStream | undefined;
    /**
     * A received track by its SDP mid, as reported by `onTrackReceived`.
     */
    getTrackByMid(mid: string): MediaStreamTrack | undefined;
    /**
     * A received track by its declared name.
     *
     * Useful when the track arrived before the listener was registered — a
     * component that mounts mid-connect misses the event but not the track.
     */
    getTrackByName(name: string): MediaStreamTrack | undefined;
    /**
     * The last error, in the shape the `onError` listener receives.
     */
    lastError(): ReactorError | undefined;
    /**
     * Create a client.
     *
     * * `options` — see the `ClientOptions` fields; `modelName` is required.
     * * `jwt` — a token string, a `() => string | Promise<string>` resolver
     *   called before every authenticated request, or `null` for an
     *   unauthenticated local runtime. Replaceable later with `setJwt`.
     */
    constructor(options: ClientOptions, jwt?: JwtSource | null);
    /**
     * `(capabilities: { protocolVersion, tracks, commands? }) => void`
     */
    onCapabilitiesReceived(listener: CapabilitiesListener): void;
    /**
     * `(error: { code, message, recoverable, timestampMs, status?, operation?,
     * retryAfterMs? }) => void`
     */
    onError(listener: ErrorListener): void;
    /**
     * `(message: { type, data }) => void` — application messages from the model.
     */
    onMessage(listener: MessageListener): void;
    /**
     * `(message: { type, data }) => void` — platform messages: moderation,
     * recording lifecycle, and the rest of the runtime's own traffic.
     */
    onRuntimeMessage(listener: MessageListener): void;
    /**
     * `(sessionId: string | undefined) => void`
     */
    onSessionIdChanged(listener: SessionIdListener): void;
    /**
     * `(status: string) => void`
     */
    onStatusChanged(listener: StatusListener): void;
    /**
     * `(name: string, mid: string | undefined) => void` — a remote track
     * arrived. Fetch the media with `getTrackByMid` / `getStreamByMid`.
     */
    onTrackReceived(listener: TrackListener): void;
    /**
     * Stop receiving a track: the receiver goes inactive and the runtime stops
     * producing it.
     */
    pauseTrack(name: string): Promise<void>;
    /**
     * Names of the tracks currently paused.
     */
    pausedTracks(): string[];
    /**
     * Claim a sendonly track and start sending `track` on it.
     */
    publishTrack(name: string, track: MediaStreamTrack): Promise<void>;
    /**
     * Rebuild the transport on the same session, without ending it.
     *
     * Only `maxAttempts` applies here — the rest of `ConnectOptions` (session
     * adoption, connection id, auto-resume) only makes sense at initial
     * connect time, same as the JS SDK's own `reconnect()` always ignored
     * them.
     */
    reconnect(options?: ConnectOptions | null): Promise<void>;
    /**
     * Capture the last `durationSeconds` of the session.
     */
    requestClip(duration_seconds: number): Promise<Clip>;
    /**
     * Capture the session in full.
     */
    requestRecording(): Promise<Clip>;
    /**
     * Request the model's command schema (an OpenAPI document).
     */
    requestSchema(): Promise<unknown>;
    /**
     * Resume a paused track.
     */
    resumeTrack(name: string): Promise<void>;
    /**
     * Send a command to the model and resolve with its reply.
     *
     * * `data` — a JSON-serializable object.
     * * `uploads` — optional `{ param: FileRef }` map, from `uploadFile`.
     *
     * Resolves with `{ type, data }`, or `undefined` when the model's handler
     * acknowledged the command without answering.
     */
    sendCommand(command: string, data?: Record<string, unknown> | null, uploads?: Record<string, FileRef> | null): Promise<ReactorMessage | undefined>;
    /**
     * The current session id, or `undefined`.
     */
    sessionId(): string | undefined;
    /**
     * The session resource from the coordinator, or `undefined` when
     * disconnected: model, cluster, server info, selected transport.
     */
    sessionInfo(): SessionInfo | undefined;
    /**
     * Replace the token source. Takes effect on the next request, so this is
     * how a client built before sign-in gets its token.
     */
    setJwt(jwt?: JwtSource | null): void;
    /**
     * Bound what one sender may spend, in bits per second. `undefined` or a
     * negative value leaves a bound at the browser default.
     *
     * This is the ceiling that actually caps a video encoder. With nothing set,
     * a Chromium-based browser derives a maximum from the frame size alone, and
     * that maximum is 2500 kbps for anything above 960x540 — so 720p and 1080p
     * senders cap at 2.5 Mbps until this raises them.
     *
     * `minBps` is non-standard: Chromium honours it, other engines ignore it.
     *
     * There is deliberately no connection-wide counterpart. The browser exposes
     * no equivalent of libwebrtc's `PeerConnection::SetBitrate`, and a method
     * that quietly did nothing would be worse than its absence.
     */
    setTrackBitrate(name: string, min_bps?: number | null, max_bps?: number | null): Promise<void>;
    /**
     * `"disconnected"` | `"connecting"` | `"waiting"` | `"ready"`.
     */
    status(): ReactorStatus;
    /**
     * The negotiated `name` → `mid` mapping: `[{ name, kind, direction, mid }]`.
     */
    trackMapping(): TrackMappingEntry[];
    /**
     * The tracks the runtime declared for this session:
     * `[{ name, kind, direction }]`. Empty until capabilities arrive.
     */
    tracks(): TrackCapability[];
    /**
     * Stop sending on a published track and release it.
     */
    unpublishTrack(name: string): Promise<void>;
    /**
     * Upload a `File` or `Blob` to the session's object store and resolve with
     * a `FileRef` to pass in a command's `uploads`.
     *
     * `name` overrides the file name; a `Blob` has none, so it needs one.
     */
    uploadFile(file: Blob, name?: string | null): Promise<FileRef>;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_reactorclient_free: (a: number, b: number) => void;
    readonly reactorclient_capabilities: (a: number) => [number, number, number];
    readonly reactorclient_connect: (a: number, b: number) => any;
    readonly reactorclient_disconnect: (a: number) => any;
    readonly reactorclient_getPeerConnection: (a: number) => any;
    readonly reactorclient_getStreamByMid: (a: number, b: number, c: number) => any;
    readonly reactorclient_getStreamByName: (a: number, b: number, c: number) => any;
    readonly reactorclient_getTrackByMid: (a: number, b: number, c: number) => any;
    readonly reactorclient_getTrackByName: (a: number, b: number, c: number) => any;
    readonly reactorclient_lastError: (a: number) => [number, number, number];
    readonly reactorclient_new: (a: any, b: number) => [number, number, number];
    readonly reactorclient_onCapabilitiesReceived: (a: number, b: any) => void;
    readonly reactorclient_onError: (a: number, b: any) => void;
    readonly reactorclient_onMessage: (a: number, b: any) => void;
    readonly reactorclient_onRuntimeMessage: (a: number, b: any) => void;
    readonly reactorclient_onSessionIdChanged: (a: number, b: any) => void;
    readonly reactorclient_onStatusChanged: (a: number, b: any) => void;
    readonly reactorclient_onTrackReceived: (a: number, b: any) => void;
    readonly reactorclient_pauseTrack: (a: number, b: number, c: number) => any;
    readonly reactorclient_pausedTracks: (a: number) => [number, number, number];
    readonly reactorclient_publishTrack: (a: number, b: number, c: number, d: any) => any;
    readonly reactorclient_reconnect: (a: number, b: number) => any;
    readonly reactorclient_requestClip: (a: number, b: number) => any;
    readonly reactorclient_requestRecording: (a: number) => any;
    readonly reactorclient_requestSchema: (a: number) => any;
    readonly reactorclient_resumeTrack: (a: number, b: number, c: number) => any;
    readonly reactorclient_sendCommand: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly reactorclient_sessionId: (a: number) => [number, number];
    readonly reactorclient_sessionInfo: (a: number) => [number, number, number];
    readonly reactorclient_setJwt: (a: number, b: number) => [number, number];
    readonly reactorclient_setTrackBitrate: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly reactorclient_status: (a: number) => any;
    readonly reactorclient_trackMapping: (a: number) => [number, number, number];
    readonly reactorclient_tracks: (a: number) => [number, number, number];
    readonly reactorclient_unpublishTrack: (a: number, b: number, c: number) => any;
    readonly reactorclient_uploadFile: (a: number, b: any, c: number, d: number) => any;
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke___wasm_bindgen_85f920685b213f97___JsValue__core_9b3796e30d99ddb7___result__Result_____wasm_bindgen_85f920685b213f97___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined___js_sys_17f5e83adf9a2bda___Function_fn_wasm_bindgen_85f920685b213f97___JsValue_____wasm_bindgen_85f920685b213f97___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_9b25b1d5883c10fa___features__gen_MessageEvent__MessageEvent______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_9b25b1d5883c10fa___features__gen_MessageEvent__MessageEvent______true__2: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke___web_sys_9b25b1d5883c10fa___features__gen_MessageEvent__MessageEvent______true__3: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_85f920685b213f97___convert__closures_____invoke_______true_: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
