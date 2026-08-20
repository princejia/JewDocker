-- 修复 products.code 重复：组内第一条保留原 code，其余按秒递增到下一个未占用的 code
-- 重复成因：批量导入时多行共用同一 created_at，set_record_code() 生成了相同的 'P'+时间戳
-- 新 code 保持原格式与长度（前缀 1 位 + 14 位 YYYYMMDDHH24MISS）

BEGIN;

-- 改动前先看一眼重复情况
SELECT code, count(*) AS cnt
FROM public.products
WHERE code IS NOT NULL AND code <> ''
GROUP BY code
HAVING count(*) > 1
ORDER BY code;

DO $$
DECLARE
  r         RECORD;
  ts        TIMESTAMP;
  candidate TEXT;
  k         INT;
BEGIN
  FOR r IN
    SELECT id, code, seq
    FROM (
      SELECT p.id,
             p.code,
             row_number() OVER (PARTITION BY p.code ORDER BY p.created_at, p.id) AS seq
      FROM public.products p
      JOIN (
        SELECT code
        FROM public.products
        WHERE code ~ '^[A-Z][0-9]{14}$'
        GROUP BY code
        HAVING count(*) > 1
      ) d ON d.code = p.code
    ) x
    WHERE seq > 1
    ORDER BY code, seq
  LOOP
    ts := to_timestamp(substring(r.code FROM 2), 'YYYYMMDDHH24MISS');
    k  := 0;
    LOOP
      k := k + 1;
      candidate := left(r.code, 1)
                || to_char(ts + make_interval(secs => k), 'YYYYMMDDHH24MISS');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE code = candidate);
    END LOOP;

    UPDATE public.products SET code = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 校验：应返回 0 行
SELECT code, count(*) AS cnt
FROM public.products
WHERE code IS NOT NULL AND code <> ''
GROUP BY code
HAVING count(*) > 1;

COMMIT;
