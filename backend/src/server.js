import { buildApp } from './app.js';
const app = await buildApp();
try { await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 8080) }); }
catch (error) { app.log.error(error); process.exit(1); }
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
