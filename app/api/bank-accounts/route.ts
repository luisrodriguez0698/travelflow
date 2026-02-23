import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');

    if (all === 'true') {
      const allAccounts = await prisma.bankAccount.findMany({
        where: { tenantId, isActive: true },
        orderBy: { referenceName: 'asc' },
      });

      const allCreatorIds = [...new Set(allAccounts.map((a) => a.createdBy).filter(Boolean))] as string[];
      const allCreators = allCreatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: allCreatorIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const allCreatorMap = Object.fromEntries(allCreators.map((u) => [u.id, u.name || u.email || 'Usuario']));

      return NextResponse.json(allAccounts.map((a) => ({
        ...a,
        creatorName: a.createdBy ? allCreatorMap[a.createdBy] || null : null,
      })));
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where: any = { tenantId, isActive: true };
    if (search) {
      where.OR = [
        { referenceName: { contains: search, mode: 'insensitive' } },
        { bankName: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
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

    // Fetch creator names
    const creatorIds = [...new Set(accounts.map((a) => a.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    return NextResponse.json({
      data: accounts.map((a) => ({
        ...a,
        creatorName: a.createdBy ? creatorMap[a.createdBy] || null : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Error fetching bank accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    if (!body.bankName || !body.accountNumber || !body.accountType || !body.referenceName) {
      return NextResponse.json({ error: 'Campos requeridos: banco, número de cuenta, tipo y nombre de referencia' }, { status: 400 });
    }

    const initialBalance = parseFloat(body.initialBalance) || 0;

    const sessionUser = await getSessionUser();

    const account = await prisma.bankAccount.create({
      data: {
        tenantId,
        bankName: body.bankName,
        accountNumber: body.accountNumber,
        accountType: body.accountType,
        referenceName: body.referenceName,
        initialBalance,
        currentBalance: initialBalance,
        createdBy: sessionUser?.id || null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Error creating bank account' }, { status: 500 });
  }
}
