const WebSocket = require('ws');
const { execSync } = require('child_process');

const PAGE_ID = 'FE02C01D3D22958C4EDF43BF386F1441';
const REPORT_DIR = '/Users/thing1/.openclaw/agents/alex/reports/e2e-full-audit';
const SCREENSHOT_SCRIPT = '/Users/thing1/.openclaw/agents/alex/scripts/browser-screenshot.sh';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function screenshot(name, w, h) {
  execSync(`${SCREENSHOT_SCRIPT} ${REPORT_DIR}/${name}.png "" ${w} ${h} 2>/dev/null`);
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  const ws = new WebSocket(`ws://127.0.0.1:18800/devtools/page/${PAGE_ID}`);
  let idCounter = 0;
  
  function evaluate(expr) {
    return new Promise((resolve) => {
      const id = ++idCounter;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === id) {
          ws.removeListener('message', handler);
          resolve(msg.result?.result?.value);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({id, method: 'Runtime.evaluate', params: {
        expression: expr, returnByValue: true
      }}));
    });
  }
  
  await new Promise(r => ws.on('open', r));
  console.log('Connected to CDP');
  
  const panels = ['Personas', 'Usage', 'Credentials', 'Models', 'Gateway', 'Contacts', 'Voice'];
  
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const num = String(i + 12).padStart(2, '0');
    console.log(`${num}. ${panel}...`);
    
    // Click the aria-label button
    const result = await evaluate(`
      (function() {
        var btn = document.querySelector('button[aria-label="${panel}"]');
        if (!btn) return 'NOT FOUND';
        btn.click();
        return 'clicked ' + btn.getAttribute('aria-label');
      })()
    `);
    console.log(`  Click result: ${result}`);
    
    await sleep(2000);
    
    // Check what the panel header says
    const header = await evaluate(`
      (function() {
        // Look for visible panel headers
        var els = document.querySelectorAll('h2, h3, [class*="panel-title"], [class*="PanelTitle"]');
        var results = [];
        for (var i = 0; i < els.length; i++) {
          if (els[i].offsetHeight > 0 && els[i].textContent.trim().length < 30) {
            results.push(els[i].textContent.trim());
          }
        }
        return JSON.stringify(results);
      })()
    `);
    console.log(`  Headers: ${header}`);
    
    screenshot(`${num}-${panel.toLowerCase()}-desktop`, 1440, 900);
    screenshot(`${num}-${panel.toLowerCase()}-mobile`, 390, 844);
  }
  
  ws.close();
  console.log('Done!');
}

main().catch(console.error);
