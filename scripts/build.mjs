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
await cp(resolve(root, 'licenses'), resolve(out, 'licenses'), { recursive: true });
await writeFile(resolve(out, 'model-config.json'), configText);
// A changed deployment URL also needs a distinct, atomic offline cache, even
// when the source-code version remains unchanged.
const configId = createHash('sha256').update(configText).digest('hex').slice(0, 12);
const sw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
await writeFile(resolve(out, 'sw.js'), sw.replace(/const VERSION = '(V\d+)';/, (_, version) => `const VERSION = '${version}-${configId}';`));
console.log(configuredUrl ? 'Static site written to dist/ with automatic model downloads configured.' : 'Static site written to dist/. Set MODEL_URL for automatic downloads; otherwise users can select a model file.');
