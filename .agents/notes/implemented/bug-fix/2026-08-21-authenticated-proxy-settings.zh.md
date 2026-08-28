# Agent Note: 已认证代理可启用浏览器设置

[English](2026-08-21-authenticated-proxy-settings.md) | 中文

Status: implemented

## Problem

浏览器客户端会把非回环页面地址视为不受信任，并将设置保存在内存中。因此，位于已认证反向代理后的 DeepSeek Harness Web 服务会在 Models 页面失去已配置的提供商目录，尽管该代理已经控制了对完整 UI 的访问。

## Decision

`dsh-client-connection` 在构造 `ConnectionHandle.isLoopback` 时，将 `globalThis.__DSH_TRUSTED_PROXY__ === true` 视为额外的受信任页面信号。已认证的反向代理可在 DSH 客户端插件启动前，在返回的 HTML 中设置该信号。信号缺失时，普通公共主机规则保持不变。

Maestro 远程代理只会向通过其授权检查后取得的 HTML 注入该信号。其登录页、未认证 API 响应、WebSocket 升级以及可公开访问的 PWA manifest 都不会收到该信号。

## Alternatives considered

**将所有公共主机名视为受信任。** 未采用：直接公开部署的 DSH 会在没有明确代理认证决策的情况下获得设置访问权限。

**在每个代理后都将设置保留在浏览器内存中。** 未采用：已认证到一个明确公开完整 Web UI 的代理的用户，无法在 Models 中配置或查看提供商。

**让代理模拟设置 API。** 未采用：代理会重复实现 DSH 的授权和设置行为，而不是把认证决策传递给拥有该行为的浏览器客户端。

## Consequences

已认证代理成为 DSH 信任边界的一部分。部署必须只在认证浏览器后注入该标记，并在该来源上防止注入的脚本内容。直接公共页面仍仅使用内存，因为它们不携带该标记。

连接客户端测试固定了受信任和不受信任的公共页面情形。Maestro 代理测试固定了已认证 HTML 带有该标记，而登录页不带该标记的行为。
