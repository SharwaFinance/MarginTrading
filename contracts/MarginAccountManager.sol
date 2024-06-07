pragma solidity 0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IMarginAccountManager} from "./interfaces/IMarginAccountManager.sol";

/**
 * @title MarginAccountManager
 * @dev This contract manages margin accounts represented as ERC721 tokens.
 * @notice Users can create margin accounts using the `createMarginAccount` function.
 * @author 0nika0
 */
contract MarginAccountManager is IMarginAccountManager, ERC721("MarginAccountToken", "MAT") {
    uint public nextTokenID = 0;

    function createMarginAccount() external returns (uint marginAccountID) {
        marginAccountID = nextTokenID;
        _safeMint(msg.sender, marginAccountID);
        nextTokenID++;

        emit CreateMarginAccount(marginAccountID);
    }

    function isApprovedOrOwner(address spender, uint tokenID)
        external
        view
        returns (bool)
    {
        return _isApprovedOrOwner(spender, tokenID);
    }
}
