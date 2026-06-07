-- Edge functions use the service_role key and still need explicit table
-- privileges even though service_role bypasses RLS.
-- generate-trivia: INSERT + SELECT (for RETURNING id after insert)
-- submit-trivia:   SELECT (fetch row) + UPDATE (write score / wipe questions)
grant select, insert, update on public.trivia_challenges to service_role;
