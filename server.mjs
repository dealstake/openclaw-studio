import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const GATEWAY_URL = process.env.GATEWAY_INTERNAL_URL || "ws://127.0.0.1:18789";

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] HTTP ${req.method} ${req.url} from=${req.socket.remoteAddress}`);
    const parsedUrl = parse(req.url, true);
    // Override cache headers for HTML pages so Cloudflare doesn't cache stale builds
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode, ...args) => {
      const isAsset = parsedUrl.pathname?.startsWith("/_next/static/");
      if (!isAsset) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.removeHeader("s-maxage");
      }
      return origWriteHead(statusCode, ...args);
    };
    await handle(req, res, parsedUrl);
  });

  // WebSocket proxy: any WS upgrade on this server gets proxied to the gateway
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const ts = new Date().toISOString();
    const { pathname } = parse(req.url, true);
    console.log(`[${ts}] UPGRADE request: path=${pathname} from=${req.socket.remoteAddress} headers=${JSON.stringify({upgrade: req.headers.upgrade, connection: req.headers.connection, origin: req.headers.origin, host: req.headers.host})}`);
    
    // Only proxy /gateway-ws path
    if (pathname === "/gateway-ws") {
      console.log(`[${ts}] WS PROXY: accepting upgrade, connecting to gateway at ${GATEWAY_URL}`);
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        console.log(`[${ts}] WS PROXY: client upgrade complete, opening gateway connection`);
        // Connect to the real gateway
        const gatewayWs = new WebSocket(GATEWAY_URL, {
          headers: {
            origin: req.headers.origin || "https://alex.tridentfundingsolutions.com",
          },
        });
        
        gatewayWs.on("open", () => {
          console.log(`[${ts}] WS PROXY: gateway connection OPEN, piping messages`);
          // Pipe messages both ways
          clientWs.on("message", (data, isBinary) => {
            const msg = data.toString().substring(0, 200);
            console.log(`[${new Date().toISOString()}] WS PROXY: client→gateway (binary=${isBinary}): ${msg}`);
            if (gatewayWs.readyState === WebSocket.OPEN) {
              gatewayWs.send(data, { binary: isBinary });
            }
          });
          gatewayWs.on("message", (data, isBinary) => {
            const msg = data.toString().substring(0, 200);
            console.log(`[${new Date().toISOString()}] WS PROXY: gateway→client (binary=${isBinary}): ${msg}`);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data, { binary: isBinary });
            }
          });
        });

        clientWs.on("close", (code, reason) => {
          console.log(`[${new Date().toISOString()}] WS PROXY: client closed code=${code} reason=${reason}`);
          gatewayWs.close();
        });
        gatewayWs.on("close", (code, reason) => {
          console.log(`[${new Date().toISOString()}] WS PROXY: gateway closed code=${code} reason=${reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code, reason);
          }
        });
        gatewayWs.on("error", (err) => {
          console.log(`[${new Date().toISOString()}] WS PROXY: gateway error: ${err.message}`);
          clientWs.close();
        });
        clientWs.on("error", (err) => {
          console.log(`[${new Date().toISOString()}] WS PROXY: client error: ${err.message}`);
          gatewayWs.close();
        });
      });
    } else {
      console.log(`[${ts}] UPGRADE: non-proxy path ${pathname}, ${dev ? 'letting Next.js handle' : 'destroying'}`);
      // Let Next.js handle other upgrades (HMR in dev)
      // In production, just destroy unknown upgrade requests
      if (!dev) socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Studio ready on http://${hostname}:${port}`);
    console.log(`> Gateway proxy at ws://${hostname}:${port}/gateway-ws → ${GATEWAY_URL}`);
  });
});
