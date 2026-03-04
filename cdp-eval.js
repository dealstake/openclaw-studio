// Usage: node cdp-eval.js <expression> [page_id]
const WebSocket = require('ws');
const expr = process.argv[2] || 'document.title';
const pageId = process.argv[3] || '76E64558D4D8410DF1A151BAA200730C';
const ws = new WebSocket(`ws://127.0.0.1:18800/devtools/page/${pageId}`);
ws.on('open', () => {
  ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
    expression: expr, returnByValue: true, awaitPromise: true
  }}));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    const r = msg.result?.result;
    if (r?.value !== undefined) console.log(typeof r.value === 'string' ? r.value : JSON.stringify(r.value));
    else if (msg.result?.exceptionDetails) console.error('ERROR:', JSON.stringify(msg.result.exceptionDetails));
    else console.log(JSON.stringify(msg.result));
    ws.close(); process.exit(0);
  }
});
setTimeout(() => { ws.close(); process.exit(1); }, 10000);
