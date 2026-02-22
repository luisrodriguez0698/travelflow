import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Payment {
  paymentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
}

interface HotelData {
  id: string;
  name: string;
  stars?: number;
  diamonds?: number;
  plan?: string;
  checkIn?: string;
  checkOut?: string;
  checkInNote?: string;
  checkOutNote?: string;
  idRequirement?: string;
  includes?: string[];
  notIncludes?: string[];
  images?: string[];
}

interface BookingItem {
  type: string;
  cost: number;
  hotelId?: string;
  hotel?: HotelData;
  roomType?: string;
  numAdults?: number;
  numChildren?: number;
  pricePerNight?: number;
  numNights?: number;
  plan?: string;
  airline?: string;
  flightNumber?: string;
  origin?: string;
  flightDestination?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightClass?: string;
  direction?: string;
  tourName?: string;
  tourDate?: string;
  numPeople?: number;
  pricePerPerson?: number;
}

interface QuotationData {
  id: string;
  totalPrice: number;
  downPayment?: number;
  paymentType?: string;
  numberOfPayments?: number;
  saleDate: string;
  expirationDate?: string;
  notes?: string;
  client: {
    fullName: string;
    phone: string;
    email?: string;
  };
  departureDate?: string;
  returnDate?: string;
  destination?: {
    name: string;
    season?: { name: string };
  };
  payments: Payment[];
  items?: BookingItem[];
  tenant?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
  };
}

const CYAN = [8, 145, 178] as const;
const AMBER = [245, 158, 11] as const;
const GRAY = [100, 116, 139] as const;
const DARK = [30, 41, 59] as const;

function formatDate(date: string | Date) {
  return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es });
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getScaledLogoDimensions(
  base64: string,
  maxWidth: number,
  maxHeight: number
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      if (naturalWidth === 0 || naturalHeight === 0) {
        resolve({ width: maxWidth, height: maxHeight });
        return;
      }
      const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
      resolve({
        width: naturalWidth * ratio,
        height: naturalHeight * ratio,
      });
    };
    img.onerror = () => resolve({ width: maxWidth, height: maxHeight });
    img.src = base64;
  });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 5;
  }
  return y;
}

/** Draws a filled 5-pointed star at (cx, cy) with given size in mm */
function drawStar(doc: jsPDF, cx: number, cy: number, size: number) {
  const outerR = size / 2;
  const innerR = outerR * 0.382;
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * 36 - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? outerR : innerR;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const lines: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    lines.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]]);
  }
  doc.lines(lines, points[0][0], points[0][1], [1, 1], 'F', true);
}

/** Draws a filled diamond/rhombus at (cx, cy) with given size in mm */
function drawDiamond(doc: jsPDF, cx: number, cy: number, size: number) {
  const halfW = size / 2 * 0.7;
  const halfH = size / 2;
  const startX = cx;
  const startY = cy - halfH;
  const dLines: [number, number][] = [
    [halfW, halfH],
    [-halfW, halfH],
    [-halfW, -halfH],
  ];
  doc.lines(dLines, startX, startY, [1, 1], 'F', true);
}

async function addWatermarkToAllPages(doc: jsPDF, logoBase64: string) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const wmMaxSize = 120;

  const wmDims = await getScaledLogoDimensions(logoBase64, wmMaxSize, wmMaxSize);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const gState = new (doc as any).GState({ opacity: 0.06 });
    doc.saveGraphicsState();
    doc.setGState(gState);

    try {
      doc.addImage(
        logoBase64,
        'AUTO',
        (pageWidth - wmDims.width) / 2,
        (pageHeight - wmDims.height) / 2,
        wmDims.width,
        wmDims.height
      );
    } catch {
      // silently ignore if image fails
    }

    doc.restoreGraphicsState();
  }
}

export async function generateQuotationPdf(quotation: QuotationData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Load logo if available
  let logoBase64: string | null = null;
  if (quotation.tenant?.logo) {
    logoBase64 = await loadImageAsBase64(`/api/files/${encodeURIComponent(quotation.tenant.logo)}`);
  }

  // ─── HEADER: Logo left + Agency info right ───
  const agencyName = quotation.tenant?.name || 'TravelFlow';
  const logoMaxWidth = 28;
  const logoMaxHeight = 22;

  if (logoBase64) {
    const logoDims = await getScaledLogoDimensions(logoBase64, logoMaxWidth, logoMaxHeight);

    try {
      const logoY = y + (logoMaxHeight - logoDims.height) / 2;
      doc.addImage(logoBase64, 'AUTO', margin, logoY, logoDims.width, logoDims.height);
    } catch {
      // continue without logo
    }

    const textX = margin + logoMaxWidth + 8;
    doc.setFontSize(20);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text(agencyName, textX, y + 6);

    let infoY = y + 12;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');

    if (quotation.tenant?.phone) {
      doc.text(`Tel: ${quotation.tenant.phone}`, textX, infoY);
      infoY += 4;
    }
    if (quotation.tenant?.email) {
      doc.text(quotation.tenant.email, textX, infoY);
      infoY += 4;
    }
    if (quotation.tenant?.address) {
      doc.text(quotation.tenant.address, textX, infoY);
    }

    y += logoMaxHeight + 4;
  } else {
    doc.setFontSize(20);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text(agencyName, margin, y + 6);

    let infoY = y + 12;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');

    if (quotation.tenant?.phone) {
      doc.text(`Tel: ${quotation.tenant.phone}`, margin, infoY);
      infoY += 4;
    }
    if (quotation.tenant?.email) {
      doc.text(quotation.tenant.email, margin, infoY);
      infoY += 4;
    }
    if (quotation.tenant?.address) {
      doc.text(quotation.tenant.address, margin, infoY);
    }

    y += 22;
  }

  // Subtitle + Folio right-aligned
  doc.setFontSize(11);
  doc.setTextColor(...AMBER);
  doc.setFont('helvetica', 'bold');
  doc.text('Cotizacion de Viaje', pageWidth - margin, y - 12, { align: 'right' });

  // COTIZACIÓN badge
  const badgeText = 'COTIZACION';
  doc.setFontSize(8);
  const badgeWidth = doc.getTextWidth(badgeText) + 10;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(...AMBER);
  doc.roundedRect(badgeX, y - 9, badgeWidth, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, badgeX + badgeWidth / 2, y - 4.5, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Folio: ${quotation.id.slice(-8).toUpperCase()}`, pageWidth - margin, y + 1, { align: 'right' });

  // Expiration date
  if (quotation.expirationDate) {
    doc.setFontSize(8);
    doc.setTextColor(...AMBER);
    doc.setFont('helvetica', 'bold');
    doc.text(`Valida hasta: ${formatDate(quotation.expirationDate)}`, pageWidth - margin, y + 5, { align: 'right' });
    y += 2;
  }

  y += 4;

  // Header line
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ─── CLIENT & TRIP INFO ───
  const colWidth = (pageWidth - margin * 2 - 10) / 2;

  doc.setFontSize(12);
  doc.setTextColor(...CYAN);
  doc.setFont('helvetica', 'bold');
  doc.text('Informacion del Cliente', margin, y);
  doc.text('Informacion del Viaje', margin + colWidth + 10, y);
  y += 2;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + colWidth, y);
  doc.line(margin + colWidth + 10, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const drawField = (label: string, value: string, x: number, currentY: number) => {
    doc.setTextColor(...GRAY);
    doc.text(label, x, currentY);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    return currentY + 11;
  };

  let yLeft = y;
  let yRight = y;

  yLeft = drawField('NOMBRE', quotation.client?.fullName || '-', margin, yLeft);
  yLeft = drawField('TELEFONO', quotation.client?.phone || '-', margin, yLeft);
  yLeft = drawField('EMAIL', quotation.client?.email || '-', margin, yLeft);
  yLeft = drawField('FECHA DE COTIZACION', formatDate(quotation.saleDate), margin, yLeft);

  const rightX = margin + colWidth + 10;
  yRight = drawField('DESTINO', quotation.destination?.name || '-', rightX, yRight);
  yRight = drawField('TEMPORADA', quotation.destination?.season?.name || 'Sin temporada', rightX, yRight);
  yRight = drawField('FECHA DE SALIDA', quotation.departureDate ? formatDate(quotation.departureDate) : '-', rightX, yRight);
  yRight = drawField('FECHA DE REGRESO', quotation.returnDate ? formatDate(quotation.returnDate) : '-', rightX, yRight);

  y = Math.max(yLeft, yRight) + 5;

  // ─── SERVICIOS DEL PAQUETE ───
  const bookingItems = quotation.items || [];
  if (bookingItems.length > 0) {
    const hotelItems = bookingItems.filter(i => i.type === 'HOTEL');
    const flightItems = bookingItems.filter(i => i.type === 'FLIGHT');
    const tourItems = bookingItems.filter(i => i.type === 'TOUR');

    y = checkPageBreak(doc, y, 30, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Servicios del Paquete', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Hotel items table
    if (hotelItems.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text('Hospedaje', margin, y);
      y += 4;

      const hotelBody = hotelItems.map((item, idx) => [
        `Hab. ${idx + 1}`,
        item.hotel?.name || '-',
        item.roomType || '-',
        item.plan || '-',
        `${item.numAdults || 0} Ad. / ${item.numChildren || 0} Men.`,
        `${item.numNights || 0} noches`,
        formatCurrency(item.cost || 0),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Hotel', 'Tipo Hab.', 'Plan', 'Ocupación', 'Noches', 'Costo']],
        body: hotelBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [239, 246, 255], textColor: [37, 99, 235], fontStyle: 'bold', lineWidth: 0.3, lineColor: [226, 232, 240] },
        bodyStyles: { lineWidth: 0.2, lineColor: [226, 232, 240] },
        columnStyles: { 0: { cellWidth: 14 }, 6: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // ── Hotel detail cards (unique hotels) ──
      const uniqueHotels: HotelData[] = [];
      const seenHIds = new Set<string>();
      for (const hi of hotelItems) {
        if (hi.hotel && !seenHIds.has(hi.hotel.id)) {
          seenHIds.add(hi.hotel.id);
          uniqueHotels.push(hi.hotel);
        }
      }

      for (const h of uniqueHotels) {
        let estimatedHeight = 30;
        if (h.plan || h.checkIn || h.checkOut) estimatedHeight += 12;
        if (h.idRequirement) estimatedHeight += 8;
        if (h.includes?.length) estimatedHeight += 6 + h.includes.length * 5;
        if (h.notIncludes?.length) estimatedHeight += 6 + h.notIncludes.length * 5;
        if (h.images?.length) estimatedHeight += 35;

        y = checkPageBreak(doc, y, estimatedHeight, margin);

        const cardX = margin;
        const cardW = pageWidth - margin * 2;

        // Hotel name
        doc.setFontSize(12);
        doc.setTextColor(8, 145, 178);
        doc.setFont('helvetica', 'bold');
        doc.text(h.name, cardX + 4, y + 5);
        y += 8;

        // Stars and diamonds (drawn as vector icons)
        const hasStars = (h.stars || 0) > 0;
        const hasDiamonds = (h.diamonds || 0) > 0;
        if (hasStars || hasDiamonds) {
          let classifX = cardX + 4;
          const iconSize = 3;
          const iconGap = 1;
          const iconCenterY = y + 3;

          if (hasStars) {
            doc.setFillColor(234, 179, 8);
            doc.setDrawColor(234, 179, 8);
            for (let si = 0; si < h.stars!; si++) {
              drawStar(doc, classifX + iconSize / 2, iconCenterY, iconSize);
              classifX += iconSize + iconGap;
            }
            classifX += 1.5;
            doc.setFontSize(8);
            doc.setTextColor(234, 179, 8);
            doc.setFont('helvetica', 'bold');
            const starLabel = `${h.stars} Estrella${h.stars! > 1 ? 's' : ''}`;
            doc.text(starLabel, classifX, iconCenterY + 1);
            classifX += doc.getTextWidth(starLabel) + 5;
          }

          if (hasDiamonds) {
            doc.setFillColor(59, 130, 246);
            doc.setDrawColor(59, 130, 246);
            for (let di = 0; di < h.diamonds!; di++) {
              drawDiamond(doc, classifX + iconSize / 2, iconCenterY, iconSize);
              classifX += iconSize + iconGap;
            }
            classifX += 1.5;
            doc.setFontSize(8);
            doc.setTextColor(59, 130, 246);
            doc.setFont('helvetica', 'bold');
            const diamondLabel = `${h.diamonds} Diamante${h.diamonds! > 1 ? 's' : ''}`;
            doc.text(diamondLabel, classifX, iconCenterY + 1);
          }

          y += 6;
        }

        // Plan, Check-In, Check-Out
        const infoFields: { label: string; value: string }[] = [];
        if (h.plan) infoFields.push({ label: 'Plan', value: h.plan });
        if (h.checkIn) infoFields.push({ label: 'Check-In', value: h.checkIn + (h.checkInNote ? ` (${h.checkInNote})` : '') });
        if (h.checkOut) infoFields.push({ label: 'Check-Out', value: h.checkOut + (h.checkOutNote ? ` (${h.checkOutNote})` : '') });

        if (infoFields.length > 0) {
          const fieldW = cardW / infoFields.length;
          for (let fi = 0; fi < infoFields.length; fi++) {
            const fx = cardX + 4 + fi * fieldW;
            doc.setFontSize(7);
            doc.setTextColor(...GRAY);
            doc.setFont('helvetica', 'normal');
            doc.text(infoFields[fi].label, fx, y + 3);
            doc.setFontSize(9);
            doc.setTextColor(...DARK);
            doc.setFont('helvetica', 'bold');
            doc.text(infoFields[fi].value, fx, y + 7);
          }
          y += 11;
        }

        // ID Requirement
        if (h.idRequirement) {
          doc.setFontSize(8);
          doc.setTextColor(146, 64, 14);
          doc.setFont('helvetica', 'bold');
          doc.text(`Identificacion requerida: ${h.idRequirement}`, cardX + 4, y + 3);
          y += 7;
        }

        // Includes
        if (h.includes && h.includes.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(22, 163, 74);
          doc.setFont('helvetica', 'bold');
          doc.text('Incluye:', cardX + 4, y + 3);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...DARK);
          doc.setFontSize(8);
          for (const inc of h.includes) {
            doc.text(`  + ${inc}`, cardX + 6, y + 3);
            y += 4.5;
          }
          y += 1;
        }

        // Not Includes
        if (h.notIncludes && h.notIncludes.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(220, 38, 38);
          doc.setFont('helvetica', 'bold');
          doc.text('No Incluye:', cardX + 4, y + 3);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...DARK);
          doc.setFontSize(8);
          for (const ni of h.notIncludes) {
            doc.text(`  - ${ni}`, cardX + 6, y + 3);
            y += 4.5;
          }
          y += 1;
        }

        // Hotel images
        if (h.images && h.images.length > 0) {
          const imgWidth = (cardW - 16) / 3;
          const imgHeight = 28;
          let imgX = cardX + 4;
          let imgCount = 0;
          for (const imgPath of h.images.slice(0, 6)) {
            try {
              const imgUrl = `/api/files/${encodeURIComponent(imgPath)}`;
              const imgBase64 = await loadImageAsBase64(imgUrl);
              if (imgBase64) {
                y = checkPageBreak(doc, y, imgHeight + 4, margin);
                doc.addImage(imgBase64, 'AUTO', imgX, y + 2, imgWidth - 2, imgHeight);
                imgX += imgWidth;
                imgCount++;
                if (imgCount % 3 === 0) {
                  imgX = cardX + 4;
                  y += imgHeight + 3;
                }
              }
            } catch {
              // skip failed image
            }
          }
          if (imgCount % 3 !== 0) {
            y += imgHeight + 3;
          }
        }

        // Bottom border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(cardX, y + 2, cardX + cardW, y + 2);
        y += 6;
      }
    }

    // Flight items table
    if (flightItems.length > 0) {
      y = checkPageBreak(doc, y, 20, margin);
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text('Vuelos', margin, y);
      y += 4;

      const flightBody = flightItems.map((item) => {
        let timeStr = '';
        if (item.departureTime) {
          const dt = new Date(item.departureTime);
          timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        }
        if (item.arrivalTime) {
          const at = new Date(item.arrivalTime);
          timeStr += ` - ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
        }
        return [
          item.direction === 'IDA' ? 'Ida' : 'Regreso',
          item.airline || '-',
          item.flightNumber || '-',
          `${item.origin || '?'} -> ${item.flightDestination || '?'}`,
          timeStr || '-',
          item.flightClass === 'ECONOMICA' ? 'Economica' : item.flightClass === 'BUSINESS' ? 'Business' : item.flightClass || '-',
          formatCurrency(item.cost || 0),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Direccion', 'Aerolinea', 'Vuelo', 'Ruta', 'Horario', 'Clase', 'Costo']],
        body: flightBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [236, 254, 255], textColor: [8, 145, 178], fontStyle: 'bold', lineWidth: 0.3, lineColor: [226, 232, 240] },
        bodyStyles: { lineWidth: 0.2, lineColor: [226, 232, 240] },
        columnStyles: { 6: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Tour items table
    if (tourItems.length > 0) {
      y = checkPageBreak(doc, y, 20, margin);
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text('Tours', margin, y);
      y += 4;

      const tourBody = tourItems.map((item) => [
        item.tourName || '-',
        item.tourDate ? formatDate(item.tourDate) : '-',
        String(item.numPeople || 0),
        formatCurrency(item.pricePerPerson || 0),
        formatCurrency(item.cost || 0),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Tour', 'Fecha', 'Personas', 'Precio/Persona', 'Costo']],
        body: tourBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [255, 251, 235], textColor: [180, 83, 9], fontStyle: 'bold', lineWidth: 0.3, lineColor: [226, 232, 240] },
        bodyStyles: { lineWidth: 0.2, lineColor: [226, 232, 240] },
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Total services cost
    const totalServicesCost = bookingItems.reduce((sum, i) => sum + (i.cost || 0), 0);
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(`Costo Neto Total: ${formatCurrency(totalServicesCost)}`, pageWidth - margin, y, { align: 'right' });
    y += 10;
  }

  // ─── RESUMEN FINANCIERO ───
  y = checkPageBreak(doc, y, 45, margin);
  doc.setFontSize(12);
  doc.setTextColor(...CYAN);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Financiero', margin, y);
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const isCash = quotation.paymentType === 'CASH';

  if (isCash) {
    // Single card for cash
    const cardWidth = pageWidth - margin * 2;
    const cardHeight = 22;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL DEL VIAJE', margin + cardWidth / 2, y + 7, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(quotation.totalPrice), margin + cardWidth / 2, y + 16, { align: 'center' });
    y += cardHeight + 8;
  } else {
    const cardWidth = (pageWidth - margin * 2 - 10) / 3;
    const cardHeight = 22;
    const cardY = y;

    // Total card
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL DEL VIAJE', margin + cardWidth / 2, cardY + 7, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(quotation.totalPrice), margin + cardWidth / 2, cardY + 16, { align: 'center' });

    // Down payment card
    const card2X = margin + cardWidth + 5;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(59, 130, 246);
    doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('ANTICIPO', card2X + cardWidth / 2, cardY + 7, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(quotation.downPayment || 0), card2X + cardWidth / 2, cardY + 16, { align: 'center' });

    // Per-payment card
    const card3X = card2X + cardWidth + 5;
    const numPayments = quotation.numberOfPayments || 1;
    const perPayment = numPayments > 0 ? Math.floor((quotation.totalPrice - (quotation.downPayment || 0)) / numPayments) : 0;
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(249, 115, 22);
    doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${numPayments} PAGOS DE`, card3X + cardWidth / 2, cardY + 7, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(234, 88, 12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(perPayment), card3X + cardWidth / 2, cardY + 16, { align: 'center' });

    y = cardY + cardHeight + 8;
  }

  y += 2;

  // ─── PAYMENTS TABLE or CASH BADGE ───
  if (isCash) {
    y = checkPageBreak(doc, y, 25, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Metodo de Pago', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const boxWidth = 70;
    const boxHeight = 12;
    const boxX = (pageWidth - boxWidth) / 2;
    doc.setFillColor(...CYAN);
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Pago de Contado', pageWidth / 2, y + 8, { align: 'center' });
    y += boxHeight + 10;
  } else {
    y = checkPageBreak(doc, y, 20, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Plan de Pagos Propuesto', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    const headers = ['#', 'Fecha de Vencimiento', 'Monto', 'Estado'];

    const body = quotation.payments.map((p) => [
      String(p.paymentNumber),
      formatDate(p.dueDate),
      formatCurrency(p.amount),
      'Pendiente',
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        lineWidth: 0.3,
        lineColor: [226, 232, 240],
      },
      bodyStyles: {
        lineWidth: 0.2,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'right' },
        3: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = [249, 115, 22]; // orange for "Pendiente"
        }
      },
    });
  }

  // ─── NOTES ───
  if (!isCash) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    y = finalY + 10;
  }

  if (quotation.notes) {
    y = checkPageBreak(doc, y, 20, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(quotation.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 8;
  }

  // ─── DISCLAIMER ───
  y = checkPageBreak(doc, y, 30, margin);
  const disclaimerWidth = pageWidth - margin * 2;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, disclaimerWidth, 18, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Esta cotizacion es un documento informativo y no representa un compromiso de venta.',
    pageWidth / 2,
    y + 6,
    { align: 'center' }
  );
  if (quotation.expirationDate) {
    doc.text(
      `Valida hasta el ${formatDate(quotation.expirationDate)}. Los precios estan sujetos a disponibilidad.`,
      pageWidth / 2,
      y + 11,
      { align: 'center' }
    );
  } else {
    doc.text(
      'Los precios estan sujetos a disponibilidad.',
      pageWidth / 2,
      y + 11,
      { align: 'center' }
    );
  }
  y += 25;

  // ─── FOOTER ───
  y = checkPageBreak(doc, y, 25, margin);
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = Math.max(y + 5, pageHeight - 25);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.text('Este documento es una cotizacion informativa.', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('Para cualquier aclaracion, comunicate con la agencia.', pageWidth / 2, footerY + 9, { align: 'center' });
  doc.text(`Generado el ${formatDate(new Date())}`, pageWidth / 2, footerY + 13, { align: 'center' });

  // ─── WATERMARK on all pages ───
  if (logoBase64) {
    await addWatermarkToAllPages(doc, logoBase64);
  }

  // Download
  const fileName = `cotizacion_${quotation.client?.fullName?.replace(/\s+/g, '_') || 'cliente'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
