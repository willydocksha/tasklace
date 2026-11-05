// online status settings, shared by the heartbeat route and the client hook

// how often an open tab pings the server
export const PRESENCE_PING_MS = 60_000;
// a member counts as online if seen within this window (a bit over two pings)
export const PRESENCE_ONLINE_MS = 150_000;
// skip the db write when the last one is newer than this (e.g. several open tabs)
export const PRESENCE_WRITE_MS = 45_000;

// server-only kill switch: set PRESENCE_ENABLED=false to turn the feature off
export const presenceEnabled = () => process.env.PRESENCE_ENABLED !== "false";
