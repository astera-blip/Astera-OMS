import { pathToFileURL } from "node:url";

export function parseSmokeArgs(argv) {
  const baseIndex = argv.indexOf("--base-url");
  const value = baseIndex >= 0 ? argv[baseIndex + 1] : "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_base_url");
  }
  if (url.protocol !== "https:") {
    throw new Error("https_base_url_required");
  }
  return { baseUrl: url.origin };
}

export async function runAnonymousSmoke(baseUrl, fetcher = fetch) {
  const paths = ["/", "/products", "/terms", "/privacy"];
  const checks = [];
  let productPath;
  for (const path of paths) {
    const response = await fetcher(new URL(path, baseUrl), {
      credentials: "omit",
      redirect: "manual",
    });
    const body = await response.text();
    checks.push({ path, status: response.status, ok: response.ok });
    if (path === "/products") {
      productPath = body.match(/href=["'](\/products\/[^"'?#]+)["']/)?.[1];
    }
  }
  if (productPath) {
    const response = await fetcher(new URL(productPath, baseUrl), {
      credentials: "omit",
      redirect: "manual",
    });
    checks.push({ path: productPath, status: response.status, ok: response.ok });
  } else {
    checks.push({
      path: "/products/:id",
      status: 0,
      ok: false,
      error: "public_product_not_found",
    });
  }
  return { ok: checks.every((check) => check.ok), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { baseUrl } = parseSmokeArgs(process.argv.slice(2));
    const report = await runAnonymousSmoke(baseUrl);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "production_smoke_failed");
    process.exitCode = 1;
  }
}
