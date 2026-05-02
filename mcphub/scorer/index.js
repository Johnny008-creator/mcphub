const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const simpleGit = require('simple-git');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../registry/mcphub.db');
const db = new sqlite3.Database(dbPath);
const git = simpleGit();

const TEMP_DIR = path.join(__dirname, 'temp_repos');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

async function scoreServer(server) {
  console.log(`Scoring server: ${server.name} (${server.git_url})`);
  const repoPath = path.join(TEMP_DIR, server.name.replace(/\s+/g, '_'));
  
  let scoreBreakdown = {
    readme: 0,
    handshake: 0,
    schemas: 0,
    speed: 0,
    versioning: 0,
    secrets: 0
  };

  try {
    // 1. Clone Repo
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    await git.clone(server.git_url, repoPath, ['--depth', '1']);

    // 2. README check (+20)
    const readmePath = path.join(repoPath, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      if (readmeContent.toLowerCase().includes('tool') || readmeContent.toLowerCase().includes('mcp')) {
        scoreBreakdown.readme = 20;
      }
    }

    // 3. Secrets scan (+10)
    const scanFiles = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (file !== '.git' && file !== 'node_modules') scanFiles(fullPath);
            } else {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const secretPatterns = [/api[_-]?key/i, /secret[_-]?key/i, /password/i, /token/i];
                if (secretPatterns.some(pattern => pattern.test(content))) {
                    if (/[='":]\s*['"][a-zA-Z0-9]{10,}['"]/.test(content)) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    
    if (!scanFiles(repoPath)) scoreBreakdown.secrets = 10;

    // 4. Versioning check (+10)
    if (fs.existsSync(path.join(repoPath, 'package.json')) || fs.existsSync(path.join(repoPath, 'CHANGELOG.md'))) {
      scoreBreakdown.versioning = 10;
    }

    // 5. MCP Handshake & Schemas (+25 + 20 + 15)
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const entrypoint = pkg.main || 'index.js';
        
        execSync('npm install --production', { cwd: repoPath, stdio: 'ignore', timeout: 30000 });

        const startTime = Date.now();
        const serverProcess = spawn('node', [path.join(repoPath, entrypoint)], {
          cwd: repoPath,
          stdio: ['pipe', 'pipe', 'inherit']
        });

        const handshakePromise = new Promise((resolve) => {
          const timeout = setTimeout(() => {
            serverProcess.kill();
            resolve(false);
          }, 5000);

          const initReq = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "MCPHub-Scorer", version: "1.0.0" }
            }
          }) + '\n';
          
          serverProcess.stdin.write(initReq);

          serverProcess.stdout.on('data', (data) => {
            const resp = data.toString();
            if (resp.includes('result') && resp.includes('protocolVersion')) {
              const endTime = Date.now();
              const responseTime = endTime - startTime;
              
              scoreBreakdown.handshake = 25;
              if (responseTime < 2000) scoreBreakdown.speed = 15;
              
              const toolsReq = JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {}
              }) + '\n';
              serverProcess.stdin.write(toolsReq);
            }
            
            if (resp.includes('tools') && resp.includes('inputSchema')) {
              scoreBreakdown.schemas = 20;
              clearTimeout(timeout);
              serverProcess.kill();
              resolve(true);
            }
          });
        });

        await handshakePromise;
      }
    } catch (err) {
      console.error(`Handshake failed for ${server.name}:`, err.message);
    }

  } catch (err) {
    console.error(`Error scoring ${server.name}:`, err.message);
  }

  const totalScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);
  console.log(`Finished scoring ${server.name}: ${totalScore}`);

  db.run('INSERT INTO scores (server_id, total_score, breakdown_json) VALUES (?, ?, ?)', 
    [server.id, totalScore, JSON.stringify(scoreBreakdown)], (err) => {
        if (err) console.error('Error saving score:', err.message);
    });
  
  db.run('UPDATE servers SET current_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [totalScore, server.id], (err) => {
        if (err) console.error('Error updating server score:', err.message);
    });
}

async function run() {
  while (true) {
    await new Promise((resolve) => {
        db.all('SELECT * FROM servers ORDER BY updated_at ASC LIMIT 1', async (err, servers) => {
            if (err) {
                console.error('Error fetching servers:', err.message);
                return resolve();
            }
            for (const server of servers) {
                await new Promise((res) => {
                    db.get('SELECT created_at FROM scores WHERE server_id = ? ORDER BY created_at DESC LIMIT 1', [server.id], async (err, lastScore) => {
                        if (!lastScore || (Date.now() - new Date(lastScore.created_at).getTime() > 3600000)) {
                            await scoreServer(server);
                        }
                        res();
                    });
                });
            }
            resolve();
        });
    });
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}

run().catch(console.error);
