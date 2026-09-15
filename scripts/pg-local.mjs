// Postgres local sin Docker usando los binarios de PostgreSQL instalados (Windows/macOS/Linux).
//   pnpm db:local init   -> crea el cluster en .pgdata (puerto 5433) con rol de app no-superusuario
//   pnpm db:local start | stop | status
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";

const DATA = path.resolve(".pgdata");
const PORT = process.env.PG_LOCAL_PORT ?? "5433";
const SUPER = "adminfit";
const APP = "adminfit_app";
const DB = "adminfit";

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (process.platform === "win32") {
    const root = "C:\\Program Files\\PostgreSQL";
    if (existsSync(root)) {
      const versions = execFileSync("cmd", ["/c", "dir", "/b", root]).toString().split(/\r?\n/).filter(Boolean);
      const latest = versions.map(Number).filter(Boolean).sort((a, b) => b - a)[0];
      if (latest) return path.join(root, String(latest), "bin");
    }
  }
  return ""; // en PATH
}

const BIN = findBin();
const exe = (name) => (BIN ? path.join(BIN, name + (process.platform === "win32" ? ".exe" : "")) : name);
const psql = (db, sql) =>
  execFileSync(exe("psql"), ["-h", "127.0.0.1", "-p", PORT, "-U", SUPER, "-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    stdio: "inherit",
  });

const cmd = process.argv[2];

if (cmd === "init") {
  if (existsSync(path.join(DATA, "PG_VERSION"))) {
    console.log("Ya existe .pgdata. Usa `pnpm db:local start`.");
    process.exit(0);
  }
  mkdirSync(DATA, { recursive: true });
  execFileSync(exe("initdb"), ["-D", DATA, "-U", SUPER, "--auth=trust", "--encoding=UTF8", "--locale=C"], { stdio: "inherit" });
  appendFileSync(path.join(DATA, "postgresql.conf"), `\nport = ${PORT}\nlisten_addresses = '127.0.0.1'\n`);
  start();
  psql("postgres", `CREATE ROLE ${APP} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;`);
  psql("postgres", `CREATE DATABASE ${DB} OWNER ${APP};`);
  psql(DB, `ALTER SCHEMA public OWNER TO ${APP};`);
  console.log(`\nListo. DATABASE_URL="postgres://${APP}@127.0.0.1:${PORT}/${DB}"\nLuego: pnpm db:migrate`);
} else if (cmd === "start") {
  start();
} else if (cmd === "stop") {
  execFileSync(exe("pg_ctl"), ["-D", DATA, "stop", "-m", "fast"], { stdio: "inherit" });
} else if (cmd === "status") {
  spawn(exe("pg_ctl"), ["-D", DATA, "status"], { stdio: "inherit" });
} else {
  console.log("Uso: pnpm db:local <init|start|stop|status>");
  process.exit(1);
}

function start() {
  // pg_ctl start deja el servidor como proceso independiente; -w espera a que acepte conexiones.
  execFileSync(exe("pg_ctl"), ["-D", DATA, "-l", path.join(DATA, "server.log"), "-w", "start"], {
    stdio: "inherit",
    windowsHide: true,
  });
}
