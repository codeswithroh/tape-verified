#!/usr/bin/env bash
# End-to-end smoke test against a deployment JSON. Usage: scripts_smoke.sh <rpc> <pk> <deployments.json>
set -euo pipefail
R=$1; K=$2; D=$3
j() { python3 -c "import json,sys;d=json.load(open('$D'));print($1)"; }
USDG=$(j "d['usdg']"); F=$(j "d['factory']"); E=$(j "d['engine']")
NVDA=$(j "d['assets']['NVDA']['token']"); NF=$(j "d['assets']['NVDA']['feed']"); SPY=$(j "d['assets']['SPY']['token']")
ME=$(cast wallet address $K)
s() { cast send "$@" --rpc-url $R --private-key $K --json | python3 -c "import json,sys;r=json.load(sys.stdin);assert r['status']=='0x1',r;print('  ok gas',int(r['gasUsed'],16))"; }
echo "mint test USDG"; s $USDG "faucet()"; s $USDG "faucet()"
echo "create vault"; s $USDG "approve(address,uint256)" $F 1000000000; s $F "createVault(string,string,address[],uint16,uint256)" "Smoke Fund" "tSMK" "[$NVDA,$SPY]" 2000 1000000000
V=$(cast call $F "vaults()(address[])" -r $R | tr -d '[]' | tr ',' '\n' | tail -1 | tr -d ' ')
echo "vault $V"
echo "follower deposit 5000"; s $USDG "approve(address,uint256)" $V 5000000000; s $V "deposit(uint256,uint256,address)" 5000000000 1 $ME
echo "manager buys NVDA 3000, SPY 1500"; s $V "trade(address,address,uint256,uint256)" $USDG $NVDA 3000000000 50; s $V "trade(address,address,uint256,uint256)" $USDG $SPY 1500000000 50
P=$(cast call $NF "latestRoundData()(uint80,int256,uint256,uint256,uint80)" -r $R | sed -n 2p | cut -d' ' -f1)
echo "NVDA +8%"; s $NF "update(int256)" $((P*108/100)); sleep 61
echo "checkpoint"; s $V "checkpoint()"
echo "metrics (Stylus): $(cast call $E 'metrics(address)(uint256,int256,uint256,uint256,int256,uint256)' $V -r $R | tr '\n' ' ')"
echo "hwm $(cast call $V 'highWaterMark()(uint256)' -r $R)  pps $(cast call $V 'pricePerShare()(uint256)' -r $R)"
SH=$(cast call $V "balanceOf(address)(uint256)" $ME -r $R | cut -d' ' -f1)
echo "redeem all ($SH shares)"; s $V "redeem(uint256,address)" $SH $ME
echo "NVDA received $(cast call $NVDA 'balanceOf(address)(uint256)' $ME -r $R)"
