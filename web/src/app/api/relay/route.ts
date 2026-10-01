import { parseAbi, type Address } from "viem";
import { DEPLOYMENTS, abi } from "@/lib/contracts";
import { FEES, isSupported, mainnet, pub, signer } from "@/lib/server/chain";

// Mirrors Robinhood Chain mainnet Chainlink stock prices into the testnet feeds in one batched tx.
// Triggered by app visitors (throttled by on-chain freshness) and by a daily Vercel cron.

export const dynamic = "force-dynamic";

const MIN_GAP_S = 120; // skip if any feed was refreshed this recently
const HEARTBEAT_S = 6 * 3600; // re-stamp unchanged prices at least this often
const batcherAbi = parseAbi(["function push(address[] feeds, int256[] answers)"]);

type Row = readonly [bigint, bigint, bigint, bigint, bigint];

async function relay(chainId: number) {
  if (!isSupported(chainId)) return { ok: false, error: "unsupported chain" };
  const dep = DEPLOYMENTS[chainId] as (typeof DEPLOYMENTS)[typeof chainId] & { batcher?: Address };
  if (!dep.batcher) return { ok: false, error: "no batcher on this chain" };

  const syms = Object.keys(dep.assets);
  const call = (address: Address) => ({ address, abi: abi.feed, functionName: "latestRoundData" as const });
  const [src, dst] = await Promise.all([
    mainnet().multicall({ contracts: syms.map((s) => call(dep.assets[s].mainnetFeed)) }),
    pub(chainId).multicall({ contracts: syms.map((s) => call(dep.assets[s].feed)) }),
  ]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const newest = dst.reduce((m, r) => (r.status === "success" && (r.result as Row)[3] > m ? (r.result as Row)[3] : m), 0n);
  if (now - newest < BigInt(MIN_GAP_S)) return { ok: true, skipped: "fresh", age: Number(now - newest) };

  const feeds: Address[] = [];
  const answers: bigint[] = [];
  syms.forEach((s, i) => {
    if (src[i].status !== "success" || dst[i].status !== "success") return;
    const [, a] = src[i].result as Row;
    const [, b, , t] = dst[i].result as Row;
    if (a > 0n && (a !== b || now - t > BigInt(HEARTBEAT_S))) {
      feeds.push(dep.assets[s].feed);
      answers.push(a);
    }
  });
  if (!feeds.length) return { ok: true, skipped: "unchanged" };

  const wallet = signer("RELAY_PRIVATE_KEY", chainId);
  const hash = await wallet.writeContract({
    address: dep.batcher,
    abi: batcherAbi,
    functionName: "push",
    args: [feeds, answers],
    gas: 80_000n + 60_000n * BigInt(feeds.length),
    ...FEES,
  });
  return { ok: true, updated: feeds.length, hash };
}

// Concurrent requests on one instance share the in-flight relay instead of racing the nonce.
const inflight = new Map<number, Promise<unknown>>();
function relayOnce(chainId: number) {
  if (!inflight.has(chainId)) inflight.set(chainId, relay(chainId).finally(() => setTimeout(() => inflight.delete(chainId), 15_000)));
  return inflight.get(chainId)!;
}

function chainParam(req: Request) {
  return Number(new URL(req.url).searchParams.get("chain") ?? 46630);
}

export async function POST(req: Request) {
  try {
    return Response.json(await relayOnce(chainParam(req)));
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

/** Vercel cron: refresh every supported chain. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const out: Record<string, unknown> = {};
  for (const id of [46630, 421614]) {
    try {
      out[id] = await relayOnce(id);
    } catch (e) {
      out[id] = { ok: false, error: (e as Error).message.slice(0, 200) };
    }
  }
  return Response.json(out);
}
