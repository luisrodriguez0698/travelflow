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

interface SaleData {
  id: string;
  totalPrice: number;
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
  tenant?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
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
