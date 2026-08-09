import { createServer, type Server } from "node:http";
import { createConnection } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSecurityWorker } from "../../ops/security-worker/server.mjs";

const productionProject = "astera-oms-prod";
const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

describe("production security worker HTTP contract", () => {
  const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
  let server: Server | undefined;

  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = productionProject;
  });

  afterEach(async () => {
    if (server) await closeServer(server);
    server = undefined;
    vi.restoreAllMocks();
    if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
  });

  it("returns only the cleanup aggregate for the fixed cleanup route", async () => {
    // Catches a worker that returns a cleanup record or its sensitive fields.
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async () => ({
        db: createCleanupDb(),
        FieldValue: { delete: () => "__delete__" },
        listKnownKeyVersions: async () => [1],
      }),
    }));

    const response = await request(server, "/jobs/refund-account-cleanup", {
      method: "POST",
      body: JSON.stringify({ account: "sensitive-account" }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      job: "refundAccountCleanup",
      cleaned: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain("sensitive-account");
    expect(JSON.stringify(response.body)).not.toContain("cleanup-document-id");
  });

  it("returns only fixed report aggregates for the fixed report route", async () => {
    // Catches a worker that exposes report identities or the detailed key report.
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async () => ({
        db: createReportDb(),
        FieldValue: { delete: () => "__delete__" },
        listKnownKeyVersions: async () => [1, 2],
      }),
    }));

    const response = await request(server, "/jobs/fingerprint-key-usage");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      job: "fingerprintKeyUsageReport",
      versionCount: 2,
      malformedMemberAccounts: 1,
      malformedPaymentSnapshots: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain(validFingerprint);
    expect(JSON.stringify(response.body)).not.toContain("report-document-id");
  });

  it("uses the production environment project despite project-selection request input", async () => {
    // Catches a worker that lets a request choose its Firebase or KMS project.
    const initializedProjects: string[] = [];
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async ({ project }) => {
        initializedProjects.push(project);
        return {
          db: createReportDb(),
          FieldValue: { delete: () => "__delete__" },
          listKnownKeyVersions: async () => [1],
        };
      },
    }));

    const response = await request(
      server,
      "/jobs/fingerprint-key-usage?project=attacker-project&job=refund-account-cleanup",
      {
        headers: {
          "x-google-cloud-project": "attacker-project",
          "x-kms-key": "attacker-key",
        },
        body: JSON.stringify({ project: "attacker-project", job: "refund-account-cleanup" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ job: "fingerprintKeyUsageReport", versionCount: 1 });
    expect(initializedProjects).toEqual([productionProject]);
  });

  it("serves the fixed health contract and rejects unknown routes", async () => {
    // Catches a worker that accidentally exposes an additional administrative route.
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async () => ({
        db: createReportDb(),
        FieldValue: { delete: () => "__delete__" },
        listKnownKeyVersions: async () => [1],
      }),
    }));

    expect(await request(server, "/healthz", { method: "GET" }))
      .toEqual({ status: 200, body: { ok: true } });
    expect(await request(server, "/healthz", { method: "POST" }))
      .toEqual({ status: 405, body: { ok: false } });
    expect(await request(server, "/jobs/arbitrary")).toEqual({ status: 404, body: { ok: false } });
  });

  it("rejects non-POST job calls", async () => {
    // Catches a worker that allows a browser or crawler to invoke a job with GET.
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async () => ({
        db: createReportDb(),
        FieldValue: { delete: () => "__delete__" },
        listKnownKeyVersions: async () => [1],
      }),
    }));

    expect(await request(server, "/jobs/refund-account-cleanup", { method: "GET" }))
      .toEqual({ status: 405, body: { ok: false } });
  });

  it("returns and logs a fixed safe failure when setup or a job fails", async () => {
    // Catches a worker that exposes raw dependency errors in HTTP responses or logs.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies: async () => {
        throw new Error("raw-secret-and-document-id");
      },
    }));

    const response = await request(server, "/jobs/refund-account-cleanup");

    expect(response).toEqual({ status: 500, body: { ok: false, error: "security_worker_failed" } });
    expect(errorSpy).toHaveBeenCalledWith("security_worker_failed");
  });

  it("fails safely without initializing dependencies outside the production environment", async () => {
    // Catches a worker that runs against a non-production project configuration.
    process.env.GOOGLE_CLOUD_PROJECT = "attacker-project";
    const initializeDependencies = vi.fn();
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies,
    }));

    const response = await request(server, "/jobs/refund-account-cleanup");

    expect(response).toEqual({ status: 500, body: { ok: false, error: "security_worker_failed" } });
    expect(initializeDependencies).not.toHaveBeenCalled();
  });

  it("rejects a malformed request target without exposing it or starting a job", async () => {
    // Catches URL parsing errors that escape fixed worker error handling.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const initializeDependencies = vi.fn();
    server = await startWorker(createSecurityWorker({
      project: productionProject,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      initializeDependencies,
    }));

    const rawTarget = "http://[::1";
    const response = await rawRequest(server, rawTarget);

    expect(response).toEqual({ status: 400, body: { ok: false, error: "invalid_request" } });
    expect(initializeDependencies).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("security_worker_invalid_request");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(rawTarget);
  });
});

async function startWorker(listener: ReturnType<typeof createSecurityWorker>) {
  const worker = createServer(listener);
  await new Promise<void>((resolve) => worker.listen(0, "127.0.0.1", resolve));
  return worker;
}

async function closeServer(worker: Server) {
  await new Promise<void>((resolve, reject) => worker.close((error) => error ? reject(error) : resolve()));
}

async function request(
  worker: Server,
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const address = worker.address();
  if (!address || typeof address === "string") throw new Error("test_server_address_missing");
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body,
  });
  return { status: response.status, body: await response.json() };
}

async function rawRequest(worker: Server, target: string) {
  const address = worker.address();
  if (!address || typeof address === "string") throw new Error("test_server_address_missing");
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: address.port });
    let output = "";
    socket.setTimeout(1_000, () => socket.destroy(new Error("raw_request_timeout")));
    socket.on("connect", () => {
      socket.write(`POST ${target} HTTP/1.1\r\nHost: security-worker.local\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => { output += chunk.toString(); });
    socket.on("end", () => {
      const separator = output.indexOf("\r\n\r\n");
      const head = separator === -1 ? output : output.slice(0, separator);
      const body = separator === -1 ? "" : output.slice(separator + 4);
      const status = Number(head.match(/^HTTP\/1\.1 (\d{3})/)?.[1]);
      try {
        resolve({ status, body: JSON.parse(decodeChunkedBody(body)) });
      } catch (error) {
        reject(error);
      }
    });
    socket.on("error", reject);
  });
}

function decodeChunkedBody(body: string) {
  const [, payload = ""] = body.match(/^[0-9a-f]+\r\n([\s\S]*)\r\n0\r\n\r\n$/i) ?? [];
  return payload;
}

function createCleanupDb() {
  const record = {
    refundAccountCiphertext: "sensitive-account",
    refundEncryptionKeyVersion: 3,
    refundAccountExpiresAt: "2026-08-08T00:00:00.000Z",
    status: "pending",
  };
  return {
    collection: (name: string) => {
      if (name !== "cancellationRequests") throw new Error("unexpected_collection");
      return {
        where: () => ({
          get: async () => ({ docs: [{ id: "cleanup-document-id", data: () => ({ ...record }) }] }),
        }),
        doc: () => ({ id: "cleanup-document-id" }),
      };
    },
    runTransaction: async (operation: (transaction: {
      get: () => Promise<{ exists: boolean; data: () => typeof record }>;
      update: () => void;
    }) => Promise<unknown>) => operation({
      get: async () => ({ exists: true, data: () => ({ ...record }) }),
      update: () => undefined,
    }),
  };
}

function createReportDb() {
  const memberAccounts = [
    {
      id: "report-document-id",
      accountFingerprint: validFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 1,
    },
    { id: "malformed-member" },
  ];
  const payments = [{ id: "malformed-payment" }];
  return {
    collection: (name: string) => ({
      get: async () => ({
        docs: (name === "memberPaymentAccounts" ? memberAccounts : payments)
          .map((record) => ({ id: record.id, data: () => ({ ...record }) })),
      }),
    }),
  };
}
