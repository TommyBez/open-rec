import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const packageJsonPath = path.join(workspaceRoot, "apps/desktop/package.json");
const cargoTomlPath = path.join(workspaceRoot, "apps/desktop/src-tauri/Cargo.toml");
const tauriConfigPath = path.join(workspaceRoot, "apps/desktop/src-tauri/tauri.conf.json");

function bumpPatchVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Expected a simple semver version, received "${version}".`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function updateCargoPackageVersion(cargoToml, nextVersion) {
  const match = cargoToml.match(/(\[package\][\s\S]*?^version = ")([^"]+)(")/m);
  if (!match) {
    throw new Error("Could not locate the package version in apps/desktop/src-tauri/Cargo.toml.");
  }

  return cargoToml.replace(
    /(\[package\][\s\S]*?^version = ")([^"]+)(")/m,
    `$1${nextVersion}$3`,
  );
}

async function main() {
  const [packageJsonRaw, cargoTomlRaw, tauriConfigRaw] = await Promise.all([
    readFile(packageJsonPath, "utf8"),
    readFile(cargoTomlPath, "utf8"),
    readFile(tauriConfigPath, "utf8"),
  ]);

  const packageJson = JSON.parse(packageJsonRaw);
  const tauriConfig = JSON.parse(tauriConfigRaw);

  const currentVersion = packageJson.version;
  const cargoVersionMatch = cargoTomlRaw.match(/(\[package\][\s\S]*?^version = ")([^"]+)(")/m);
  const cargoVersion = cargoVersionMatch?.[2];
  const tauriVersion = tauriConfig.version;

  if (!currentVersion || !cargoVersion || !tauriVersion) {
    throw new Error("Unable to read the current desktop version from all manifests.");
  }

  if (currentVersion !== cargoVersion || currentVersion !== tauriVersion) {
    throw new Error(
      `Desktop version files are out of sync: package.json=${currentVersion}, Cargo.toml=${cargoVersion}, tauri.conf.json=${tauriVersion}.`,
    );
  }

  const nextVersion = bumpPatchVersion(currentVersion);

  packageJson.version = nextVersion;
  tauriConfig.version = nextVersion;
  const nextCargoToml = updateCargoPackageVersion(cargoTomlRaw, nextVersion);

  if (!dryRun) {
    await Promise.all([
      writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`),
      writeFile(cargoTomlPath, nextCargoToml),
      writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`),
    ]);
  }

  process.stdout.write(
    `${JSON.stringify({
      currentVersion,
      nextVersion,
      dryRun,
    })}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
