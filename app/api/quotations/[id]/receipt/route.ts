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

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId, type: 'QUOTATION' },
      include: {
        client: true,
        destination: { include: { season: true } },
        payments: { orderBy: { paymentNumber: 'asc' } },
        tenant: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true, destination: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const isCash = booking.paymentType === 'CASH';

    const formatDate = (date: Date | string) => {
      return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es });
    };

    const formatCurrency = (amount: number) => {
      return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };

    let logoUrl = '';
    if (booking.tenant?.logo) {
      try {
        const isPublic = booking.tenant.logo.includes('/public/');
        logoUrl = await getFileUrl(booking.tenant.logo, isPublic);
      } catch (e) {
        console.error('Error getting logo URL:', e);
      }
    }

    // Collect unique hotels from booking items (deduplicate by hotel ID)
    const itemHotels: any[] = [];
    const seenHotelIds = new Set<string>();
    const items = (booking as any).items || [];
    for (const item of items) {
      if (item.type === 'HOTEL' && item.hotel && !seenHotelIds.has(item.hotel.id)) {
        seenHotelIds.add(item.hotel.id);
        itemHotels.push(item.hotel);
      }
    }
    // Fallback to booking-level hotel for legacy data
    if (itemHotels.length === 0 && booking.hotel) {
      itemHotels.push(booking.hotel);
    }

    // Resolve image URLs for each unique hotel
    const hotelImageMap: Record<string, string[]> = {};
    for (const hotel of itemHotels) {
      const urls: string[] = [];
      if (hotel.images?.length) {
        for (const imgPath of hotel.images.slice(0, 6)) {
          try {
            const isPublic = imgPath.includes('/public/');
            const url = await getFileUrl(imgPath, isPublic);
            urls.push(url);
          } catch (e) {
            console.error('Error getting hotel image URL:', e);
          }
        }
      }
      hotelImageMap[hotel.id] = urls;
    }

    // Build legacy hotel section (for bookings without hotel items, e.g. old data)
    const hasHotelItems = items.some((i: any) => i.type === 'HOTEL' && i.hotel);
    let hotelsSectionHtml = '';
    if (!hasHotelItems && itemHotels.length > 0) {
      hotelsSectionHtml = `<div class="section"><div class="section-title">Información de Hoteles</div>`;
      for (const h of itemHotels) {
        const starsStr = h.stars > 0 ? '★'.repeat(h.stars) : '';
        const diamondsStr = h.diamonds > 0 ? '◆'.repeat(h.diamonds) : '';
        const classification = [starsStr, diamondsStr].filter(Boolean).join(' ');
        const imgUrls = hotelImageMap[h.id] || [];

        hotelsSectionHtml += `
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: bold; color: #0891b2; margin-bottom: 4px;">${h.name}</div>
          ${classification ? `<div style="font-size: 14px; color: #eab308; margin-bottom: 8px;">${classification}</div>` : ''}
          <div class="info-grid">
            ${h.plan ? `<div class="info-item"><div class="info-label">Plan</div><div class="info-value">${h.plan}</div></div>` : ''}
            ${h.checkIn ? `<div class="info-item"><div class="info-label">Check-In</div><div class="info-value">${h.checkIn}${h.checkInNote ? `<br><span style="font-size:11px;color:#666;">${h.checkInNote}</span>` : ''}</div></div>` : ''}
            ${h.checkOut ? `<div class="info-item"><div class="info-label">Check-Out</div><div class="info-value">${h.checkOut}${h.checkOutNote ? `<br><span style="font-size:11px;color:#666;">${h.checkOutNote}</span>` : ''}</div></div>` : ''}
          </div>
          ${h.idRequirement ? `<div style="margin-top: 10px; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;"><strong>Identificación requerida:</strong> ${h.idRequirement}</div>` : ''}
          ${h.includes?.length > 0 ? `
          <div style="margin-top: 10px;">
            <div style="font-weight: 600; font-size: 13px; color: #16a34a; margin-bottom: 6px;">Incluye:</div>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${h.includes.map((inc: string) => `<li style="font-size: 13px; padding: 2px 0; color: #333;">✓ ${inc}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${h.notIncludes?.length > 0 ? `
          <div style="margin-top: 10px;">
            <div style="font-weight: 600; font-size: 13px; color: #dc2626; margin-bottom: 6px;">No Incluye:</div>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${h.notIncludes.map((ni: string) => `<li style="font-size: 13px; padding: 2px 0; color: #333;">✗ ${ni}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${imgUrls.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">
            ${imgUrls.map((url) => `<img src="${url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px;" />`).join('')}
          </div>` : ''}
        </div>`;
      }
      hotelsSectionHtml += `</div>`;
    }

    // Build services section HTML (pre-built to avoid IIFE scoping issues)
    let servicesSectionHtml = '';
    if (items.length > 0) {
      const hotelItems = items.filter((i: any) => i.type === 'HOTEL');
      const flightItems = items.filter((i: any) => i.type === 'FLIGHT');
      const tourItems = items.filter((i: any) => i.type === 'TOUR');

      servicesSectionHtml = '<div class="section"><div class="section-title">Servicios del Paquete</div>';

      // Hospedaje table + hotel detail cards
      if (hotelItems.length > 0) {
        servicesSectionHtml += '<div style="margin-bottom: 15px;">';
        servicesSectionHtml += '<div style="font-weight: 600; font-size: 14px; color: #2563eb; margin-bottom: 8px;">Hospedaje</div>';
        servicesSectionHtml += '<table><thead><tr><th>#</th><th>Hotel</th><th>Tipo Hab.</th><th>Plan</th><th>Ocupación</th><th>Noches</th><th style="text-align:right;">Costo</th></tr></thead><tbody>';
        hotelItems.forEach((item: any, idx: number) => {
          servicesSectionHtml += '<tr>';
          servicesSectionHtml += '<td>Hab. ' + (idx + 1) + '</td>';
          servicesSectionHtml += '<td>' + (item.hotel?.name || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.roomType || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.plan || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.numAdults || 0) + ' Ad. / ' + (item.numChildren || 0) + ' Men.</td>';
          servicesSectionHtml += '<td>' + (item.numNights || 0) + '</td>';
          servicesSectionHtml += '<td style="text-align:right;">' + formatCurrency(item.cost || 0) + '</td>';
          servicesSectionHtml += '</tr>';
        });
        servicesSectionHtml += '</tbody></table></div>';

        // Hotel detail cards with images (unique hotels only)
        const uniqueHotels: any[] = [];
        const seenHIds = new Set<string>();
        for (const hi of hotelItems) {
          if (hi.hotel && !seenHIds.has(hi.hotel.id)) {
            seenHIds.add(hi.hotel.id);
            uniqueHotels.push(hi.hotel);
          }
        }

        for (const h of uniqueHotels) {
          const starsStr = h.stars > 0 ? '★'.repeat(h.stars) : '';
          const diamondsStr = h.diamonds > 0 ? '◆'.repeat(h.diamonds) : '';
          const classif = [starsStr, diamondsStr].filter(Boolean).join(' ');
          const imgUrls = hotelImageMap[h.id] || [];

          servicesSectionHtml += '<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 12px; margin-bottom: 8px;">';
          servicesSectionHtml += '<div style="font-size: 16px; font-weight: bold; color: #0891b2; margin-bottom: 4px;">' + h.name + '</div>';
          if (classif) servicesSectionHtml += '<div style="font-size: 14px; color: #eab308; margin-bottom: 8px;">' + classif + '</div>';
          servicesSectionHtml += '<div class="info-grid">';
          if (h.plan) servicesSectionHtml += '<div class="info-item"><div class="info-label">Plan</div><div class="info-value">' + h.plan + '</div></div>';
          if (h.checkIn) servicesSectionHtml += '<div class="info-item"><div class="info-label">Check-In</div><div class="info-value">' + h.checkIn + (h.checkInNote ? '<br><span style="font-size:11px;color:#666;">' + h.checkInNote + '</span>' : '') + '</div></div>';
          if (h.checkOut) servicesSectionHtml += '<div class="info-item"><div class="info-label">Check-Out</div><div class="info-value">' + h.checkOut + (h.checkOutNote ? '<br><span style="font-size:11px;color:#666;">' + h.checkOutNote + '</span>' : '') + '</div></div>';
          servicesSectionHtml += '</div>';
          if (h.idRequirement) servicesSectionHtml += '<div style="margin-top: 10px; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;"><strong>Identificación requerida:</strong> ' + h.idRequirement + '</div>';
          if (h.includes?.length > 0) {
            servicesSectionHtml += '<div style="margin-top: 10px;"><div style="font-weight: 600; font-size: 13px; color: #16a34a; margin-bottom: 6px;">Incluye:</div><ul style="list-style: none; padding: 0; margin: 0;">';
            h.includes.forEach((inc: string) => { servicesSectionHtml += '<li style="font-size: 13px; padding: 2px 0; color: #333;">✓ ' + inc + '</li>'; });
            servicesSectionHtml += '</ul></div>';
          }
          if (h.notIncludes?.length > 0) {
            servicesSectionHtml += '<div style="margin-top: 10px;"><div style="font-weight: 600; font-size: 13px; color: #dc2626; margin-bottom: 6px;">No Incluye:</div><ul style="list-style: none; padding: 0; margin: 0;">';
            h.notIncludes.forEach((ni: string) => { servicesSectionHtml += '<li style="font-size: 13px; padding: 2px 0; color: #333;">✗ ' + ni + '</li>'; });
            servicesSectionHtml += '</ul></div>';
          }
          if (imgUrls.length > 0) {
            servicesSectionHtml += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">';
            imgUrls.forEach((url: string) => { servicesSectionHtml += '<img src="' + url + '" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px;" />'; });
            servicesSectionHtml += '</div>';
          }
          servicesSectionHtml += '</div>';
        }
      }

      // Vuelos table
      if (flightItems.length > 0) {
        servicesSectionHtml += '<div style="margin-bottom: 15px;">';
        servicesSectionHtml += '<div style="font-weight: 600; font-size: 14px; color: #0891b2; margin-bottom: 8px;">Vuelos</div>';
        servicesSectionHtml += '<table><thead><tr><th>Dirección</th><th>Aerolínea</th><th>Vuelo</th><th>Ruta</th><th>Horario</th><th>Clase</th><th style="text-align:right;">Costo</th></tr></thead><tbody>';
        flightItems.forEach((item: any) => {
          let timeStr = '';
          if (item.departureTime) {
            const dt = new Date(item.departureTime);
            timeStr = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
          }
          if (item.arrivalTime) {
            const at = new Date(item.arrivalTime);
            timeStr += ' - ' + String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
          }
          const classLabel = item.flightClass === 'ECONOMICA' ? 'Económica' : item.flightClass === 'BUSINESS' ? 'Business' : item.flightClass || '-';
          servicesSectionHtml += '<tr>';
          servicesSectionHtml += '<td>' + (item.direction === 'IDA' ? 'Ida' : 'Regreso') + '</td>';
          servicesSectionHtml += '<td>' + (item.airline || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.flightNumber || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.origin || '?') + ' → ' + (item.flightDestination || '?') + '</td>';
          servicesSectionHtml += '<td>' + (timeStr || '-') + '</td>';
          servicesSectionHtml += '<td>' + classLabel + '</td>';
          servicesSectionHtml += '<td style="text-align:right;">' + formatCurrency(item.cost || 0) + '</td>';
          servicesSectionHtml += '</tr>';
        });
        servicesSectionHtml += '</tbody></table></div>';
      }

      // Tours table
      if (tourItems.length > 0) {
        servicesSectionHtml += '<div style="margin-bottom: 15px;">';
        servicesSectionHtml += '<div style="font-weight: 600; font-size: 14px; color: #b45309; margin-bottom: 8px;">Tours</div>';
        servicesSectionHtml += '<table><thead><tr><th>Tour</th><th>Fecha</th><th>Personas</th><th style="text-align:right;">Precio/Persona</th><th style="text-align:right;">Costo</th></tr></thead><tbody>';
        tourItems.forEach((item: any) => {
          servicesSectionHtml += '<tr>';
          servicesSectionHtml += '<td>' + (item.tourName || '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.tourDate ? formatDate(item.tourDate) : '-') + '</td>';
          servicesSectionHtml += '<td>' + (item.numPeople || 0) + '</td>';
          servicesSectionHtml += '<td style="text-align:right;">' + formatCurrency(item.pricePerPerson || 0) + '</td>';
          servicesSectionHtml += '<td style="text-align:right;">' + formatCurrency(item.cost || 0) + '</td>';
          servicesSectionHtml += '</tr>';
        });
        servicesSectionHtml += '</tbody></table></div>';
      }

      const totalCost = items.reduce((s: number, i: any) => s + (i.cost || 0), 0);
      servicesSectionHtml += '<div style="text-align: right; font-weight: bold; font-size: 14px; color: #1e293b; margin-top: 8px;">Costo Neto Total: ' + formatCurrency(totalCost) + '</div>';
      servicesSectionHtml += '</div>';
    }

    // Build destination display
    const destinationDisplay = booking.destination?.name || (() => {
      const destNames = [...new Set(items.filter((i: any) => i.destination).map((i: any) => i.destination.name))];
      return destNames.length > 0 ? destNames.join(', ') : '-';
    })();

    // Build passengers section HTML
    let passengersSectionHtml = '';
    if (booking.passengers?.length > 0) {
      const holder = booking.passengers.find((p: any) => p.isHolder);
      const others = booking.passengers.filter((p: any) => !p.isHolder);
      passengersSectionHtml = `
      <div class="section">
        <div class="section-title">Pasajeros</div>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Edad</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            ${holder ? `<tr><td><strong>${holder.name}</strong></td><td>${holder.type === 'ADULT' ? 'Adulto' : 'Menor'}</td><td>${holder.age || '-'}</td><td><span style="background: #0891b2; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Titular</span></td></tr>` : ''}
            ${others.map((p: any) => `<tr><td>${p.name}</td><td>${p.type === 'ADULT' ? 'Adulto' : 'Menor'}</td><td>${p.age || '-'}</td><td>Acompañante</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    // Build payment section HTML for quotation (all pending - preview only)
    let paymentSectionHtml = '';
    if (isCash) {
      paymentSectionHtml = `
      <div class="section">
        <div class="section-title">Método de Pago</div>
        <div style="text-align: center; padding: 15px;">
          <span style="background: #0891b2; color: white; padding: 8px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">
            Pago de Contado
          </span>
        </div>
      </div>`;
    } else {
      const paymentRows = booking.payments.map((payment: any) => {
        return `
          <tr>
            <td>${payment.paymentNumber}</td>
            <td>${formatDate(payment.dueDate)}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td class="status-pending">Pendiente</td>
          </tr>`;
      }).join('');

      const frequencyLabel = (booking as any).paymentFrequency === 'MENSUAL' ? 'Mensual' : 'Quincenal';
      paymentSectionHtml = `
      <div class="section">
        <div class="section-title">Plan de Pagos Propuesto</div>
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Frecuencia de pagos: <strong>${frequencyLabel}</strong></div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha de Vencimiento</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>`;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0891b2; }
        .header-content { display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 10px; }
        .header-logo { width: 80px; height: 80px; object-fit: contain; }
        .header-info { text-align: left; }
        .logo-text { font-size: 28px; font-weight: bold; color: #0891b2; margin-bottom: 5px; }
        .agency-contact { font-size: 12px; color: #666; }
        .subtitle { color: #666; font-size: 14px; margin-top: 10px; }
        .receipt-number { margin-top: 10px; font-size: 12px; color: #888; }
        .quotation-badge { display: inline-block; background: #f59e0b; color: white; padding: 4px 16px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-top: 8px; }
        .expiration-note { font-size: 12px; color: #f59e0b; margin-top: 5px; font-weight: 500; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 16px; font-weight: bold; color: #0891b2; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .info-item { margin-bottom: 8px; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .info-value { font-size: 14px; font-weight: 500; }
        .summary-cards { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px; }
        .summary-card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-card.total { background: #f0fdf4; border: 1px solid #22c55e; }
        .summary-card.down { background: #eff6ff; border: 1px solid #3b82f6; }
        .summary-card.payments { background: #fff7ed; border: 1px solid #f97316; }
        .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .summary-value { font-size: 20px; font-weight: bold; margin-top: 5px; }
        .summary-card.total .summary-value { color: #16a34a; }
        .summary-card.down .summary-value { color: #2563eb; }
        .summary-card.payments .summary-value { color: #ea580c; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f8fafc; padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px 8px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .status-pending { color: #f97316; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #888; }
        .disclaimer { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 25px; text-align: center; font-size: 12px; color: #92400e; }
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
        <div class="subtitle">Cotización de Viaje</div>
        <div class="quotation-badge">COTIZACIÓN</div>
        <div class="receipt-number">Folio: ${booking.id.slice(-8).toUpperCase()}</div>
        ${booking.expirationDate ? `<div class="expiration-note">Válida hasta: ${formatDate(booking.expirationDate)}</div>` : ''}
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
            <div class="info-label">Fecha de Cotización</div>
            <div class="info-value">${formatDate(booking.createdAt)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Información del Viaje</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Destino</div>
            <div class="info-value">${destinationDisplay}</div>
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

      ${hotelsSectionHtml}

      ${passengersSectionHtml}

      ${servicesSectionHtml}

      <div class="section">
        <div class="section-title">Resumen Financiero</div>
        <div class="summary-cards">
          <div class="summary-card total">
            <div class="summary-label">Total del Viaje</div>
            <div class="summary-value">${formatCurrency(booking.totalPrice)}</div>
          </div>
          ${!isCash ? `
          <div class="summary-card down">
            <div class="summary-label">Anticipo</div>
            <div class="summary-value">${formatCurrency(booking.downPayment || 0)}</div>
          </div>
          <div class="summary-card payments">
            <div class="summary-label">${booking.numberOfPayments} Pagos de</div>
            <div class="summary-value">${formatCurrency(booking.numberOfPayments > 0 ? Math.floor((booking.totalPrice - (booking.downPayment || 0)) / booking.numberOfPayments) : 0)}</div>
          </div>
          ` : ''}
        </div>
      </div>

      ${paymentSectionHtml}

      ${booking.notes ? `
      <div class="section">
        <div class="section-title">Notas</div>
        <p style="font-size: 13px; color: #666;">${booking.notes}</p>
      </div>
      ` : ''}

      <div class="disclaimer">
        Esta cotización es un documento informativo y no representa un compromiso de venta.
        ${booking.expirationDate ? `<br>Válida hasta el ${formatDate(booking.expirationDate)}.` : ''}
        Los precios están sujetos a disponibilidad.
      </div>

      <div class="footer">
        <p>Para cualquier aclaración, comunícate con la agencia.</p>
        <p style="margin-top: 5px;">Generado el ${formatDate(new Date())}</p>
      </div>
    </body>
    </html>
    `;

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
      return NextResponse.json({ error: 'Error al crear la solicitud de PDF' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return NextResponse.json({ error: 'No se recibió ID de solicitud' }, { status: 500 });
    }

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
        const fileName = `cotizacion_${booking.client?.fullName?.replace(/\s+/g, '_') || 'cliente'}_${format(new Date(), 'yyyyMMdd')}.pdf`;

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      } else if (status === 'FAILED') {
        return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 });
      }

      attempts++;
    }

    return NextResponse.json({ error: 'Tiempo de espera agotado' }, { status: 500 });
  } catch (error) {
    console.error('Error generating quotation receipt:', error);
    return NextResponse.json({ error: 'Error al generar la cotización' }, { status: 500 });
  }
}
