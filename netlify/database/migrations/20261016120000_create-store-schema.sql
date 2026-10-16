-- Atelier store schema. Nested documents from the original MongoDB models
-- (addresses, variants, cart/order lines, status history, refund requests)
-- are kept as JSONB so API response shapes stay unchanged.

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  email TEXT NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  wishlist UUID[] NOT NULL DEFAULT '{}',
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX users_created_at_idx ON users (created_at DESC);
CREATE INDEX users_reset_token_hash_idx ON users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 80),
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
  image TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 160),
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL CHECK (char_length(description) <= 5000),
  category_id UUID NOT NULL REFERENCES categories (id),
  brand TEXT NOT NULL DEFAULT 'Atelier',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  sku TEXT NOT NULL UNIQUE,
  price INTEGER NOT NULL CHECK (price >= 1),
  discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  average_rating DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX products_category_id_idx ON products (category_id);
CREATE INDEX products_listing_idx ON products (is_active, category_id, price, created_at DESC);
CREATE INDEX products_search_idx ON products
  USING GIN (to_tsvector('english', name || ' ' || description || ' ' || brand));

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  coupon_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value INTEGER NOT NULL CHECK (value >= 1),
  minimum_purchase INTEGER NOT NULL DEFAULT 0 CHECK (minimum_purchase >= 0),
  usage_limit INTEGER NOT NULL DEFAULT 1000 CHECK (usage_limit >= 1),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  idempotency_key TEXT NOT NULL,
  items JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  coupon_code TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping INTEGER NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'not_required')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_provider_order_id TEXT NOT NULL DEFAULT '',
  inventory_released BOOLEAN NOT NULL DEFAULT FALSE,
  reservation_expires_at TIMESTAMPTZ,
  cancellation_reason TEXT NOT NULL DEFAULT '',
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_id_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_created_at_status_idx ON orders (created_at DESC, status);
CREATE INDEX orders_pending_reservations_idx ON orders (reservation_expires_at)
  WHERE status = 'pending' AND payment_status = 'pending' AND inventory_released = FALSE;

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id),
  user_id UUID NOT NULL REFERENCES users (id),
  provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (provider = 'razorpay'),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 1),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'authorized', 'paid', 'failed', 'refunded')),
  refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  pending_refund_amount INTEGER NOT NULL DEFAULT 0 CHECK (pending_refund_amount >= 0),
  refund_requests JSONB NOT NULL DEFAULT '[]'::jsonb,
  webhook_event_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  product_id UUID NOT NULL REFERENCES products (id),
  order_id UUID NOT NULL REFERENCES orders (id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id, order_id)
);
CREATE INDEX reviews_product_id_idx ON reviews (product_id, is_approved, created_at DESC);

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  subject TEXT NOT NULL CHECK (char_length(subject) <= 160),
  message TEXT NOT NULL CHECK (char_length(message) <= 4000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX contact_messages_created_at_idx ON contact_messages (created_at DESC, status);

CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Starter catalog (previously inserted by `npm run seed`), so a fresh
-- deployment has something to browse. Re-running is a no-op on conflict.
INSERT INTO categories (name, slug, description, image) VALUES
  ('The Living Edit', 'living', 'Quiet details, considered for the rituals of home.', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=85'),
  ('Objects & Form', 'objects', 'Functional pieces with a little more feeling.', 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=960&q=85'),
  ('Wear Well', 'wear', 'Considered essentials for getting out the door.', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=960&q=85'),
  ('Slow Sundays', 'self-care', 'Little rituals for slowing down and looking after yourself.', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=960&q=85')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (name, slug, description, category_id, sku, price, stock, featured, images, variants)
SELECT p.name, p.slug, p.description, c.id, p.sku, p.price, p.stock, p.featured, p.images::jsonb, p.variants::jsonb
FROM (VALUES
  ('Sunday Stoneware Set', 'sunday-stoneware-set', 'An everyday set of two wheel-thrown ceramic cups. Finished in a soft, tactile glaze; each piece is a little different, just as it should be.', 'objects', 'ATL-CER-001', 2400, 28, TRUE, '["https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('Soft Form Linen Throw', 'soft-form-linen-throw', 'Relaxed European linen that only gets softer with time. Woven in small batches, with a generous drape for slow evenings.', 'living', 'ATL-LIN-002', 6800, 14, TRUE, '["https://images.unsplash.com/photo-1600210491369-e753d80a41f3?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('Everyday Carryall', 'everyday-carryall', 'A hard-wearing cotton canvas tote with a softly structured silhouette and room for the essentials you actually carry.', 'wear', 'ATL-BAG-003', 1850, 36, TRUE, '["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('First Light Candle', 'first-light-candle', 'A small-batch soy wax candle with notes of cedar, fig leaf and the quiet hour before the day begins. Approx. 45 hours of burn time.', 'self-care', 'ATL-HME-004', 1450, 42, FALSE, '["https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('Good Morning Pour-Over', 'good-morning-pour-over', 'A tactile, thoughtfully balanced ceramic dripper designed for an unhurried first cup. Fits standard cone filters.', 'objects', 'ATL-CER-005', 2200, 19, TRUE, '["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('Weekend Market Shirt', 'weekend-market-shirt', 'An easy, oversized cotton shirt for the long way home. Cut from breathable fabric and designed to wear on repeat.', 'wear', 'ATL-WEA-006', 3850, 22, FALSE, '["https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=960&q=85"]', '[{"name":"Size","options":["XS","S","M","L","XL"]}]'),
  ('Little Ritual Hand Balm', 'little-ritual-hand-balm', 'A rich but quick-absorbing, botanical hand balm made with shea butter and a gentle, fresh citrus scent.', 'self-care', 'ATL-CARE-007', 850, 55, FALSE, '["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=960&q=85"]', '[]'),
  ('Gather Together Serving Board', 'gather-together-serving-board', 'Solid, responsibly sourced acacia with a softly rounded edge. A serving board and a lovely centrepiece, made to earn its place on the table.', 'living', 'ATL-HME-008', 3200, 2, FALSE, '["https://images.unsplash.com/photo-1495546968767-f0573cca821e?auto=format&fit=crop&w=960&q=85"]', '[]')
) AS p (name, slug, description, category_slug, sku, price, stock, featured, images, variants)
JOIN categories c ON c.slug = p.category_slug
ON CONFLICT (slug) DO NOTHING;
