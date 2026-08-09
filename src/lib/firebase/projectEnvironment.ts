const projectEnvironmentNames = [
  "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT_ID",
  "GCLOUD_PROJECT",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

type ProjectEnvironment = Readonly<Record<string, string | undefined>>;

export function configuredFirebaseProjectIds(env: ProjectEnvironment = process.env) {
  return projectEnvironmentNames
    .map((name) => env[name]?.trim() ?? "")
    .filter(Boolean);
}

export function resolveFirebaseProjectId(env: ProjectEnvironment = process.env) {
  const projectIds = configuredFirebaseProjectIds(env);
  if (new Set(projectIds).size > 1) {
    throw new Error("firebase_project_id_conflict");
  }
  return projectIds[0] || undefined;
}

export function everyConfiguredProjectMatches(
  expectedProjectId: string,
  env: ProjectEnvironment = process.env,
) {
  const projectIds = configuredFirebaseProjectIds(env);
  return projectIds.length > 0
    && projectIds.every((projectId) => projectId === expectedProjectId);
}
