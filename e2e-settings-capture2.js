const WebSocket = require('ws');
const { execSync } = require('child_process');

const PAGE_ID = 'FE02C01D3D22958C4EDF43BF386F1441';
const REPORT_DIR = '/Users/thing1/.openclaw/agents/alex/reports/e2e-full-audit';
const SCREENSHOT_SCRIPT = '/Users/thing1/.openclaw/agents/alex/scripts/browser-screenshot.sh';

function cdpEval(expr) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:18800/devtools/page/${PAGE_ID}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);
    ws.on('open', () => {
      ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
        expression: expr, returnByValue: true, awaitPromise: true
      }}));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id === 1) {
        clearTimeout(timer);
        resolve(msg.result?.result?.value);
        ws.close();
      }
    });
    ws.on('error', reject);
  });
}

function screenshot(name, w, h) {
  execSync(`${SCREENSHOT_SCRIPT} ${REPORT_DIR}/${name}.png "" ${w} ${h} 2>/dev/null`);
  console.log(`  ✓ ${name}.png`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // First close any open management view
  await cdpEval(`
    var btns = document.querySelectorAll('button[aria-label="Personas"]');
    for (var j = 0; j < btns.length; j++) {
      if (btns[j].offsetHeight > 0 && btns[j].getAttribute('data-active') === 'true') {
        btns[j].click(); break;
      }
    }
    'reset'
  `);
  await sleep(500);

  const panels = ['Personas', 'Usage', 'Credentials', 'Models', 'Gateway', 'Contacts', 'Voice'];
  
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const num = String(i + 12).padStart(2, '0');
    console.log(`${num}. ${panel}...`);
    
    // Click by aria-label to open
    await cdpEval(`
      var btns = document.querySelectorAll('button[aria-label="${panel}"]');
      for (var j = 0; j < btns.length; j++) {
        if (btns[j].offsetHeight > 0) { btns[j].click(); break; }
      }
      'clicked'
    `);
    await sleep(2000);
    
    // Verify which panel is actually open
    const currentPanel = await cdpEval(`
      var h = document.querySelector('[data-management-view] h2, [data-management-view] h3');
      h ? h.textContent.trim() : 'unknown'
    `);
    console.log(`  Panel showing: ${currentPanel}`);
    
    screenshot(`${num}-${panel.toLowerCase()}-desktop`, 1440, 900);
    screenshot(`${num}-${panel.toLowerCase()}-mobile`, 390, 844);
  }
  
  console.log('Done!');
}

main().catch(console.error);
