# Tric-Trac

Digitale versie van het klassieke bordspel Tric-Trac: speel tegen de computer,
lokaal met twee spelers op één scherm, of online tegen een vriend (Firebase).

## Ontwikkelen

```bash
npm install
npm run dev          # dev server (Vite)
npm run build        # typecheck + productiebuild
npx playwright test  # E2E-tests (5 browserprojecten)
```

Handige test-URL's (omzeilen login/menu):

- `/?test=1` — ingelogd, hoofdmenu
- `/?test=1&start_pva=1` — direct in een potje tegen de computer
- `/?test=1&start_gameroom=1` — gameroom (lobby)
- `/?test=1&start_gameover=1` — game-over-scherm

In het spel: **Ctrl+Z** toggle't dev-knoppen voor endgame-scenario's.

## Architectuur

- Spellogica: pure reducer (`src/engine/gameReducer.ts`) + engines voor zetten,
  dobbelstenen en setup. UI raakt de regels nooit rechtstreeks aan.
- Online pvp: de volledige `GameState` synct als JSON via het Firestore-document
  `games/{gameId}` (`stateJson` + `lastUpdateId`).
- Bordinteractie: hit-testing in image-space (976×509) met touch-slop;
  de layoutcoördinaten staan in `src/constants/boardLayout.ts`.
- Design tokens en gedeelde knopklassen: `src/theme.css`.

## Security (Firestore)

De rules staan in `firestore.rules` en zijn verplicht voor online spelen:
alleen ingelogde spelers, `player1` onveranderlijk, join alleen op een lege
`player2`-slot, en bewaakte statusovergangen (`waiting → playing → cancelled`).

Deployen (eenmalig na elke rules-wijziging):

```bash
firebase deploy --only firestore:rules
```

## Bekende beperkingen

- **Dobbelstenen zijn client-side.** De actieve speler gooit lokaal
  (`Math.random`) en synct het resultaat. Een technische speler kan dus in
  theorie zijn eigen worpen vervalsen. Echte eerlijkheid vereist een
  twee-partijen commit-reveal-protocol of een Cloud Function als scheidsrechter
  — bewuste vervolgstap, zie `IMPLEMENTATIEPLAN-UX.md` §3.3.
- **Bordafbeelding is opgeschaald.** `speelbord@2x.webp` is een
  lanczos-upscale van de 976×509-bron; een echte high-res re-export van de
  originele artwork blijft de aanbeveling voor maximale scherpte.
