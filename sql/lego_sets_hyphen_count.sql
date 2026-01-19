-- Count of LEGO sets with and without hyphens in set_num

SELECT 
  COUNT(*) FILTER (WHERE set_num LIKE '%-%') AS sets_with_hyphen,
  COUNT(*) FILTER (WHERE set_num NOT LIKE '%-%') AS sets_without_hyphen,
  COUNT(*) AS total_sets
FROM catalog.lego_sets;
