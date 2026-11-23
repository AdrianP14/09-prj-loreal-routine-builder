# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Run locally

Open the project in a Codespace or VS Code, then start a local server:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`.

## Connect the Cloudflare Worker

The `workerUrl` value in `script.js` is configured to use the class Cloudflare Worker:
`https://wanderbot-worker.adrianp14business.workers.dev`

The frontend sends the conversation as a `messages` array in a `POST` request. Do not put an API key in `script.js` or any other frontend file.

## Enable live web search

The optional web-search feature runs in `worker.js`, not in the browser. It uses OpenAI's Responses API with the `web_search` tool and returns source links that the chat displays.

To enable it on Cloudflare:

1. If your current Worker is dedicated to this app, back up its code first. If another app uses it, create a separate Worker so you don't break that app.
2. In the Cloudflare dashboard, open the dedicated Worker and paste in `worker.js`.
3. In the Worker's **Settings → Variables and Secrets**, add an encrypted secret named `OPENAI_API_KEY` if one is not already configured. Never put the key in this repository or send it in chat.
4. In `worker.js`, add your deployed app's exact origin to `allowedOrigins`. The local origins for this project are already listed.
5. Deploy the Worker. If you created a separate Worker, update `workerUrl` in `script.js` to its URL.
6. Test a current-products question in the app. Web search may incur OpenAI API charges.

The Worker uses the Responses API and the `gpt-6.2-astra` model with `web_search`, following the [OpenAI web search documentation](https://developers.openai.com/api/docs/guides/tools-web-search).