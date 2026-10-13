// Tareas en segundo plano del servidor (Next llama a register() al arrancar).
// Next compila este archivo tambien para el runtime "edge" (sin http/https/net):
// el import va DENTRO del if para que en esa compilacion se elimine por completo.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
