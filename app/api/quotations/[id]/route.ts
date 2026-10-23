import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { saleTotalFromItems, salePriceToStore } from '@/lib/booking-pricing';
import { bookingDestination } from '@/lib/booking-destination';
import { parsePaymentAmounts, planUpdateError, resolvePlanDates } from '@/lib/payment-plan';
import { resolveAgent } from '@/lib/booking-agent';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('cotizaciones');
    const tenantId = access.tenantId;
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, ...access.bookingScope, type: 'QUOTATION' },
      include: {
        client: true,
        destination: { include: { season: true } },
        payments: { orderBy: { paymentNumber: 'asc' } },
        tenant: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: { include: { destination: { include: { season: true } } } }, destination: { include: { season: true } }, passengers: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Fetch creator name
    let creatorName: string | null = null;
    if (booking.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: booking.createdBy },
        select: { name: true, email: true },
      });
      creatorName = creator?.name || creator?.email || null;
    }

    // Destino general (ventas nuevas: el de sus servicios) para el detalle y el PDF
    const derived = bookingDestination(booking);
    const destination = booking.destination ?? (derived.name ? { name: derived.name, season: derived.season } : null);

    return NextResponse.json({ ...booking, destination, creatorName });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching quotation:', error);
    return NextResponse.json({ error: 'Error fetching quotation' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('cotizaciones', 'edit');
    const tenantId = access.tenantId;
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.booking.findFirst({
      where: { id, ...access.bookingScope, type: 'QUOTATION' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const agent = await resolveAgent(access, 'cotizaciones', body.sellerId, existing.createdBy);
    if ('error' in agent) return NextResponse.json({ error: agent.error }, { status: agent.status });

    const items: any[] = body.items || [];
    // Precio de venta = suma de los servicios (si tienen precio de venta por servicio)
    const servicesTotal = saleTotalFromItems(items);
    if (servicesTotal !== null) body.totalPrice = servicesTotal;
    let netCost: number;

    const numAdults = body.numAdults || 1;
    const numChildren = body.numChildren || 0;
    const priceAdult = body.priceAdult || 0;
    const priceChild = body.priceChild || 0;
    const pricePerNight = body.pricePerNight || 0;
    const numNights = body.numNights || 0;
    const freeChildren = body.freeChildren || 0;
    const paidChildren = Math.max(0, numChildren - freeChildren);

    if (items.length > 0) {
      netCost = items.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    } else {
      netCost = (priceAdult * numAdults) + (priceChild * paidChildren) + (pricePerNight * numNights);
    }

    // Plan de pagos: montos personalizados del formulario (o reparto automatico)
    const plan = body.paymentType === 'CREDIT' && body.numberOfPayments > 0
      ? parsePaymentAmounts(body.paymentAmounts, body.numberOfPayments, body.totalPrice - (body.downPayment || 0))
      : { amounts: [] as number[] };
    if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 400 });

    // Fechas de los pagos: personalizadas (si vienen) o por frecuencia
    const frequency0 = body.paymentFrequency || existing.paymentFrequency || 'QUINCENAL';
    const planDates = body.paymentType === 'CREDIT' && body.numberOfPayments > 0
      ? resolvePlanDates({
          frequency: frequency0,
          start: body.paymentStartDate ? new Date(body.paymentStartDate) : new Date(),
          count: body.numberOfPayments,
          customDates: body.paymentDates,
        })
      : { dates: [] as Date[] };
    if ('error' in planDates) return NextResponse.json({ error: planDates.error }, { status: 400 });
    // Personalizado con fechas: tambien se guardan sobre el plan existente
    const customDatesSent = frequency0 === 'PERSONALIZADO' && Array.isArray(body.paymentDates);

    // Montos editados sin regenerar el plan: validar contra lo ya abonado antes de guardar
    const keepsPlan =
      existing.paymentType === body.paymentType &&
      existing.numberOfPayments === body.numberOfPayments &&
      existing.downPayment === body.downPayment &&
      existing.totalPrice === body.totalPrice;
    const savedPlans = keepsPlan && (body.paymentAmounts != null || customDatesSent) && plan.amounts.length
      ? await prisma.paymentPlan.findMany({ where: { bookingId: id }, orderBy: { paymentNumber: 'asc' } })
      : [];
    if (savedPlans.length && body.paymentAmounts != null) {
      const updateError = planUpdateError(savedPlans, plan.amounts);
      if (updateError) return NextResponse.json({ error: updateError }, { status: 400 });
    }

    // Delete old payment plans and recreate
    if (
      existing.paymentType !== body.paymentType ||
      existing.numberOfPayments !== body.numberOfPayments ||
      existing.downPayment !== body.downPayment ||
      existing.totalPrice !== body.totalPrice
    ) {
      await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        createdBy: agent.agentId,
        clientId: body.clientId,
        destinationId: body.destinationId,
        departureDate: body.departureDate ? new Date(body.departureDate) : existing.departureDate,
        returnDate: body.returnDate ? new Date(body.returnDate) : existing.returnDate,
        priceAdult,
        priceChild,
        numAdults,
        numChildren,
        totalPrice: body.totalPrice,
        netCost,
        paymentType: body.paymentType,
        downPayment: body.downPayment || 0,
        numberOfPayments: body.paymentType === 'CASH' ? 0 : (body.numberOfPayments || 1),
        notes: body.notes || null,
        status: 'ACTIVE',
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : existing.expirationDate,
        hotelId: body.hotelId !== undefined ? (body.hotelId || null) : existing.hotelId,
        paymentFrequency: body.paymentFrequency || existing.paymentFrequency,
      },
    });

    // Update passengers if provided
    if (body.passengers !== undefined) {
      await prisma.bookingPassenger.deleteMany({ where: { bookingId: id } });
      if (Array.isArray(body.passengers) && body.passengers.length > 0) {
        await prisma.bookingPassenger.createMany({
          data: body.passengers.map((p: any) => ({
            bookingId: id,
            name: p.name,
            type: p.type || 'ADULT',
            age: p.age || null,
            isHolder: p.isHolder || false,
          })),
        });
      }
    }

    // Update booking items if provided
    if (body.items !== undefined) {
      await prisma.bookingItem.deleteMany({ where: { bookingId: id } });
      if (Array.isArray(body.items) && body.items.length > 0) {
        for (let idx = 0; idx < body.items.length; idx++) {
          const item = body.items[idx];
          const itemPassengers: any[] = item.type === 'HOTEL' && Array.isArray(item.passengers) ? item.passengers : [];
          const createdItem = await prisma.bookingItem.create({
            data: {
              bookingId: id,
              type: item.type || 'OTHER',
              description: item.description || null,
              cost: item.cost || 0,
              salePrice: salePriceToStore(item),
              sortOrder: item.sortOrder ?? idx,
              hotelId: item.hotelId || null,
              serviceId: item.serviceId || null,
              roomType: item.roomType || null,
              numAdults: item.numAdults ?? null,
              numChildren: item.numChildren ?? null,
              freeChildren: item.freeChildren ?? null,
              pricePerNight: item.pricePerNight ?? null,
              numNights: item.numNights ?? null,
              priceAdult: item.priceAdult ?? null,
              priceChild: item.priceChild ?? null,
              pricePackage: item.pricePackage ?? null,
              plan: item.plan || null,
              airline: item.airline || null,
              flightNumber: item.flightNumber || null,
              origin: item.origin || null,
              flightDestination: item.flightDestination || null,
              departureTime: item.departureTime ? new Date(item.departureTime) : null,
              arrivalTime: item.arrivalTime ? new Date(item.arrivalTime) : null,
              flightClass: item.flightClass || null,
              direction: item.direction || null,
              tourName: item.tourName || null,
              tourDate: item.tourDate ? new Date(item.tourDate) : null,
              numPeople: item.numPeople ?? null,
              pricePerPerson: item.pricePerPerson ?? null,
              destinationId: item.destinationId || null,
              supplierId: item.supplierId || null,
              supplierDeadline: item.supplierDeadline ? new Date(item.supplierDeadline) : null,
              transportType: item.transportType || null,
              isInternational: item.isInternational ?? false,
              returnDepartureTime: item.returnDepartureTime ? new Date(item.returnDepartureTime) : null,
              returnArrivalTime: item.returnArrivalTime ? new Date(item.returnArrivalTime) : null,
              returnFlightNumber: item.returnFlightNumber || null,
            },
          });
          if (itemPassengers.length > 0) {
            await prisma.bookingItemPassenger.createMany({
              data: itemPassengers.map((p: any) => ({
                bookingItemId: createdItem.id,
                name: p.name,
                type: p.type || 'ADULT',
                age: p.age || null,
                isHolder: p.isHolder || false,
              })),
            });
          }
        }
      }
    }

    // Recreate payment plan if needed
    const existingPayments = await prisma.paymentPlan.count({ where: { bookingId: id } });

    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0 && existingPayments === 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const payments = [];


      for (let i = 0; i < body.numberOfPayments; i++) {
        const dueDate = planDates.dates[i];
        payments.push({
          bookingId: booking.id,
          paymentNumber: i + 1,
          dueDate,
          amount: plan.amounts[i],
          status: 'PENDING',
        });
      }

      await prisma.paymentPlan.createMany({ data: payments });
    }

    // Personalizado: las fechas pactadas se guardan sobre el plan existente
    if (savedPlans.length && customDatesSent) {
      await prisma.$transaction(
        savedPlans
          .map((p, i) => ({ p, dueDate: planDates.dates[i] }))
          .filter(({ p, dueDate }) => dueDate && p.dueDate.getTime() !== dueDate.getTime())
          .map(({ p, dueDate }) => prisma.paymentPlan.update({ where: { id: p.id }, data: { dueDate } }))
      );
    }

    // Actualizar montos del plan existente (se conservan fechas y abonos)
    if (savedPlans.length) {
      await prisma.$transaction(
        savedPlans
          .map((p, i) => ({ p, amount: body.paymentAmounts != null ? plan.amounts[i] : p.amount }))
          .filter(({ p, amount }) => Math.abs(p.amount - amount) > 0.001)
          .map(({ p, amount }) => {
            const covered = p.paidAmount >= amount - 0.01;
            return prisma.paymentPlan.update({
              where: { id: p.id },
              data: {
                amount,
                status: covered ? 'PAID' : p.status === 'PAID' ? 'PENDING' : p.status,
                ...(covered && !p.paidDate && { paidDate: new Date() }),
              },
            });
          })
      );
    }

    const result = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        client: true,
        destination: { include: { season: true } },
        payments: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true, passengers: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const sessionUser = await getSessionUser();

    return NextResponse.json(result);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating quotation:', error);
    return NextResponse.json({ error: 'Error updating quotation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('cotizaciones', 'delete');
    const tenantId = access.tenantId;
    const { id } = await params;

    const existing = await prisma.booking.findFirst({
      where: { id, ...access.bookingScope, type: 'QUOTATION' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });
    await prisma.booking.delete({ where: { id } });

    const sessionUser = await getSessionUser();

    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting quotation:', error);
    return NextResponse.json({ error: 'Error deleting quotation' }, { status: 500 });
  }
}
