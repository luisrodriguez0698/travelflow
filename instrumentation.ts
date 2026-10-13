// Tareas en segundo plano del servidor (Next llama a register() al arrancar).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('./lib/scheduler');
  startScheduler();
}
