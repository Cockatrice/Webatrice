---
'@cockatrice/webatrice': minor
---

The pre-game lobby now follows desktop's deck view. Once a deck is loaded it shows the Maindeck and Sideboard with Unload deck, Ready to start, a Sideboard locked/unlocked toggle and, for the host, Force start. While the sideboard is unlocked and you are not ready, clicking a card moves it between Maindeck and Sideboard and sends your sideboard plan, both before the first game and between games. Force start asks for confirmation and then sends a single force-start ready command, so the server removes unready players and starts the game in one step instead of the lobby kicking each player. If the server rejects a deck, or never answers, the lobby stays on the deck picker and says why.

The lobby and the in-game player list now offer "Copy game link" and "Invite to Game...". Both use desktop's `cockatrice://joingame` link, so desktop players can open it too. An invite sends that link as a private message to an online user you pick (buddies only for a buddies-only game). Game links in room, game and private chat become "Join game" buttons that confirm, join the room if needed, ask for a password or offer spectating when needed, and open the game.
