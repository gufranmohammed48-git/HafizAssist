# Deploying HafizAssist

## Cloudflare Workers Builds (the deployment flow in the reported error)

This is a static website, supported by Workers Static Assets without a server-side Worker script. The root `wrangler.jsonc` explicitly sets `assets.directory` to `./dist`.

In the connected Cloudflare project's build settings use:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave default) |
| Build command | `node scripts/build.mjs` |
| Deploy command | `npx wrangler deploy --assets=./dist` |

The configuration's Worker name is `myproject`, matching the connected Worker for recitealquran.com. Observability is enabled in the configuration to preserve the requested logging setting on deployment. The custom website domain and R2 bucket name are not necessarily the Worker name. Builds for the retired `hafizassist` Worker should be disconnected when it is no longer used.

Replace any existing deploy command that uses `--assets .`, `--assets=.` or the repository root. Command-line flags override the file configuration. Keep the root directory at the repository root: the build script runs there and generates `dist`; only the assets directory should point to `dist`.

Push these changes and retry the deployment. The displayed application version for this change is **V4**. No deploy command has been run by the agent.

### Why the previous deployment failed

The log reported assets directory `/opt/buildhome/repo`, so Wrangler attempted to upload the complete checkout, including `node_modules/workerd/bin/workerd` (127 MiB). That binary belongs to the deployment tooling and must not be a website asset. The site's build copies only `public`, browser source files, the HTML entry point, and license files into `dist`. It excludes model weights. The inference model is downloaded separately from the configured R2 custom domain.

## Cloudflare Pages (alternative deployment flow)

Use framework **None**, build command `node scripts/build.mjs`, and build output directory `dist`. Pages Git integration does not need a Wrangler deploy command. Do not switch products merely to fix the reported directory error; the settings above support the existing Workers flow.

## Model

The configured model URL remains `https://model.recitealquran.com/zipformer_p_arabic_v3.int8.onnx`. The R2 bucket must contain that object, with CORS allowing `https://recitealquran.com`. See `R2-SETUP.md`. A build-time `MODEL_URL` variable overrides the committed model configuration; remove an obsolete override.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

