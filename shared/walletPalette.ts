export type WalletRgb = [number, number, number];
const css = (rgb: WalletRgb) => `rgb(${rgb.join(', ')})`;
export function walletPalette(accent: WalletRgb) {
  const mix = (amount: number) => accent.map(channel => Math.round(channel * amount + 255 * (1 - amount))) as WalletRgb;
  const body = mix(.10);
  const strip = mix(.24);
  return { body, strip, backgroundColor: css(body), stripColor: css(strip), foregroundColor: 'rgb(28, 30, 29)', labelColor: 'rgb(69, 77, 71)' };
}
export function walletPaletteFromHex(hex: string) {
  return walletPalette([1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as WalletRgb);
}
