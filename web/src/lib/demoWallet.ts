"use client";
import { createWalletClient, http, numberToHex, type EIP1193Provider, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { injected } from "wagmi/connectors";
import { robinhoodTestnet, arbitrumSepolia } from "./chains";

// Testnet-only burner wallet so judges can try Tape without a browser wallet or bridged ETH.
// The key lives in this browser's localStorage and never leaves it.
const KEY = "tape:demo-key";
const ON = "tape:demo-on"; // set only by an explicit connect, so reconnect never auto-selects the demo wallet

export function demoKey(): Hex {
  let k = localStorage.getItem(KEY) as Hex | null;
  if (!k) {
    k = generatePrivateKey();
    localStorage.setItem(KEY, k);
  }
  return k;
}

const CHAINS = { [robinhoodTestnet.id]: robinhoodTestnet, [arbitrumSepolia.id]: arbitrumSepolia } as const;

function provider(): EIP1193Provider {
  const account = () => privateKeyToAccount(demoKey());
  let chainId: 46630 | 421614 = (Number(localStorage.getItem("tape:chain")) === 421614 ? 421614 : 46630);
  const listeners: Record<string, Array<(x: unknown) => void>> = {};
  const emit = (e: string, x: unknown) => (listeners[e] ?? []).forEach((f) => f(x));
  const rpc = async (method: string, params: unknown) => {
    const r = await fetch(CHAINS[chainId].rpcUrls.default.http[0], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
    });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), j.error);
    return j.result;
  };
  return {
    on: (e: string, f: (x: unknown) => void) => void (listeners[e] ??= []).push(f),
    removeListener: (e: string, f: (x: unknown) => void) => void (listeners[e] = (listeners[e] ?? []).filter((g) => g !== f)),
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      switch (method) {
        case "eth_requestAccounts":
          localStorage.setItem(ON, "1");
          return [account().address];
        case "eth_accounts":
          return localStorage.getItem(ON) === "1" ? [account().address] : [];
        case "eth_chainId":
          return numberToHex(chainId);
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_revokePermissions":
          localStorage.removeItem(ON);
          return null;
        case "wallet_switchEthereumChain": {
          const id = Number((params?.[0] as { chainId: string }).chainId);
          if (id !== 46630 && id !== 421614) throw Object.assign(new Error("Unsupported chain"), { code: 4902 });
          chainId = id;
          emit("chainChanged", numberToHex(id));
          return null;
        }
        case "eth_sendTransaction": {
          const tx = params?.[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
          const w = createWalletClient({ account: account(), chain: CHAINS[chainId], transport: http() });
          return w.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : 0n,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
            maxFeePerGas: 200_000_000n,
            maxPriorityFeePerGas: 0n,
          });
        }
        case "personal_sign":
        case "eth_signTypedData_v4":
          throw Object.assign(new Error("Demo wallet does not sign messages"), { code: 4200 });
        default:
          return rpc(method, params);
      }
    },
  } as unknown as EIP1193Provider;
}

let cached: EIP1193Provider | null = null;
export const demoConnector = injected({
  target: () => ({ id: "tape-demo", name: "Demo wallet", provider: (typeof window === "undefined" ? undefined : (cached ??= provider())) as EIP1193Provider }),
  shimDisconnect: true,
});
