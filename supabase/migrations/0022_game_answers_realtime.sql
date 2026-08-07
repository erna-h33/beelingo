-- Bug fix found via live e2e testing: the host console's live "N / M
-- answered" indicator (useAnsweredCountQuery) never updated past 0,
-- even though answers were being scored correctly (the leaderboard did
-- update). Cause: game_answers was never added to the supabase_realtime
-- publication, so its INSERTs never reached the postgres_changes
-- subscription that's supposed to invalidate the count query.
alter publication supabase_realtime add table public.game_answers;
