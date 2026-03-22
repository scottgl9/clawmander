const { execFile } = require('child_process');

class OpenClawCLI {
  constructor(openClawHome) {
    this.openClawHome = openClawHome || process.env.OPENCLAW_HOME || '';
  }

  _exec(args) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (this.openClawHome) env.OPENCLAW_HOME = this.openClawHome;

      execFile('openclaw', args, { env, timeout: 10000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  async configSet(key, value, json = false) {
    const args = ['config', 'set', key, value];
    if (json) args.push('--json');
    return this._exec(args);
  }

  async configSetGlobal(key, value, json = false) {
    const args = ['config', 'set', key, value];
    if (json) args.push('--json');
    return this._execGlobal(args);
  }

  async configGet(key) {
    return this._exec(['config', 'get', key]);
  }

  _execGlobal(args) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      delete env.OPENCLAW_HOME;
      execFile('openclaw', args, { env, timeout: 10000 }, (err, stdout, stderr) => {
        if (err) { reject(new Error(stderr || err.message)); return; }
        resolve(stdout.trim());
      });
    });
  }

  async readConfig() {
    try {
      const [agentsRaw, toolsRaw] = await Promise.allSettled([
        this._execGlobal(['config', 'get', 'agents', '--json']),
        this._execGlobal(['config', 'get', 'tools', '--json']),
      ]);
      const agents = agentsRaw.status === 'fulfilled' ? JSON.parse(agentsRaw.value) : {};
      const tools = toolsRaw.status === 'fulfilled' ? JSON.parse(toolsRaw.value) : {};
      return { agents, tools };
    } catch {
      return {};
    }
  }
}

module.exports = OpenClawCLI;
