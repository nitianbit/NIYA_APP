import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';

export type Ecard = { id: string; title: string; source: 'link' | 'file'; url: string | null;
  contentType: string | null; extension: string | null; updatedAt: string };
let generation = 0;
let pending: Promise<unknown> = Promise.resolve();
const directory = 'niya-ecards';
function serial<T>(work: () => Promise<T>): Promise<T> {
  const task = pending.then(work, work); pending = task; return task;
}
async function removeCache() {
  const root = await Filesystem.readdir({ path: '', directory: Directory.Cache });
  if (root.files.some(file => file.name === directory)) await Filesystem.rmdir({ path: directory, directory: Directory.Cache, recursive: true });
}
export const ecardGeneration = () => generation;
export function clearEcardCache(): Promise<void> {
  generation++;
  return Capacitor.isNativePlatform() ? serial(removeCache) : Promise.resolve();
}
export function validEcardLink(value: string | null): boolean {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export async function openEcardFile(blob: Blob, version: number, isCurrent: () => boolean) {
  const extension = ({ 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' } as Record<string, string>)[blob.type];
  if (!extension || !blob.size || blob.size > 5 * 1024 * 1024) throw new Error('This e-card is not a supported PDF or image. Contact support.');
  const current = () => version === generation && isCurrent();
  if (!current()) return;
  if (Capacitor.isNativePlatform()) {
    const uri = await serial(async () => {
      if (!current()) return null;
      await removeCache();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not prepare this e-card. Try again.')); reader.readAsDataURL(blob);
      });
      if (!current()) return null;
      const result = await Filesystem.writeFile({ path: `${directory}/${crypto.randomUUID()}${extension}`,
        directory: Directory.Cache, data, recursive: true });
      if (!current()) { await removeCache(); return null; }
      return result.uri;
    });
    if (uri && current()) await FileViewer.openDocumentFromLocalPath({ path: uri });
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `niya-ecard${extension}`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
