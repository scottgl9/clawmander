// Shared exec-notification regex patterns used by chat routes and ChatGatewayClient.
//
// Strip exec completion notifications appended to user message content.
// Requires preceding whitespace so user-typed "System: ..." at the start is not stripped.
const EXEC_SUFFIX_RE = /\s+System: \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]+\] (?:Exec completed|Exec started|Exec failed|HEARTBEAT_OK|Process exited)[\s\S]*/;
// Whole-content check — entire message is just a notification (no real user text)
const EXEC_ONLY_RE = /^System: \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]+\] (?:Exec completed|Exec started|Exec failed|HEARTBEAT_OK|Process exited)/;

function stripExecSuffix(text) {
  if (!text || typeof text !== 'string') return text;
  if (EXEC_ONLY_RE.test(text.trimStart())) return '';
  return text.replace(EXEC_SUFFIX_RE, '').trimEnd();
}

module.exports = { EXEC_SUFFIX_RE, EXEC_ONLY_RE, stripExecSuffix };
