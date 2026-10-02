# kzfamily 4.27.7: functional inventory

Paths are relative to `reference/kzfamily-4.27.7/`.

## Loading architecture

- Single content script `bootstrap.js` at `document_start` on `https://www.wiki-masters.com/*`, plus `styles.css` and `theme-tracker.css`
- Adds `wm-premium-cards-enabled` on `<html>` before first paint (bootstrap.js:144-152)
- Injects 24 scripts into the main world as `<script src>` with `async=false` (bootstrap.js:157-213)
- `postMessage` bridge (bootstrap.js:15-135): `copy-card-image` (clipboard PNG), `semantic-fetch` (proxied GET to Wikidata/Wikipedia, unused)
- Dead code: `bridge/families.js`, `bridge/themes.js` (never injected)
- Communication between bridge and features: `window` CustomEvents `wm-average-*` correlated by `requestId`
- `bridge/intercept.js` monkeypatches `window.fetch` and `XMLHttpRequest` (intercept.js:14-103) and clones JSON for `/api/my-collection`, `/api/trades`, `/api/marketplace/{uuid}`, `/api/packs/open`, Supabase `/rest/v1/cards`. Also captures Supabase `apikey`/auth headers (core.js:282-324)
- Route detection: MutationObserver on `<main>` and `body`, plus `popstate`, comparing `pathname+search`, debounced 70 ms (app.js:216-345). Route predicates in features/core.js:37-63

## Card mapping

- Card element: `div[class*="rounded-2xl"][class*="overflow-hidden"][class*="cursor-pointer"]` or `div[class*="glow-"]` with an `h3`
- `h3` text normalized (NFC, collapsed spaces) and looked up in an `idByTitle` map filled from intercepted JSON (core.js:205-253), stored as `data-wm-card-id`
- Rarity from a child whose text is exactly `L|UR|SR|R|PC|C`

## Features

| Setting | Route | What it does | Data |
|---|---|---|---|
| `collectionPrices` | `/collection` | `Moy. X W` badge after `h3`, IntersectionObserver (rootMargin 320px) | `GET /api/marketplace/cards/{id}/sales?scope=summary`, 3 in flight, localStorage `wm_avg_v3_{id}` TTL 24h ok / 60s error, cleanup after 30 days |
| `marketplacePrice` | `/marketplace/{uuid}` | Average next to the `h1` | intercepted `/api/marketplace/{uuid}` or own fetch (throttled 2.5s) |
| `globalCollectionPrice` | `/global-collection` | Badge in the inspected card modal (`button[aria-label="Fermer"]` then `.card-frame`) | intercepted Supabase `/rest/v1/cards?...&id=eq.{uuid}` |
| `bulkPriceLoader` | `/collection` | "Charger les prix" by rarity | pages `/api/my-collection?sort=rarity&page=N` up to 200, after `/api/my-collection/stats` |
| `ranking`, `rankingSales` | `/collection` | "Plus chères" modal sorted by cached average, sell button per row | `/api/my-collection?sort=starred`, `&tag_id=` |
| `compactMode` | collection pages | `body.wm-compact-mode` | `wm_compact_mode_v1` |
| `premiumCards` | all | Full-art restyle, canvas palette, pointer tilt and foil, "Possédée" badge on marketplace (card-extras.js:389-671) | none |
| `wikipediaButtons` | all | "W" link to the article | `wikipediaUrl` |
| `missingImages` | all | Replaces the placeholder image | Wikidata, Commons, PokeAPI, Wikipedia `pageimages`, cache `wm_missing_img_v2_{title}` 30d found / 7d miss |
| `copyCardImage`, `pullShareButton` | all, `/pulls` | Card drawn on canvas, copied as PNG | none |
| `hideCardStats` | all | Hides ATK/DEF via `:has(svg.lucide-swords)` (styles.css:2995) | none |
| `notificationSound` | all | Chime when `button[aria-label="Notifications"]` badge grows | none |
| `packRecap`, `pullStats` | `/pulls` | Price recap of the opened pack, rarity counts | intercepted `/api/packs/open`, `wm_pull_stats_v1` |
| `tradeValues`, `tradePreviews` | `/trades` | Per-side totals (averages plus WikiBidous), rarity chips turned into mini cards | `GET /api/trades` |
| `themeTracker` | `/global-collection?wm=themes` | "Familles": user-built card groups, ownership check, missing cards on the market, import/export codes `F0.`/`F1.` | `/api/cards`, `/api/my-collection?q=`, `/api/marketplace?sort=recent&q=` |

Average price is not computed: it reads `summary[rarity].average` (prices.js:565-570). `chooseAverage` (price-ui.js:92-103): average of the card's rarity, else the only available one, else null.

Settings key `wm_feature_settings_v1`, all features default to `true`. Changing a setting reloads the page.

## Player action automation (excluded from our extension)

- "Tout ouvrir" (bridge/packs.js:398-523): loops `POST /api/packs/open` up to 100 times, random 500-2000 ms jitter, waits on `retry_after`
- Auto-open (features/packs.js:299-453): random timer 20-100 min, opens all packs without confirmation, on any page
- Anti-bot challenge auto-pass (packs.js:36-217, called on every `/pulls` render from app.js:195, not gated by any setting): simulates human delays (lognormal), clicks the checkbox then "Continuer"
- Listing from the ranking (bridge/marketplace.js:205-411): `POST /api/marketplace` `{card_id, base_amount, duration_minutes}`

## Response fields

- `/api/my-collection`: `collection[]{id, card_id, count, starred, tags[], card{id, wikipedia_title, rarity, image_url, wikipedia_url}}`, `total`, `tagOptions[]{id,name,color,cardCount}`, `searchHasMore`. Params: `sort` (`rarity`|`starred`), `q`, `page` (0-based), `stats`, `tag_id`
- `/api/my-collection/stats`: `rarityCounts` (or variants), map or `{rarity,count}` rows
- `/api/marketplace/cards/{id}/sales?scope=summary`: `{wikipedia_title, summary:{L:{average},...}}`
- `/api/marketplace/{uuid}`: `auction{id, card_id, snapshot_rarity, card{...}}`
- `/api/marketplace?page(1-based)&limit&sort=recent&q`: `auctions[]{id, status, card_id, is_shiny, effective_bid, current_bid, listing_base_amount, base_amount, end_at, seller{username}}`, `hasMore`
- `/api/packs/open`: `cards[]`, `packs_remaining`, `rate_limited`, `rate_limit_daily`, `retry_after`
- `/api/trades`: `trades[]{id, status, initiator_id, recipient_id, initiator_wikibidous, recipient_wikibidous, initiator{id,username}, recipient{id,username}, items[]{id, offered_by, card_id, snapshot_rarity, card{...}}}`
- `/api/cards`: `cards[]` with `category`, `atk`, `def`, plus `ownedCardIds[]`, `searchHasMore`
