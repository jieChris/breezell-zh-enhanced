# Breezell 简体中文增强

适用于 macOS Breezell `1.112.0` 的本地可逆汉化扩展。当前版本为 `0.1.2`。

补丁覆盖 Breezell 外层 NLS、7 组关键工作台硬编码文本和 Codex 扩展清单。Breezell Settings 自带简体中文词典，本项目不会修改其压缩 React 包。

## 使用前准备

1. 确认 Breezell 版本为 `1.112.0`。
2. 在 Breezell 中安装 Microsoft 中文（简体）语言包。
3. 将 Breezell 显示语言切换为 `zh-cn`，然后完整退出并重新打开一次，以生成中文缓存。

补丁会校验 Breezell 的版本和文件结构；不兼容时会直接拒绝写入。

## 安装

从 [Releases](https://github.com/jieChris/breezell-zh-enhanced/releases/latest) 下载最新 `.vsix`，然后任选一种方式安装。

### 在 Breezell 中安装

1. 打开“扩展”。
2. 点击扩展视图右上角的 `…`。
3. 选择“从 VSIX 安装...”。
4. 选择下载的 `.vsix`。

### 使用命令行安装

```sh
sh /Applications/Breezell.app/Contents/Resources/app/bin/code \
  --install-extension /path/to/breezell-zh-enhanced-0.1.2.vsix \
  --force
```

## 应用汉化

1. 打开命令面板。
2. 运行“应用 Breezell 简体中文增强”。
3. 在 `Breezell Settings > 通用 > 语言` 中选择“简体中文”。
4. 完整退出并重新打开 Breezell。

可运行“查看 Breezell 汉化状态”确认补丁状态。

## 恢复原文件

在命令面板运行“恢复 Breezell 汉化前文件”，然后完整退出并重新打开 Breezell。

每次应用前都会备份原文件。恢复时会校验当前文件，避免覆盖 Breezell 更新或其他程序产生的新修改。

## Breezell 更新前注意

建议先恢复汉化，再更新 Breezell。更新后不要把旧补丁强行应用到新版本；请等待与新版本匹配的补丁。

本项目会修改 Breezell `.app` 内的资源文件，因此可能使 macOS 应用资源签名失效，官方更新也可能覆盖这些修改。项目不会修改可执行文件、账户数据，也不会在后台自动应用补丁。

## 从源码检查和打包

需要 Node.js 18 或更高版本，以及安装在 `/Applications/Breezell.app` 的兼容 Breezell。

```sh
npm run scan
npm test
npm run package
```

打包命令会输出生成的 VSIX 路径。扫描结果保存在 `inventory/scan.json` 和 `inventory/report.md`。

## 许可

[MIT](LICENSE)
