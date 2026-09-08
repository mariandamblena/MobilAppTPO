import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

export async function computeMetrics(clientId: number) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) throw notFound("Cliente");

  const [
    auctionsAttended,
    auctionsWon,
    bidAggregate,
    paidRecords,
    attendeesWithAuction,
    wonRecordsWithAuction,
    bidCount,
  ] = await Promise.all([
    prisma.attendee.count({ where: { clientId } }),
    prisma.saleRecord.count({ where: { clientId, boughtByCompany: false } }),
    prisma.bid.aggregate({
      _sum: { amount: true },
      where: { attendee: { clientId } },
    }),
    prisma.saleRecord.findMany({
      where: { clientId, paymentStatus: "paid" },
      select: { amount: true, commission: true, shippingCost: true },
    }),
    prisma.attendee.findMany({
      where: { clientId },
      select: { auction: { select: { category: true } } },
    }),
    prisma.saleRecord.findMany({
      where: { clientId, boughtByCompany: false },
      select: { auction: { select: { category: true } } },
    }),
    prisma.bid.count({ where: { attendee: { clientId } } }),
  ]);

  const totalBidAmount = bidAggregate._sum.amount ?? 0;
  const totalPaidAmount = paidRecords.reduce(
    (acc, r) => acc + r.amount + r.commission + (r.shippingCost ?? 0),
    0
  );

  const categoryMap = new Map<string, { attended: number; won: number }>();
  for (const att of attendeesWithAuction) {
    const cat = att.auction.category;
    if (!categoryMap.has(cat)) categoryMap.set(cat, { attended: 0, won: 0 });
    categoryMap.get(cat)!.attended++;
  }
  for (const rec of wonRecordsWithAuction) {
    const cat = rec.auction.category;
    if (!categoryMap.has(cat)) categoryMap.set(cat, { attended: 0, won: 0 });
    categoryMap.get(cat)!.won++;
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      attended: stats.attended,
      won: stats.won,
    }))
    // F08: no listar categorías sin participación (attended === 0).
    .filter((c) => c.attended > 0);

  return { auctionsAttended, auctionsWon, totalBidAmount, totalPaidAmount, bidCount, byCategory };
}
