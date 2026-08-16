# Technical Design

## Package Shape

- `src/extension.js`: VS Code 命令入口。
- `src/patcher.js`: 纯 Node.js、可测试的扫描、应用、恢复和状态逻辑。
- `src/translations.json`: 以稳定模块名、NLS 键或精确英文文本定位的中文映射。
- `scripts/scan.mjs`: 从本机 Breezell 生成审计清单。
- `scripts/package.mjs`: 用系统 `zip` 生成 VSIX，不引入构建依赖。
- `assets/icon.png`: 256×256 PNG 扩展图标，由扩展清单直接引用并随 VSIX 打包。

## Safety Contract

1. 从 `vscode.env.appRoot` 验证 `product.json.applicationName === "breezell"`。
2. 写入前逐项确认源文本存在且目标文本不存在或已是中文。
3. 在扩展全局存储目录保存带哈希的备份和清单。
4. 所有检查通过后再写入；失败时不写任何目标。
5. 恢复时只恢复哈希仍匹配补丁结果的文件，避免覆盖用户后续修改。

## Patch Layers

- NLS 缓存：根据当前 `nls.keys.json` 的模块和键定位数组索引并替换。
- Breezell Settings：使用其现有 `globalSettings.language = "zh"` 原生选项，不修改压缩 React 包。
- 工作台硬编码：只对 `workbench.desktop.main.js` 中已计数的精确上下文片段替换，任一数量不符则整批拒绝。
- 完整性清单：只更新 `product.json` 中上述工作台文件的 SHA-256 字段，避免 Breezell 把预期补丁误报为安装损坏。
- Codex 扩展清单：只修改已知 JSON 字段，不改执行代码。

## Verification

- Node 自检覆盖扫描、幂等应用、冲突拒绝和恢复。
- VSIX 内容检查覆盖必须文件和路径。
- 最终只使用 Breezell 内置界面验证，不使用外部浏览器。
