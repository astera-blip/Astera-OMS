import { existsSync, mkdirSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const localStateRoot = join(root, ".firebase-local");
const appDataPath = join(localStateRoot, "appdata");
const localAppDataPath = join(localStateRoot, "localappdata");
const xdgConfigPath = join(localStateRoot, "xdg-config");
const bundledJdk21Home = "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot";
const jdk21Bin = join(bundledJdk21Home, "bin");

mkdirSync(appDataPath, { recursive: true });
mkdirSync(localAppDataPath, { recursive: true });
mkdirSync(xdgConfigPath, { recursive: true });

const firebaseEntry = join(
  root,
  "node_modules",
  "firebase-tools",
  "lib",
  "bin",
  "firebase.js",
);

const firebaseEnv = {
  ...process.env,
  APPDATA: appDataPath,
  LOCALAPPDATA: localAppDataPath,
  XDG_CONFIG_HOME: xdgConfigPath,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
};

if (process.platform === "win32" && existsSync(bundledJdk21Home)) {
  const inheritedPath = process.env.PATH ?? process.env.Path ?? "";

  firebaseEnv.JAVA_HOME = bundledJdk21Home;
  firebaseEnv.Path = `${jdk21Bin}${delimiter}${inheritedPath}`;
  delete firebaseEnv.PATH;
}

const child = spawn(process.execPath, [firebaseEntry, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: firebaseEnv,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Firebase CLI exited with signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
