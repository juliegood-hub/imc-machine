-- Commerce / Online Store URLs for profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online_menu_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS square_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shopify_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS etsy_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS merch_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_store_url TEXT DEFAULT '';
