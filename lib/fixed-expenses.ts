import { z } from 'zod';
import { prisma } from './prisma';
import type { Access } from './access';
import { EXPENSE_CATEGORIES, EXPENSE_FREQUENCIES, dayToDate } from './fixed-expense-rules';

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');

export const fixedExpenseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120),
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [string, ...string[]]),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  frequency: z.enum(Object.keys(EXPENSE_FREQUENCIES) as [string, ...string[]]),
  nextDueDate: dayString,
  notify: z.boolean().default(true),
  remindDaysBefore: z.coerce.number().int().min(0).max(30).default(3),
  bankAccountId: z.string().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const payFixedExpenseSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  paidAt: dayString.optional(),
  bankAccountId: z.string().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

/** Datos a guardar a partir del formulario (valida la cuenta contra lo que el usuario puede ver). */
export async function toFixedExpenseData(access: Access, input: z.infer<typeof fixedExpenseSchema>) {
  if (input.bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: input.bankAccountId, ...access.bankScope, isActive: true },
      select: { id: true },
    });
    if (!bank) return { error: 'Cuenta bancaria no válida' } as const;
  }
  const due = dayToDate(input.nextDueDate);
  const monthBased = EXPENSE_FREQUENCIES[input.frequency as keyof typeof EXPENSE_FREQUENCIES].months > 0;
  return {
    data: {
      name: input.name,
      category: input.category,
      amount: input.amount,
      frequency: input.frequency,
      dueDay: monthBased ? due.getUTCDate() : null,
      nextDueDate: due,
      notify: input.notify,
      remindDaysBefore: input.remindDaysBefore,
      bankAccountId: input.bankAccountId || null,
      notes: input.notes || null,
    },
  } as const;
}
