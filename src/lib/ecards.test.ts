import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ value: false }));
const files = vi.hoisted(() => ({ readdir: vi.fn(), rmdir: vi.fn(), writeFile: vi.fn() }));
const viewer = vi.hoisted(() => ({ openDocumentFromLocalPath: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: files }));
vi.mock('@capacitor/file-viewer', () => ({ FileViewer: viewer }));
import { clearEcardCache, ecardGeneration, openEcardFile, validEcardLink } from './ecards';

beforeEach(async () => {
  native.value = false; await clearEcardCache(); vi.clearAllMocks();
  files.readdir.mockResolvedValue({ files: [] }); files.rmdir.mockResolvedValue(undefined);
  files.writeFile.mockResolvedValue({ uri: 'file:///private/cache/niya-ecards/card.pdf' });
  viewer.openDocumentFromLocalPath.mockResolvedValue(undefined);
});
describe('private e-card files', () => {
  it('opens a native file from private cache without a token or URL', async () => {
    native.value = true;
    await openEcardFile(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), ecardGeneration(), () => true);
    expect(files.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE', recursive: true, data: 'JVBERi0xLjQ=' }));
    expect(viewer.openDocumentFromLocalPath).toHaveBeenCalledWith({ path: 'file:///private/cache/niya-ecards/card.pdf' });
  });
  it('invalidates an in-flight file before sign-out cleanup', async () => {
    native.value = true;
    let release!: (result: { uri: string }) => void;
    files.writeFile.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const opening = openEcardFile(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), ecardGeneration(), () => true);
    await vi.waitFor(() => expect(files.writeFile).toHaveBeenCalled());
    const cleaning = clearEcardCache(); release({ uri: 'file:///private/old.pdf' });
    await Promise.all([opening, cleaning]); expect(viewer.openDocumentFromLocalPath).not.toHaveBeenCalled();
  });
  it('does not open files after navigation or a session change', async () => {
    native.value = true; const version = ecardGeneration(); await clearEcardCache();
    await openEcardFile(new Blob(['file'], { type: 'application/pdf' }), version, () => true);
    await openEcardFile(new Blob(['file'], { type: 'application/pdf' }), ecardGeneration(), () => false);
    expect(files.writeFile).not.toHaveBeenCalled();
  });
  it('clears only the e-card cache, and surfaces failed storage cleanup', async () => {
    native.value = true; files.readdir.mockResolvedValue({ files: [{ name: 'niya-ecards' }, { name: 'another-plugin' }] });
    await clearEcardCache(); expect(files.rmdir).toHaveBeenCalledWith({ path: 'niya-ecards', directory: 'CACHE', recursive: true });
    files.rmdir.mockRejectedValueOnce(new Error('denied')); await expect(clearEcardCache()).rejects.toThrow('denied');
  });
  it('refuses unsafe formats and links', async () => {
    await expect(openEcardFile(new Blob(['<script>'], { type: 'text/html' }), ecardGeneration(), () => true)).rejects.toThrow('not a supported');
    expect(validEcardLink('javascript:alert(1)')).toBe(false); expect(validEcardLink('https://user:pass@example.com')).toBe(false);
    expect(validEcardLink('https://example.com/card')).toBe(true);
  });
});
