# Agent Note: 在组装阶段丢弃名称或 id 为空的退化工具调用

Status: implemented

[English](2026-08-26-empty-tool-call-drop.md) | 中文

## Problem

DeepSeek V4 Flash 偶尔会发出一个退化的工具调用，其线上 `id` 与 `function.name` 均为空。
与提供方无关的组装器会把它转成 `name: ''`、`id: CallId('')` 的 `tool-call` 块，随后
agent loop 会去调度它。这会产出一条虚假的 `unknown tool ""` 结果、违反要求 name 与
callId 非空的 `tools/result` 不变量，并把一个幽灵调用写入会话日志，而它在序列化后
变成 `tool_calls: [{ id: '', function: { name: '' } }]` —— 这种形态在后续每一轮都会被
提供方拒绝。

## Decision

`BlockAssembler.assembled()` —— 它本就是所有可见块唯一的保留/丢弃决策点 —— 现在除了
已有的 `max-tokens` 丢弃外，还会在 `tool-call` 块的 `name` 为空（trim 后）或 `id` 为空时
丢弃它。该决策放在新的 `keepBlock(block)` 辅助方法中，replay-envelope 的裁剪现在以
`blocks.length === all.length` 取代 `kept === undefined` 作为判断。

这一丢弃与提供方无关（它位于规范的组装器中，而非 DeepSeek 适配器），通过在幽灵调用
进入会话日志之前移除它来维持“对模型可见 ⟺ 已记录”的规则，并复用已有的 replay 元数据
裁剪，使发出的块与 replay 元数据不会不一致。

## Alternatives considered

**在 DeepSeek 适配器（`translate.ts`）中丢弃。** 拒绝：缺陷来自提供方行为，但 harness
必须对每个提供方都保持正确；组装器是唯一与提供方无关的位置。

**在调度点过滤（`agent.ts` / `tool-calls.ts`）。** 拒绝：到那时幽灵调用已经进入持久化的
`assistant/message`，留下一个没有结果的悬空工具调用，并破坏请求重建。

**为 id 为空的调用合成一个 id。** 拒绝：name 为空时无可合成，而 id 为空的调用无法在
线上关联其结果。

## Verification

`packages/llm/llm/tests/assembler.spec.ts` 断言了无 name 的 delta、空 id 的块、以及
文本/幽灵/有效调用混合流都会被正确丢弃，并覆盖了丢弃空调用时的 replay 条目裁剪；
有效工具调用与已有的 `max-tokens` 丢弃行为保持不变。

## Consequences

退化的工具调用不再被调度、不再违反不变量、也不再污染下一次请求。一个孤立的空调用
现在会组装成空消息并结束本轮，这严格优于此前的未知工具调度，且已被现有的无文本轮次
序列化（`content: ''`）覆盖。
