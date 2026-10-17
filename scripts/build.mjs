import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
const modelConfig = JSON.parse(await readFile(resolve(root, 'public/model-config.json'), 'utf8'));
const configuredUrl = (process.env.MODEL_URL ?? modelConfig.modelUrl ?? '').trim();
if (configuredUrl) {
  const parsed = new URL(configuredUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('MODEL_URL must be a public HTTPS model URL without credentials.');
}
const configText = JSON.stringify({ modelUrl: configuredUrl }, null, 2) + '\n';
await mkdir(out, { recursive: true });
await cp(resolve(root, 'public'), out, { recursive: true, filter: (path) => !path.endsWith('.onnx') });
await cp(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
await cp(resolve(root, 'index.html'), resolve(out, 'index.html'));
await cp(resolve(root, 'mobile.html'), resolve(out, 'mobile.html'));
// Keep the version in local previews and the offline cache identifier. The
// production reading entries reserve that corner for the account control.
for (const page of ['index.html', 'mobile.html']) {
  const html = await readFile(resolve(out, page), 'utf8');
  await writeFile(resolve(out, page), html.replace('<html ', '<html data-release="production" '));
}
await cp(resolve(root, 'test.html'), resolve(out, 'test.html'));
await cp(resolve(root, 'test2.html'), resolve(out, 'test2.html'));
await mkdir(resolve(out, 'docs'), { recursive: true });
await cp(resolve(root, 'docs/TEACHER-MODE.md'), resolve(out, 'docs/TEACHER-MODE.md'));
await cp(resolve(root, 'docs/QUA-TEACHER-PREVIEW.md'), resolve(out, 'docs/QUA-TEACHER-PREVIEW.md'));
await cp(resolve(root, 'docs/TAJWEED-COLOURS.md'), resolve(out, 'docs/TAJWEED-COLOURS.md'));
await cp(resolve(root, 'docs/TAJWEED-PREVIEW-TESTING.md'), resolve(out, 'docs/TAJWEED-PREVIEW-TESTING.md'));
await cp(resolve(root, 'docs/teacher-mode-preview.html'), resolve(out, 'docs/teacher-mode-preview.html'));
await cp(resolve(root, 'licenses'), resolve(out, 'licenses'), { recursive: true });
await writeFile(resolve(out, 'model-config.json'), configText);
// A changed deployment URL also needs a distinct, atomic offline cache, even
// when the source-code version remains unchanged.
const configId = createHash('sha256').update(configText).digest('hex').slice(0, 12);
const sw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
await writeFile(resolve(out, 'sw.js'), sw.replace(/const VERSION = '(V\d+)';/, (_, version) => `const VERSION = '${version}-${configId}';`));
console.log(configuredUrl ? 'Static site written to dist/ with automatic model downloads configured.' : 'Static site written to dist/. Set MODEL_URL for automatic downloads; otherwise users can select a model file.');
