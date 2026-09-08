/**
 * Tipos TypeScript para los schemas MVP del OpenAPI de Auctify.
 * Basados en auctify-openapi.yaml — solo se tipan los schemas relevantes al MVP.
 *
 */

// ─────────────── ErrorCode ───────────────

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'DUPLICATE_ENTRY'
  | 'INVALID_TOKEN'
  | 'ACCOUNT_ALREADY_ACTIVATED'
  | 'NOT_ADMITTED'
  | 'CATEGORY_INSUFFICIENT'
  | 'NO_VERIFIED_PAYMENT_METHOD'
  | 'PAYMENT_METHOD_NOT_OWNED'
  | 'CHECK_LIMIT_EXCEEDED'
  | 'CLIENT_BLOCKED'
  | 'NOT_CONNECTED'
  | 'ALREADY_CONNECTED'
  | 'BID_OUT_OF_RANGE'
  | 'BID_SUPERSEDED'
  | 'MISSING_PHOTOS'
  | 'DECLARATION_REQUIRED'
  | 'INSUFFICIENT_FUNDS';

// ─────────────── Country ───────────────

export interface Country {
  id: number;
  name: string;
  shortName?: string | null;
  capital?: string;
  nationality?: string;
  languages?: string;
}

// ─────────────── Client ───────────────

export type ClientCategory = 'common' | 'special' | 'silver' | 'gold' | 'platinum';

export interface Client {
  id: number;
  document: string;
  name: string;
  address?: string | null;
  active: boolean;
  photoUrl?: string | null;
  email?: string | null;
  countryId?: number | null;
  admitted: boolean;
  category: ClientCategory;
  hasVerifiedPaymentMethod: boolean;
  blocked: boolean;
}

// ─────────────── Auction ───────────────

export type AuctionStatus = 'open' | 'closed' | 'scheduled';

export interface Auction {
  id: number;
  startsAt: string; // ISO date-time
  status: AuctionStatus;
  currency: 'ARS' | 'USD';
  auctioneerId?: number | null;
  location?: string | null;
  attendeeCapacity?: number | null;
  hasWarehouse: boolean;
  ownSecurity: boolean;
  category: ClientCategory;
  streamingUrl?: string | null;
  isCollection: boolean;
  collectionName?: string | null;
  itemCount?: number;
  attendeeCount?: number;
}

export interface AuctionDetail extends Auction {
  catalogId?: number | null;
  itemCount: number;
  attendeeCount: number;
}

// ─────────────── AuctionLiveStatus ───────────────

export type AuctionEventType =
  | 'new_bid'
  | 'item_opened'
  | 'item_closed'
  | 'item_sold'
  | 'item_unsold'
  | 'auction_ended';

export interface LiveStatusItem {
  itemId: number;
  productId: number;
  catalogDescription: string;
  basePrice: number;
  bestBid?: number | null;
  bestBidBidderNumber?: number | null;
  minBidAllowed?: number | null;
  maxBidAllowed?: number | null; // null para gold/platinum
  bidCount: number;
}

export interface AuctionLiveStatus {
  version: number;
  auctionId: number;
  auctionStatus: AuctionStatus;
  connectedCount: number;
  currentItem?: LiveStatusItem | null;
  youWereOutbid?: boolean;
  youAreLeading?: boolean;
  lastEvent?: {
    type: AuctionEventType;
    timestamp: string;
    data?: Record<string, unknown>;
  } | null;
  updatedAt: string;
}

// ─────────────── CatalogItem ───────────────

export interface CatalogItem {
  id: number;
  catalogId: number;
  productId: number;
  /** Solo visible si el cliente está registrado como asistente */
  basePrice?: number | null;
  commission: number;
  auctioned: boolean;
}

// ─────────────── Bid ───────────────

export interface Bid {
  id: number;
  attendeeId: number;
  itemId: number;
  amount: number;
  winner: boolean;
  timestamp: string;
  paymentMethodId: number;
}

// ─────────────── MyBid (GET /me/bids) ───────────────

export interface MyBid {
  id: number;
  itemId: number;
  amount: number;
  winner: boolean;
  timestamp: string;
  lotNumber: number;
  title: string;
  photo?: string | null;
  auctionId: number;
  auctionStatus: AuctionStatus;
  currency: 'ARS' | 'USD';
}

// ─────────────── PaymentMethod ───────────────

export type PaymentMethodType = 'bank_account' | 'credit_card' | 'certified_check';
export type PaymentMethodStatus = 'pending' | 'verified' | 'rejected';

export interface PaymentMethod {
  id: number;
  clientId: number;
  type: PaymentMethodType;
  currency: 'ARS' | 'USD';
  detail: string;
  bank?: string | null;
  countryId?: number | null;
  /** Solo para certified_check */
  reservedAmount?: number | null;
  status: PaymentMethodStatus;
}

// ─────────────── Notification ───────────────

export type NotificationType =
  | 'admission'
  | 'auction_winner'
  | 'inclusion_proposal'
  | 'penalty'
  | 'item_rejected'
  | 'info';

export interface Notification {
  id: number;
  clientId: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  payload?: Record<string, unknown>;
}

// ─────────────── Metrics ───────────────

export interface Metrics {
  auctionsAttended: number;
  auctionsWon: number;
  totalBidAmount: number;
  totalPaidAmount: number;
  /** Cantidad total de pujas realizadas por el cliente. */
  bidCount: number;
  byCategory: Array<{
    category: ClientCategory;
    attended: number;
    won: number;
  }>;
}

// ─────────────── SaleRecord ───────────────

export type SalePaymentStatus = 'pending' | 'paid' | 'failed';

export interface SaleRecord {
  id: number;
  auctionId: number;
  ownerId: number;
  productId: number;
  clientId: number;
  amount: number;
  commission: number;
  shippingCost?: number | null;
  pickupInPerson: boolean;
  shippingAddress?: string | null;
  paymentMethodId: number;
  boughtByCompany: boolean;
  paymentStatus: SalePaymentStatus;
  paidAt?: string | null;
  createdAt: string;
  product?: {
    id: number;
    catalogDescription?: string | null;
    fullDescription: string;
    photos: Array<{ photoUrl: string }>;
  };
}

// ─────────────── CatalogItemDetail ───────────────

export interface CatalogItemFull {
  id: number;
  catalogId: number;
  lotNumber: number;
  productId: number;
  catalogDescription?: string | null;
  basePrice?: number | null;
  commission: number;
  status: string;
  auctioned: boolean;
  photo?: string | null;
  bestBid?: number | null;
  minBidAllowed?: number | null;
  maxBidAllowed?: number | null;
  auctionId?: number;
  auctionStatus?: AuctionStatus;
  product?: {
    id: number;
    fullDescription: string;
    catalogDescription?: string | null;
    pieceCount: number;
    artist?: string | null;
    historicalDate?: string | null;
    history?: string | null;
    photos: string[];
  };
}

// ─────────────── AuctionCatalog ───────────────

export interface AuctionCatalog {
  catalogId: number;
  description: string;
  auctionId: number;
  items: Array<{
    id: number;
    lotNumber: number;
    catalogDescription?: string | null;
    basePrice?: number | null;
    commission: number;
    status: string;
    auctioned: boolean;
    photo?: string | null;
  }>;
}

// ─────────────── Insurance ───────────────

export interface Insurance {
  policyNumber: string;
  company: string;
  combinedPolicy: boolean;
  amount: number;
}

// ─────────────── PayoutAccount ───────────────

export interface PayoutAccount {
  id: number;
  ownerId: number;
  bank: string;
  countryId?: number | null;
  currency: 'ARS' | 'USD';
  cbuOrIban: string;
  accountHolder: string;
  declaredAt: string;
}

// ─────────────── ProductLocation ───────────────

export interface ProductLocation {
  productId: number;
  warehouse: string;
  address: string;
  receivedAt: string;
}

// ─────────────── Product / Photo ───────────────

export interface Photo {
  id: number;
  productId: number;
  photoUrl: string;
}

export interface Product {
  id: number;
  fullDescription: string;
  catalogDescription?: string | null;
  date?: string | null;
  pieceCount: number;
  artist?: string | null;
  historicalDate?: string | null;
  history?: string | null;
  available: boolean;
  ownerId: number;
  photos: Photo[];
}

// ─────────────── InclusionRequest ───────────────

export type InclusionRequestStatus =
  | 'pending'
  | 'under_inspection'
  | 'accepted'
  | 'rejected'
  | 'proposal_sent'
  | 'proposal_rejected';

export interface InclusionRequest {
  id: number;
  ownerId: number;
  productId: number;
  itemDescription: string;
  ownershipDeclared: boolean;
  legalityDeclared: boolean;
  status: InclusionRequestStatus;
  rejectionReason?: string | null;
  proposedBasePrice?: number | null;
  proposedCommission?: number | null;
  proposedAuctionId?: number | null;
  /** Costo de devolucion con cargo al dueno si fue rechazado */
  returnShippingCost?: number | null;
  createdAt: string;
}
