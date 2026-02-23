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
  paidDate?: string;
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
  isInternational?: boolean;
  // Hotel
  hotelId?: string;
  hotel?: HotelData;
  roomType?: string;
  numAdults?: number;
  numChildren?: number;
  pricePerNight?: number;
  numNights?: number;
  plan?: string;
  // Flight
  airline?: string;
  flightNumber?: string;
  origin?: string;
  flightDestination?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightClass?: string;
  direction?: string;
  // Return leg (IDA_Y_VUELTA)
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  returnFlightNumber?: string;
  // Tour
  tourName?: string;
  tourDate?: string;
  numPeople?: number;
  pricePerPerson?: number;
  // Transport
  transportType?: string;
}

interface SaleData {
  id: string;
  totalPrice: number;
  netCost?: number;
  downPayment?: number;
  paymentType?: string;
  saleDate: string;
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
  paymentFrequency?: string;
  items?: BookingItem[];
  tenant?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
    policies?: string | null;
  };
}

const CYAN = [8, 145, 178] as const;  // #0891b2
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

/** Get real image dimensions and calculate scaled size that fits within a max box */
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

/** Adds the watermark logo centered on every page */
async function addWatermarkToAllPages(doc: jsPDF, logoBase64: string) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const wmMaxSize = 120;

  // Get proportional watermark dimensions
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

export async function generateReceiptPdf(sale: SaleData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Load logo if available
  let logoBase64: string | null = null;
  if (sale.tenant?.logo) {
    logoBase64 = await loadImageAsBase64(`/api/files/${encodeURIComponent(sale.tenant.logo)}`);
  }

  // ─── HEADER: Logo left + Agency info right ───
  const agencyName = sale.tenant?.name || 'TravelFlow';
  const logoMaxWidth = 28;
  const logoMaxHeight = 22;

  if (logoBase64) {
    // Calculate proportional logo dimensions
    const logoDims = await getScaledLogoDimensions(logoBase64, logoMaxWidth, logoMaxHeight);

    try {
      // Center vertically within the max height area
      const logoY = y + (logoMaxHeight - logoDims.height) / 2;
      doc.addImage(logoBase64, 'AUTO', margin, logoY, logoDims.width, logoDims.height);
    } catch {
      // continue without logo
    }

    // Agency name and contact aligned to the right of the logo
    const textX = margin + logoMaxWidth + 8;
    doc.setFontSize(20);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text(agencyName, textX, y + 6);

    let infoY = y + 12;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');

    if (sale.tenant?.phone) {
      doc.text(`Tel: ${sale.tenant.phone}`, textX, infoY);
      infoY += 4;
    }
    if (sale.tenant?.email) {
      doc.text(sale.tenant.email, textX, infoY);
      infoY += 4;
    }
    if (sale.tenant?.address) {
      doc.text(sale.tenant.address, textX, infoY);
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

    if (sale.tenant?.phone) {
      doc.text(`Tel: ${sale.tenant.phone}`, margin, infoY);
      infoY += 4;
    }
    if (sale.tenant?.email) {
      doc.text(sale.tenant.email, margin, infoY);
      infoY += 4;
    }
    if (sale.tenant?.address) {
      doc.text(sale.tenant.address, margin, infoY);
    }

    y += 22;
  }

  // Subtitle + Folio right-aligned
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('Estado de Cuenta - Viaje', pageWidth - margin, y - 8, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Folio: ${sale.id.slice(-8).toUpperCase()}`, pageWidth - margin, y - 3, { align: 'right' });

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

  yLeft = drawField('NOMBRE', sale.client?.fullName || '-', margin, yLeft);
  yLeft = drawField('TELEFONO', sale.client?.phone || '-', margin, yLeft);
  yLeft = drawField('EMAIL', sale.client?.email || '-', margin, yLeft);
  yLeft = drawField('FECHA DE VENTA', formatDate(sale.saleDate), margin, yLeft);

  const rightX = margin + colWidth + 10;
  yRight = drawField('DESTINO', sale.destination?.name || '-', rightX, yRight);
  yRight = drawField('TEMPORADA', sale.destination?.season?.name || 'Sin temporada', rightX, yRight);
  yRight = drawField('FECHA DE SALIDA', sale.departureDate ? formatDate(sale.departureDate) : '-', rightX, yRight);
  yRight = drawField('FECHA DE REGRESO', sale.returnDate ? formatDate(sale.returnDate) : '-', rightX, yRight);

  y = Math.max(yLeft, yRight) + 5;

  // ─── SERVICIOS DEL PAQUETE ───
  const bookingItems = sale.items || [];
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
        // Estimate needed height: name + classification + fields + includes/notIncludes + images
        let estimatedHeight = 30;
        if (h.plan || h.checkIn || h.checkOut) estimatedHeight += 12;
        if (h.idRequirement) estimatedHeight += 8;
        if (h.includes?.length) estimatedHeight += 6 + h.includes.length * 5;
        if (h.notIncludes?.length) estimatedHeight += 6 + h.notIncludes.length * 5;
        if (h.images?.length) estimatedHeight += 35;

        y = checkPageBreak(doc, y, estimatedHeight, margin);

        // Card background
        const cardX = margin;
        const cardW = pageWidth - margin * 2;
        const cardStartY = y;

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

        // Plan, Check-In, Check-Out in a row
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

        // Hotel images (load and render in a row, max 3 per row)
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

        // Draw card background behind content
        const cardEndY = y + 2;
        const cardH = cardEndY - cardStartY;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);

        // Move to correct page and draw background behind the text
        // Since jsPDF draws in order, we need to use a workaround:
        // We'll draw a subtle bottom border instead
        doc.line(cardX, cardEndY, cardX + cardW, cardEndY);
        y = cardEndY + 4;
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
        const fmtHHMM = (d: string | undefined) => {
          if (!d) return '';
          const dt = new Date(d);
          return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        };
        const isRoundTrip = item.direction === 'IDA_Y_VUELTA';
        let timeStr = '';
        const dep = fmtHHMM(item.departureTime);
        const arr = fmtHHMM(item.arrivalTime);
        if (dep || arr) timeStr = dep + (arr ? ` - ${arr}` : '');
        if (isRoundTrip) {
          const retDep = fmtHHMM(item.returnDepartureTime);
          const retArr = fmtHHMM(item.returnArrivalTime);
          if (retDep || retArr) {
            timeStr += (timeStr ? '\n' : '') + 'Reg: ' + retDep + (retArr ? ` - ${retArr}` : '');
          }
        }
        const vueloStr = item.flightNumber || '-';
        const vueloFull = isRoundTrip && item.returnFlightNumber
          ? `${vueloStr}\n${item.returnFlightNumber}`
          : vueloStr;
        const dirLabel = isRoundTrip ? 'Ida y Vuelta' : item.direction === 'IDA' ? 'Ida' : 'Regreso';
        return [
          dirLabel,
          item.airline || '-',
          vueloFull,
          `${item.origin || '?'} → ${item.flightDestination || '?'}`,
          timeStr || '-',
          item.flightClass === 'ECONOMICA' ? 'Económica' : item.flightClass === 'BUSINESS' ? 'Business' : item.flightClass || '-',
          formatCurrency(item.cost || 0),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Dirección', 'Aerolínea', 'Vuelo', 'Ruta', 'Horario', 'Clase', 'Costo']],
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

    // Transport items table
    const transferItems = bookingItems.filter(i => i.type === 'TRANSFER');
    if (transferItems.length > 0) {
      y = checkPageBreak(doc, y, 20, margin);
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text('Transporte Terrestre', margin, y);
      y += 4;

      const transferBody = transferItems.map((item) => {
        const fmtHHMM = (d: string | undefined) => {
          if (!d) return '';
          const dt = new Date(d);
          return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        };
        const isRoundTrip = item.direction === 'IDA_Y_VUELTA';
        let timeStr = '';
        const dep = fmtHHMM(item.departureTime);
        const arr = fmtHHMM(item.arrivalTime);
        if (dep || arr) timeStr = dep + (arr ? ` - ${arr}` : '');
        if (isRoundTrip) {
          const retDep = fmtHHMM(item.returnDepartureTime);
          const retArr = fmtHHMM(item.returnArrivalTime);
          if (retDep || retArr) {
            timeStr += (timeStr ? '\n' : '') + 'Reg: ' + retDep + (retArr ? ` - ${retArr}` : '');
          }
        }
        const dirLabel = isRoundTrip ? 'Ida y Vuelta' : item.direction === 'IDA' ? 'Ida' : 'Regreso';
        return [
          item.transportType || 'Transporte',
          dirLabel,
          `${item.origin || '?'} → ${item.flightDestination || '?'}`,
          timeStr || '-',
          String(item.numPeople || 0),
          item.isInternational ? 'Internacional' : 'Nacional',
          formatCurrency(item.cost || 0),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Unidad', 'Dirección', 'Ruta', 'Horario', 'Pasajeros', 'Modalidad', 'Costo']],
        body: transferBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: 'bold', lineWidth: 0.3, lineColor: [226, 232, 240] },
        bodyStyles: { lineWidth: 0.2, lineColor: [226, 232, 240] },
        columnStyles: { 4: { halign: 'center' }, 6: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Total services cost
    const totalServicesCost = bookingItems.reduce((sum, i) => sum + (i.cost || 0), 0);
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    // doc.text(`Costo Neto Total: ${formatCurrency(totalServicesCost)}`, pageWidth - margin, y, { align: 'right' });
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

  const isCash = sale.paymentType === 'CASH';
  const totalPaid = isCash
    ? sale.totalPrice
    : sale.payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0) + (sale.downPayment || 0);
  const remaining = sale.totalPrice - totalPaid;
  const progress = Math.round((totalPaid / sale.totalPrice) * 100);

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
  doc.text(formatCurrency(sale.totalPrice), margin + cardWidth / 2, cardY + 16, { align: 'center' });

  // Paid card
  const card2X = margin + cardWidth + 5;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL ABONADO', card2X + cardWidth / 2, cardY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalPaid), card2X + cardWidth / 2, cardY + 16, { align: 'center' });

  // Remaining card
  const card3X = card2X + cardWidth + 5;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(249, 115, 22);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('SALDO PENDIENTE', card3X + cardWidth / 2, cardY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(234, 88, 12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(remaining), card3X + cardWidth / 2, cardY + 16, { align: 'center' });

  y = cardY + cardHeight + 8;

  // Progress bar
  const barWidth = pageWidth - margin * 2;
  const barHeight = 4;
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, 'F');
  if (progress > 0) {
    doc.setFillColor(...CYAN);
    doc.roundedRect(margin, y, barWidth * (progress / 100), barHeight, 2, 2, 'F');
  }
  y += barHeight + 4;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${progress}% del total pagado`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ─── PAYMENTS TABLE or CASH BADGE ───
  if (isCash) {
    y = checkPageBreak(doc, y, 25, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Método de Pago', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Green "Pagado de Contado" box
    const boxWidth = 70;
    const boxHeight = 12;
    const boxX = (pageWidth - boxWidth) / 2;
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Pagado de Contado', pageWidth / 2, y + 8, { align: 'center' });
    y += boxHeight + 10;
  } else {
    y = checkPageBreak(doc, y, 20, margin);
    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Historial de Pagos', margin, y);
    if (sale.paymentFrequency) {
      const freqLabel = sale.paymentFrequency === 'MENSUAL' ? 'Mensual' : 'Quincenal';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`Frecuencia: ${freqLabel}`, margin + 47, y);
    }
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    const hasPaidDates = sale.payments.some(p => p.paidDate);

    const headers = ['#', 'Fecha de Vencimiento', 'Monto', 'Abonado', 'Pendiente', 'Estado'];
    if (hasPaidDates) headers.push('Fecha de Pago');

    const body = sale.payments.map((p) => {
      const pending = Math.max(0, p.amount - (p.paidAmount || 0));
      const statusText = p.status === 'PAID' ? 'Pagado' : p.status === 'PENDING' ? 'Pendiente' : 'Vencido';
      const row = [
        String(p.paymentNumber),
        formatDate(p.dueDate),
        formatCurrency(p.amount),
        formatCurrency(p.paidAmount || 0),
        formatCurrency(pending),
        statusText,
      ];
      if (hasPaidDates) row.push(p.paidDate ? formatDate(p.paidDate) : '-');
      return row;
    });

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
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val === 'Pagado') data.cell.styles.textColor = [22, 163, 74];
          else if (val === 'Pendiente') data.cell.styles.textColor = [249, 115, 22];
          else if (val === 'Vencido') data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });
  }

  // ─── NOTES ───
  if (!isCash) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    y = finalY + 10;
  }

  if (sale.notes) {
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
    const lines = doc.splitTextToSize(sale.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 8;
  }

  // ─── POLÍTICAS ───
  if (sale.tenant?.policies) {
    const policiesLines = doc.splitTextToSize(sale.tenant.policies, pageWidth - margin * 2);
    const policiesHeight = policiesLines.length * 4 + 20;
    y = checkPageBreak(doc, y, policiesHeight, margin);

    doc.setFontSize(12);
    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.text('Políticas y Condiciones', margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(policiesLines, margin, y);
    y += policiesLines.length * 4 + 8;
  }

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
  doc.text('Este documento es un estado de cuenta informativo.', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('Para cualquier aclaracion, comunicate con la agencia.', pageWidth / 2, footerY + 9, { align: 'center' });
  doc.text(`Generado el ${formatDate(new Date())}`, pageWidth / 2, footerY + 13, { align: 'center' });

  // ─── WATERMARK on all pages ───
  if (logoBase64) {
    await addWatermarkToAllPages(doc, logoBase64);
  }

  // Download
  const fileName = `estado_cuenta_${sale.client?.fullName?.replace(/\s+/g, '_') || 'cliente'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
