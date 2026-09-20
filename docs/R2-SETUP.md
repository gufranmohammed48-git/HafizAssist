# R2 model hosting

V22 is configured for the existing bucket `hafizassist-model` through the new custom domain (activation in Cloudflare is still required) `model.recitealquran.com`. The application downloads `https://model.recitealquran.com/zipformer_p_arabic_v3.int8.onnx`. This assumes the INT8 file is uploaded at the bucket root with that exact filename; object availability and browser downloads have not been tested. The CORS policy in docs/r2-cors.json is prepared for https://recitealquran.com and http://localhost:5173; it still needs to be saved in the R2 bucket settings. No Cloudflare account credentials are needed in the browser or this repository. Keep the Public Development URL disabled; the custom domain is the public download endpoint, not the S3 API address.

1. In Cloudflare, enable R2 and create a dedicated **Standard** bucket, for example `hafizassist-models`. Review the billing terms shown by Cloudflare.
2. Upload `zipformer_p_arabic_v3.int8.onnx` from Downloads. The file must be **72,705,392 bytes**. Set its content type to `application/octet-stream` if prompted. Keep the filename intact. Do not upload the full-size ONNX file. `tokens.txt` and all other runtime assets are already in the Pages build.
3. Under bucket **Settings → Custom Domains**, connect a hostname you control, for example `models.example.com`, for production public access. For initial development only, you can enable the public `r2.dev` URL; Cloudflare rate-limits it and does not recommend it for production. Do not use the private S3 API endpoint or an expiring signed URL.
4. Under **Settings → CORS Policy**, paste the contents of `r2-cors.json`. The template already includes `https://recitealquran.com` and `http://localhost:5173`. Origins contain the scheme and hostname, with no path or trailing slash. Add specific preview origins if you intend to use them. Public access and CORS are separate settings; both are needed. If the custom-domain object was previously cached without CORS, purge that object's Cloudflare cache after updating the policy.
5. The configured public object URL is `https://model.recitealquran.com/zipformer_p_arabic_v3.int8.onnx`.
6. The public model URL is already in `public/model-config.json`, so no environment variable is required. If you previously set **MODEL_URL** in your Pages build settings, remove it to use this file or set it to the same public URL; the environment variable overrides the file (even an empty value). Redeploy using `node scripts/build.mjs`, output `dist`.
7. After the new deployment installs, close all app tabs and reopen until **V22** appears. Press **Start reciting** to download/cache the model. Wait for **Ready offline** before disconnecting.

Alternatively, set `modelUrl` in `public/model-config.json` and commit that public URL; this also works with the local development server. `MODEL_URL` overrides this file at build time. Changing the environment alone does not modify an already deployed site: redeploy it.

The loader uses the cached model first. If absent, it downloads the configured URL with a CORS GET request and without cookies/credentials, checks its expected byte size, and stores it under the existing local model cache key. Localhost and the public site have separate browser storage, so the first visit to the public site needs its own download. The file picker remains available if the download fails. Audio is never uploaded to R2. Browser storage eviction or clearing site data requires another download.

The build adds a configuration hash to its internal offline cache name so a changed MODEL_URL is included in a new cache. The visible app version still identifies the source-code release. Hosting changes do not replace an already cached model with different weights; this integration is for the same INT8 v3 file.

Reference: [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/), [pricing](https://developers.cloudflare.com/r2/pricing/). Retain the model's applicable license and attribution when distributing it; see `licenses/NOTICE.md`.


## Moving the existing bucket to model.recitealquran.com (V22)

Keep the existing bucket and its model object; no new bucket or model upload is needed. With recitealquran.com active in the same Cloudflare account, open R2 > hafizassist-model > Settings > Custom Domains > Add and connect model.recitealquran.com. Wait for Active before deploying V22.

Save docs/r2-cors.json in the bucket's CORS settings. It permits recitealquran.com, www.recitealquran.com, and localhost; the old website origin is retained for the transition and can be removed after retirement. Purge the model hostname's cache if previously cached responses lack the updated CORS headers.

Remove the old MODEL_URL build variable, or set it to https://model.recitealquran.com/zipformer_p_arabic_v3.int8.onnx. It overrides the repository configuration. Push/deploy V22 only after the new hostname is ready. Confirm the new model download from the new website before disconnecting the old R2 hostname and retiring the old domain. Cloudflare settings have not been changed by these local edits.

The website domain and the R2 custom domain are separate: attach recitealquran.com to the existing Worker and model.recitealquran.com to R2. Existing cached weights remain usable on the same website origin. A new website origin has separate browser storage and downloads its own copy.
