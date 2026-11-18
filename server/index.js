import express from 'express';
import { createInvoiceExpressHandler } from './controllers/createInvoiceController.js';
import paymentsRouter from './routes/payments.js';

const app = express();

// Seguridad básica y parseo JSON para callbacks IPN y facturas de NowPayments
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'conoscamosnos-payments-api',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/payments/create-invoice', createInvoiceExpressHandler);
app.use('/api/webhooks', paymentsRouter);

const port = Number(process.env.API_PORT || process.env.PORT || 4000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.info(`[Conoscamosnos API] Servidor escuchando en http://localhost:${port}`);
  });
}

export default app;
