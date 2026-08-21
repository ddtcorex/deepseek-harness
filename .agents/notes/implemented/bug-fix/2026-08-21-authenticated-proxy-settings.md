# Agent Note: Authenticated proxies may enable browser settings

Status: implemented

English | [中文](2026-08-21-authenticated-proxy-settings.zh.md)

## Problem

The browser client treats non-loopback page authorities as untrusted and keeps settings in memory. A DeepSeek Harness web server behind an authenticated reverse proxy therefore loses its configured provider directory in the Models screen even though the proxy already controls access to the full UI.

## Decision

`dsh-client-connection` accepts `globalThis.__DSH_TRUSTED_PROXY__ === true` as an additional trusted-page signal when it constructs `ConnectionHandle.isLoopback`. An authenticated reverse proxy may set that signal in the served HTML before DSH client plugins boot. The ordinary public-host rule remains unchanged when the signal is absent.

The Maestro remote proxy injects the signal only into HTML it has obtained after its authorization check. Its login page, unauthenticated API responses, WebSocket upgrades, and publicly reachable PWA manifest do not receive the signal.

## Alternatives considered

**Treat every public hostname as trusted.** Rejected: a direct public DSH deployment would gain settings access without an explicit proxy-authentication decision.

**Keep settings in browser memory behind every proxy.** Rejected: users who authenticate to a proxy that deliberately exposes the full web UI cannot configure or inspect providers in Models.

**Teach the proxy to emulate the settings APIs.** Rejected: the proxy would duplicate DSH authorization and settings behavior instead of conveying the authentication decision to the owning browser client.

## Consequences

An authenticated proxy becomes part of DSH's trust boundary. Deployments must inject the marker only after authenticating the browser and must protect against injected script content on that origin. Direct public pages remain memory-only because they do not carry the marker.

The connection client test pins the trusted and untrusted public cases. The Maestro proxy test pins that authenticated HTML has the marker while the login page does not.
