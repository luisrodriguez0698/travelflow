import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/** Modulos que registran cobros/pagos y necesitan elegir una cuenta */
const PAYMENT_MODULES = ['bancos', 'ventas', 'cotizaciones', 'proveedores', 'rifas'];

async function creatorNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name || u.email || 'Usuario']));
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess(PAYMENT_MODULES);
    const fullAccess = access.can('bancos');
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');
    // status: 'active' (default) | 'archived' | 'all'
    const status = fullAccess ? searchParams.get('status') || 'active' : 'active';
    const statusWhere = status === 'all' ? {} : { isActive: status === 'archived' ? false : true };

    // Sin el modulo Bancos: solo la lista para elegir cuenta al cobrar/pagar
    // (sus cuentas + compartidas, activas, sin numero de cuenta)
    if (!fullAccess) {
      if (all !== 'true') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
      const accounts = await prisma.bankAccount.findMany({
        where: { ...access.bankScope, isActive: true },
        orderBy: { referenceName: 'asc' },
        select: { id: true, referenceName: true, bankName: true, accountType: true, currentBalance: true, shared: true, isActive: true },
      });
      return NextResponse.json(accounts);
    }

    if (all === 'true') {
      const allAccounts = await prisma.bankAccount.findMany({
        where: { ...access.bankScope, ...statusWhere },
        orderBy: { referenceName: 'asc' },
      });
      const names = await creatorNames(allAccounts.map((a) => a.createdBy));
      return NextResponse.json(
        allAccounts.map((a) => ({
          ...a,
          accountNumber: decrypt(a.accountNumber),
          creatorName: a.createdBy ? names[a.createdBy] || null : null,
          canManage: !access.ownOnly || a.createdBy === access.userId,
        }))
      );
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where: any = { ...access.bankScope, ...statusWhere };
    if (search) {
      // accountNumber is encrypted so cannot be searched with contains
      where.OR = [
        { referenceName: { contains: search, mode: 'insensitive' } },
        { bankName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      prisma.bankAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bankAccount.count({ where }),
    ]);

    const names = await creatorNames(accounts.map((a) => a.createdBy));

    return NextResponse.json({
      data: accounts.map((a) => ({
        ...a,
        accountNumber: decrypt(a.accountNumber),
        creatorName: a.createdBy ? names[a.createdBy] || null : null,
        canManage: !access.ownOnly || a.createdBy === access.userId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Error fetching bank accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('bancos', 'create');
    const body = await request.json();

    if (!body.bankName || !body.accountNumber || !body.accountType || !body.referenceName) {
      return NextResponse.json({ error: 'Campos requeridos: banco, número de cuenta, tipo y nombre de referencia' }, { status: 400 });
    }

    const initialBalance = parseFloat(body.initialBalance) || 0;

    const account = await prisma.bankAccount.create({
      data: {
        tenantId: access.tenantId,
        bankName: body.bankName,
        accountNumber: encrypt(body.accountNumber),
        accountType: body.accountType,
        referenceName: body.referenceName,
        initialBalance,
        currentBalance: initialBalance,
        shared: body.shared === true,
        createdBy: access.userId,
      },
    });

    return NextResponse.json({ ...account, accountNumber: decrypt(account.accountNumber) }, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Error creating bank account' }, { status: 500 });
  }
}
