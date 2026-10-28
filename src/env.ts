// Variáveis que redirecionariam o claude para outro provedor. A sessão principal
// roda sempre no login oficial (Remote Control não funciona com outro host).
export const BLOCKED_VARS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
] as const;

export interface CleanEnv {
  env: NodeJS.ProcessEnv;
  // Só os NOMES das variáveis removidas, nunca os valores.
  removed: string[];
}

// Devolve uma cópia do ambiente sem as variáveis bloqueadas; o process.env do pai não muda.
export function cleanEnv(source: NodeJS.ProcessEnv = process.env): CleanEnv {
  const env: NodeJS.ProcessEnv = { ...source };
  const removed: string[] = [];
  for (const name of BLOCKED_VARS) {
    if (name in env) {
      delete env[name];
      removed.push(name);
    }
  }
  return { env, removed };
}
