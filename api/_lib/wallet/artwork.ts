import { getBinding } from '../runtime.js';
import { HttpError } from '../http.js';

export type WalletArtworkRefs = { logo?: string; strip: string };
export function validateWalletArtwork(value: unknown, owner: string): WalletArtworkRefs | undefined {
  if (value === undefined) return undefined;
  const input = value as WalletArtworkRefs;
  const valid = (path: unknown) => typeof path === 'string' && path.startsWith(`/media/files/${owner}/`) && /^\/media\/files\/[a-zA-Z0-9-]{1,64}\/[a-f0-9]{64}\.png$/.test(path);
  if (!input || !valid(input.strip) || (input.logo !== undefined && !valid(input.logo))) throw new HttpError(400, 'تصميم البطاقة غير صالح.');
  return { strip: input.strip, ...(input.logo ? { logo: input.logo } : {}) };
}
export async function readWalletArtwork(refs?: WalletArtworkRefs) {
  if (!refs) return undefined;
  const media = getBinding<{ get(key: string): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> } | null> }>('MEDIA');
  if (!media) throw new HttpError(503, 'تعذر قراءة تصميم البطاقة.');
  async function read(path: string, width: number, height: number) {
    const object = await media.get(path.slice('/media/'.length));
    if (!object || object.size > 1_000_000) throw new HttpError(409, 'أعد تجهيز تصميم البطاقة.');
    const bytes = new Uint8Array(await object.arrayBuffer());
    const view = new DataView(bytes.buffer);
    if (bytes.length < 24 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(16) !== width || view.getUint32(20) !== height) throw new HttpError(400, 'مقاسات تصميم البطاقة غير صالحة.');
    return bytes;
  }
  return { strip: await read(refs.strip, 1125, 369), logo: refs.logo ? await read(refs.logo, 480, 150) : undefined };
}
