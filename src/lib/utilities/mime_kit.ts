export const IMAGE_PNG = 'image/png';
export const IMAGE_JPEG = 'image/jpeg';
export const IMAGE_GIF = 'image/gif';
export const IMAGE_WEBP = 'image/webp';
export const SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = [
  IMAGE_PNG,
  IMAGE_JPEG,
  IMAGE_GIF,
  IMAGE_WEBP,
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const GIF_SIGNATURES = ['GIF87a', 'GIF89a'];

export function resolveFormat(data: Uint8Array): string | undefined {
  const bytes = Buffer.from(data);
  if (
    bytes.subarray(0, 8).equals(PNG_SIGNATURE) &&
    bytes.length >= 24 &&
    bytes.toString('ascii', 12, 16) === 'IHDR'
  )
    return IMAGE_PNG;
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return IMAGE_JPEG;
  if (
    bytes.length >= 13 &&
    GIF_SIGNATURES.includes(bytes.toString('ascii', 0, 6))
  )
    return IMAGE_GIF;
  if (
    bytes.length >= 16 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return IMAGE_WEBP;
  return undefined;
}
