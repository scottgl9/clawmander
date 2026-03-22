jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const { execFile } = require('child_process');
const OpenClawCLI = require('../../backend/services/OpenClawCLI');

describe('OpenClawCLI', () => {
  let cli;

  beforeEach(() => {
    jest.clearAllMocks();
    cli = new OpenClawCLI('/home/test/.openclaw');
  });

  describe('_exec', () => {
    it('should call execFile with openclaw and args', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, 'output', ''));
      const result = await cli._exec(['config', 'get', 'tools.exec']);
      expect(execFile).toHaveBeenCalledWith(
        'openclaw',
        ['config', 'get', 'tools.exec'],
        expect.objectContaining({ timeout: 10000 }),
        expect.any(Function)
      );
      expect(result).toBe('output');
    });

    it('should set OPENCLAW_HOME in env', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        expect(opts.env.OPENCLAW_HOME).toBe('/home/test/.openclaw');
        cb(null, '', '');
      });
      await cli._exec(['test']);
    });

    it('should reject on error', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(new Error('not found'), '', 'command not found'));
      await expect(cli._exec(['bad'])).rejects.toThrow('command not found');
    });

    it('should trim output', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '  result\n', ''));
      const result = await cli._exec(['test']);
      expect(result).toBe('result');
    });
  });

  describe('configSet', () => {
    it('should call _exec with config set args', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '', ''));
      await cli.configSet('tools.exec.security', 'full');
      expect(execFile).toHaveBeenCalledWith(
        'openclaw',
        ['config', 'set', 'tools.exec.security', 'full'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should add --json flag when json=true', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '', ''));
      await cli.configSet('key', 'value', true);
      expect(execFile).toHaveBeenCalledWith(
        'openclaw',
        ['config', 'set', 'key', 'value', '--json'],
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('readConfig', () => {
    it('should parse JSON config', async () => {
      const config = { tools: { exec: { security: 'full' } } };
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, JSON.stringify(config), ''));
      const result = await cli.readConfig();
      expect(result).toEqual(config);
    });

    it('should return empty object on error', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => cb(new Error('fail'), '', 'fail'));
      const result = await cli.readConfig();
      expect(result).toEqual({});
    });
  });
});
