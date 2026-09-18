export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="sv-SE">
  <head>
    <meta charset="utf-8" />
    <title>Sidan kunde inte laddas</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 'Inter', system-ui, -apple-system, sans-serif; background: hsl(215 100% 12%); color: #FFFFFF; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: rgba(255,255,255,0.85); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.65rem 1.5rem; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #FFFFFF; color: hsl(215 100% 12%); }
      .secondary { background: rgba(255,255,255,0.12); color: #FFFFFF; border-color: rgba(255,255,255,0.28); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sidan kunde inte laddas</h1>
      <p>Något gick fel hos oss. Du kan försöka igen eller gå tillbaka till startsidan.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Försök igen</button>
        <a class="secondary" href="/">Till startsidan</a>
      </div>
    </div>
  </body>
</html>`;
}
