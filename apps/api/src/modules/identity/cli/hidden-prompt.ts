import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

/** The streams of the prompt: standard input and error unless a caller passes its own. */
export interface HiddenPromptStreams {
  /** Where the answer is typed; a terminal is detected through its `isTTY` flag. */
  input?: Readable;
  /** Where the question is written and where a terminal would echo the answer. */
  output?: Writable;
}

/**
 * Asks for a password without echoing it: what is typed never reaches a log line, and on a terminal
 * it is also kept off the screen (CLI-06). The answer is read from `process.stdin`, like any other
 * prompt: with standard input at end-of-file there is nothing to read, which is what
 * `--password-stdin` exists for.
 *
 * The streams are parameters so a test can hand over a stream flagged as a terminal and watch what
 * the prompt writes while the answer is typed (CLI-06).
 */
export function promptHidden(question: string, streams: HiddenPromptStreams = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = (streams.input ?? process.stdin) as Readable & { isTTY?: boolean };
    const output = (streams.output ?? process.stderr) as Writable;
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
      // Resolve before closing: `close` also resolves (with nothing), and the first call wins.
      resolve(answer);
      rl.close();
      if (original !== undefined) muted._writeToOutput = original;
      // The line the terminal would have echoed is replaced by a newline, so the next output starts clean.
      if (terminal) output.write('\n');
    });
    // Standard input closed with no answer: an empty answer, which the password rule refuses.
    rl.on('close', () => resolve(''));
    rl.on('error', reject);
  });
}
