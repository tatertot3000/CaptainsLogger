import fs from 'node:fs';
import path from 'node:path';

export function localDiskDbPlugin() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const dataFile = path.join(dataDir, 'captains-log.json');

  return {
    name: 'local-disk-db-plugin',
    configureServer(server) {
      // Never expose or write to data/captains-log.json when running in demo mode
      if (server.config.mode === 'demo') {
        return;
      }

      server.middlewares.use('/api/local-db', (req, res) => {
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET') {
          try {
            if (fs.existsSync(dataFile)) {
              const raw = fs.readFileSync(dataFile, 'utf-8');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  exists: true,
                  filePath: dataFile,
                  data: JSON.parse(raw),
                })
              );
            } else {
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false, filePath: dataFile }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
              }
              fs.writeFileSync(dataFile, JSON.stringify(parsed, null, 2), 'utf-8');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  ok: true,
                  filePath: dataFile,
                  savedAt: new Date().toISOString(),
                })
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    },
  };
}

