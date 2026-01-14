-- Backfill set_img_url for existing LEGO sets
-- Constructs image URLs from set_num using Rebrickable CDN pattern

UPDATE catalog.lego_sets
SET set_img_url = 'https://cdn.rebrickable.com/media/sets/' || set_num || '.jpg'
WHERE set_img_url IS NULL 
   OR set_img_url = ''
   OR set_img_url = 'null';

-- Add comment for documentation
COMMENT ON COLUMN catalog.lego_sets.set_img_url IS 'LEGO set image URL from Rebrickable CDN. Constructed from set_num if not provided in CSV.';
