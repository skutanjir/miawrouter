const net = require("net");

function checkPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ port, host, exclusive: true }, () => server.close(resolve));
  });
}

async function waitForPortAvailable(port, host, timeoutMs = 0) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try { return await checkPortAvailable(port, host); }
    catch (error) {
      if (error.code !== "EADDRINUSE" || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())));
    }
  }
}

module.exports = { checkPortAvailable, waitForPortAvailable };
