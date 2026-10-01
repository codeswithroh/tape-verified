// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AssetRegistry} from "./AssetRegistry.sol";
import {TapeVault} from "./TapeVault.sol";
import {IPerfEngine} from "./interfaces/IPerfEngine.sol";

/// @title TapeFactory
/// @notice Launches manager vaults. Every vault starts with the manager's own USDG in it
///         (skin in the game) and its track record begins at the first checkpoint.
///         The factory's vault list is the canonical leaderboard universe.
contract TapeFactory {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_SEED = 10e6; // 10 USDG

    AssetRegistry public immutable registry;
    IPerfEngine public immutable engine;

    address[] internal _vaults;
    mapping(address vault => bool) public isVault;
    mapping(address manager => address[]) internal _byManager;

    event VaultCreated(address indexed vault, address indexed manager, string name, uint16 perfFeeBps, uint256 seed);

    error SeedTooSmall();

    constructor(AssetRegistry registry_, IPerfEngine engine_) {
        registry = registry_;
        engine = engine_;
    }

    function createVault(
        string calldata name,
        string calldata symbol,
        address[] calldata assets,
        uint16 perfFeeBps,
        uint256 seed
    ) external returns (TapeVault vault) {
        if (seed < MIN_SEED) revert SeedTooSmall();
        vault = new TapeVault(name, symbol, registry, engine, msg.sender, assets, perfFeeBps);
        _vaults.push(address(vault));
        isVault[address(vault)] = true;
        _byManager[msg.sender].push(address(vault));

        IERC20 usdg = IERC20(registry.usdg());
        usdg.safeTransferFrom(msg.sender, address(this), seed);
        usdg.forceApprove(address(vault), seed);
        vault.deposit(seed, 1, msg.sender);
        vault.checkpoint(); // genesis entry on the tape
        emit VaultCreated(address(vault), msg.sender, name, perfFeeBps, seed);
    }

    function vaults() external view returns (address[] memory) {
        return _vaults;
    }

    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    function vaultsOf(address manager) external view returns (address[] memory) {
        return _byManager[manager];
    }
}
