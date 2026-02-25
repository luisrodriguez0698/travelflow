import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const forgotPasswordSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { email } = parsed.data;

    // Rate limit: 5 solicitudes por email cada 15 minutos (falla silenciosa para no revelar si el email existe)
    const rl = rateLimit(`forgot-password:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid exposing whether an email exists
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generate a secure random token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    const BASE_URL = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const resetLink = `${BASE_URL}/reset-password?token=${token}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 16px; margin-bottom: 12px;">
            <span style="font-size: 28px;">✈️</span>
          </div>
          <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0;">TravelFlow</h1>
        </div>
        <h2 style="font-size: 18px; color: #111827; margin-bottom: 8px;">Restablecer contraseña</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          Hola <strong>${user.name || user.email}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
        </p>
        <a href="${resetLink}"
           style="display: block; text-align: center; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 20px;">
          Restablecer contraseña
        </a>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 8px;">
          Este enlace expira en <strong>1 hora</strong>.
        </p>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #d1d5db; font-size: 11px; text-align: center;">
          TravelFlow — Sistema de gestión para agencias de viajes
        </p>
      </div>
    `;

    try {
      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Restablecer contraseña — TravelFlow',
          htmlContent,
          to: [{ email: user.email, name: user.name || user.email }],
          sender: { name: 'TravelFlow', email: process.env.BREVO_SENDER_EMAIL || '' },
        }),
      });

      if (!brevoResponse.ok) {
        console.error('Brevo error:', await brevoResponse.text());
      }
    } catch (err) {
      console.error('Error sending reset email:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
