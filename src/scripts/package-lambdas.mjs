import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import path from "node:path";

const distRoot = path.resolve("dist");
const zipTimestamp = new Date("1980-01-01T00:00:00.000Z");

for (const entry of readdirSync(distRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const handlerDir = path.join(distRoot, entry.name);
  const files = listFiles(handlerDir)
    .map((filePath) => path.relative(handlerDir, filePath))
    .sort();

  if (files.length === 0) {
    continue;
  }

  for (const file of files) {
    utimesSync(path.join(handlerDir, file), zipTimestamp, zipTimestamp);
  }

  const zipPath = path.join(distRoot, `${entry.name}.zip`);
  rmSync(zipPath, { force: true });

  execFileSync("zip", ["-X", "-q", zipPath, ...files], {
    cwd: handlerDir,
    stdio: "inherit",
  });
}

function listFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }

    if (statSync(fullPath).isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}
