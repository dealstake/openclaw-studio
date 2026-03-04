const WebSocket = require('ws');
const { execSync } = require('child_process');
const fs = require('fs');

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
        const r = msg.result?.result;
        if (r?.value !== undefined) resolve(r.value);
        else if (msg.result?.exceptionDetails) reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        else resolve(JSON.stringify(msg.result));
        ws.close();
      }
    });
    ws.on('error', reject);
  });
}

function screenshot(name, w, h) {
  try {
    execSync(`${SCREENSHOT_SCRIPT} ${REPORT_DIR}/${name}.png "" ${w} ${h} 2>/dev/null`);
    console.log(`  ✓ ${name}.png (${w}x${h})`);
  } catch(e) {
    console.error(`  ✗ ${name}.png FAILED`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== E2E Full Audit Screenshots ===\n');
  
  // Management tabs
  const tabs = ['Projects', 'Tasks', 'Files', 'Skills', 'Activity', 'Budget', 'Routing', 'Playground', 'Swarm', 'Memory', 'Feedback'];
  
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const num = String(i + 1).padStart(2, '0');
    console.log(`${num}. ${tab}...`);
    
    // Click tab
    await cdpEval(`
      var tabs = document.querySelectorAll('[role=tab]');
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].textContent.trim() === '${tab}') { tabs[j].click(); break; }
      }
      'clicked ${tab}'
    `);
    await sleep(1500);
    
    // Desktop screenshot
    screenshot(`${num}-${tab.toLowerCase()}-desktop`, 1440, 900);
    // Mobile screenshot
    screenshot(`${num}-${tab.toLowerCase()}-mobile`, 390, 844);
  }
  
  // Now capture settings panels
  // First close the management panel
  console.log('\nCapturing Settings panels...');
  
  // Click sidebar buttons: Personas, Usage, Credentials, Models, Gateway, Contacts, Voice
  const settingsPanels = ['Personas', 'Usage', 'Credentials', 'Models', 'Gateway', 'Contacts', 'Voice'];
  
  for (let i = 0; i < settingsPanels.length; i++) {
    const panel = settingsPanels[i];
    const num = String(i + 12).padStart(2, '0');
    console.log(`${num}. ${panel}...`);
    
    await cdpEval(`
      var btns = document.querySelectorAll('button');
      for (var j = 0; j < btns.length; j++) {
        if (btns[j].textContent.trim() === '${panel}' && btns[j].offsetHeight > 0) {
          btns[j].click(); break;
        }
      }
      'clicked ${panel}'
    `);
    await sleep(1500);
    
    screenshot(`${num}-${panel.toLowerCase()}-desktop`, 1440, 900);
    screenshot(`${num}-${panel.toLowerCase()}-mobile`, 390, 844);
  }
  
  console.log(`\n=== Complete: ${fs.readdirSync(REPORT_DIR).filter(f => f.endsWith('.png')).length} screenshots ===`);
}

main().catch(console.error);
