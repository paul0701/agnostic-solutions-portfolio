# Flat version

Every file sits in one folder (no assets folder). Upload them all to the repo root.
The one exception is the vote function: it must live at `netlify/functions/votes.mjs`.
In GitHub use Add file > Create new file, type `netlify/functions/votes.mjs` as the name (typing the slashes makes the folders), paste in the contents of votes.mjs, and commit. Then delete the loose votes.mjs from the repo root.
Game screenshots go in the repo root as pawn-force.jpg, blockchain-breakout.jpg, guess-the-opening.jpg, slash-and-dash.jpg, vertical-limit.jpg, courier-run.jpg, rum-to-riches.jpg and ninja-dojo.jpg.

Each tile can also show a muted, click-to-play gameplay clip. Drop a `<slug>.mp4` in the repo root (same names as the screenshots) and a play button appears on that tile automatically; with no clip the tile just shows its screenshot/icon. The `.jpg` doubles as the clip's poster. Keep clips short (~10s) and small (720p or less, well under ~1&nbsp;MB).

# Deploying the portfolio

Static site plus one Netlify Function. No build command.

1. Put this folder in a GitHub repo and connect it to Netlify (or `netlify deploy --prod` from this folder). `netlify.toml` already sets publish = "." and the functions folder.
2. Site settings > Environment variables: add `VOTE_SALT` (any long random string). Without it, vote de-duplication falls back to a weaker default.
3. Forms: the "Describe your situation" form on the home page is a Netlify Form named `situation`. Enable it under Forms, then add an email notification to yourself.
4. Domain: add your custom domain in Domain management.
5. Votes: the Games page vote round is set by `data-round` (e.g. `2026-q4`) and `data-closes` on the `[data-vote]` section in games.html. For a new round, change both and swap the ideas. One vote per person per round; Lab "this would help" is one per idea.
6. Patreon: set `patreon` in assets/js/config.js. The thanks box stays hidden until it is set.
7. Game links are plain hrefs in games.html and index.html. Edit them there.
