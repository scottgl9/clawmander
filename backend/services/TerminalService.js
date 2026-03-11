const pty = require('node-pty');
const os = require('os');

class TerminalService {
  constructor() {
    this.sessions = new Map();
  }

  createSession(id, cols = 80, rows = 24) {
    if (this.sessions.has(id)) {
      this.destroySession(id);
    }

    const shell = process.env.SHELL || '/bin/bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: os.homedir(),
      env: process.env,
    });

    this.sessions.set(id, { pty: ptyProcess });
    return ptyProcess;
  }

  resizeSession(id, cols, rows) {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  writeToSession(id, data) {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.write(data);
    }
  }

  destroySession(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  destroyAll() {
    for (const [id] of this.sessions) {
      this.destroySession(id);
    }
  }
}

module.exports = TerminalService;
