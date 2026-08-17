-- Realtime Authorization for private game channels.
--
-- Clients connect with a server-signed JWT carrying `role: "authenticated"`
-- and a `game_id` claim (see src/server/auth/token.ts). These policies compare
-- that claim against the channel topic, so a token minted for one game cannot
-- read or write another game's channel.
--
-- The asymmetry is the point: clients may RECEIVE everything on their own
-- channel but may only SEND presence. Game state, chat messages and errors are
-- broadcast exclusively by the server over REST with the service_role key,
-- which bypasses RLS. That is what stops a player from forging a `game_state`
-- event and rewriting the board in their opponent's browser.

create policy "players receive events for their own game"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = (auth.jwt() ->> 'game_id')
  and extension in ('broadcast', 'presence')
);

create policy "players may only publish presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() = (auth.jwt() ->> 'game_id')
  and extension = 'presence'
);
