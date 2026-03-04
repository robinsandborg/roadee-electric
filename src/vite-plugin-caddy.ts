import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { Plugin } from "vite";

type CaddyPluginOptions = {
  host?: string;
  httpsPort?: number;
  encoding?: boolean;
  autoStart?: boolean;
  configPath?: string;
};

export function caddyPlugin(options: CaddyPluginOptions = {}): Plugin {
  const {
    host = "localhost",
    httpsPort = 5173,
    encoding = true,
    autoStart = true,
    configPath = "Caddyfile",
  } = options;

  let caddyProcess: ChildProcess | null = null;
  let vitePort: number | undefined;
  let caddyStarted = false;

  const generateCaddyfile = (port: number): string => {
    return `localhost:${httpsPort} {
  reverse_proxy ${host}:${port} {
    flush_interval -1
  }${
    encoding
      ? `
  encode {
    gzip
  }`
      : ""
  }
}
`;
  };

  const startCaddy = (): void => {
    if (caddyProcess) {
      return;
    }

    caddyProcess = spawn("caddy", ["run", "--config", configPath]);

    caddyProcess.on("error", (error) => {
      console.error("Failed to start Caddy:", error.message);
    });

    caddyProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Caddy exited with code ${code}`);
      }
      caddyProcess = null;
    });

    const cleanup = () => {
      if (caddyProcess && !caddyProcess.killed) {
        caddyProcess.kill("SIGTERM");
        setTimeout(() => {
          if (caddyProcess && !caddyProcess.killed) {
            caddyProcess.kill("SIGKILL");
            process.exit();
          } else {
            process.exit();
          }
        }, 1000);
      }
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("exit", cleanup);
  };

  const stopCaddy = (): void => {
    if (caddyProcess && !caddyProcess.killed) {
      caddyProcess.kill("SIGTERM");
      setTimeout(() => {
        if (caddyProcess && !caddyProcess.killed) {
          caddyProcess.kill("SIGKILL");
        }
      }, 3000);
      caddyProcess = null;
    }
  };

  const startCaddyIfReady = () => {
    if (!autoStart || !vitePort || caddyStarted) {
      return;
    }

    caddyStarted = true;

    const check = spawnSync("caddy", ["--version"], { stdio: "ignore" });
    if (check.error || check.status !== 0) {
      console.error(
        "`caddy` binary not found or unavailable. Install Caddy to run local HTTPS + HTTP/2.",
      );
      process.exit(1);
    }

    writeFileSync(configPath, generateCaddyfile(vitePort));
    startCaddy();
  };

  return {
    name: "vite-plugin-caddy",
    configureServer(server) {
      server.printUrls = function printUrls() {
        console.log(`\n  ➜  Local:   https://localhost:${httpsPort}/\n`);
        console.log(
          "  Note: served through Caddy with local HTTPS. Install/trust certs if prompted.\n",
        );
      };

      server.middlewares.use((_req, _res, next) => {
        if (!vitePort && server.config.server.port) {
          vitePort = server.config.server.port;
          startCaddyIfReady();
        }
        next();
      });

      const originalListen = server.listen;
      server.listen = function patchedListen(port?: number, isRestart?: boolean) {
        if (port) {
          vitePort = port;
        }

        const result = originalListen.call(this, port, isRestart);
        if (result && typeof result.then === "function") {
          result.then(() => {
            if (!vitePort && server.config.server.port) {
              vitePort = server.config.server.port;
            }
            startCaddyIfReady();
          });
        } else {
          startCaddyIfReady();
        }

        return result;
      };
    },
    buildEnd() {
      stopCaddy();
    },
  };
}
