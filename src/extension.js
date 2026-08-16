"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const translations = require("./translations.json");
const { applyOperation, computeCodexPatch, computeExactTextPatch, computeNlsPatch, computeProductChecksumPatch, getStatus, restoreLatest } = require("./patcher");

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));

function resolveTargets(context) {
  const appRoot = vscode.env.appRoot;
  const product = readJson(path.join(appRoot, "product.json"));
  if (product.applicationName !== "breezell") throw new Error("此扩展只能在 Breezell 中使用");
  if (product.commit !== translations.source.commit) throw new Error(`当前 Breezell 版本不兼容：${product.version}`);

  const globalStorage = context.globalStorageUri.fsPath;
  const userData = path.resolve(globalStorage, "..", "..", "..");
  const locale = vscode.env.language.toLowerCase();
  if (locale !== "zh-cn") throw new Error("请先将 Breezell 显示语言设为简体中文（zh-cn）");
  const packs = readJson(path.join(userData, "languagepacks.json"));
  const pack = packs[locale];
  if (!pack) throw new Error("未找到简体中文语言包");

  const nlsCache = path.join(userData, "clp", `${pack.hash}.${locale}`, product.commit, "nls.messages.json");
  if (!fs.existsSync(nlsCache)) throw new Error("中文缓存尚未生成，请重启 Breezell 后再应用补丁");
  const codex = vscode.extensions.getExtension("openai.chatgpt");
  if (!codex) throw new Error("未找到 Codex 扩展");

  return {
    appRoot,
    backupRoot: path.join(globalStorage, "backups"),
    codexManifest: path.join(codex.extensionPath, "package.json"),
    defaultMessages: path.join(appRoot, "out", "nls.messages.json"),
    keys: path.join(appRoot, "out", "nls.keys.json"),
    nlsCache,
    workbenchBundle: path.join(appRoot, "out", "vs", "workbench", "workbench.desktop.main.js")
  };
}

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand("breezellZh.apply", async () => {
    try {
      const target = resolveTargets(context);
      const nls = computeNlsPatch(readJson(target.keys), readJson(target.defaultMessages), readJson(target.nlsCache), translations.coreEntries);
      const codexSource = fs.readFileSync(target.codexManifest, "utf8");
      const workbenchSource = fs.readFileSync(target.workbenchBundle, "utf8");
      const workbenchPatched = computeExactTextPatch(workbenchSource, translations.hardcodedEntries).text;
      const productPath = path.join(target.appRoot, "product.json");
      const result = applyOperation([
        { id: "breezell-nls", path: target.nlsCache, after: nls.text },
        { id: "codex-manifest", path: target.codexManifest, after: computeCodexPatch(codexSource, translations.codex) },
        { id: "workbench-hardcoded", path: target.workbenchBundle, after: workbenchPatched },
        {
          id: "product-checksum",
          path: productPath,
          after: computeProductChecksumPatch(
            fs.readFileSync(productPath, "utf8"),
            "vs/workbench/workbench.desktop.main.js",
            translations.source.workbenchChecksum,
            workbenchPatched
          )
        }
      ], target.backupRoot);
      const prefix = result.status === "alreadyApplied" ? "汉化补丁已经生效。" : `已更新 ${result.changed} 个文件。`;
      vscode.window.showInformationMessage(`${prefix} 请完整退出并重新打开 Breezell；Breezell 设置请在“通用 > 语言”选择“简体中文”。`);
    } catch (error) {
      vscode.window.showErrorMessage(`应用 Breezell 中文增强失败：${error.message}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("breezellZh.restore", async () => {
    try {
      const target = resolveTargets(context);
      const result = restoreLatest(target.backupRoot);
      if (result.status === "notApplied") return vscode.window.showInformationMessage("没有可恢复的汉化补丁。");
      vscode.window.showInformationMessage(`已恢复 ${result.changed} 个文件。请完整退出并重新打开 Breezell。`);
    } catch (error) {
      vscode.window.showErrorMessage(`恢复 Breezell 文件失败：${error.message}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("breezellZh.status", () => {
    try {
      const status = getStatus(resolveTargets(context).backupRoot).status;
      const labels = { applied: "汉化补丁已生效", restored: "已恢复到汉化前状态", drifted: "目标文件已被其他更新修改", notApplied: "尚未应用汉化补丁" };
      vscode.window.showInformationMessage(labels[status] || status);
    } catch (error) {
      vscode.window.showErrorMessage(`读取 Breezell 汉化状态失败：${error.message}`);
    }
  }));
}

module.exports = { activate };
