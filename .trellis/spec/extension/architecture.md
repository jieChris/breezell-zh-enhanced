# Architecture Rules

## Applies To

本规范适用于 `src/`、`scripts/` 和 `test/`。

## Local Pattern

- 使用 Node.js 标准库和 Breezell 已提供的 VS Code API；不添加运行时依赖。
- 文件定位、补丁计算和文件写入分离。`src/patcher.js` 的补丁计算可在临时目录独立验证。
- 所有替换采用稳定模块/键、明确 JSON 字段或已计数的精确上下文片段；Breezell Settings 使用原生语言选项，不修改其压缩 React 包。
- 仅允许对已锁定版本的 `workbench.desktop.main.js` 做精确硬编码替换；不得泛化为任意压缩包或全局英文替换。
- 修改工作台资源时，只同步 `product.json` 中对应的内置 SHA-256 完整性字段；不得修改 macOS 可执行文件或代码签名。
- 每个目标文件先验证、后备份、最后写入；批次中任一验证失败则整批不写。
- 补丁必须幂等；恢复必须检查补丁后哈希，避免覆盖外部修改。

## Anti-Patterns

- 不在扩展激活时自动修改 Breezell。
- 不扫描并替换所有英文单词。
- 不修改可执行文件、签名信息或账户数据。
- 不依赖固定用户名、绝对主目录或单一扩展版本目录。

## Verification

- `npm test`
- `npm run scan`
- `npm run package`

这些命令和入口由项目根目录 `package.json` 定义。
