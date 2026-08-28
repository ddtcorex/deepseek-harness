# Agent Note: Drop degenerate tool calls with empty name or id at assembly

Status: implemented

English | [中文](2026-08-26-empty-tool-call-drop.zh.md)

## Problem

DeepSeek V4 Flash occasionally emits a degenerate tool call whose wire `id` and
`function.name` are empty. The provider-neutral assembler turned it into a `tool-call`
block with `name: ''` and `id: CallId('')`, and the agent loop dispatched it. That
produced a spurious `unknown tool ""` result, failed the `tools/result` invariant that
requires a non-empty name and callId, and persisted a ghost call that serializes to
`tool_calls: [{ id: '', function: { name: '' } }]` — a shape the provider rejects on
every later turn.

## Decision

`BlockAssembler.assembled()` — already the single keep/drop decision over all seen
blocks — now drops a `tool-call` block when its `name` is empty (after trimming) or its
`id` is empty, in addition to the existing `max-tokens` drop. The decision lives in a
new `keepBlock(block)` helper, and the replay-envelope prune now keys on
`blocks.length === all.length` instead of `kept === undefined`.

The drop is provider-neutral (it sits in the canonical assembler, not the DeepSeek
adapter), keeps the "model-visible ⟺ logged" rule by removing the ghost before it
reaches the session log, and reuses the existing replay-metadata pruning so emitted
blocks and replay metadata cannot disagree.

## Alternatives considered

**Drop at the DeepSeek adapter (`translate.ts`).** Rejected: the defect is a provider
behavior, but the harness must stay correct for every provider; the assembler is the
single provider-neutral place.

**Filter at dispatch (`agent.ts` / `tool-calls.ts`).** Rejected: by then the ghost is
already in the persisted `assistant/message`, leaving a dangling tool call with no
result and breaking request reconstruction.

**Fabricate a synthetic id for empty-id calls.** Rejected: an empty name has nothing to
fabricate, and a call whose id is empty cannot correlate its result on the wire.

## Verification

`packages/llm/llm/tests/assembler.spec.ts` asserts the drop for a nameless delta, an
empty-id block, and a mixed text/ghost/valid stream, plus replay-entry pruning for a
dropped empty call; a valid tool call and the existing `max-tokens` drop are unchanged.

## Consequences

A degenerate tool call no longer dispatches, fails an invariant, or poisons the next
request. A lone empty call now assembles to an empty message and completes the turn,
which is strictly better than the prior unknown-tool dispatch and is covered by the
existing text-less-turn serialization (`content: ''`).
