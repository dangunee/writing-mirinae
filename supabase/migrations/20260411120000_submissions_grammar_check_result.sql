-- Server-side grammar usage check result (required expressions matched in submitted body)
ALTER TABLE writing.submissions
  ADD COLUMN IF NOT EXISTS grammar_check_result jsonb;

COMMENT ON COLUMN writing.submissions.grammar_check_result IS 'JSON: { checkedAt, results: [{ expressionKey, expressionLabel, pattern, matched }] }';
