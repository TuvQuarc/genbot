# Bot Template Generator

A Deno-based tool for the automated generation of Python Telegram bot project structures. The generator produces a ready-to-use project utilizing the `aiogram` library and the `uv` dependency manager.

## Key Features

* Automated generation of the complete project file structure.
* Handler creation based on a user-provided list of commands.
* Docker and Docker Compose configuration setup.
* Automatic bot name validation according to Telegram requirements.
* Delivery of the generated project as a ZIP archive via the Telegram interface.

## Generator Technology Stack

* **Runtime**: Deno 2.x
* **Language**: TypeScript
* **Libraries**: JSZip (for archive creation), Deno Standard Library

## Generated Project Structure

The generator creates a project with the following architecture:
* `src/app/main.py` — Application entry point.
* `src/app/handlers.py` — Bot command logic.
* `pyproject.toml` — Configuration for the `uv` manager.
* `Dockerfile` / `docker-compose.yml` — Containerization environment.
* `.env` — File for storing tokens and secrets.

## Requirements

1. Deno installed (version 2.0 or higher).
2. A Telegram bot token obtained from @BotFather.

## Setup and Execution

### 1. Environment Preparation

Create a `.env` file in the root directory of the project:
```text
BOT_TOKEN=your_bot_token
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_SECRET=your_secret_token
PORT=8000
```

> **Important**: For the bot to function, the `WEBHOOK_URL` must be publicly accessible over **HTTPS** with a valid SSL certificate. Telegram will not send updates to `http` or `localhost` addresses.

### 2. Running via Deno
To start in development mode with hot-reload:
```bash
deno task dev
```

For standard production execution:
```bash
deno task start
```

### 3. Local Development
If you are developing locally, you must use a tunneling service (such as **ngrok** or **Cloudflare Tunnel**) to expose your local port (default: 8000) to the internet. 

Example using ngrok:
```bash
ngrok http 8000
```
After running this, update your `WEBHOOK_URL` in the `.env` file with the provided HTTPS forwarding address (e.g., `https://random-id.ngrok-free.app/webhook`).

### 4. Deployment
The application uses Webhooks to interact with the Telegram API. Ensure that the `WEBHOOK_URL` is accessible externally via HTTPS.

## Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| BOT_TOKEN | Telegram API access token. | Yes |
| WEBHOOK_URL | Full URL for receiving updates. | No (Recommended) |
| WEBHOOK_SECRET | Secret token for request validation. | No |
| PORT | Port on which the HTTP server will run. | No (Default: 8000) |

## License

This project is intended for free use and the automation of development processes.
