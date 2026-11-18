import express from 'express';
import paymentsRouter from './routes/payments.js';

const app = express();

// Seguridad básica y parseo compatible con NowPayments (JSON) y Payeer (urlencoded)
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'conoscamosnos-payments-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/webhooks', paymentsRouter);

const port = Number(process.env.API_PORT || process.env.PORT || 4000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.info(`[Conoscamosnos API] Servidor escuchando en http://localhost:${port}`);
  });
}

export default app;
