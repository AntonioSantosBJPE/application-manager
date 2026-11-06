import { createInterface } from 'node:readline';

/**
 * Asks for a password without echoing it: what is typed never reaches a log line, and on a terminal
 * it is also kept off the screen (CLI-06). The answer is read from `process.stdin`, like any other
 * prompt: with standard input at end-of-file there is nothing to read, which is what
 * `--password-stdin` exists for.
 */
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stderr;
    const terminal = input.isTTY === true;
    const rl = createInterface({ input, output, terminal });

    // The mute is internal to readline; a terminal that does not echo keeps the answer out of sight.
    const muted = rl as unknown as { _writeToOutput?: (text: string) => void };
    const original = muted._writeToOutput?.bind(rl);
    if (original !== undefined) {
      muted._writeToOutput = (text: string) => {
        if (text.includes(question)) original(question);
      };
    }

    output.write(question);
    rl.question('', (answer) => {
      rl.close();
      if (original !== undefined) muted._writeToOutput = original;
      // The line the terminal would have echoed is replaced by a newline, so the next output starts clean.
      if (terminal) output.write('\n');
      resolve(answer);
    });
    rl.on('error', reject);
  });
}
