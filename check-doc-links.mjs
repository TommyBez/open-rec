import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const docsDir = path.join(workspaceRoot, "docs");
const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

async function collectMarkdownFiles() {
  const docEntries = await readdir(docsDir, { withFileTypes: true });
  const docMarkdownFiles = docEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(docsDir, entry.name));
  return [path.join(workspaceRoot, "README.md"), ...docMarkdownFiles];
}

function shouldSkipLink(target) {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

function normalizeTarget(target) {
  const withoutFragment = target.split("#", 1)[0]?.trim() ?? "";
  return withoutFragment;
}

async function validateMarkdownFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const missingLinks = [];
  for (const match of content.matchAll(markdownLinkRegex)) {
    const rawTarget = match[1]?.trim() ?? "";
    if (shouldSkipLink(rawTarget)) {
      continue;
    }
    const target = normalizeTarget(rawTarget);
    if (!target) {
      continue;
    }
    const resolvedPath = path.resolve(path.dirname(filePath), target);
    try {
      await access(resolvedPath);
    } catch {
      missingLinks.push({
        source: path.relative(workspaceRoot, filePath),
        target,
      });
    }
  }
  return missingLinks;
}

async function main() {
  const markdownFiles = await collectMarkdownFiles();
  const missingLinks = [];

  for (const filePath of markdownFiles) {
    const fileMissingLinks = await validateMarkdownFile(filePath);
    missingLinks.push(...fileMissingLinks);
  }

  if (missingLinks.length === 0) {
    console.log("Docs link check passed.");
    return;
  }

  console.error("Docs link check failed. Missing targets:");
  for (const entry of missingLinks) {
    console.error(`- ${entry.source}: ${entry.target}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("Docs link check failed with an unexpected error:", error);
  process.exit(1);
});
