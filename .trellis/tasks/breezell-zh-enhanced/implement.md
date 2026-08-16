# Execution Notes

## Order

1. 建立 Trellis 规范和项目骨架。
2. 扫描并冻结翻译清单。
3. 实现纯函数补丁器和最小自检。
4. 接入扩展命令并打包 VSIX。
5. 安装后进行 Breezell 内置界面验证。

## Route Deviation

- 基线扫描确认 Breezell Settings 的大量文本写死在压缩 React 包中，无法由标准 VS Code 语言包覆盖。因此从“单一语言包覆盖”调整为“一个混合 VSIX：NLS 缓存覆盖 + 显式硬编码补丁命令”。仍保持单包安装、可恢复、无后台修改。
- 继续检查发现同一 React 包已内置完整 `zh` 简体中文词典，并通过 `globalSettings.language` 原生切换。为避免修改约 1 MB 的压缩前端包，首版取消 React 文件补丁，改为提示并验证原生“简体中文”选项。混合 VSIX 仅处理外层 NLS 与 Codex 扩展清单。
- 安装后验证发现标题栏“Close All Tabs / Image Studio”、欢迎页“Open Folder”和代码索引状态文本直接硬编码在 `workbench.desktop.main.js`，不读取已补丁的 NLS 项。按保守路径增加 7 组带数量校验的上下文级替换；仍不修改 Settings React 包，且在执行前明确提示应用签名会失效。
- 首次应用工作台补丁后，Breezell 内置完整性检查按 `product.json.checksums` 将预期修改误报为“安装可能损坏”。已立即按三文件备份回退；v0.1.2 改为把该单一 SHA-256 字段纳入同批备份与恢复，不修改 macOS 可执行文件或代码签名。
- UI 升级时命令面板被启动期刷新反复关闭。为避免误点，旧版恢复和一次 v0.1.1 应用改用与扩展命令相同的纯 Node 补丁器执行；发现完整性警告后已完整回退，未保留该路线产生的修改。
- v0.1.2 应用后首次通过 Launch Services 重启返回 `-609`；保守改用 `open -na`。Breezell 实际已以 `Electron` 进程名启动，原轮询因只匹配 `Breezell` 而误报未启动；未强制结束进程，也未更改补丁路线。

## Validation Log

- 已强制安装 `local.breezell-zh-enhanced@0.1.2`。
- 已通过现有纯 Node 补丁器一次性应用 4 个目标：Breezell NLS 缓存、Codex 扩展清单、工作台硬编码文本和 `product.json` 完整性字段；`getStatus` 返回 4 个 `applied`。
- 工作台补丁后的无填充 Base64 SHA-256 为 `heG2v/P0CGnT3M0+OzXoWk7lISUwBuJ6htVDFYHgRI8`，与 `product.json` 对应字段一致。
- 完整重启后通过内置 Computer Use 验证“关闭所有标签页”“图像工作室”“打开文件夹”“代码索引”；通知中心未出现安装损坏或扩展被磁盘修改警告。
- `npm run scan` 通过：193 个 NLS 条目、7 组工作台硬编码补丁。
- `npm test` 通过：`self-check ok: 193 NLS entries, 7 hardcoded groups`。
- `npm run package` 通过；VSIX 内容和 `extension/package.json` v0.1.2 元数据检查通过。
- 最终 VSIX SHA-256：`c524a098e1bd99624d71b94c8a86ece48f72135a30ef78fd9ac56a441c0218c0`。
