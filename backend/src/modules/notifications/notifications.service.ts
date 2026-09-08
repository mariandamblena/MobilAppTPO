import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

export async function listNotifications(clientId: number, unreadOnly: boolean) {
  const where = {
    clientId,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where: { clientId, read: false } }),
  ]);

  const parsed = items.map((n) => ({
    ...n,
    payload: n.payload ? (JSON.parse(n.payload) as Record<string, unknown>) : undefined,
  }));

  return { items: parsed, unreadCount };
}

export async function markAsRead(id: number, clientId: number) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.clientId !== clientId) {
    throw notFound("Notificación");
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
}

/** Helper interno — llamado desde F01, F06, F07 para emitir notificaciones al cliente. */
export async function createNotification(
  clientId: number,
  type: string,
  title: string,
  message: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await prisma.notification.create({
    data: {
      clientId,
      type,
      title,
      message,
      payload: JSON.stringify(payload),
    },
  });
}
