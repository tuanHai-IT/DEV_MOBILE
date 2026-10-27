-- SQLite reference schema; enforce server business transactions described in docs/architecture.md.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  city TEXT,
  avatar_key TEXT,
  cover_key TEXT,
  created_at TEXT NOT NULL,
  CHECK (role IN ('MEMBER','COLLECTOR','MODERATOR','ADMIN')),
  CHECK (status IN ('ACTIVE','SUSPENDED')),
  UNIQUE (email)
);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  expires_at TEXT,
  reason TEXT,
  CHECK (status IN ('PENDING','VERIFIED','REJECTED','EXPIRED'))
);

CREATE INDEX idx_verifications_user_id ON verifications(user_id);

CREATE INDEX idx_verifications_reviewer_id ON verifications(reviewer_id);

CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  recipient TEXT NOT NULL,
  phone TEXT NOT NULL,
  line TEXT NOT NULL,
  city TEXT NOT NULL,
  is_default INTEGER NOT NULL
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL,
  UNIQUE (name)
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  tags_json TEXT,
  created_at TEXT NOT NULL,
  moderator_id TEXT REFERENCES users(id),
  moderation_reason TEXT,
  CHECK (kind IN ('SALE','COMMUNITY')),
  CHECK (status IN ('PENDING','APPROVED','REJECTED','HIDDEN','SOLD'))
);

CREATE INDEX idx_listings_seller_id ON listings(seller_id);

CREATE INDEX idx_listings_moderator_id ON listings(moderator_id);

CREATE TABLE listing_items (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  material TEXT NOT NULL,
  condition TEXT NOT NULL,
  price_vnd INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  unit TEXT NOT NULL,
  CHECK (price_vnd > 0),
  CHECK (stock >= 0)
);

CREATE INDEX idx_listing_items_listing_id ON listing_items(listing_id);

CREATE INDEX idx_listing_items_category_id ON listing_items(category_id);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  visibility TEXT NOT NULL,
  listing_id TEXT REFERENCES listings(id),
  message_id TEXT REFERENCES messages(id),
  content_id TEXT REFERENCES content_entries(id),
  report_id TEXT REFERENCES reports(id),
  verification_id TEXT REFERENCES verifications(id),
  CHECK (visibility IN ('PUBLIC','PRIVATE')),
  CHECK ((listing_id IS NOT NULL) + (message_id IS NOT NULL) + (content_id IS NOT NULL) + (report_id IS NOT NULL) + (verification_id IS NOT NULL) = 1),
  CHECK (verification_id IS NULL OR visibility = 'PRIVATE')
);

CREATE INDEX idx_media_assets_uploader_id ON media_assets(uploader_id);

CREATE INDEX idx_media_assets_listing_id ON media_assets(listing_id);

CREATE INDEX idx_media_assets_message_id ON media_assets(message_id);

CREATE INDEX idx_media_assets_content_id ON media_assets(content_id);

CREATE INDEX idx_media_assets_report_id ON media_assets(report_id);

CREATE INDEX idx_media_assets_verification_id ON media_assets(verification_id);

CREATE TABLE interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  listing_id TEXT REFERENCES listings(id),
  content_id TEXT REFERENCES content_entries(id),
  target_user_id TEXT REFERENCES users(id),
  parent_comment_id TEXT REFERENCES interactions(id),
  like_count INTEGER DEFAULT 0,
  body TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (type IN ('LIKE','COMMENT','COMMENT_LIKE','SAVE','VIEW','SEARCH','FOLLOW','JOIN','REGISTER','FRIEND_REQUEST','NOTIFICATION','CHALLENGE_COMPLETION'))
);

CREATE INDEX idx_interactions_user_id ON interactions(user_id);

CREATE INDEX idx_interactions_listing_id ON interactions(listing_id);

CREATE INDEX idx_interactions_content_id ON interactions(content_id);

CREATE INDEX idx_interactions_target_user_id ON interactions(target_user_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  address_id TEXT REFERENCES addresses(id),
  delivery_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  subtotal_vnd INTEGER NOT NULL,
  shipping_vnd INTEGER NOT NULL,
  total_vnd INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (buyer_id <> seller_id),
  CHECK (status IN ('PENDING_PAYMENT','PAID','SHIPPED','COMPLETED','CANCELLED','DISPUTED','REFUND_PENDING','REFUNDED')),
  CHECK (subtotal_vnd > 0),
  CHECK (shipping_vnd >= 0),
  CHECK (total_vnd = subtotal_vnd + shipping_vnd)
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);

CREATE INDEX idx_orders_seller_id ON orders(seller_id);

CREATE INDEX idx_orders_address_id ON orders(address_id);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  listing_item_id TEXT NOT NULL REFERENCES listing_items(id),
  title_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_vnd INTEGER NOT NULL,
  CHECK (quantity > 0),
  CHECK (unit_price_vnd > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE INDEX idx_order_items_listing_item_id ON order_items(listing_item_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  parent_payment_id TEXT REFERENCES payments(id),
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  CHECK (kind IN ('CHARGE','REFUND')),
  CHECK (provider IN ('MOMO','VNPAY')),
  CHECK (status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
  CHECK (amount_vnd > 0),
  CHECK (currency = 'VND'),
  CHECK ((kind = 'CHARGE' AND parent_payment_id IS NULL) OR (kind = 'REFUND' AND parent_payment_id IS NOT NULL)),
  UNIQUE (idempotency_key),
  UNIQUE (provider, provider_ref)
);

CREATE INDEX idx_payments_order_id ON payments(order_id);

CREATE INDEX idx_payments_parent_payment_id ON payments(parent_payment_id);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  member_a_id TEXT NOT NULL REFERENCES users(id),
  member_b_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  created_at TEXT NOT NULL,
  CHECK (member_a_id <> member_b_id)
);

CREATE INDEX idx_conversations_member_a_id ON conversations(member_a_id);

CREATE INDEX idx_conversations_member_b_id ON conversations(member_b_id);

CREATE INDEX idx_conversations_order_id ON conversations(order_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  content_id TEXT REFERENCES content_entries(id),
  content_kind TEXT,
  sent_at TEXT NOT NULL,
  read_at TEXT,
  CHECK ((content_id IS NULL AND content_kind IS NULL) OR
         (content_id IS NOT NULL AND content_kind IN ('POST','TIP')))
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);

CREATE INDEX idx_messages_content_id ON messages(content_id);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (rating BETWEEN 1 AND 5),
  CHECK (author_id <> target_user_id),
  UNIQUE (order_id, author_id)
);

CREATE INDEX idx_reviews_order_id ON reviews(order_id);

CREATE INDEX idx_reviews_author_id ON reviews(author_id);

CREATE INDEX idx_reviews_target_user_id ON reviews(target_user_id);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id),
  content_id TEXT REFERENCES content_entries(id),
  target_user_id TEXT REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  resolver_id TEXT REFERENCES users(id),
  resolution TEXT,
  created_at TEXT NOT NULL,
  CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
  CHECK ((listing_id IS NOT NULL) + (content_id IS NOT NULL) + (target_user_id IS NOT NULL) + (order_id IS NOT NULL) = 1)
);

CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);

CREATE INDEX idx_reports_listing_id ON reports(listing_id);

CREATE INDEX idx_reports_content_id ON reports(content_id);

CREATE INDEX idx_reports_target_user_id ON reports(target_user_id);

CREATE INDEX idx_reports_order_id ON reports(order_id);

CREATE INDEX idx_reports_resolver_id ON reports(resolver_id);

CREATE TABLE collection_points (
  id TEXT PRIMARY KEY,
  manager_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  materials TEXT NOT NULL,
  opening_hours TEXT NOT NULL,
  status TEXT NOT NULL,
  CHECK (latitude BETWEEN -90 AND 90),
  CHECK (longitude BETWEEN -180 AND 180),
  CHECK (status IN ('ACTIVE','INACTIVE'))
);

CREATE INDEX idx_collection_points_manager_id ON collection_points(manager_id);

CREATE TABLE green_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  content_id TEXT REFERENCES content_entries(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (points <> 0),
  UNIQUE (dedupe_key)
);

CREATE INDEX idx_green_ledger_user_id ON green_ledger(user_id);

CREATE INDEX idx_green_ledger_order_id ON green_ledger(order_id);

CREATE INDEX idx_green_ledger_content_id ON green_ledger(content_id);

CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT REFERENCES content_entries(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  points_cost INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  CHECK (kind IN ('POST','TIP','SCAN','STORY','ARTICLE','GROUP','EVENT','CHALLENGE','REWARD','BADGE')),
  CHECK (status IN ('DRAFT','PUBLISHED','HIDDEN','PRIVATE','ARCHIVED')),
  CHECK ((kind = 'SCAN' AND status IN ('PRIVATE','ARCHIVED')) OR (kind <> 'SCAN' AND status <> 'PRIVATE')),
  CHECK (points_cost >= 0)
);

CREATE INDEX idx_content_entries_author_id ON content_entries(author_id);

CREATE INDEX idx_content_entries_parent_id ON content_entries(parent_id);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);

CREATE TABLE system_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL,
  UNIQUE (key)
);

CREATE INDEX idx_system_settings_updated_by ON system_settings(updated_by);

CREATE UNIQUE INDEX one_successful_charge_per_order ON payments(order_id) WHERE kind = 'CHARGE' AND status = 'SUCCEEDED';

CREATE UNIQUE INDEX one_pending_charge_per_order ON payments(order_id) WHERE kind = 'CHARGE' AND status = 'PENDING';

CREATE UNIQUE INDEX one_pending_verification_per_user ON verifications(user_id) WHERE status = 'PENDING';

CREATE UNIQUE INDEX one_default_address_per_user ON addresses(user_id) WHERE is_default = 1;

CREATE TRIGGER verified_order_insert BEFORE INSERT ON orders BEGIN
  SELECT RAISE(ABORT, 'Both parties must be active and verified') WHERE
    (SELECT COUNT(*) FROM users u WHERE u.id IN (NEW.buyer_id, NEW.seller_id) AND u.status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM verifications v WHERE v.user_id = u.id AND v.status = 'VERIFIED'
        AND (v.expires_at IS NULL OR v.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')))) <> 2;
END;

CREATE TRIGGER review_completed_order BEFORE INSERT ON reviews BEGIN
  SELECT RAISE(ABORT, 'Review requires completed order and participants') WHERE NOT EXISTS
    (SELECT 1 FROM orders o WHERE o.id = NEW.order_id AND o.status = 'COMPLETED' AND
    ((o.buyer_id = NEW.author_id AND o.seller_id = NEW.target_user_id) OR
     (o.seller_id = NEW.author_id AND o.buyer_id = NEW.target_user_id)));
END;

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Append-only audit log'); END;

CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Append-only audit log'); END;

CREATE TRIGGER scan_media_private_insert BEFORE INSERT ON media_assets BEGIN
  SELECT RAISE(ABORT, 'Scan media must be private') WHERE NEW.content_id IS NOT NULL
    AND NEW.visibility <> 'PRIVATE'
    AND EXISTS (SELECT 1 FROM content_entries WHERE id = NEW.content_id AND kind = 'SCAN');
END;

CREATE TRIGGER scan_media_private_update BEFORE UPDATE ON media_assets BEGIN
  SELECT RAISE(ABORT, 'Scan media must be private') WHERE NEW.content_id IS NOT NULL
    AND NEW.visibility <> 'PRIVATE'
    AND EXISTS (SELECT 1 FROM content_entries WHERE id = NEW.content_id AND kind = 'SCAN');
END;
