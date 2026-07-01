const port = process.env.PORT ?? "3000";
const url = process.env.HEALTHCHECK_URL ?? `http://127.0.0.1:${port}/ready`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4_000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    console.error(`Healthcheck failed with status ${response.status}.`);
    process.exit(1);
  }
} catch (error) {
  clearTimeout(timeout);
  console.error(error instanceof Error ? error.message : "Healthcheck request failed.");
  process.exit(1);
}
