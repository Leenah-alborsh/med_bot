export type UploadConfig = { maxUploadBytes: number };

export function uploadTooLargeMessage(maxUploadBytes: number) {
  return `حجم الملف يتجاوز الحد المسموح: ${maxUploadBytes / 1_000_000}MB لكل ملف.`;
}
