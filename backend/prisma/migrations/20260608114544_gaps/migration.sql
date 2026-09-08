-- AlterTable
ALTER TABLE "Penalty" ADD COLUMN "dueAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SaleRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "auctionId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "amount" REAL NOT NULL,
    "commission" REAL NOT NULL,
    "shippingCost" REAL,
    "pickupInPerson" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" TEXT,
    "paymentMethodId" INTEGER,
    "boughtByCompany" BOOLEAN NOT NULL DEFAULT false,
    "insuranceCovered" BOOLEAN NOT NULL DEFAULT true,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleRecord_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SaleRecord" ("amount", "auctionId", "boughtByCompany", "clientId", "commission", "createdAt", "id", "ownerId", "paidAt", "paymentMethodId", "paymentStatus", "pickupInPerson", "productId", "shippingAddress", "shippingCost") SELECT "amount", "auctionId", "boughtByCompany", "clientId", "commission", "createdAt", "id", "ownerId", "paidAt", "paymentMethodId", "paymentStatus", "pickupInPerson", "productId", "shippingAddress", "shippingCost" FROM "SaleRecord";
DROP TABLE "SaleRecord";
ALTER TABLE "new_SaleRecord" RENAME TO "SaleRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
