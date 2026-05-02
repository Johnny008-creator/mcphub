#!/usr/bin/env node
const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const program = new Command();
const API_URL = process.env.MCPHUB_API_URL || 'http://localhost:3000/api';

program
  .name('mcphub')
  .description('MCP Server Registry CLI')
  .version('1.0.0');

program.command('search')
  .description('Search for MCP servers')
  .argument('<query>', 'search query')
  .action(async (query) => {
    try {
      const resp = await axios.get(`${API_URL}/servers`, { params: { q: query } });
      console.log(chalk.bold(`\nFound ${resp.data.length} servers:\n`));
      resp.data.forEach(s => {
        console.log(`${chalk.green.bold(s.name)} [Score: ${s.current_score}/100]`);
        console.log(chalk.dim(s.description || 'No description'));
        console.log(chalk.blue(s.git_url));
        console.log();
      });
    } catch (err) {
      console.error(chalk.red('Error searching:', err.message));
    }
  });

program.command('info')
  .description('Get detailed info for a server')
  .argument('<id>', 'server id')
  .action(async (id) => {
    try {
      const resp = await axios.get(`${API_URL}/servers/${id}`);
      const s = resp.data;
      console.log(chalk.bold(`\n${s.name}`));
      console.log(chalk.dim(`ID: ${s.id}`));
      console.log(`URL: ${chalk.blue(s.git_url)}`);
      console.log(`Score: ${chalk.yellow.bold(s.current_score)}/100`);
      console.log(`Categories: ${s.categories.join(', ')}`);
      console.log(`\nDescription:\n${s.description || 'N/A'}`);
      
      if (s.scores.length > 0) {
        console.log(`\nLatest Score Breakdown:`);
        const latest = JSON.parse(s.scores[0].breakdown_json);
        Object.entries(latest).forEach(([k, v]) => {
          console.log(`- ${k}: ${v}`);
        });
      }
    } catch (err) {
      console.error(chalk.red('Error getting info:', err.message));
    }
  });

program.command('install')
  .description('Install an MCP server to Claude Desktop')
  .argument('<id>', 'server id')
  .option('-c, --config <path>', 'custom path to claude_desktop_config.json')
  .action(async (id, options) => {
    try {
      const resp = await axios.get(`${API_URL}/servers/${id}`);
      const s = resp.data;
      
      let configPath = options.config || process.env.MCPHUB_CONFIG_PATH;
      if (!configPath) {
         // Default paths based on OS
         if (process.platform === 'win32') {
           configPath = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
         } else if (process.platform === 'darwin') {
           configPath = path.join(process.env.HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
         } else {
           console.error(chalk.red('Could not determine default config path. Use --config or MCPHUB_CONFIG_PATH.'));
           return;
         }
      }

      let config = { mcpServers: {} };
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      // Add server to config
      config.mcpServers[s.name] = {
        command: "node",
        args: [/* In a real scenario we'd need to know where it's installed or use npx */ "run", s.name]
      };
      
      // For MVP, we'll just suggest how to run it
      console.log(chalk.yellow(`Warning: Automatic installation is experimental.`));
      console.log(`Adding ${s.name} to ${configPath}...`);
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('Done!'));
    } catch (err) {
      console.error(chalk.red('Error installing:', err.message));
    }
  });

program.command('publish')
  .description('Publish a new MCP server')
  .argument('<git-url>', 'Git repository URL')
  .option('-n, --name <name>', 'Server name')
  .option('-d, --desc <desc>', 'Description')
  .action(async (url, options) => {
    try {
      const name = options.name || path.basename(url, '.git');
      const resp = await axios.post(`${API_URL}/servers`, {
        name,
        git_url: url,
        description: options.desc
      });
      console.log(chalk.green('Published successfully!'));
      console.log(`ID: ${resp.data.id}`);
    } catch (err) {
      console.error(chalk.red('Error publishing:', err.response?.data?.error || err.message));
    }
  });

program.command('score')
  .description('Trigger a rescore for a server')
  .argument('<id>', 'server id')
  .action(async (id) => {
    try {
      await axios.post(`${API_URL}/servers/${id}/score`);
      console.log(chalk.green('Rescore triggered successfully!'));
    } catch (err) {
      console.error(chalk.red('Error triggering score:', err.message));
    }
  });

program.parse();
