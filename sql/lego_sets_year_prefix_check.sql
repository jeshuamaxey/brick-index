-- Count LEGO sets where the first part of set_num (before dash) is a year in range 1990-2030
-- This helps determine if excluding years would cause false negatives

SELECT 
  COUNT(*) AS sets_with_year_prefix,
  COUNT(*) FILTER (WHERE set_num LIKE '%-%') AS sets_with_year_prefix_and_dash,
  COUNT(*) FILTER (WHERE set_num NOT LIKE '%-%') AS sets_with_year_prefix_no_dash
FROM catalog.lego_sets
WHERE 
  -- Extract first part (before dash, or whole string if no dash)
  SPLIT_PART(set_num, '-', 1) ~ '^\d{4}$'  -- Exactly 4 digits
  AND CAST(SPLIT_PART(set_num, '-', 1) AS INTEGER) BETWEEN 1990 AND 2030;

-- Optional: See some examples
-- SELECT 
--   set_num,
--   SPLIT_PART(set_num, '-', 1) AS first_part,
--   CAST(SPLIT_PART(set_num, '-', 1) AS INTEGER) AS first_part_as_int,
--   name
-- FROM catalog.lego_sets
-- WHERE 
--   SPLIT_PART(set_num, '-', 1) ~ '^\d{4}$'
--   AND CAST(SPLIT_PART(set_num, '-', 1) AS INTEGER) BETWEEN 1990 AND 2030
-- ORDER BY first_part_as_int
-- LIMIT 20;
