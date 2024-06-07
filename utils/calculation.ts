/**
 * Calculates the margin ratio for a margin account and returns it with 8 decimal places.
 *
 * @param accountValue - The total value of the account with 6 decimals.
 * @param wethDebt - The debt in USDC with accrued interest for the WETH pool with 18 decimals (negative value).
 * @param wethPrice - The price of WETH as a BigInt.
 * @param wbtcDebt - The debt in USDC with accrued interest for the WBTC pool with 8 decimals (negative value).
 * @param wbtcPrice - The price of WBTC as a BigInt.
 * @param usdcDebt - The debt in USDC with accrued interest for the USDC pool with 6 decimals (negative value).
 * @param usdcPrice - The price of USDC as a BigInt.
 * @returns The calculated margin ratio as a BigInt with 8 decimals.
 */

function calculateMarginRatio(
  accountValue: bigint,
  wethDebt: bigint,
  wethPrice: bigint,
  wbtcDebt: bigint,
  wbtcPrice: bigint,
  usdcDebt: bigint,
  usdcPrice: bigint
): bigint {
  const WETH_DECIMALS = 18n;
  const WBTC_DECIMALS = 8n;
  const USDC_DECIMALS = 6n;
  const ACCOUNT_DECIMALS = 6n;
  const TARGET_DECIMALS = 5n; 
  const PRICE_DECIMALS = 8n;

  const wethDebtNormalized = abs(wethDebt) * (10n ** ACCOUNT_DECIMALS) / (10n ** WETH_DECIMALS);
  const wbtcDebtNormalized = abs(wbtcDebt) * (10n ** ACCOUNT_DECIMALS) / (10n ** WBTC_DECIMALS);
  const usdcDebtNormalized = abs(usdcDebt);

  const totalDebt = ((wethDebt * wethPrice)/BigInt(1e18)) + ((wbtcDebt * wbtcPrice)/BigInt(1e8)) + (usdcDebt);

  if (totalDebt === 0n) {
    throw new Error("Total debt is zero, cannot calculate margin ratio.");
  }

  const marginRatio = (accountValue * (10n ** TARGET_DECIMALS) * (10n ** PRICE_DECIMALS)) / totalDebt;

  return marginRatio / (10n ** PRICE_DECIMALS); 
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export { calculateMarginRatio };