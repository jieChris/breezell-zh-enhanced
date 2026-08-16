import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "breezell-zh-vsix-"));
const extensionDir = path.join(stage, "extension");
fs.mkdirSync(path.join(extensionDir, "src"), { recursive: true });
fs.mkdirSync(path.join(extensionDir, "assets"), { recursive: true });

for (const file of ["package.json", "README.md", "LICENSE"]) fs.copyFileSync(path.join(projectRoot, file), path.join(extensionDir, file));
for (const file of ["extension.js", "patcher.js", "translations.json"]) fs.copyFileSync(path.join(projectRoot, "src", file), path.join(extensionDir, "src", file));
fs.copyFileSync(path.join(projectRoot, "assets", "icon.png"), path.join(extensionDir, "assets", "icon.png"));

const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="png" ContentType="image/png" />
</Types>
`;
const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="zh-CN" Id="${manifest.name}" Version="${manifest.version}" Publisher="${manifest.publisher}" />
    <DisplayName>${manifest.displayName}</DisplayName>
    <Description xml:space="preserve">${manifest.description}</Description>
    <Tags>Breezell,Chinese,Localization</Tags>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${manifest.engines.vscode}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui" />
    </Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
  <Dependencies />
  <Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" /></Assets>
</PackageManifest>
`;
fs.writeFileSync(path.join(stage, "[Content_Types].xml"), contentTypes);
fs.writeFileSync(path.join(stage, "extension.vsixmanifest"), vsixManifest);

const outputDir = path.resolve(projectRoot, "..", "..", "outputs");
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, `${manifest.name}-${manifest.version}.vsix`);
fs.rmSync(output, { force: true });
const zipped = spawnSync("/usr/bin/zip", ["-qr", output, "."], { cwd: stage, encoding: "utf8" });
if (zipped.status !== 0) throw new Error(zipped.stderr || "VSIX 打包失败");
fs.copyFileSync(path.join(projectRoot, "inventory", "report.md"), path.join(outputDir, "breezell-zh-scan-report.md"));
console.log(output);
