import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: bookingId } = await params;

    // Fetch booking with all relations
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        client: true,
        destination: {
          include: { season: true },
        },
        payments: {
          orderBy: { paymentNumber: 'asc' },
        },
        tenant: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const isCash = booking.paymentType === 'CASH';
    const totalPaid = isCash
      ? booking.totalPrice
      : booking.payments.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
    const remaining = booking.totalPrice - totalPaid;
    const progress = Math.round((totalPaid / booking.totalPrice) * 100);

    const formatDate = (date: Date | string) => {
      return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es });
    };

    const formatCurrency = (amount: number) => {
      return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };

    // Get logo URL if exists
    let logoUrl = '';
    if (booking.tenant?.logo) {
      try {
        const isPublic = booking.tenant.logo.includes('/public/');
        logoUrl = await getFileUrl(booking.tenant.logo, isPublic);
      } catch (e) {
        console.error('Error getting logo URL:', e);
      }
    }

    // Build payment section HTML
    let paymentSectionHtml = '';
    if (isCash) {
      paymentSectionHtml = `
      <div class="section">
        <div class="section-title">Método de Pago</div>
        <div style="text-align: center; padding: 15px;">
          <span style="background: #22c55e; color: white; padding: 8px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">
            Pagado de Contado
          </span>
        </div>
      </div>`;
    } else {
      const hasPaidDates = booking.payments.some((p: any) => p.paidDate);
      const paymentRows = booking.payments.map((payment: any) => {
        const pending = Math.max(0, payment.amount - (payment.paidAmount || 0));
        const statusClass = payment.status === 'PAID' ? 'status-paid' : payment.status === 'PENDING' ? 'status-pending' : 'status-overdue';
        const statusText = payment.status === 'PAID' ? 'Pagado' : payment.status === 'PENDING' ? 'Pendiente' : 'Vencido';
        return `
          <tr>
            <td>${payment.paymentNumber}</td>
            <td>${formatDate(payment.dueDate)}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>${formatCurrency(payment.paidAmount || 0)}</td>
            <td>${formatCurrency(pending)}</td>
            <td class="${statusClass}">${statusText}</td>
            ${hasPaidDates ? `<td>${payment.paidDate ? formatDate(payment.paidDate) : '-'}</td>` : ''}
          </tr>`;
      }).join('');

      paymentSectionHtml = `
      <div class="section">
        <div class="section-title">Historial de Pagos</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha de Vencimiento</th>
              <th>Monto</th>
              <th>Abonado</th>
              <th>Pendiente</th>
              <th>Estado</th>
              ${hasPaidDates ? '<th>Fecha de Pago</th>' : ''}
            </tr>
          </thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>`;
    }

    // Generate HTML for PDF
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
          padding: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px solid #0891b2;
        }
        .header-content {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 10px;
        }
        .header-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
        }
        .header-info {
          text-align: left;
        }
        .logo-text {
          font-size: 28px;
          font-weight: bold;
          color: #0891b2;
          margin-bottom: 5px;
        }
        .agency-contact {
          font-size: 12px;
          color: #666;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
          margin-top: 10px;
        }
        .receipt-number {
          margin-top: 10px;
          font-size: 12px;
          color: #888;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #0891b2;
          margin-bottom: 12px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .info-item {
          margin-bottom: 8px;
        }
        .info-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 14px;
          font-weight: 500;
        }
        .summary-cards {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 25px;
        }
        .summary-card {
          flex: 1;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .summary-card.total {
          background: #f0fdf4;
          border: 1px solid #22c55e;
        }
        .summary-card.paid {
          background: #eff6ff;
          border: 1px solid #3b82f6;
        }
        .summary-card.remaining {
          background: #fff7ed;
          border: 1px solid #f97316;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .summary-value {
          font-size: 20px;
          font-weight: bold;
          margin-top: 5px;
        }
        .summary-card.total .summary-value { color: #16a34a; }
        .summary-card.paid .summary-value { color: #2563eb; }
        .summary-card.remaining .summary-value { color: #ea580c; }
        .progress-bar {
          height: 12px;
          background: #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 5px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #0891b2, #22d3ee);
          border-radius: 6px;
        }
        .progress-text {
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th {
          background: #f8fafc;
          padding: 12px 8px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        td {
          padding: 10px 8px;
          font-size: 13px;
          border-bottom: 1px solid #e2e8f0;
        }
        .status-paid {
          color: #16a34a;
          font-weight: 600;
        }
        .status-pending {
          color: #f97316;
          font-weight: 600;
        }
        .status-overdue {
          color: #dc2626;
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #888;
        }
        .date-generated {
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoUrl ? `
        <div class="header-content">
          <img src="${logoUrl}" alt="Logo" class="header-logo" />
          <div class="header-info">
            <div class="logo-text">${booking.tenant?.name || 'TravelFlow'}</div>
            ${booking.tenant?.phone ? `<div class="agency-contact">Tel: ${booking.tenant.phone}</div>` : ''}
            ${booking.tenant?.email ? `<div class="agency-contact">${booking.tenant.email}</div>` : ''}
          </div>
        </div>
        ` : `
        <div class="logo-text">${booking.tenant?.name || 'TravelFlow'}</div>
        ${booking.tenant?.phone ? `<div class="agency-contact">Tel: ${booking.tenant.phone}</div>` : ''}
        ${booking.tenant?.email ? `<div class="agency-contact">${booking.tenant.email}</div>` : ''}
        `}
        ${booking.tenant?.address ? `<div class="agency-contact" style="margin-top: 5px;">${booking.tenant.address}</div>` : ''}
        <div class="subtitle">Estado de Cuenta - Viaje</div>
        <div class="receipt-number">Folio: ${booking.id.slice(-8).toUpperCase()}</div>
      </div>

      <div class="section">
        <div class="section-title">Información del Cliente</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nombre</div>
            <div class="info-value">${booking.client?.fullName || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Teléfono</div>
            <div class="info-value">${booking.client?.phone || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${booking.client?.email || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Fecha de Venta</div>
            <div class="info-value">${formatDate(booking.saleDate)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Información del Viaje</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Destino</div>
            <div class="info-value">${booking.destination?.name || '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Temporada</div>
            <div class="info-value">${booking.destination?.season?.name || 'Sin temporada'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Fecha de Salida</div>
            <div class="info-value">${booking.departureDate ? formatDate(booking.departureDate) : '-'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Fecha de Regreso</div>
            <div class="info-value">${booking.returnDate ? formatDate(booking.returnDate) : '-'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Resumen Financiero</div>
        <div class="summary-cards">
          <div class="summary-card total">
            <div class="summary-label">Total del Viaje</div>
            <div class="summary-value">${formatCurrency(booking.totalPrice)}</div>
          </div>
          <div class="summary-card paid">
            <div class="summary-label">Total Abonado</div>
            <div class="summary-value">${formatCurrency(totalPaid)}</div>
          </div>
          <div class="summary-card remaining">
            <div class="summary-label">Saldo Pendiente</div>
            <div class="summary-value">${formatCurrency(remaining)}</div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text">${progress}% del total pagado</div>
      </div>

      ${paymentSectionHtml}

      ${booking.notes ? `
      <div class="section">
        <div class="section-title">Notas</div>
        <p style="font-size: 13px; color: #666;">${booking.notes}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Este documento es un estado de cuenta informativo.</p>
        <p>Para cualquier aclaración, comunícate con la agencia.</p>
        <p class="date-generated">Generado el ${formatDate(new Date())}</p>
      </div>
    </body>
    </html>
    `;

    // Create PDF request
    const createResponse = await fetch(
      'https://apps.abacus.ai/api/createConvertHtmlToPdfRequest',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          html_content: html,
          pdf_options: {
            format: 'A4',
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            print_background: true,
          },
        }),
      }
    );

    if (!createResponse.ok) {
      return NextResponse.json(
        { error: 'Error al crear la solicitud de PDF' },
        { status: 500 }
      );
    }

    const { request_id } = await createResponse.json();

    if (!request_id) {
      return NextResponse.json(
        { error: 'No se recibió ID de solicitud' },
        { status: 500 }
      );
    }

    // Poll for status
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        'https://apps.abacus.ai/api/getConvertHtmlToPdfStatus',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id,
            deployment_token: process.env.ABACUSAI_API_KEY,
          }),
        }
      );

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || 'FAILED';
      const result = statusResult?.result || null;

      if (status === 'SUCCESS' && result?.result) {
        const pdfBuffer = Buffer.from(result.result, 'base64');
        const fileName = `estado_cuenta_${booking.client?.fullName?.replace(/\s+/g, '_') || 'cliente'}_${format(new Date(), 'yyyyMMdd')}.pdf`;

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      } else if (status === 'FAILED') {
        return NextResponse.json(
          { error: 'Error al generar el PDF' },
          { status: 500 }
        );
      }

      attempts++;
    }

    return NextResponse.json(
      { error: 'Tiempo de espera agotado' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { error: 'Error al generar el recibo' },
      { status: 500 }
    );
  }
}
