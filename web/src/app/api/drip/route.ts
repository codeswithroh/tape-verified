import { isAddress, parseEther, type Address } from "viem";
import { FEES, isSupported, pub, signer } from "@/lib/server/chain";

// Gas faucet for the in-app demo wallet: sends a little testnet ETH to wallets that have none,
// so judges can try Tape without bridging. Testnet only; budget-capped by the drip wallet's balance.

export const dynamic = "force-dynamic";

const GRANT = { 46630: parseEther("0.0002"), 421614: parseEther("0.001") } as const;
const recent = new Map<string, number>(); // best-effort per-instance throttle

export async function POST(req: Request) {
  try {
    const { address, chain } = (await req.json()) as { address?: string; chain?: number };
    const chainId = Number(chain);
    if (!address || !isAddress(address) || !isSupported(chainId)) return Response.json({ ok: false, error: "bad request" }, { status: 400 });

    const key = `${chainId}:${address.toLowerCase()}`;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "?";
    const t = Date.now();
    if ((recent.get(key) ?? 0) > t - 60_000 || (recent.get(ip) ?? 0) > t - 10_000) return Response.json({ ok: false, error: "slow down" }, { status: 429 });
    recent.set(key, t);
    recent.set(ip, t);

    const grant = GRANT[chainId];
    const client = pub(chainId);
    const bal = await client.getBalance({ address: address as Address });
    if (bal >= grant / 2n) return Response.json({ ok: true, skipped: "has-gas" });

    const wallet = signer("DRIP_PRIVATE_KEY", chainId);
    const hash = await wallet.sendTransaction({ to: address as Address, value: grant, gas: 30_000n, ...FEES });
    await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return Response.json({ ok: true, hash });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
