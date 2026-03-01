import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './ws';
import { setupRoutes } from './routes';

const app = express();
app.use(cors());
app.use(express.json());

setupRoutes(app);

const server = http.createServer(app);
setupWebSocket(server);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
