// Deterministic test-only OpenAI protocol server. Never imported by application code.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
type Message = { role: string; content: string; tool_calls?: unknown[] };
export async function startProvider(port = 0) {
  const requests: unknown[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.end('ok');
      return;
    }
    if (req.url !== '/v1/chat/completions') {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const messages = body.messages as Message[];
    const question = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    if (question.includes('provider fail')) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          error: { message: 'test upstream failure sk-test-secret-should-not-leak' },
        }),
      );
      return;
    }
    if (question.includes('slow response')) {
      const timer = setTimeout(() => res.end(), 30000);
      res.on('close', () => clearTimeout(timer));
      return;
    }
    const toolMessages = messages.filter((m) => m.role === 'tool');
    let tool: string | undefined;
    if (
      body.tools &&
      (!toolMessages.length || (question.includes('multiple tools') && toolMessages.length === 1))
    ) {
      tool = toolMessages.length
        ? 'list_workloads'
        : question.toLowerCase().includes('benchmark')
          ? 'list_benchmark_runs'
          : question.toLowerCase().includes('prediction')
            ? 'get_ml_prediction'
            : 'list_hardware_profiles';
    }
    const last = toolMessages.at(-1);
    let fact = 'No retrieved project records.';
    if (last) {
      const data = JSON.parse(last.content);
      const details = Array.isArray(data.data)
        ? data.data
            .map((row: { name?: string; cpuName?: string; id?: string }) =>
              [row.name, row.cpuName, row.id].filter(Boolean).join(' · '),
            )
            .join('; ')
        : JSON.stringify(data.data);
      fact = `${data.provenance}: ${data.available ? 'Retrieved authorized records.' : 'No data available.'} ${details}. SHAP contributions use ln(ms), not milliseconds. Records do not prove causality.`;
    }
    const answer = question.includes('markdown fixture')
      ? `Test provider response: ${fact}\n\n**Evidence summary**\n\n\`\`\`typescript\nconst evidence = true;\n\`\`\`\n\n[unverified](https://attacker.invalid) ![tracking](https://attacker.invalid/pixel) <script>alert(1)</script>`
      : `Test provider response: ${fact}`;
    const base = {
      id: 'chatcmpl-fixture',
      object: 'chat.completion',
      created: 1,
      model: 'corewise-test-model',
    };
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (let i = 0; i < answer.length; i += 40)
        res.write(
          `data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: answer.slice(i, i + 40) }, finish_reason: null }] })}\n\n`,
        );
      res.end(
        `data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 80, completion_tokens: 25, total_tokens: 105 } })}\n\ndata: [DONE]\n\n`,
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        ...base,
        choices: [
          {
            index: 0,
            message: tool
              ? {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: `call-${toolMessages.length}`,
                      type: 'function',
                      function: { name: tool, arguments: '{}' },
                    },
                  ],
                }
              : { role: 'assistant', content: answer },
            finish_reason: tool ? 'tool_calls' : 'stop',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 25, total_tokens: 105 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No fixture port');
  return { server, requests, origin: `http://127.0.0.1:${address.port}` };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.argv.includes('--serve')
)
  await startProvider(8123);
