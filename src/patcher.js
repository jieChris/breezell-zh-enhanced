"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const integrityHash = value => crypto.createHash("sha256").update(value).digest("base64").replace(/=+$/, "");

function indexNls(keys, defaultMessages) {
  const result = new Map();
  let index = 0;
  for (const [module, names] of keys) {
    for (const key of names) {
      const id = `${module}\0${key}`;
      const items = result.get(id) || [];
      items.push({ index, source: defaultMessages[index] });
      result.set(id, items);
      index += 1;
    }
  }
  return result;
}

function computeNlsPatch(keys, defaultMessages, localizedMessages, entries) {
  if (defaultMessages.length !== localizedMessages.length) throw new Error("NLS 消息数量不一致");
  const lookup = indexNls(keys, defaultMessages);
  const patched = [...localizedMessages];
  let changed = 0;
  for (const entry of entries) {
    const matches = (lookup.get(`${entry.module}\0${entry.key}`) || []).filter(item => item.source === entry.source);
    if (!matches.length) throw new Error(`Breezell 版本不兼容：${entry.module} / ${entry.key}`);
    for (const match of matches) {
      if (patched[match.index] !== entry.target) {
        patched[match.index] = entry.target;
        changed += 1;
      }
    }
  }
  return { changed, text: JSON.stringify(patched) };
}

function computeCodexPatch(source, translations) {
  const manifest = JSON.parse(source);
  manifest.displayName = translations.displayName;
  manifest.description = translations.description;

  const commands = new Map((manifest.contributes?.commands || []).map(command => [command.command, command]));
  for (const [id, title] of Object.entries(translations.commands)) {
    const command = commands.get(id);
    if (!command) throw new Error(`Codex 命令不存在：${id}`);
    command.title = title;
  }

  const configuration = manifest.contributes?.configuration;
  if (!configuration?.properties) throw new Error("Codex 配置清单结构不兼容");
  configuration.title = translations.configurationTitle;
  for (const [id, description] of Object.entries(translations.configurationDescriptions)) {
    const setting = configuration.properties[id];
    if (!setting) throw new Error(`Codex 设置不存在：${id}`);
    setting.description = description;
  }

  const indent = /\n\t+"/.test(source) ? "\t" : 2;
  return `${JSON.stringify(manifest, null, indent)}\n`;
}

function countOccurrences(source, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function computeExactTextPatch(source, entries) {
  let text = source;
  let changed = 0;
  for (const entry of entries) {
    const expected = entry.count || 1;
    const before = countOccurrences(text, entry.from);
    const after = countOccurrences(text, entry.to);
    if (before === expected && after === 0) {
      text = text.replaceAll(entry.from, entry.to);
      changed += expected;
    } else if (before !== 0 || after !== expected) {
      throw new Error(`Breezell 硬编码文本不兼容：${entry.id}`);
    }
  }
  return { changed, text };
}

function computeProductChecksumPatch(source, file, originalChecksum, patchedContent) {
  const product = JSON.parse(source);
  const current = product.checksums?.[file];
  const patched = integrityHash(patchedContent);
  if (current !== originalChecksum && current !== patched) throw new Error(`Breezell 完整性清单不兼容：${file}`);
  product.checksums[file] = patched;
  const indent = /\n\t+"/.test(source) ? "\t" : 2;
  return `${JSON.stringify(product, null, indent)}\n`;
}

function atomicWrite(file, content) {
  const temporary = `${file}.breezell-zh-${process.pid}.tmp`;
  const mode = fs.statSync(file).mode;
  fs.writeFileSync(temporary, content, { mode });
  fs.renameSync(temporary, file);
}

function applyOperation(files, backupRoot) {
  const plans = files.map(file => {
    const before = fs.readFileSync(file.path);
    const after = Buffer.from(file.after);
    return { ...file, before, after, beforeHash: hash(before), afterHash: hash(after) };
  });
  const changed = plans.filter(plan => plan.beforeHash !== plan.afterHash);
  if (!changed.length) return { status: "alreadyApplied", changed: 0 };

  const operationId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const operationDir = path.join(backupRoot, operationId);
  fs.mkdirSync(operationDir, { recursive: true });
  const manifest = {
    operationId,
    files: changed.map((plan, index) => ({
      id: plan.id,
      path: plan.path,
      backup: `${index}.bak`,
      beforeHash: plan.beforeHash,
      afterHash: plan.afterHash
    }))
  };
  changed.forEach((plan, index) => fs.writeFileSync(path.join(operationDir, `${index}.bak`), plan.before));
  fs.writeFileSync(path.join(operationDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const written = [];
  try {
    for (const plan of changed) {
      atomicWrite(plan.path, plan.after);
      written.push(plan);
    }
  } catch (error) {
    for (const plan of written.reverse()) atomicWrite(plan.path, plan.before);
    throw error;
  }
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.writeFileSync(path.join(backupRoot, "latest.json"), `${JSON.stringify({ operationId }, null, 2)}\n`);
  return { status: "applied", changed: changed.length, operationId };
}

function readLatest(backupRoot) {
  const latestFile = path.join(backupRoot, "latest.json");
  if (!fs.existsSync(latestFile)) return null;
  const { operationId } = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const operationDir = path.join(backupRoot, operationId);
  return { operationDir, manifest: JSON.parse(fs.readFileSync(path.join(operationDir, "manifest.json"), "utf8")) };
}

function getStatus(backupRoot) {
  const latest = readLatest(backupRoot);
  if (!latest) return { status: "notApplied" };
  const states = latest.manifest.files.map(file => {
    if (!fs.existsSync(file.path)) return "missing";
    const current = hash(fs.readFileSync(file.path));
    if (current === file.afterHash) return "applied";
    if (current === file.beforeHash) return "restored";
    return "drifted";
  });
  return { status: states.every(state => state === "applied") ? "applied" : states.every(state => state === "restored") ? "restored" : "drifted", files: states };
}

function restoreLatest(backupRoot) {
  const latest = readLatest(backupRoot);
  if (!latest) return { status: "notApplied", changed: 0 };
  for (const file of latest.manifest.files) {
    if (!fs.existsSync(file.path) || hash(fs.readFileSync(file.path)) !== file.afterHash) {
      throw new Error(`目标文件已被其他更新修改，拒绝覆盖：${file.path}`);
    }
  }
  for (const file of latest.manifest.files) {
    atomicWrite(file.path, fs.readFileSync(path.join(latest.operationDir, file.backup)));
  }
  return { status: "restored", changed: latest.manifest.files.length };
}

module.exports = { applyOperation, computeCodexPatch, computeExactTextPatch, computeNlsPatch, computeProductChecksumPatch, getStatus, hash, integrityHash, restoreLatest };
