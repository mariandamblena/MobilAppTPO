-- CreateIndex
CREATE INDEX "Attendee_clientId_idx" ON "Attendee"("clientId");

-- CreateIndex
CREATE INDEX "Auction_status_startsAt_idx" ON "Auction"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Auction_category_idx" ON "Auction"("category");

-- CreateIndex
CREATE INDEX "AuctionEvent_auctionId_createdAt_idx" ON "AuctionEvent"("auctionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuctionSession_clientId_active_idx" ON "AuctionSession"("clientId", "active");

-- CreateIndex
CREATE INDEX "AuctionSession_auctionId_active_idx" ON "AuctionSession"("auctionId", "active");

-- CreateIndex
CREATE INDEX "Bid_itemId_amount_idx" ON "Bid"("itemId", "amount" DESC);

-- CreateIndex
CREATE INDEX "Bid_itemId_timestamp_idx" ON "Bid"("itemId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Bid_itemId_winner_idx" ON "Bid"("itemId", "winner");

-- CreateIndex
CREATE INDEX "Bid_attendeeId_winner_idx" ON "Bid"("attendeeId", "winner");

-- CreateIndex
CREATE INDEX "Bid_attendeeId_timestamp_idx" ON "Bid"("attendeeId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "CatalogItem_catalogId_status_idx" ON "CatalogItem"("catalogId", "status");

-- CreateIndex
CREATE INDEX "CatalogItem_productId_idx" ON "CatalogItem"("productId");

-- CreateIndex
CREATE INDEX "InclusionRequest_ownerId_status_idx" ON "InclusionRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Notification_clientId_read_idx" ON "Notification"("clientId", "read");

-- CreateIndex
CREATE INDEX "Notification_clientId_createdAt_idx" ON "Notification"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PayoutAccount_ownerId_declaredAt_idx" ON "PayoutAccount"("ownerId", "declaredAt");

-- CreateIndex
CREATE INDEX "Penalty_clientId_status_idx" ON "Penalty"("clientId", "status");

-- CreateIndex
CREATE INDEX "Penalty_auctionId_idx" ON "Penalty"("auctionId");

-- CreateIndex
CREATE INDEX "Photo_productId_idx" ON "Photo"("productId");

-- CreateIndex
CREATE INDEX "SaleRecord_clientId_idx" ON "SaleRecord"("clientId");

-- CreateIndex
CREATE INDEX "SaleRecord_auctionId_idx" ON "SaleRecord"("auctionId");

-- CreateIndex
CREATE INDEX "SaleRecord_ownerId_idx" ON "SaleRecord"("ownerId");
