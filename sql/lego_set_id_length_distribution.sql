-- Distribution of character lengths for LEGO set IDs (set_num field)
-- Returns count of records for each character length from 1 to 10

SELECT 
  LENGTH(set_num) AS character_length,
  COUNT(*) AS record_count
FROM catalog.lego_sets
WHERE LENGTH(set_num) BETWEEN 1 AND 10
GROUP BY LENGTH(set_num)
ORDER BY character_length;
