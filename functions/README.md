# AI proxy

`aiProxy` is a callable Firebase Function used by the web app to call an
OpenAI-compatible Chat Completions API without exposing the AI API key in the
browser.

Required secret:

```powershell
firebase functions:secrets:set AI_API_KEY --project dev
firebase functions:secrets:set AI_API_KEY --project prod
```

Optional runtime environment variables:

```text
AI_BASE_URL=https://nano-gpt.com/api/v1
AI_MODEL=deepseek/deepseek-latest
```

If the optional variables are not set, the function defaults to:

- `AI_BASE_URL=https://nano-gpt.com/api/v1`
- `AI_MODEL=deepseek/deepseek-latest`

Do not create `VITE_` variables for AI secrets. Anything prefixed with `VITE_`
is bundled into the front-end.

Install dependencies from inside the `functions` directory:

```powershell
cd functions
npm.cmd install
cd ..
```

Do not use `npm.cmd --prefix functions install` in this workspace if it
reintroduces `joao-diet-training-app` as `file:..`; that couples Functions to
the React/Vite app and can break Firebase Functions discovery.

Deploy Functions without `NODE_OPTIONS` or `tools/firebase-gaxios-token-patch.cjs`.
That patch is only for legacy Firebase CLI hosting auth flows and interferes
with the local HTTP discovery used by Functions.
