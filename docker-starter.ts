import { spawn } from "node:child_process";
import path from "node:path";
import { Command } from "commander";

const program = new Command();

program
  .name("resend-local")
  .version("0.0.7")
  .option("-p, --port <port>", "Port to run the server on", "8005")
  .parse(process.argv);

const options = program.opts();

const PORT = options.port;

// In Docker, the app directory is in the same location as this script
const cwd = path.join(__dirname, "");

const DATABASE_URL = "file:resend-local.sqlite";

spawn("node", ["server.js"], {
  cwd: cwd,
  env: {
    ...process.env,
    PORT: PORT,
    DATABASE_URL: DATABASE_URL,
  },
  stdio: "inherit",
});
