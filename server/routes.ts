import { Express } from 'express';
import { v4 as uuid } from 'uuid';
import { queries } from './db';

export function setupRoutes(app: Express) {
  // List all pages
  app.get('/api/pages', (_req, res) => {
    const pages = queries.getAllPages.all();
    res.json(pages);
  });

  // Get a page with all its blocks
  app.get('/api/pages/:id', (req, res) => {
    const page = queries.getPageById.get(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const blocks = queries.getBlocksByPageId.all(req.params.id);
    res.json({ page, blocks });
  });

  // Create a new page
  app.post('/api/pages', (req, res) => {
    const id = uuid();
    const title = req.body.title || 'Untitled';
    queries.createPage.run(id, title);
    res.status(201).json({ id, title });
  });
}
