// Correo de invitacion a una agencia. HTML con tablas y estilos en linea
// porque Gmail/Outlook ignoran <style> y casi todo el CSS moderno.

const INVITE_VALID_DAYS = 7;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface InviteEmailParams {
  to: string;
  token: string;
  tenantName: string;
  roleName: string;
  inviterName?: string | null;
}

function buildInviteEmailHtml(p: {
  link: string;
  tenantName: string;
  roleName: string;
  inviterName: string | null;
}): string {
  const tenant = escapeHtml(p.tenantName);
  const role = escapeHtml(p.roleName);
  const link = escapeHtml(p.link);
  const intro = p.inviterName
    ? `<strong style="color:#0f172a;">${escapeHtml(p.inviterName)}</strong> te invitó a unirte al equipo de <strong style="color:#0f172a;">${tenant}</strong> en TravelFlow.`
    : `Te invitaron a unirte al equipo de <strong style="color:#0f172a;">${tenant}</strong> en TravelFlow.`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>Invitación a ${tenant}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <!-- Preheader: texto que se ve en la bandeja de entrada -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Únete a ${tenant} como ${role}. La invitación vence en ${INVITE_VALID_DAYS} días.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td align="center" bgcolor="#2563eb" style="background-color:#2563eb;background-image:linear-gradient(135deg,#3b82f6,#06b6d4);padding:36px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" width="56" height="56" style="width:56px;height:56px;background-color:rgba(255,255,255,0.2);border-radius:14px;font-size:28px;line-height:56px;">✈️</td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#dbeafe;font-weight:600;">TravelFlow</p>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">Te invitaron a ${tenant}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">¡Hola!</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#334155;">${intro}</p>
              <!-- Detalles -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="display:block;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Agencia</span>
                    <span style="display:block;margin-top:4px;font-size:15px;color:#0f172a;font-weight:600;">${tenant}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Tu rol</span>
                    <span style="display:inline-block;margin-top:6px;padding:4px 12px;background-color:#dbeafe;color:#1d4ed8;border-radius:999px;font-size:13px;font-weight:600;">${role}</span>
                  </td>
                </tr>
              </table>
              <!-- Boton -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#2563eb" style="border-radius:10px;background-color:#2563eb;background-image:linear-gradient(135deg,#3b82f6,#06b6d4);">
                    <a href="${link}" target="_blank" style="display:block;padding:14px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Aceptar invitación y crear mi cuenta</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                Esta invitación vence en <strong>${INVITE_VALID_DAYS} días</strong>.
              </p>
              <!-- Enlace alterno -->
              <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
                ¿El botón no funciona? Copia y pega este enlace en tu navegador:<br />
                <a href="${link}" target="_blank" style="color:#2563eb;word-break:break-all;">${link}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
                Si no esperabas esta invitación, puedes ignorar este correo.<br />
                TravelFlow — Sistema de gestión para agencias de viajes
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Envia el correo de invitacion por Brevo. No lanza error: solo lo registra. */
export async function sendInviteEmail({ to, token, tenantName, roleName, inviterName }: InviteEmailParams) {
  const BASE_URL = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const link = `${BASE_URL}/auth/accept-invite?token=${encodeURIComponent(token)}`;

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: `Te invitaron a unirte a ${tenantName} en TravelFlow`,
        htmlContent: buildInviteEmailHtml({ link, tenantName, roleName, inviterName: inviterName || null }),
        to: [{ email: to }],
        sender: { name: 'TravelFlow', email: process.env.BREVO_SENDER_EMAIL || '' },
      }),
    });

    if (!brevoResponse.ok) {
      console.error('Brevo error:', await brevoResponse.text());
    }
  } catch (err) {
    console.error('Error sending invite email via Brevo:', err);
  }
}
