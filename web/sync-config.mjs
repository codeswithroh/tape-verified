// Copies contract deployments and replay manifests into the web app's config.
// On Vercel only web/ is uploaded, so missing sources leave the committed copies untouched.
import { cpSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("src/config", { recursive: true });
for (const id of [46630, 421614]) {
  const d = `../contracts/deployments/${id}.json`;
  if (existsSync(d)) cpSync(d, `src/config/deployment-${id}.json`);
  const r = `../scripts/data/replay-${id}.json`;
  const out = `src/config/replay-${id}.json`;
  if (existsSync(r)) cpSync(r, out);
  else if (!existsSync(out)) cpSync("src/config/empty-replay.json", out);
}
console.log("config synced");
