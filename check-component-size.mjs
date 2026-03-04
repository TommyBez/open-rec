import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const SOURCE_DIR = join(process.cwd(), "src")
const MAX_COMPONENT_LINES = 149

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedEntries = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        return collectTsxFiles(fullPath)
      }
      return fullPath.endsWith(".tsx") ? [fullPath] : []
    }),
  )
  return nestedEntries.flat()
}

async function run() {
  const files = await collectTsxFiles(SOURCE_DIR)
  const violations = []

  await Promise.all(
    files.map(async (filePath) => {
      const content = await readFile(filePath, "utf8")
      const rawLines = content.split(/\r?\n/)
      const lineCount =
        rawLines.length > 0 && rawLines[rawLines.length - 1] === ""
          ? rawLines.length - 1
          : rawLines.length
      if (lineCount > MAX_COMPONENT_LINES) {
        violations.push({
          path: relative(process.cwd(), filePath),
          lineCount,
        })
      }
    }),
  )

  violations.sort((a, b) => b.lineCount - a.lineCount || a.path.localeCompare(b.path))

  if (violations.length > 0) {
    console.error(`Component line limit violations (must be < 150 lines): ${violations.length}`)
    for (const violation of violations) {
      console.error(`- ${violation.path}: ${violation.lineCount} lines`)
    }
    process.exitCode = 1
    return
  }

  console.log(`All ${files.length} TSX files are under 150 lines.`)
}

run().catch((error) => {
  console.error("Component size check failed:", error)
  process.exitCode = 1
})
