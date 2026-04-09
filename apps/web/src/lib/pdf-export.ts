/**
 * Opens a new window with formatted HTML content and triggers the browser print dialog.
 * The user can then save as PDF or print directly.
 */
export function exportToPdf(title: string, content: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  const now = new Date();
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #475569; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 36px; height: 36px; background: #0F172A; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #3B82F6; font-weight: 800; font-size: 18px; font-family: 'Inter', Arial, sans-serif; }
        .logo-text { font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.5px; }
        .logo-sub { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; }
        .header-right { text-align: right; font-size: 11px; color: #64748B; }
        .meta { color: #64748B; font-size: 12px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th { text-align: left; padding: 6px 8px; background: #f1f5f9; border: 1px solid #e2e8f0; font-weight: 600; }
        td { padding: 6px 8px; border: 1px solid #e2e8f0; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; font-size: 12px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: 700; }
        .stat-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 2px solid #0F172A; font-size: 10px; color: #64748B; display: flex; justify-content: space-between; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">
          <div class="logo-icon">V</div>
          <div>
            <div class="logo-text">Velnari</div>
            <div class="logo-sub">Sistema Operativo de Seguridad Municipal</div>
          </div>
        </div>
        <div class="header-right">
          Documento oficial<br>
          ${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <h1>${title}</h1>
      ${content}
      <div class="footer">
        <span>Documento oficial generado por Velnari &middot; ${now.toLocaleString('es-MX')}</span>
        <span>${now.toISOString()}</span>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 300);
}
