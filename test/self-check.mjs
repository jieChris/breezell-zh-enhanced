import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { applyOperation, computeCodexPatch, computeExactTextPatch, computeNlsPatch, computeProductChecksumPatch, getStatus, integrityHash, restoreLatest } = require("../src/patcher.js");
const translations = require("../src/translations.json");

const nls = computeNlsPatch([["module", ["first", "second"]]], ["One", "Two"], ["One", "Two"], [
  { module: "module", key: "second", source: "Two", target: "二" }
]);
assert.deepEqual(JSON.parse(nls.text), ["One", "二"]);
assert.equal(nls.changed, 1);

const codexSource = JSON.stringify({
  displayName: "Old",
  description: "Old",
  contributes: {
    commands: [{ command: "cmd", title: "Old" }],
    configuration: { title: "Old", properties: { setting: { description: "Old" } } }
  }
}, null, 2);
const codex = JSON.parse(computeCodexPatch(codexSource, {
  displayName: "新",
  description: "新说明",
  commands: { cmd: "新命令" },
  configurationTitle: "新设置",
  configurationDescriptions: { setting: "新描述" }
}));
assert.equal(codex.contributes.commands[0].title, "新命令");
assert.equal(codex.contributes.configuration.properties.setting.description, "新描述");

const exact = computeExactTextPatch("before before", [{ id: "sample", count: 2, from: "before", to: "after" }]);
assert.equal(exact.text, "after after");
assert.equal(exact.changed, 2);
assert.equal(computeExactTextPatch(exact.text, [{ id: "sample", count: 2, from: "before", to: "after" }]).changed, 0);
assert.throws(() => computeExactTextPatch("drifted", [{ id: "sample", from: "before", to: "after" }]), /不兼容/);

const productSource = `${JSON.stringify({ checksums: { bundle: integrityHash("before") } }, null, 2)}\n`;
const productPatched = computeProductChecksumPatch(productSource, "bundle", integrityHash("before"), "after");
assert.equal(JSON.parse(productPatched).checksums.bundle, integrityHash("after"));
assert.equal(computeProductChecksumPatch(productPatched, "bundle", integrityHash("before"), "after"), productPatched);
assert.throws(() => computeProductChecksumPatch(productSource, "bundle", "unexpected", "after"), /不兼容/);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "breezell-zh-test-"));
const target = path.join(temporary, "target.txt");
const backups = path.join(temporary, "backups");
fs.writeFileSync(target, "before");
assert.equal(applyOperation([{ id: "test", path: target, after: "after" }], backups).status, "applied");
assert.equal(fs.readFileSync(target, "utf8"), "after");
assert.equal(getStatus(backups).status, "applied");
assert.equal(applyOperation([{ id: "test", path: target, after: "after" }], backups).status, "alreadyApplied");
assert.equal(restoreLatest(backups).status, "restored");
assert.equal(fs.readFileSync(target, "utf8"), "before");
assert.equal(getStatus(backups).status, "restored");

assert.ok(translations.coreEntries.length >= 190);
assert.equal(translations.nativeSettingsLanguage, "zh");
assert.equal(translations.hardcodedEntries.length, 7);
assert.equal(typeof translations.source.workbenchChecksum, "string");
assert.equal(translations.coreEntries.some(entry => entry.source === entry.target), false);
console.log(`self-check ok: ${translations.coreEntries.length} NLS entries, ${translations.hardcodedEntries.length} hardcoded groups`);
