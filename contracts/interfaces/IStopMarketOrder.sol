pragma solidity 0.8.20;

interface IStopMarketOrder {

    // ONLY MANAGER_ROLE FUNCTIONS //

    function setMaximumActiveOrders(uint newMaximumActiveOrders) external;

    function setMaximumMarginAccountOrders(uint newMaximumMarginAccountOrders) external;

    // EXTERNAL FUNCTIONS //

    function addOrder(
        uint marginAccountID,
        address addressTokenIn,
        uint amountTokenIn,
        address addressTokenOut,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 typeConditions,
        uint8 useBorrow,
        uint8 autoRepay
    ) external;

    function editOrder(
        uint idOrder,
        uint amountTokenIn,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 useBorrow,
        uint8 autoRepay
    ) external;

    function executeOrder(uint activeOrderId) external;

    function deleteOrder(uint activeOrderId) external;

    function getAllOrdersLength() external view returns (uint);

    function getActiveIdOrdersLength() external view returns (uint);

    function getUserOrdersLength(uint marginAccountID) external view returns (uint);

    // PUBLIC FUNCTIONS //

    function availableBorrow(uint marginAccountID, address addressTokenIn, uint amountTokenIn) external returns (uint);

    function availableOrderForExecution(uint idOrder) external returns (uint);

    // EVENTS //

    /**
     * @notice Emitted adding a new order.
     * @param marginAccountID The ID of the margin account.
     * @param addressTokenIn The address of the input token.
     * @param amountTokenIn The amount of input tokens to swap.
     * @param addressTokenOut The address of the output token.
     * @param amountTokenOutMinimum The minimum amount of output tokens expected.
     * @param targetPrice The target order execution price.
     * @param typeConditions The conditions for execution of the order at the target price.
     * @param autoRepay The auto-refund of borrowing tokens in the presence of debt in addressTokenOut ERC20.
     */
    event AddNewOrder(
        uint indexed marginAccountID,
        address indexed addressTokenIn,
        uint amountTokenIn,
        address indexed addressTokenOut,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 typeConditions,
        uint8 autoRepay
    );

    /**
     * @notice Generated when the active order is edited.
     * @param marginAccountID The ID of the margin account.
     * @param addressTokenIn The address of the input token.
     * @param amountTokenIn The amount of input tokens to swap.
     * @param addressTokenOut The address of the output token.
     * @param amountTokenOutMinimum The minimum amount of output tokens expected.
     * @param targetPrice The target order execution price.
     * @param typeConditions The conditions for execution of the order at the target price.
     * @param autoRepay The auto-refund of borrowing tokens in the presence of debt in addressTokenOut ERC20.
     */
    event EditActiveOrder(
        uint indexed marginAccountID,
        address indexed addressTokenIn,
        uint amountTokenIn,
        address indexed addressTokenOut,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 typeConditions,
        uint8 autoRepay
    );

    /**
     * @notice Generated when executing an active order.
     * @param marginAccountID The ID of the margin account.
     * @param addressTokenIn The address of the input token.
     * @param amountTokenIn The amount of input tokens to swap.
     * @param addressTokenOut The address of the output token.
     * @param amountTokenOutMinimum The minimum amount of output tokens expected.
     * @param targetPrice The target order execution price.
     * @param typeConditions The conditions for execution of the order at the target price.
     * @param autoRepay The auto-refund of borrowing tokens in the presence of debt in addressTokenOut ERC20.
     */
    event ExecutActiveOrder(
        uint indexed marginAccountID,
        address indexed addressTokenIn,
        uint amountTokenIn,
        address indexed addressTokenOut,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 typeConditions,
        uint8 autoRepay
    );

    /**
     * @notice Generated when an active order is deleted.
     * @param marginAccountID The ID of the margin account.
     * @param addressTokenIn The address of the input token.
     * @param amountTokenIn The amount of input tokens to swap.
     * @param addressTokenOut The address of the output token.
     * @param amountTokenOutMinimum The minimum amount of output tokens expected.
     * @param targetPrice The target order execution price.
     * @param typeConditions The conditions for execution of the order at the target price.
     * @param autoRepay The auto-refund of borrowing tokens in the presence of debt in addressTokenOut ERC20.
     */
    event DeleteActiveOrder(
        uint indexed marginAccountID,
        address indexed addressTokenIn,
        uint amountTokenIn,
        address indexed addressTokenOut,
        uint amountTokenOutMinimum,
        int256 targetPrice,
        uint8 typeConditions,
        uint8 autoRepay
    );
}