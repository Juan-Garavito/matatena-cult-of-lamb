-- Persist the bot's personality and skill level alongside the player row.
--
-- These lived in a module-level array in src/server/agent/data.ts, which only
-- works while a single long-lived process serves every request. Any restart, or
-- any deployment that spreads requests across more than one instance, silently
-- lost them: getBotByGame returned undefined and the agent kept playing without
-- the traits it was created with.
--
-- A bot IS a player, so the traits belong on the players row rather than in a
-- side table. That also avoids an insert-ordering problem: the agent invents the
-- traits and the player in the same step, so a separate table would need its row
-- written before the players row it references exists.

alter table public.players
  add column if not exists personality text,
  add column if not exists smart smallint;

-- Every bot must carry both traits; humans must carry neither. This is the last
-- line of defence: the agent hands the player object from create_player to
-- join_game through the model, and a bot inserted with null traits would be the
-- same silent failure in a new place. Better to reject the write.
--
-- NOT VALID skips the rows that already exist, whose traits are null and cannot
-- be recovered, while still enforcing the rule on every insert and update from
-- here on.
alter table public.players
  add constraint players_bot_traits check (
    (type = 'human' and personality is null and smart is null)
    or (type = 'bot' and personality is not null and smart between 1 and 10)
  ) not valid;
