// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {AssetRegistry} from "./AssetRegistry.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IPerfEngine} from "./interfaces/IPerfEngine.sol";
import {ISwapRouter02} from "./interfaces/ISwapRouter02.sol";

/// @title TapeVault
/// @notice A manager's public stock-token portfolio, denominated in USDG.
///
///         - Followers deposit USDG and receive shares priced at oracle NAV.
///         - The manager can only swap between USDG and the vault's fixed asset list, through the
///           registry's router, and every fill must land within `maxDevBps` of the Chainlink price.
///           The manager has no path to move assets out of the vault.
///         - Followers redeem in kind, pro rata, at any time. Redemption reads no oracle, so it works
///           over weekends, during feed outages and if the manager disappears.
///         - Each checkpoint appends the net-of-fee price per share to the PerfEngine. That history
///           is the manager's track record: append-only, keyed to this vault, impossible to edit.
///         - The performance fee is minted as shares, only on gains above the high-water mark.
contract TapeVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ASSETS = 8;
    uint256 public constant MAX_PERF_FEE_BPS = 3_000;
    /// @notice Hard cap on how far a fill may deviate from the oracle, whatever the manager asks for.
    uint256 public constant MAX_TRADE_DEV_BPS = 150;
    /// @notice Charged on deposit and paid to the registry's fee recipient, never to the vault: a fee kept
    ///         in the vault would lift share price and let a manager pad the track record by churning
    ///         deposits. Taxes arbitrage of oracle lag (24/5 feeds, 0.5% deviation) against holders.
    uint256 public constant ENTRY_FEE_BPS = 20;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    AssetRegistry public immutable registry;
    IPerfEngine public immutable engine;
    IERC20 public immutable usdg;
    ISwapRouter02 public immutable router;
    address public immutable manager;
    address public immutable factory;
    uint16 public immutable perfFeeBps;

    address[] internal _assets;
    mapping(address token => bool) public isAsset;

    /// @notice Highest net-of-fee price per share on which a fee has been charged (1e18 = 1.0).
    uint256 public highWaterMark = WAD;
    uint256 public lastCheckpoint;

    event Deposited(address indexed caller, address indexed receiver, uint256 usdgIn, uint256 shares);
    event Redeemed(address indexed owner, address indexed receiver, uint256 shares);
    event Traded(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 oracleOut);
    event FeeAccrued(uint256 feeShares, uint256 newHighWaterMark);
    event Checkpointed(uint256 indexed index, uint256 pps, uint256 totalValue);

    error NotManager();
    error ZeroAmount();
    error BadAsset(address token);
    error TooManyAssets();
    error FeeTooHigh();
    error DeviationTooHigh();
    error StalePrice(address token);
    error BadPrice(address token);
    error SlippageExceeded(uint256 out, uint256 minOut);
    error InsufficientShares(uint256 shares, uint256 minShares);
    error CheckpointTooSoon();

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        AssetRegistry registry_,
        IPerfEngine engine_,
        address manager_,
        address[] memory assets_,
        uint16 perfFeeBps_
    ) ERC20(name_, symbol_) {
        if (assets_.length == 0 || assets_.length > MAX_ASSETS) revert TooManyAssets();
        if (perfFeeBps_ > MAX_PERF_FEE_BPS) revert FeeTooHigh();
        registry = registry_;
        engine = engine_;
        usdg = IERC20(registry_.usdg());
        router = ISwapRouter02(registry_.router());
        manager = manager_;
        factory = msg.sender;
        perfFeeBps = perfFeeBps_;
        for (uint256 i; i < assets_.length; ++i) {
            address t = assets_[i];
            if (!registry_.isListed(t) || isAsset[t]) revert BadAsset(t);
            isAsset[t] = true;
            _assets.push(t);
        }
    }

    // ------------------------------------------------------------------
    // Followers
    // ------------------------------------------------------------------

    /// @notice Deposit USDG for shares at current oracle NAV, net of the entry fee.
    /// @param minShares slippage guard against NAV moving between quote and inclusion
    function deposit(uint256 usdgIn, uint256 minShares, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (usdgIn == 0) revert ZeroAmount();
        uint256 value = _totalValue();
        _accrueFee(value);

        uint256 supply = totalSupply();
        uint256 entryFee = usdgIn * ENTRY_FEE_BPS / BPS;
        uint256 inValue = _usdgToWad(usdgIn - entryFee);
        // Empty vault (or one emptied by redemptions): shares start at 1.0. Any dust left behind
        // accrues to this depositor rather than diluting them.
        shares = (supply == 0 || value == 0) ? inValue : Math.mulDiv(inValue, supply, value);
        if (shares == 0 || shares < minShares) revert InsufficientShares(shares, minShares);

        usdg.safeTransferFrom(msg.sender, address(this), usdgIn - entryFee);
        if (entryFee > 0) usdg.safeTransferFrom(msg.sender, registry.feeRecipient(), entryFee);
        _mint(receiver, shares);
        emit Deposited(msg.sender, receiver, usdgIn, shares);
    }

    /// @notice Burn shares for a pro-rata slice of every holding. No oracle, no manager, no pause.
    function redeem(uint256 shares, address receiver)
        external
        nonReentrant
        returns (uint256 usdgOut, uint256[] memory assetsOut)
    {
        if (shares == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        _burn(msg.sender, shares);

        usdgOut = Math.mulDiv(usdg.balanceOf(address(this)), shares, supply);
        if (usdgOut > 0) usdg.safeTransfer(receiver, usdgOut);

        uint256 n = _assets.length;
        assetsOut = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            IERC20 t = IERC20(_assets[i]);
            uint256 amt = Math.mulDiv(t.balanceOf(address(this)), shares, supply);
            assetsOut[i] = amt;
            if (amt > 0) t.safeTransfer(receiver, amt);
        }
        emit Redeemed(msg.sender, receiver, shares);
    }

    // ------------------------------------------------------------------
    // Manager
    // ------------------------------------------------------------------

    /// @notice Swap between USDG and one of the vault's assets. The vault measures what it actually
    ///         received and reverts unless it is within `maxDevBps` of the oracle-implied amount.
    function trade(address tokenIn, address tokenOut, uint256 amountIn, uint256 maxDevBps)
        external
        onlyManager
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (maxDevBps > MAX_TRADE_DEV_BPS) revert DeviationTooHigh();

        address stock;
        bool buying = tokenIn == address(usdg);
        if (buying) {
            stock = tokenOut;
        } else {
            if (tokenOut != address(usdg)) revert BadAsset(tokenOut);
            stock = tokenIn;
        }
        if (!isAsset[stock]) revert BadAsset(stock);

        uint256 px = _price(stock);
        uint256 oracleOut = buying
            ? _wadToToken(stock, Math.mulDiv(_usdgToWad(amountIn), WAD, _pxToWad(px)))
            : _wadToUsdg(_tokenValue(stock, amountIn, px));
        uint256 minOut = oracleOut * (BPS - maxDevBps) / BPS;

        IERC20 out = IERC20(tokenOut);
        uint256 before = out.balanceOf(address(this));
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: registry.asset(stock).poolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(router), 0);

        amountOut = out.balanceOf(address(this)) - before;
        if (amountOut < minOut) revert SlippageExceeded(amountOut, minOut);
        emit Traded(tokenIn, tokenOut, amountIn, amountOut, oracleOut);
    }

    // ------------------------------------------------------------------
    // Track record
    // ------------------------------------------------------------------

    /// @notice Crystallise fees and append the net-of-fee share price to the PerfEngine.
    ///         Permissionless: anyone (followers, keepers, the manager) can stamp the tape.
    function checkpoint() external nonReentrant returns (uint256 pps) {
        if (lastCheckpoint != 0 && block.timestamp < lastCheckpoint + registry.minCheckpointInterval()) {
            revert CheckpointTooSoon();
        }
        uint256 value = _totalValue();
        _accrueFee(value);
        pps = _pps(value);
        lastCheckpoint = block.timestamp;
        uint256 index = engine.count(address(this));
        engine.record(pps);
        emit Checkpointed(index, pps, value);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Portfolio value in 1e18 USD units (USDG treated at par).
    function totalValue() external view returns (uint256) {
        return _totalValue();
    }

    /// @notice Gross price per share before any pending fee, 1e18 = 1.0.
    function pricePerShare() external view returns (uint256) {
        return _pps(_totalValue());
    }

    function assets() external view returns (address[] memory) {
        return _assets;
    }

    function holdings() external view returns (address[] memory tokens, uint256[] memory balances) {
        uint256 n = _assets.length;
        tokens = new address[](n + 1);
        balances = new uint256[](n + 1);
        tokens[0] = address(usdg);
        balances[0] = usdg.balanceOf(address(this));
        for (uint256 i; i < n; ++i) {
            tokens[i + 1] = _assets[i];
            balances[i + 1] = IERC20(_assets[i]).balanceOf(address(this));
        }
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _accrueFee(uint256 value) internal {
        uint256 supply = totalSupply();
        if (perfFeeBps == 0 || supply == 0) return;
        uint256 pps = _pps(value);
        uint256 hwm = highWaterMark;
        if (pps <= hwm) return;

        uint256 gain = Math.mulDiv(pps - hwm, supply, WAD);
        uint256 fee = gain * perfFeeBps / BPS;
        // Mint shares worth exactly `fee` after dilution: s / (supply + s) * value = fee.
        uint256 feeShares = Math.mulDiv(fee, supply, value - fee);
        if (feeShares > 0) _mint(manager, feeShares);
        uint256 newHwm = Math.mulDiv(value, WAD, supply + feeShares);
        highWaterMark = newHwm;
        emit FeeAccrued(feeShares, newHwm);
    }

    function _totalValue() internal view returns (uint256 value) {
        value = _usdgToWad(usdg.balanceOf(address(this)));
        uint256 n = _assets.length;
        for (uint256 i; i < n; ++i) {
            address t = _assets[i];
            uint256 bal = IERC20(t).balanceOf(address(this));
            if (bal == 0) continue; // an asset we hold none of needs no (possibly stale) price
            value += _tokenValue(t, bal, _price(t));
        }
    }

    function _pps(uint256 value) internal view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? WAD : Math.mulDiv(value, WAD, supply);
    }

    /// @dev Fresh, positive Chainlink answer with 8 decimals, or revert.
    function _price(address token) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(registry.feedOf(token)).latestRoundData();
        if (answer <= 0) revert BadPrice(token);
        if (updatedAt + registry.maxStaleness() < block.timestamp) revert StalePrice(token);
        return uint256(answer);
    }

    function _tokenValue(address token, uint256 amount, uint256 px8) internal view returns (uint256) {
        return Math.mulDiv(amount, _pxToWad(px8), 10 ** IERC20Metadata(token).decimals());
    }

    function _pxToWad(uint256 px8) internal pure returns (uint256) {
        return px8 * 1e10;
    }

    function _usdgToWad(uint256 amount) internal pure returns (uint256) {
        return amount * 1e12; // USDG has 6 decimals
    }

    function _wadToUsdg(uint256 wad) internal pure returns (uint256) {
        return wad / 1e12;
    }

    function _wadToToken(address token, uint256 wad) internal view returns (uint256) {
        return Math.mulDiv(wad, 10 ** IERC20Metadata(token).decimals(), WAD);
    }
}
