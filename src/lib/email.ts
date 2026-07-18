import "server-only";
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;

// Sin SMTP configurado (ej. desarrollo local), el correo se imprime en la
// consola del servidor en vez de fallar — así el flujo se puede probar
// completo sin depender de credenciales reales.
const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.SMTP_FROM ?? "PROMERC <no-reply@promerc.local>";
  const subject = "Recuperación de contraseña — PROMERC";
  const text = `Solicitaste recuperar tu contraseña. Abre este enlace (válido 1 hora):\n\n${resetUrl}\n\nSi no fuiste tú, ignora este correo.`;

  if (!transporter) {
    console.log(`[email:dev] Para ${to} — ${subject}\n${text}`);
    return;
  }

  await transporter.sendMail({ from, to, subject, text });
}
