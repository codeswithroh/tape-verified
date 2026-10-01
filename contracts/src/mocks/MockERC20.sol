// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet stand-in for USDG (6 dp) with a capped public faucet, plus minters (the mock router).
contract MockERC20 is ERC20, Ownable {
    uint8 internal immutable _dec;
    uint256 public immutable faucetAmount;
    mapping(address => bool) public isMinter;

    error NotMinter();

    constructor(string memory n, string memory s, uint8 d, uint256 faucetAmount_, address owner_)
        ERC20(n, s)
        Ownable(owner_)
    {
        _dec = d;
        faucetAmount = faucetAmount_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function setMinter(address m, bool on) external onlyOwner {
        isMinter[m] = on;
    }

    function mint(address to, uint256 amount) external {
        if (!isMinter[msg.sender] && msg.sender != owner()) revert NotMinter();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (!isMinter[msg.sender]) revert NotMinter();
        _burn(from, amount);
    }

    /// @notice Anyone can drip test funds.
    function faucet() external {
        _mint(msg.sender, faucetAmount);
    }
}
