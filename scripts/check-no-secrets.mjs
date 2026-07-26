import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".firebase-local",
  ".next",
  ".worktrees",
  "node_modules",
  "out",
  "build",
  "coverage",
  ".vercel",
]);

const allowedFiles = new Set([".env.example", "scripts/check-no-secrets.mjs"]);

const ignoredFilePatterns = [/(^|\/).*?-debug\.log$/];

const forbiddenPathPatterns = [
  /^\.env($|\.)/,
  /(^|[\\/])serviceAccount.*\.json$/i,
  /(^|[\\/]).*firebase-adminsdk.*\.json$/i,
  /(^|[\\/]).*private.*key.*$/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

const forbiddenContentPatterns = [
  /-----BEGIN PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /AIza[0-9A-Za-z_-]{35}/,
  /firebase-adminsdk/i,
  /"type"\s*:\s*"service_account"/i,
];

function walk(directory) {
  const results = [];

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      results.push(...walk(absolutePath));
      continue;
    }

    if (stats.isFile()) {
      results.push(absolutePath);
    }
  }

  return results;
}

function listGitVisibleFiles() {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    return output
      .split("\0")
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/"));
  } catch {
    return null;
  }
}

const gitVisibleFiles = listGitVisibleFiles();
const isFallbackScan = gitVisibleFiles === null;
const ignoredFallbackPathPatterns = [/^\.env($|\.)/];
const files =
  gitVisibleFiles ??
  walk(root).map((file) => relative(root, file).replaceAll("\\", "/"));

const pathViolations = files.filter((file) => {
  if (allowedFiles.has(file)) {
    return false;
  }

  if (isFallbackScan && ignoredFallbackPathPatterns.some((pattern) => pattern.test(file))) {
    return false;
  }

  return forbiddenPathPatterns.some((pattern) => pattern.test(file));
});

const contentViolations = [];

for (const file of files) {
  if (allowedFiles.has(file)) {
    continue;
  }

  if (isFallbackScan && ignoredFallbackPathPatterns.some((pattern) => pattern.test(file))) {
    continue;
  }

  if (ignoredFilePatterns.some((pattern) => pattern.test(file))) {
    continue;
  }

  const absolutePath = join(root, file);
  let stats;

  try {
    stats = statSync(absolutePath);
  } catch {
    continue;
  }

  if (stats.size > 1024 * 1024) {
    continue;
  }

  let content = "";

  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  if (forbiddenContentPatterns.some((pattern) => pattern.test(content))) {
    contentViolations.push(file);
  }
}

if (pathViolations.length > 0 || contentViolations.length > 0) {
  console.error("Potential secret files or content detected.");

  if (pathViolations.length > 0) {
    console.error("Path violations:");
    for (const file of pathViolations) {
      console.error(`- ${file}`);
    }
  }

  if (contentViolations.length > 0) {
    console.error("Content violations:");
    for (const file of contentViolations) {
      console.error(`- ${file}`);
    }
  }

  process.exit(1);
}

console.log("No obvious secrets detected in project files.");
