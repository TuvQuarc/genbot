import JSZip from "jszip";

// ==========================================
// Configuration
// ==========================================

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || ""; // Secret token for webhook validation
const PORT = 8000;

// ==========================================
// Templates for static files
// ==========================================

const GITIGNORE_TEMPLATE = `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDEs
.idea/
.vscode/
`;

const ENV_TEMPLATE = `# Replace with your actual bot token from @BotFather
BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ
`;

const DOCKERFILE_TEMPLATE = `# Use official Python image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    UV_SYSTEM_PYTHON=1

# Install uv package manager
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies using uv
RUN uv sync --no-dev

# Copy the rest of the application
COPY . .

# Command to run the bot
CMD ["uv", "run", "python", "-m", "src.app.main"]
`;

const DOCKER_COMPOSE_TEMPLATE = `services:
  bot:
    build: .
    restart: unless-stopped
    env_file:
      - .env
`;

const PYPROJECT_TEMPLATE = `[project]
name = "{project_name}"
version = "0.1.0"
description = "Telegram bot managed by uv"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "aiogram>=3.4.0",
]

[tool.uv]
dev-dependencies = [
    "ruff>=0.3.0",
    "mypy>=1.9.0",
]
`;

const README_TEMPLATE = `# {project_name}

This is a Telegram bot project generated automatically. It uses \`aiogram\` and is managed by \`uv\`.

## Developer Notice
**Please edit this README** before publishing or sharing your project. Remove these initialization instructions and describe what your bot actually does.

## Initial Setup

1. **Initialize Git repository:**
   \`\`\`bash
   git init
   \`\`\`

2. **Initialize uv (if not already initialized) and install dependencies:**
   \`\`\`bash
   uv sync
   \`\`\`

3. **Set up your environment:**
   - Open the \`.env\` file.
   - Replace the placeholder with your real bot token obtained from [@BotFather](https://t.me/botfather).

## Running the Bot

**Locally:**
\`\`\`bash
uv run python -m src.app.main
\`\`\`

**Using Docker:**
\`\`\`bash
docker-compose up -d --build
\`\`\`
`;

// ==========================================
// Templates for Python code (Bot logic)
// ==========================================

const MAIN_PY_TEMPLATE = `import asyncio
import logging
import os
from aiogram import Bot, Dispatcher
from src.app.handlers import router

async def main() -> None:
    """
    Main entry point for the bot.
    Initializes the bot instance and the dispatcher, then starts polling.
    """
    logging.basicConfig(level=logging.INFO)
    
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise ValueError("BOT_TOKEN environment variable is not set!")

    bot = Bot(token=bot_token)
    dp = Dispatcher()

    # Include the generated handlers router
    dp.include_router(router)

    # Start polling
    logging.info("Starting bot polling...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
`;

const HANDLERS_HEADER = `from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

router = Router()
`;

const HANDLER_TEMPLATE = `
@router.message(Command("{command}"))
async def {command}_handler(message: Message) -> None:
    """
    Empty handler for the /{command} command.
    """
    await message.answer("Received command: /{command}. This is a boilerplate response.")
`;

// ==========================================
// Bot State Management
// ==========================================

interface UserSession {
  step: "idle" | "waiting_name" | "waiting_commands";
  projectName?: string;
  commands?: string[];
}

const kv = await Deno.openKv(); 

async function getSession(chatId: number): Promise<UserSession> {
  const res = await kv.get<UserSession>(["sessions", chatId]);
  return res.value || { step: "idle" };
}

async function saveSession(chatId: number, session: UserSession) {
  await kv.set(["sessions", chatId], session, {expireIn: 3600000});
}

async function deleteSession(chatId: number) {
  await kv.delete(["sessions", chatId]);
}

// ==========================================
// Project Name Validation
// ==========================================

/**
 * Validates and normalizes the project name according to Telegram bot username rules.
 * Bot usernames must end with "bot" (case-insensitive).
 * 
 * @param name - The desired project/bot name
 * @returns The normalized name with proper suffix
 */
function normalizeBotName(name: string): string {
  // Remove leading @ if present
  let normalized = name.startsWith("@") ? name.slice(1) : name;
  
  // Trim whitespace
  normalized = normalized.trim();
  
  // Convert to lowercase for checking
  const lowerName = normalized.toLowerCase();
  
  // Check if already ends with "bot"
  if (lowerName.endsWith("bot")) {
    return normalized;
  }
  
  // Add "bot" suffix
  return normalized + "bot";
}

// ==========================================
// Core Generator Logic
// ==========================================

/**
 * Generates the Python code for handlers based on the provided list of commands.
 *
 * @param commands - A list of command strings.
 * @returns A string containing the complete Python source code for the handlers file.
 */
function generateHandlersCode(commands: string[]): string {
  let code = HANDLERS_HEADER;
  for (const cmd of commands) {
    // Replace hyphens with underscores for valid Python function names
    const safeCmd = cmd.replaceAll("-", "_");
    code += HANDLER_TEMPLATE.replaceAll("{command}", safeCmd);
  }
  return code;
}

/**
 * Creates a ZIP archive containing the boilerplate files.
 *
 * @param projectName - The name of the project.
 * @param commands - A list of commands to generate handlers for.
 * @returns Uint8Array containing the ZIP file data
 */
async function createProjectZip(projectName: string, commands: string[]): Promise<Uint8Array> {
  // Normalize project name (ensure it ends with "bot")
  const normalizedName = normalizeBotName(projectName);

  // Mapping of internal paths to their textual content
  const filesToCreate: Record<string, string> = {
    [`${normalizedName}/.gitignore`]: GITIGNORE_TEMPLATE,
    [`${normalizedName}/.env`]: ENV_TEMPLATE,
    [`${normalizedName}/Dockerfile`]: DOCKERFILE_TEMPLATE,
    [`${normalizedName}/docker-compose.yml`]: DOCKER_COMPOSE_TEMPLATE,
    [`${normalizedName}/pyproject.toml`]: PYPROJECT_TEMPLATE.replaceAll("{project_name}", normalizedName),
    [`${normalizedName}/README.md`]: README_TEMPLATE.replaceAll("{project_name}", normalizedName),
    [`${normalizedName}/src/app/__init__.py`]: "", // Empty init
    [`${normalizedName}/src/app/main.py`]: MAIN_PY_TEMPLATE,
    [`${normalizedName}/src/app/handlers.py`]: generateHandlersCode(commands),
  };

  // Create a new JSZip instance and add all files
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(filesToCreate)) {
    zip.file(filePath, content);
  }

  // Generate zip content
  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6
    }
  });
}

// ==========================================
// Telegram API Helpers
// ==========================================

async function sendMessage(chatId: number, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    }),
  });
  
  if (!response.ok) {
    console.error("Failed to send message:", await response.text());
  }
}

async function sendDocument(chatId: number, document: Uint8Array, filename: string) {
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  
  const fileBlob = new Blob([document as any], { type: "application/zip" });
  formData.append("document", fileBlob, filename);
  
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    console.error("Failed to send document:", await response.text());
    return false;
  }
  return true;
}

// ==========================================
// Command Handlers
// ==========================================

async function handleStart(chatId: number) {
  const welcomeText = `
<b>Bot Template Generator</b>

Hi! I'll help you create a Telegram bot template in Python using aiogram and uv.

<b>How to use:</b>
1. Send me a name for your bot (e.g., mycoolbot)
2. I'll automatically add the "bot" suffix if needed
3. Send a comma-separated list of commands (e.g., start, help, settings)
4. Get a ready-to-use ZIP archive with your project!

<b>Available commands:</b>
/start - Start bot creation
/cancel - Cancel current operation
/help - Show help

<i>Note: The bot name must end in "bot" according to Telegram requirements.</i>
  `;
  
  await saveSession(chatId, { step: "waiting_name" });
  await sendMessage(chatId, welcomeText);
  await sendMessage(chatId, "Enter a name for your bot:");
}

async function handleHelp(chatId: number) {
  const helpText = `
<b>Help</b>

This bot generates templates for Python-based Telegram bots.

<b>Naming rules:</b>
• Name must be 5-32 characters long
• Latin letters, numbers, and underscores only
• Must end in "bot" (I'll add it automatically)

<b>Examples:</b>
• mycool → mycoolbot
• weather_bot → weather_bot (already okay)
• super_cool_bot → super_cool_bot (already okay)

<b>Available commands:</b>
/start - Start bot creation
/cancel - Cancel current operation
/help - Show help
  `;
  await sendMessage(chatId, helpText);
}

async function handleCancel(chatId: number) {
  await deleteSession(chatId);
  await sendMessage(chatId, "Operation canceled. Send /start to start over.");
}

async function sendStarsInvoice(chatId: number, amount: number) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      title: "Support the Project",
      description: `Donate ${amount} stars ⭐️ to support the Bot Template Generator`,
      payload: `stars_donate_${amount}`,
      currency: "XTR",
      prices: [{ label: "Stars", amount: amount }],
      provider_token: "",
    }),
  });

  if (!response.ok) {
    console.error("Failed to send invoice:", await response.text());
  }
}

async function handleMessage(chatId: number, text: string) {
  const session = await getSession(chatId);
  
  if (session.step === "waiting_name") {
    const cleanName = text.trim().startsWith("@") ? text.trim().slice(1) : text.trim();
    const normalizedName = normalizeBotName(cleanName);

    if (normalizedName.length <= 3) {
      await sendMessage(chatId, "Name is too short. Try again:");
      return;
    }

    if (normalizedName.length > 32) {
      await sendMessage(chatId, "The resulting name would be too long (max 32 chars including 'bot'). Try again:");
      return;
    }

    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(normalizedName)) {
      await sendMessage(chatId, "Name can only contain Latin letters, numbers, and underscores.");
      return;
    }

    // Inform user about normalization if it happened
    if (normalizedName.toLowerCase() !== cleanName.toLowerCase()) {
      await sendMessage(chatId, `I've automatically updated the name: <b>${cleanName}</b> → <b>${normalizedName}</b>\n\n(Per Telegram requirements, the bot name must end in "bot")`);
    }
    
    session.projectName = normalizedName;
    session.step = "waiting_commands";
    await saveSession(chatId, session);
    
    await sendMessage(chatId, `
Great! Project name: <b>${normalizedName}</b>

Now, send the list of bot commands separated by commas.
Examples:
• <code>start, help</code>
• <code>start, help, settings, profile</code>
• <code>start</code> (single command only)

If you don't provide commands, the defaults will be used: start, help
    `);
    
  } else if (session.step === "waiting_commands") {
    // Parse commands
    let commands: string[] = [];
    
    if (text.trim()) {
      commands = text
        .split(",")
        .map(cmd => cmd.trim().toLowerCase().replace(/^\//, ""))
        .filter(cmd => cmd.length > 0);
    }
    
    // Default commands if none provided
    if (commands.length === 0) {
      commands = ["start", "help"];
      await sendMessage(chatId, "No commands provided; using defaults: start, help");
    }
    
    // Validate commands
    const validCommands = commands.filter(cmd => /^[a-z0-9_]+$/.test(cmd));
    
    if (validCommands.length !== commands.length) {
      await sendMessage(chatId, "Some commands contained invalid characters and were filtered out.");
    }
    
    if (validCommands.length === 0) {
      await sendMessage(chatId, "No valid commands found. Using defaults: start, help");
      validCommands.push("start", "help");
    }
    
    const projectName = session.projectName!;
    
    await sendMessage(chatId, `Generating project ${projectName} with commands: ${validCommands.join(", ")}...`);
    
    try {
      // Generate ZIP
      const zipData = await createProjectZip(projectName, validCommands);
      const filename = `${projectName}.zip`;
      
      // Send file
      const success = await sendDocument(chatId, zipData, filename);
      
      if (success) {
        await sendMessage(chatId, `
<b>Project is ready!</b>

<code>${filename}</code>
Bot name: <b>${projectName}</b>
Commands: <b>${validCommands.join(", ")}</b>

<b>What's next?</b>
1. Unpack the archive
2. Install dependencies: <code>uv sync</code>
3. Add your token to the .env file
4. Run: <code>uv run python -m src.app.main</code>

<i>Enjoying the generator? Use /donate to support the project with some stars ⭐️</i>

Send /start to create another project!
        `);
        
      } else {
        await sendMessage(chatId, "Failed to send the file. Please try again later.");
      }
      
    } catch (error) {
      console.error("Error generating project:", error);
      await sendMessage(chatId, "An error occurred during project generation. Please try again later.");
    }
    
    // Clear session
    await deleteSession(chatId);
    
  } else {
    // Unknown state
    await sendMessage(chatId, "I don't understand. Send /start to create a new project.");
  }
}

// ==========================================
// Webhook Handler
// ==========================================

async function handleWebhook(request: Request): Promise<Response> {
  // Validate secret token if configured
  if (WEBHOOK_SECRET) {
    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secretHeader !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  
  try {
    const update = await request.json();

    // Handle donations
    if (update.pre_checkout_query) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true,
        }),
      });
      return new Response("OK", { status: 200 });
    }

    // Handle update.message.successful_payment
    if (update.message?.successful_payment) {
      await sendMessage(update.message.chat.id, "Thank you so much for your support! 🌟🌟🌟");
      return new Response("OK", { status: 200 });
    }
    
    // Handle message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || "";
      
      // Handle commands
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();
        
        switch (command) {
          case "/start":
            await handleStart(chatId);
            break;
          case "/help":
            await handleHelp(chatId);
            break;
          case "/cancel":
            await handleCancel(chatId);
            break;
          case "/donate":
            await sendStarsInvoice(chatId, 50);
            break;
          default:
            await sendMessage(chatId, "Unknown command. Send /help for assistance.");
        }
      } else {
        // Handle regular messages based on session state
        await handleMessage(chatId, text);
      }
    }
    
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    console.error("Error handling webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ==========================================
// HTTP Server
// ==========================================

function startServer(): void {
  const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }
    
    // Webhook endpoint
    if (url.pathname === "/webhook" && request.method === "POST") {
      return await handleWebhook(request);
    }
    
    return new Response("Not Found", { status: 404 });
  };
  
  console.log(`Server running on port ${PORT}`);
  Deno.serve({ port: PORT }, handler);
}

// ==========================================
// Main Entry Point
// ==========================================

function main(): void {
  // Validate configuration
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN environment variable is required!");
    console.error("Set it with: export BOT_TOKEN=your_token_here");
    Deno.exit(1);
  }
  
  console.log("Bot Template Generator");
  console.log("=========================");

  // Start HTTP server
  startServer();
}

main();
