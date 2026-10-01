// Copies contract deployments and replay manifests into the web app's config.
import { cpSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("src/config", { recursive: true });
for (const id of [46630, 421614]) {
  const d = `../contracts/deployments/${id}.json`;
  if (existsSync(d)) cpSync(d, `src/config/deployment-${id}.json`);
  const r = `../scripts/data/replay-${id}.json`;
  cpSync(existsSync(r) ? r : "src/config/empty-replay.json", `src/config/replay-${id}.json`);
}
console.log("config synced");
