pragma solidity 0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IPositionsManager is IERC721 {
    function nextTokenId() external view returns (uint256);
    function createOptionFor(address holder) external returns (uint256 id);
}