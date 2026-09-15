import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import { ensureDefaultRolesAndUsers } from './config/bootstrap';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api', (req, res) => {
  res.json({
    message: 'FDR QR Auth API is running',
    status: 'ok'
  });
});

app.get('/api/', (req, res) => {
  res.json({
    message: 'FDR QR Auth API is running',
    status: 'ok'
  });
});

import { getPublicBaseUrl } from './utils/network';

app.get('/verify', (req, res) => {
  const token = req.query.token as string || '';
  const frontendUrl = getPublicBaseUrl();
  return res.redirect(`${frontendUrl}/verify?token=${encodeURIComponent(token)}`);
});

app.use('/api', routes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 4000;

ensureDefaultRolesAndUsers()
  .then(() => {
    const portNumber = Number(port);
    app.listen(portNumber, '0.0.0.0', () => console.log(`Server running on port ${portNumber} (0.0.0.0)`));
  })
  .catch((error) => {
    console.error('Failed to initialize application bootstrap:', error);
    process.exit(1);
  });
