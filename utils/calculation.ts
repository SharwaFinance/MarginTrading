
/**
 * Calculates the margin ratio for a margin account and returns it with 7 decimal places.
 *
 * @param accountValue - The total value of the account with 6 decimals.
 * @param wethDebt - The debt in USDC with accrued interest for the WETH pool with 18 decimals (negative value).
 * @param wethPrice - The price of WETH as a string.
 * @param wbtcDebt - The debt in USDC with accrued interest for the WBTC pool with 8 decimals (negative value).
 * @param wbtcPrice - The price of WBTC as a string.
 * @param usdcDebt - The debt in USDC with accrued interest for the USDC pool with 6 decimals (negative value).
 * @param usdcPrice - The price of USDC as a string.
 * @returns The calculated margin ratio as a BigInt with 5 decimals.
 */

function calculateMarginRatio(
  accountValue: bigint,
  wethDebt: bigint,
  wethPrice: string,
  wbtcDebt: bigint,
  wbtcPrice: string,
  usdcDebt: bigint,
  usdcPrice: string
): bigint {
  const WETH_DECIMALS = 18n;
  const WBTC_DECIMALS = 8n;
  const USDC_DECIMALS = 6n;
  const ACCOUNT_DECIMALS = 6n;
  const TARGET_DECIMALS = 5n; 
  const PRICE_DECIMALS = 8n;

  const wethPriceBigInt = BigInt(Math.round(parseFloat(wethPrice) * 10 ** Number(PRICE_DECIMALS)));
  const wbtcPriceBigInt = BigInt(Math.round(parseFloat(wbtcPrice) * 10 ** Number(PRICE_DECIMALS)));
  const usdcPriceBigInt = BigInt(Math.round(parseFloat(usdcPrice) * 10 ** Number(PRICE_DECIMALS)));

  const wethDebtNormalized = abs(wethDebt) * (10n ** ACCOUNT_DECIMALS) / (10n ** WETH_DECIMALS);
  const wbtcDebtNormalized = abs(wbtcDebt) * (10n ** ACCOUNT_DECIMALS) / (10n ** WBTC_DECIMALS);
  const usdcDebtNormalized = abs(usdcDebt); 

  const totalDebt = (wethDebtNormalized * wethPriceBigInt) + (wbtcDebtNormalized * wbtcPriceBigInt) + (usdcDebtNormalized * usdcPriceBigInt);

  if (totalDebt === 0n) {
    throw new Error("Total debt is zero, cannot calculate margin ratio.");
  }

  const marginRatio = (accountValue * (10n ** TARGET_DECIMALS) * (10n ** PRICE_DECIMALS)) / totalDebt;

  return marginRatio;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}





export { calculateMarginRatio,calculateDiscreteCompounding };