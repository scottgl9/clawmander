const fs = require('fs');
const path = require('path');
const os = require('os');
const MemoryService = require('../../backend/services/MemoryService');

jest.mock('fs');

const HOME = os.homedir();

const WORK_WEEKS_DIR = `${HOME}/.openclaw/workspace/memory/weeks`;
const PERSONAL_WEEKS_DIR = `${HOME}/.openclaw/workspace-personal/memory/weeks`;
const BUDGET_WEEKS_DIR = `${HOME}/.openclaw/workspace-personal/agents/budget/memory/weeks`;

const WEEK_MD_CONTENT = `# Week 2026-W09\n\n## Summary\nGreat week.`;

describe('MemoryService.getAvailableWeeks()', () => {
  let service;

  beforeEach(() => {
    // Mock directory structure: work-agent has W09 + W08, personal-agent has W09
    fs.readdirSync = jest.fn().mockImplementation((dir) => {
      if (dir.includes('workspace/memory/weeks')) return ['2026-W09', '2026-W08'];
      if (dir.includes('workspace-personal/memory/weeks')) return ['2026-W09'];
      if (dir.includes('budget/memory/weeks')) return ['2026-W09'];
      return [];
    });

    fs.existsSync = jest.fn().mockImplementation((p) => p.endsWith('WEEK.md'));
    fs.readFileSync = jest.fn().mockReturnValue(WEEK_MD_CONTENT);
    service = new MemoryService();
  });

  test('returns sorted weeks newest first', () => {
    const weeks = service.getAvailableWeeks(10);
    expect(weeks[0].weekId).toBe('2026-W09');
    expect(weeks[1].weekId).toBe('2026-W08');
  });

  test('counts agents per week correctly', () => {
    const weeks = service.getAvailableWeeks(10);
    const w09 = weeks.find(w => w.weekId === '2026-W09');
    // work-agent, personal-agent, budget all have W09
    expect(w09.agentCount).toBeGreaterThanOrEqual(2);
    expect(w09.agents).toContain('work-agent');
  });

  test('respects limit parameter', () => {
    const weeks = service.getAvailableWeeks(1);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].weekId).toBe('2026-W09');
  });

  test('returns empty array when no weeks exist', () => {
    fs.readdirSync = jest.fn().mockImplementation(() => { throw new Error('ENOENT'); });
    const weeks = service.getAvailableWeeks(10);
    expect(weeks).toEqual([]);
  });

  test('ignores dirs that do not match YYYY-WXX pattern', () => {
    fs.readdirSync = jest.fn().mockReturnValue(['2026-W09', 'not-a-week', '.DS_Store', '2026-W08']);
    const weeks = service.getAvailableWeeks(10);
    // Only properly named weeks should appear
    weeks.forEach(w => expect(w.weekId).toMatch(/^\d{4}-W\d{2}$/));
  });
});

describe('MemoryService.getWeekSummaries()', () => {
  let service;

  beforeEach(() => {
    fs.readdirSync = jest.fn().mockReturnValue([]);
    // work-agent path: workspace/memory/weeks/WEEK/WEEK.md (no "work-agent" in path)
    // personal-agent path: workspace-personal/memory/weeks/WEEK/WEEK.md
    // Other agents have agentId in path: agents/<agentId>/memory/...
    fs.existsSync = jest.fn().mockImplementation((p) => {
      // Only work-agent and personal-agent return true
      const isWorkAgent = p.includes('workspace/memory') && !p.includes('agents/');
      const isPersonalAgent = p.includes('workspace-personal/memory') && !p.includes('agents/');
      return isWorkAgent || isPersonalAgent;
    });
    fs.readFileSync = jest.fn().mockImplementation((p) => {
      if (p.includes('workspace/memory') && !p.includes('agents/')) return '# Work Week\nWork summary.';
      if (p.includes('workspace-personal/memory') && !p.includes('agents/')) return '# Personal Week\nPersonal summary.';
      return '';
    });
    service = new MemoryService();
  });

  test('returns summaries for each agent that has a WEEK.md', () => {
    const result = service.getWeekSummaries('2026-W09');
    expect(result.weekId).toBe('2026-W09');
    expect(result.agents).toContain('work-agent');
    expect(result.agents).toContain('personal-agent');
    expect(result.summaries['work-agent']).toBe('# Work Week\nWork summary.');
    expect(result.summaries['personal-agent']).toBe('# Personal Week\nPersonal summary.');
  });

  test('does not include agents without WEEK.md', () => {
    fs.existsSync = jest.fn().mockReturnValue(false);
    const result = service.getWeekSummaries('2026-W09');
    expect(result.agents).toHaveLength(0);
    expect(result.summaries).toEqual({});
  });

  test('handles read errors gracefully', () => {
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockImplementation(() => { throw new Error('read failed'); });
    const result = service.getWeekSummaries('2026-W09');
    expect(result.agents).toHaveLength(0);
  });
});

describe('MemoryService.getWeekMd()', () => {
  let service;

  beforeEach(() => {
    fs.readdirSync = jest.fn().mockReturnValue([]);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockReturnValue(WEEK_MD_CONTENT);
    service = new MemoryService();
  });

  test('returns content for a known agent and week', () => {
    const content = service.getWeekMd('work-agent', '2026-W09');
    expect(content).toBe(WEEK_MD_CONTENT);
  });

  test('returns null for unknown agent', () => {
    const content = service.getWeekMd('nonexistent-agent', '2026-W09');
    expect(content).toBeNull();
  });

  test('returns null when WEEK.md does not exist', () => {
    fs.existsSync = jest.fn().mockReturnValue(false);
    const content = service.getWeekMd('work-agent', '2026-W09');
    expect(content).toBeNull();
  });

  test('returns null on read error', () => {
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockImplementation(() => { throw new Error('read error'); });
    const content = service.getWeekMd('work-agent', '2026-W09');
    expect(content).toBeNull();
  });
});
