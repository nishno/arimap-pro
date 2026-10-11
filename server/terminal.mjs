import { emitKeypressEvents } from 'node:readline';
export async function secret(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal');
  process.stdout.write(prompt); emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) { process.stdin.off('keypress', listener); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : resolve(value); }
    function listener(str, key) {
      if (key?.ctrl && key.name === 'c') return finish(new Error('Cancelled'));
      if (key?.name === 'return' || key?.name === 'enter') return finish();
      if (key?.name === 'backspace') value = value.slice(0, -1);
      else if (str && !key?.ctrl && !key?.meta) value += str;
    }
    process.stdin.on('keypress', listener);
  });
}
