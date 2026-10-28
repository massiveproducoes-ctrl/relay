import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
export const VENV_PYTHON = join(ROOT, '.venv', 'Scripts', 'python.exe');
const SCRIPT = join(ROOT, 'scripts', 'transcribe.py');

export interface TranscribeOptions {
  model?: string;
  language?: string;
  // O primeiro uso baixa o modelo, então o limite padrão é folgado.
  timeoutMs?: number;
}

// Transcreve um áudio local com Whisper (CPU) e devolve só o texto.
export function transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<string> {
  if (!existsSync(VENV_PYTHON)) {
    return Promise.reject(new Error(`venv ausente em ${VENV_PYTHON}; crie com "python -m venv .venv" e instale faster-whisper`));
  }
  if (!existsSync(audioPath)) {
    return Promise.reject(new Error(`áudio não encontrado: ${audioPath}`));
  }
  const args = [SCRIPT, audioPath, '--model', opts.model ?? 'small', '--language', opts.language ?? 'pt'];
  return new Promise((resolve, reject) => {
    execFile(
      VENV_PYTHON,
      args,
      { timeout: opts.timeoutMs ?? 300_000, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', HF_HUB_DISABLE_PROGRESS_BARS: '1' } },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`transcrição falhou: ${stderr.trim().split('\n').pop() || err.message}`));
        resolve(stdout.trim());
      },
    );
  });
}
