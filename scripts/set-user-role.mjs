import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = parseArgs(process.argv.slice(2));

if (!args.project) {
  fail("請明確指定 --project。");
}

if (args.confirmProject && args.confirmProject !== args.project) {
  fail("--confirm-project 必須與 --project 相同。");
}

if (!["owner", "helper", "member"].includes(args.role)) {
  fail("--role 只支援 owner、helper、member。");
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  fail("請先設定 GOOGLE_APPLICATION_CREDENTIALS 指向專案外的 service-account JSON。");
}

if (!existsSync(credentialsPath)) {
  fail("GOOGLE_APPLICATION_CREDENTIALS 指向的檔案不存在。");
}

const credential = buildCredential(credentialsPath);

if (!getApps().length) {
  initializeApp({
    credential,
    projectId: args.project,
  });
}

const auth = getAuth();
const firestore = getFirestore();
const user = await auth.getUserByEmail(args.email);
const beforeClaims = user.customClaims ?? {};
const nextClaims = {
  ...beforeClaims,
  role: args.role,
};

await auth.setCustomUserClaims(user.uid, nextClaims);

const refreshedUser = await auth.getUser(user.uid);
const refreshedRole = refreshedUser.customClaims?.role;

if (refreshedRole !== args.role) {
  fail(`使用者 ${args.email} 的 role 寫入後仍不是 ${args.role}。`);
}

const auditId = `role-change-${Date.now()}`;

await firestore.collection("auditLogs").doc(auditId).set({
  id: auditId,
  actorUid: args.actorUid ?? "local-admin-script",
  action: "auth.role.updated",
  targetType: "firebaseAuthUser",
  targetId: user.uid,
  metadata: {
    email: args.email,
    project: args.project,
    role: args.role,
    previousRole: beforeClaims.role ?? null,
  },
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`已將 ${args.email} 設為 ${args.role}，project=${args.project}，uid=${user.uid}`);

function parseArgs(argv) {
  const result = {
    project: "",
    confirmProject: "",
    email: "",
    role: "member",
    actorUid: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--")) {
      continue;
    }

    if (value === undefined) {
      fail(`缺少 ${key} 的值。`);
    }

    switch (key) {
      case "--project":
        result.project = value;
        break;
      case "--confirm-project":
        result.confirmProject = value;
        break;
      case "--email":
        result.email = value;
        break;
      case "--role":
        result.role = value;
        break;
      case "--actor-uid":
        result.actorUid = value;
        break;
      default:
        fail(`未知參數：${key}`);
    }

    index += 1;
  }

  if (!result.email) {
    fail("請明確指定 --email。");
  }

  return result;
}

function buildCredential(path) {
  const raw = requireJson(path);
  if (raw.client_email && raw.private_key) {
    return cert(raw);
  }

  fail("service-account JSON 必須包含 client_email 與 private_key。");
}

function requireJson(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw || typeof raw !== "object") {
    fail("service-account JSON 格式無效。");
  }

  return raw;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
