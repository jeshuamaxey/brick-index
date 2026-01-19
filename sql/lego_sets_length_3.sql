-- Return all LEGO sets with set_num character length of 3

SELECT *
FROM catalog.lego_sets
WHERE LENGTH(set_num) = 3
ORDER BY set_num;
