const ChatGatewayClient = require('../../backend/services/ChatGatewayClient');

function createClient() {
  return new ChatGatewayClient({ broadcast: jest.fn() }, null);
}

describe('ChatGatewayClient approval events', () => {
  test('broadcasts exec approval requests as chat approval events', () => {
    const client = createClient();

    client._handleEvent({
      event: 'exec.approval.requested',
      payload: {
        id: 'approval-123',
        createdAtMs: 1000,
        expiresAtMs: 61000,
        request: {
          command: 'npm install left-pad',
          commandPreview: 'npm install left-pad',
          cwd: '/tmp/project',
          host: 'gateway',
          nodeId: null,
          agentId: 'main',
          sessionKey: 'agent:main:clawmander:1',
          warningText: 'Network access requested',
          allowedDecisions: ['allow-once', 'deny'],
        },
      },
    });

    expect(client.sse.broadcast).toHaveBeenCalledWith('chat.approval', {
      approvalId: 'approval-123',
      sessionKey: 'agent:main:clawmander:1',
      command: 'npm install left-pad',
      commandText: 'npm install left-pad',
      cwd: '/tmp/project',
      host: 'gateway',
      nodeId: null,
      agentId: 'main',
      warningText: 'Network access requested',
      allowedDecisions: ['allow-once', 'deny'],
      createdAtMs: 1000,
      expiresAtMs: 61000,
      state: 'pending',
    });
  });

  test('uses systemRunPlan session details when request fields are absent', () => {
    const client = createClient();

    client._handleEvent({
      event: 'exec.approval.requested',
      payload: {
        id: 'approval-456',
        request: {
          command: '/usr/bin/echo ok',
          systemRunPlan: {
            commandPreview: 'echo ok',
            commandText: '/usr/bin/echo ok',
            cwd: '/workspace',
            agentId: 'worker',
            sessionKey: 'agent:worker:clawmander:1',
          },
        },
      },
    });

    expect(client.sse.broadcast).toHaveBeenCalledWith(
      'chat.approval',
      expect.objectContaining({
        approvalId: 'approval-456',
        sessionKey: 'agent:worker:clawmander:1',
        command: 'echo ok',
        commandText: '/usr/bin/echo ok',
        cwd: '/workspace',
        agentId: 'worker',
      })
    );
  });

  test('broadcasts exec approval resolutions as chat approval resolved events', () => {
    const client = createClient();

    client._handleEvent({
      event: 'exec.approval.resolved',
      payload: {
        id: 'approval-123',
        decision: 'deny',
        resolvedBy: { clientId: 'gateway-client' },
        request: {
          sessionKey: 'agent:main:clawmander:1',
        },
      },
    });

    expect(client.sse.broadcast).toHaveBeenCalledWith('chat.approval.resolved', {
      approvalId: 'approval-123',
      sessionKey: 'agent:main:clawmander:1',
      decision: 'deny',
      resolvedBy: { clientId: 'gateway-client' },
      state: 'resolved',
    });
  });
});
