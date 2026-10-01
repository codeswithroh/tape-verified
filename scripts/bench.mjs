// Gas benchmark: Stylus (Rust) PerfEngine vs the Solidity reference, same math, same data.
// Runs on a local Nitro devnode. Writes data/bench.json.
//   STYLUS=0x.. SOLIDITY=0x.. node bench.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
const RPC = "http://127.0.0.1:8547";
const chain = { id: 412346, name: "devnode", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const dev = privateKeyToAccount("0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659");
const pub = createPublicClient({ chain, transport: http(RPC), pollingInterval: 100 });
const wallet = createWalletClient({ account: dev, chain, transport: http(RPC) });
const abi = parseAbi(["function record(uint256)", "function metrics(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)"]);
const engines = { stylus: process.env.STYLUS, solidity: process.env.SOLIDITY };

// one fresh recorder account per (engine, size) so tapes don't mix
const SIZES = [30, 70, 150, 300];
const out = [];
let n0 = 0;
for (const size of SIZES) {
  const row = { checkpoints: size };
  for (const [name, addr] of Object.entries(engines)) {
    const rec = privateKeyToAccount(`0x${(0xbeef0000 + n0++).toString(16).padStart(64, "0")}`);
    const fund = await wallet.sendTransaction({ to: rec.address, value: 10n ** 17n });
    await pub.waitForTransactionReceipt({ hash: fund });
    const w = createWalletClient({ account: rec, chain, transport: http(RPC) });
    let pps = 10n ** 18n;
    let nonce = await pub.getTransactionCount({ address: rec.address });
    let last;
    let recordGas = 0n;
    for (let i = 0; i < size; i++) {
      pps = (pps * BigInt(1000 + ((i * 37) % 41) - 20)) / 1000n; // deterministic wiggle
      last = await w.sendTransaction({ to: addr, data: encodeFunctionData({ abi, functionName: "record", args: [pps] }), nonce: nonce++, gas: 300_000n });
    }
    const r = await pub.waitForTransactionReceipt({ hash: last });
    recordGas = r.gasUsed;
    const gas = await pub.estimateGas({ account: dev.address, to: addr, data: encodeFunctionData({ abi, functionName: "metrics", args: [rec.address] }) });
    const m = await pub.readContract({ address: addr, abi, functionName: "metrics", args: [rec.address] });
    row[name] = { metricsGas: Number(gas), recordGas: Number(recordGas), result: m.map(String) };
  }
  row.ratio = +(row.solidity.metricsGas / row.stylus.metricsGas).toFixed(2);
  row.sameResult = JSON.stringify(row.solidity.result) === JSON.stringify(row.stylus.result);
  out.push(row);
  console.log(`n=${size}  solidity ${row.solidity.metricsGas}  stylus ${row.stylus.metricsGas}  ${row.ratio}x  identical=${row.sameResult}  record gas sol/sty ${row.solidity.recordGas}/${row.stylus.recordGas}`);
}
writeFileSync(join(here, "data", "bench.json"), JSON.stringify(out, null, 1));
