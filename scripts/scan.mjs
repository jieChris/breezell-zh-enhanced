import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appPath = process.env.BREEZELL_APP || "/Applications/Breezell.app";
const appRoot = path.join(appPath, "Contents", "Resources", "app");
const userData = process.env.BREEZELL_USER_DATA || path.join(os.homedir(), "Library", "Application Support", "Breezell");

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function findFileContaining(directory, needle) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findFileContaining(file, needle);
      if (found) return found;
    } else if (entry.name.endsWith(".js") && fs.readFileSync(file, "utf8").includes(needle)) {
      return file;
    }
  }
}

function extractDictionary(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`无法提取内置语言词典：${start}`);
  return vm.runInNewContext(`(${source.slice(from + start.length, to)})`, Object.create(null), { timeout: 1000 });
}

const extraKeys = new Set([
  "vs/workbench/browser/parts/globalCompositeBar\0themeSwitcher",
  "vs/workbench/browser/parts/titlebar/titlebarActions\0themeSwitcher",
  "vs/workbench/browser/parts/notifications/notificationsCenter\0notifications",
  "vs/workbench/browser/parts/notifications/notificationsCommands\0notifications",
  "vs/workbench/browser/parts/notifications/notificationsStatus\0status.notifications",
  "vs/workbench/contrib/ports/browser/ports.contribution\0ports",
  "vs/workbench/contrib/remote/browser/remoteExplorer\0ports",
  "vs/workbench/contrib/remote/browser/tunnelView\0remote.tunnel"
]);

function isInScope(module, key, source) {
  return /breezell|superMemory|uiAggregate/i.test(module)
    || /breezell/i.test(key)
    || /breezell/i.test(source)
    || extraKeys.has(`${module}\0${key}`);
}

function buildRows(keys, messages) {
  const rows = [];
  let index = 0;
  for (const [module, names] of keys) {
    for (const key of names) {
      const source = messages[index++];
      if (source && isInScope(module, key, source)) rows.push({ module, key, source });
    }
  }
  const unique = new Map();
  for (const row of rows) unique.set(`${row.module}\0${row.key}`, row);
  return [...unique.values()];
}

function addReusableTranslations(map, keys, messages, contents) {
  let index = 0;
  for (const [module, names] of keys) {
    for (const key of names) {
      const source = messages[index++];
      const target = contents?.[module]?.[key];
      if (target && target !== source && !map.has(source)) map.set(source, target);
    }
  }
}

const product = readJson(path.join(appRoot, "product.json"));
if (product.applicationName !== "breezell") throw new Error(`目标不是 Breezell：${product.applicationName || "unknown"}`);

const keys = readJson(path.join(appRoot, "out", "nls.keys.json"));
const messages = readJson(path.join(appRoot, "out", "nls.messages.json"));
const languagePacks = readJson(path.join(userData, "languagepacks.json"));
const mainTranslationPath = languagePacks["zh-cn"]?.translations?.vscode;
if (!mainTranslationPath) throw new Error("未找到已安装的简体中文语言包");
const baseChinese = readJson(mainTranslationPath);

const reactDirectory = path.join(appRoot, "out", "vs", "workbench", "contrib", "breezell", "browser", "react", "out");
const reactBundle = findFileContaining(reactDirectory, '"tab.models":"Models"');
if (!reactBundle) throw new Error("未找到 Breezell 内置语言词典");
const reactSource = fs.readFileSync(reactBundle, "utf8");
const reactEnglish = extractDictionary(reactSource, "var a=", ";var o=");
const reactChinese = extractDictionary(reactSource, ";var o=", ";var s=");
const workbenchBundle = path.join(appRoot, "out", "vs", "workbench", "workbench.desktop.main.js");
const workbenchSource = fs.readFileSync(workbenchBundle, "utf8");
const originalWorkbenchChecksum = "p8n1M6ledXSK0xmYXOwC1lR7JjOey1/nCwbLcClMeDA";
const hardcodedEntries = [
  {
    id: "titlebar.closeAll",
    from: 'b.setAttribute("aria-label","Close All Tabs");const v=document.createElement("span");v.classList.add("bzn-capsule-btn-text"),v.textContent="Close All"',
    to: 'b.setAttribute("aria-label","关闭所有标签页");const v=document.createElement("span");v.classList.add("bzn-capsule-btn-text"),v.textContent="全部关闭"'
  },
  {
    id: "titlebar.imageStudio",
    from: 't.className="open-image-studio-window-label",t.textContent="Image Studio"',
    to: 't.className="open-image-studio-window-label",t.textContent="图像工作室"'
  },
  {
    id: "welcome.openFolder",
    from: 'a("Open Folder","codicon-folder-opened"',
    to: 'a("打开文件夹","codicon-folder-opened"'
  },
  {
    id: "codeIndex.idleText",
    count: 2,
    from: 'text:"$(shield) Code Index"',
    to: 'text:"$(shield) 代码索引"'
  },
  {
    id: "codeIndex.progressText",
    from: 'e.progress===0?"$(sync~spin) Updating...":`$(sync~spin) Indexing ${e.progress}%`',
    to: 'e.progress===0?"$(sync~spin) 正在更新...":`$(sync~spin) 正在索引 ${e.progress}%`'
  },
  {
    id: "codeIndex.failedText",
    from: 'text:"$(error) Index Failed"',
    to: 'text:"$(error) 索引失败"'
  },
  {
    id: "codeIndex.indexedText",
    from: 'const t="$(verified-filled) Indexed"',
    to: 'const t="$(verified-filled) 已索引"'
  }
];

for (const entry of hardcodedEntries) {
  const expected = entry.count || 1;
  const before = workbenchSource.split(entry.from).length - 1;
  const after = workbenchSource.split(entry.to).length - 1;
  if (!((before === expected && after === 0) || (before === 0 && after === expected))) {
    throw new Error(`硬编码扫描不兼容：${entry.id}，原文 ${before} 处，译文 ${after} 处`);
  }
}

const reusable = new Map();
addReusableTranslations(reusable, keys, messages, baseChinese.contents);
for (const key of Object.keys(reactEnglish)) {
  const source = reactEnglish[key];
  const target = reactChinese[key];
  if (target && target !== source && !reusable.has(source)) reusable.set(source, target);
}

const manual = readJson(path.join(projectRoot, "src", "core-manual.json"));
const codex = readJson(path.join(projectRoot, "src", "codex-translations.json"));
const allowedUntranslated = new Set(["Breezell"]);
const rows = buildRows(keys, messages);
const unresolved = [];
const coreEntries = [];
for (const row of rows) {
  const target = manual[row.source] || reusable.get(row.source);
  if (!target) {
    if (!allowedUntranslated.has(row.source)) unresolved.push(row);
    continue;
  }
  if (target !== row.source) coreEntries.push({ ...row, target });
}

if (unresolved.length) {
  console.error(JSON.stringify(unresolved, null, 2));
  throw new Error(`仍有 ${unresolved.length} 个核心条目缺少译文`);
}

const translations = {
  source: {
    applicationName: product.applicationName,
    version: product.version,
    commit: product.commit,
    workbenchChecksum: originalWorkbenchChecksum
  },
  nativeSettingsLanguage: "zh",
  coreEntries,
  hardcodedEntries,
  codex
};

writeJson(path.join(projectRoot, "src", "translations.json"), translations);

const inventory = {
  application: product.applicationName,
  version: product.version,
  core: {
    occurrences: rows.length,
    translatedEntries: coreEntries.length,
    uniqueEnglish: new Set(coreEntries.map(row => row.source)).size,
    reusedTranslations: coreEntries.filter(row => !manual[row.source]).length,
    manualTranslations: coreEntries.filter(row => manual[row.source]).length
  },
  nativeSettingsDictionary: {
    bundle: path.relative(appRoot, reactBundle),
    englishKeys: Object.keys(reactEnglish).length,
    chineseKeys: Object.keys(reactChinese).length,
    selectedLanguage: "zh"
  },
  hardcodedWorkbench: {
    bundle: path.relative(appRoot, workbenchBundle),
    entries: hardcodedEntries.map(({ id, count = 1 }) => ({ id, count }))
  },
  codexManifestEntries: 2 + Object.keys(codex.commands).length + 1 + Object.keys(codex.configurationDescriptions).length,
  coreEntries
};
writeJson(path.join(projectRoot, "inventory", "scan.json"), inventory);

const report = `# Breezell 中文增强扫描报告

- Breezell 版本：${product.version}
- 核心补丁条目：${inventory.core.translatedEntries}
- 核心独立英文：${inventory.core.uniqueEnglish}
- 复用现有译文：${inventory.core.reusedTranslations}
- 手工补充译文：${inventory.core.manualTranslations}
- Breezell Settings 内置简体中文词典：${inventory.nativeSettingsDictionary.chineseKeys} 个键
- 外层硬编码补丁：${inventory.hardcodedWorkbench.entries.length} 组
- Codex 清单文本：${inventory.codexManifestEntries} 个字段

## 结论

Breezell Settings 已有原生简体中文，不修改压缩 React 包。VSIX 补齐外层 NLS 缓存、7 组严格匹配的工作台硬编码文本与 Codex 扩展清单，并保留恢复能力。
`;
fs.writeFileSync(path.join(projectRoot, "inventory", "report.md"), report);

console.log(JSON.stringify(inventory, null, 2));
