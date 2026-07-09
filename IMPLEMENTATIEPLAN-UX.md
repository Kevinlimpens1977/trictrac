# Implementatieplan UX-optimalisatie Tric-Trac

> **Voor de uitvoerende agent (Claude Opus 4.8):** dit plan is zelfstandig leesbaar. Alle
> onderzoek is al gedaan (codebase gelezen + live gemeten op 3 viewports). Je hoeft géén
> nieuw onderzoek te doen — volg de fasen in volgorde. Elke taak heeft bestanden,
> implementatierichting en acceptatiecriteria. Werk per fase op een aparte git branch
> (`ux-fase-1`, `ux-fase-2`, …) en commit per afgeronde taak.

---

## 0. Projectcontext (alles wat je moet weten voordat je begint)

### Stack & structuur
- React 19 + TypeScript + Vite 8, Firebase (Auth + Firestore), canvas-confetti.
- Speler-vs-computer (`pva`), lokaal 2 spelers en online 2 spelers (`pvp`) via Firestore.
- Spellogica: pure reducer in `src/engine/gameReducer.ts` (631 regels) + `moveEngine.ts`,
  `diceEngine.ts`, `setupEngine.ts`, `aiEngine.ts`. **De spelregels-engine is correct en
  goed getest — NIET wijzigen behalve waar dit plan het expliciet zegt.**
- Schermen: `AuthScreen` → `MenuScreen` → `Gameroom` (lobby+toss) → spel (`App.tsx` +
  `GameBoard` + `GameHUD`) → `GameOverScreen`.

### Dev & test
- Dev server: `npm run dev -- --port 5199 --strictPort` (er is een launch-config
  `trictrac-dev` in `C:\Projecten\nieuwsbriefgeneratorvs2627\.claude\launch.json` die dit
  al doet; gebruik de preview-tools daarmee).
- **Test-URL's (omzeilen login/menu):**
  - `http://localhost:5199/?test=1` → ingelogd, menu
  - `http://localhost:5199/?test=1&start_pva=1` → direct in spel tegen computer
  - `http://localhost:5199/?test=1&start_gameroom=1` → gameroom
  - `http://localhost:5199/?test=1&start_gameover=1` → gameover-scherm
- Dev-paneel in het spel: **Ctrl+Z** toggle't knoppen voor endgame-scenario's
  (`DEV_SETUP_COMPLETE`, `DEV_ENDGAME_SCENARIO`, `DEV_ENDGAME_3`, `DEV_ENDGAME_1`).
- Playwright staat klaar: `npx playwright test` met tests in `tests/`
  (`device-playability.spec.ts`, `gameboard.spec.ts`, `gameover.spec.ts`,
  `gameroom.spec.ts`, `responsive.spec.ts`), poort 5175 via `PLAYWRIGHT_PORT`.
- Verifieer visueel op 3 viewports: **375×812 (mobiel portret), 812×375 (mobiel
  landscape), 1280×800 (desktop)**.

### Firestore datamodel (collectie `games`, doc-id = 5-teken game-id)
```
player1, player2: string|null
status: 'waiting' | 'playing' | 'cancelled'
tossP1, tossP2: number|null, starter: 'B'|'W'|null
isPrivate: boolean, createdAt: number
stateJson: string  (volledige GameState, geserialiseerd; sync via lastUpdateId)
lastUpdateId: string
```
Sync-mechanisme in `App.tsx` regels 44–84: schrijver zet `lastUpdateId`, luisteraar
negeert eigen updates. `localPlayer` bepaalt wie mag klikken.

### Kernmetingen uit het onderzoek (live gemeten — dit zijn de problemen)

| # | Bevinding | Bewijs |
|---|-----------|--------|
| 1 | Menuknoppen zijn onzichtbare hitboxes van **112×20 px** op mobiel (375×812). Norm: 44×44 px. | `MenuScreen.tsx` regels 37–47 (`--pvp-top: 86%`, `--pvp-height: 10%`), hitboxes over tekst die in `homevideo5s.mp4` is ingebakken |
| 2 | Bordpunten hebben **~13 px** tapbreedte op mobiel portret (bord rendert 351×181 px). | `GameBoard.tsx` `hitTest()` regel 51–70: `halfW = 18` in 976 px image-space |
| 3 | Mobiel portret verspilt **~350 px** verticale ruimte; bord blijft 16:9 miniatuur bovenin. | `App.css` media query `(max-width: 700px) and (orientation: portrait)` |
| 4 | "Verlaat spel"-knop rendert **buiten** het geschilderde SPELRESULTAAT-paneel (gemeten: knop y=316, paneelbodem y=267 op 812×375). | `App.tsx` `styles.hudOverlay`: hardcoded `left: 66%, top: 28%, width: 26.5%, height: 58%` over afbeelding `speelbord.png` |
| 5 | `state.msg` (reducer-feedback zoals "Je moet eerst je stenen van de bar spelen!") wordt **nergens gerenderd**. | `GameState.ts` regel 56; `gameReducer.ts` zet msg op 25+ plekken; `GameHUD.tsx` heeft ongebruikte `styles.message` |
| 6 | **Vier** losse dobbelsteen-implementaties: `DiceRoller.tsx` (worp-animatie in HUD), `FloatingDice.tsx` (gouden undo-tokens), `DiceDisplay.tsx` (**dode code**), `DiceFace` in `Gameroom.tsx` (toss). | — |
| 7 | `DiceRoller.tsx` maakt **elke worp een nieuwe AudioContext** en sluit die nooit (Chrome-limiet ~6 → geluid valt stil). | `DiceRoller.tsx` regels 8–49 |
| 8 | `speelbord.png` is 976×509 en wordt op desktop ~2× opgeschaald (blurry). Hogere bron (5504×3072) bestaat volgens commentaar in `boardLayout.ts`. | `public/afbeeldingen/` |
| 9 | Dobbelen + toss zijn client-side `Math.random`; geen Firestore security rules; lobby-query haalt álle waiting games (privéfilter client-side, geen limit); verlaten games blijven eeuwig 'waiting'. | `Gameroom.tsx` regels 47–64, 211–252; `diceEngine.ts` |
| 10 | Intro-video `bordopenen.mp4` speelt **elk potje**, niet skipbaar (`pointerEvents: 'none'`), met `objectFit: 'fill'` (vervormt). | `App.tsx` regels 361–379 |
| 11 | Worp-animatie blokkeert vaste **2000 ms** (`App.tsx` regel 200 + `DiceRoller` 2 s). Op mobiel portret speelt de animatie in het paneel ónder het bord (buiten focus). | — |
| 12 | Bear-off is volledig geautomatiseerd (speler kan niet kiezen); exit-animatie-detectie dif't puntentotalen en kan een **hit verwarren met bear-off**. | `App.tsx` regels 90–124 (diffing) en 164–190 (auto bear-off) |
| 13 | Stenen **teleporteren** bij een zet (popIn op nieuwe plek); geen A→B animatie, geslagen stenen vliegen niet zichtbaar naar de bar. | `App.css` `.piece-enter` |
| 14 | Undo (klik op grijze/omgedraaide gouden tokens) is **onvindbaar** — geen enkele affordance. | `FloatingDice.tsx` regels 40–44 |
| 15 | Dode code: `DiceDisplay.tsx`, `LeaveGameModal.tsx`, `src/measure.ts`; twee firebase-inits (`src/firebase.ts` én `src/lib/firebase.ts`); analyze-scripts + `dist/` in repo. | — |
| 16 | Drie stijlsystemen door elkaar: inline style-objects, geïnjecteerde `<style>`-strings per component, losse CSS-files. Font "Impact" (rendert als fallback op Android). | — |
| 17 | `index.html`: `lang="en"`, titel "trictrac", geen meta-description, geen `viewport-fit=cover`, geen manifest. | — |
| 18 | Geen `touch-action: manipulation` → dubbeltik-zoom bij snel tikken op iOS. | — |

### Bordgeometrie-referentie (nodig voor fase 1 en 2)
- `src/constants/boardLayout.ts`: image-space 976×509. Punten 1–24 met x-centra
  (`LF`/`RF` arrays), driehoekbreedte ≈ 40,5 px image-space, `BOTTOM_BASE=415`,
  `BOTTOM_TIP=264`, `TOP_BASE=78`, `TOP_TIP=245`, `PIECE_RADIUS=16`.
  Bar op x=344 (12 breed), rechter tray x=774.
- Nummering gespiegeld: 1–6 linksonder, 7–12 rechtsonder, 13–18 rechtsboven, 19–24
  linksboven. Zwart (B) loopt 1→24, wit (W) 24→1 (check `moveEngine.ts` bij twijfel).
- Klik-afhandeling: container-click → relatieve coördinaten → image-space → `hitTest()`.
  SVG-overlay is puur render (`pointerEvents: 'none'`).

### Spelregels die de UI moet respecteren (NIET veranderen)
- Setup-fase: elke speler plaatst eerst 15 stenen (laagste dobbelsteen eerst,
  auto-place bij 1 optie na 600 ms).
- Dubbel gegooid → set `[d, d, 7-d, 7-d]` (worp eerst, dan spiegelbonus) én nog een keer
  gooien na afronden. Tric-trac (1+2) → set `[1,1,2,2,5,5,6,6]`.
- Verplichte volgorde: laagste eerst binnen een set (`diceEngine.ts` doc-blok).
- Bar-stenen moeten eerst; bear-off pas als alle stenen in het thuisvak zijn.

---

## FASE 1 — Speelbaarheid mobiel & feedback (branch `ux-fase-1`)

**Doel:** het spel is op elke telefoon comfortabel bedienbaar; foute acties geven zichtbare feedback.

### 1.1 Echte menuknoppen i.p.v. onzichtbare hitboxes
**Bestanden:** `src/components/MenuScreen.tsx`
- Vervang de twee `hitboxBtn`-buttons door zichtbare knoppen in de bestaande
  "Supercell"-stijl (die stijl staat al in hetzelfde bestand als `.btn-supercell`).
- Positioneer ze onderaan de videoStage op dezelfde plek als de ingebakken videotekst,
  maar als echte knoppen met label ("2 Spelers" / "Tegen de computer"), zodat de
  ingebakken tekst erachter wegvalt. Maak ze `min-height: max(48px, 7dvh)`.
- Op portret (`max-width: 700px`): knoppen NIET in de smalle 16:9-stage persen —
  plaats ze als kolom ónder de stage (stage wordt visueel element, knoppen ernaast/eronder).
- Houd `DEBUG_HITBOXES` en de aria-labels.
- **Acceptatie:** op 375×812 zijn beide knoppen ≥ 48 px hoog, volledig zichtbaar,
  leesbaar en tapbaar; op desktop lijkt het beeld op het huidige ontwerp.

### 1.2 Groter bord op mobiel portret
**Bestanden:** `src/App.css`, `src/App.tsx`, evt. `src/components/GameBoard.tsx`
- Aanpak (pragmatisch, geen board-rotatie in fase 1): maximaliseer het bord in portret
  door de HUD compact te maken. Concreet in de portret-media-query:
  - `board-wrapper` behoudt de bord-aspectratio maar krijgt de volle breedte
    (blijft ~181 px hoog — dat is inherent aan 16:9; daarom óók:)
  - Voeg een **"Draai je telefoon"-suggestie** toe: een dismissbare overlay/banner in
    portret in het spel-scherm ("🔄 Draai je telefoon voor een groter bord"), éénmalig
    per sessie (sessionStorage).
  - Maak het mobiele HUD-paneel compacter (max-height kleiner, gap 8px) zodat bord +
    HUD + banner zonder scroll passen; verwijder de loze ruimte onderaan (nu ~350 px).
- **Acceptatie:** portret toont bord + volledige HUD zonder scroll en zonder grote lege
  vlakken; landscape-hint verschijnt één keer en is wegklikbaar.

### 1.3 Ruimere hit-zones op het bord + pointer events
**Bestanden:** `src/components/GameBoard.tsx`
- `hitTest()`: vergroot `halfW` van 18 naar **20** (volle driehoekbreedte ≈ 40,5) en
  voeg verticale marge toe: laat de klikzone doorlopen tot de horizontale middenlijn
  (bottom: van `BOTTOM_BASE+10` tot `BOTTOM_TIP-20`; top: van `TOP_BASE-10` tot
  `TOP_TIP+20`), zodat ook nét naast/boven de driehoek tikken raak is.
- Voeg **touch-slop** toe: als niets direct geraakt wordt, zoek het dichtstbijzijnde
  punt binnen een straal van 30 image-px (alleen punten die een steen van de speler
  bevatten óf in `state.validTos` zitten — anders `none`).
- Vervang `onClick` door `onPointerUp` (met `pointerType`-agnostische afhandeling) en
  zet `touch-action: manipulation` op de container.
- Bar-hitzone: verbreed van 12 naar minimaal 40 image-px breed.
- **Acceptatie:** bestaande Playwright-tests slagen; op 375-breed viewport is elk punt
  met één tik betrouwbaar te selecteren (handmatig verifiëren met preview_click op
  puntcoördinaten).

### 1.4 HUD als echt paneel (niet meer over de geschilderde afbeelding)
**Bestanden:** `src/App.tsx` (hudOverlay), `src/components/GameHUD.tsx`, `src/App.css`
- Probleem: `styles.hudOverlay` (66 % / 28 % / 26,5 % / 58 %) is afgestemd op het
  geschilderde papier in `speelbord.png`; content loopt eruit ("Verlaat spel" zweeft
  boven het gras).
- Oplossing: geef `.board-hud-overlay` een eigen papier-achtige achtergrond
  (CSS: crème verloop + border-radius + subtiele schaduw, passend bij de art) en
  `overflow: hidden` + interne flex-layout, zodat het paneel zijn content ALTIJD omvat,
  ook als de afbeelding eronder net anders schaalt. Grens: het paneel mag het
  geschilderde papier bedekken (dat is oké — zelfde look).
- "Verlaat spel" hoort ÍN het paneel (geen `marginTop: auto` die hem eruit duwt);
  maak hem kleiner/subtieler (tekstlink-stijl met icoon) bovenin of onderin het paneel.
- Verwijder de aparte `@media (max-height: 520px)` overrides als het paneel door de
  nieuwe layout vanzelf past.
- **Acceptatie:** op 812×375, 1024×768 en 1280×800 valt géén enkel HUD-element buiten
  de paneelachtergrond (meet met getBoundingClientRect via preview_eval).

### 1.5 `state.msg` zichtbaar maken (feedbackbalk)
**Bestanden:** `src/components/GameHUD.tsx`, evt. `src/App.css`
- Render `state.msg` in de HUD (de ongebruikte `styles.message` bestaat al).
- Maak er een statusregel van met vaste hoogte (geen layout-shift), max 2 regels,
  en een subtiele fade bij wijziging (key op msg + CSS animation).
- Belangrijke berichten (fout-acties: "Je moet eerst…", "Geen geldige zetten…")
  extra opvallend: rood accent of korte shake.
- **Acceptatie:** klik in het spel op een eigen steen terwijl je op de bar staat →
  het bericht "Je moet eerst je stenen van de bar spelen!" is zichtbaar in de UI.

### 1.6 Mobile-hygiëne (klein maar essentieel)
**Bestanden:** `index.html`, `src/index.css`
- `index.html`: `lang="nl"`, `<title>Tric-Trac — het klassieke bordspel</title>`,
  meta-description, viewport → `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- `src/index.css`: globaal `button, [role="button"] { touch-action: manipulation; }`,
  `html { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }`.
- Safe-area: paddings met `env(safe-area-inset-*)` op game-shell en mobile-hud-panel
  (deels al aanwezig voor top — vul aan voor bottom/left/right).
- **Acceptatie:** build slaagt; geen dubbeltik-zoom meer op interactieve elementen.

### 1.7 Tap-targets ≥ 44 px afdwingen met test
**Bestanden:** `tests/device-playability.spec.ts` (uitbreiden)
- Voeg een Playwright-test toe die op viewports 375×812, 812×375 en 1280×800 door
  de schermen navigeert (gebruik de `?test=1…` URL's) en van élke zichtbare `button`
  asserteert: `width ≥ 44 && height ≥ 44` (uitzondering: expliciete allowlist voor
  tekstlinks, momenteel leeg).
- **Acceptatie:** test slaagt na 1.1–1.6.

---

## FASE 2 — Dobbelen & game feel (branch `ux-fase-2`)

**Doel:** één professioneel dobbelsysteem, zichtbaar op het bord, met correcte audio, zet-animaties en ontdekbare undo.

### 2.1 Eén herbruikbare `<Die>`-component (3D)
**Nieuw bestand:** `src/components/Die.tsx`
- CSS 3D-kubus: 6 vlakken (`transform: rotateX/rotateY … translateZ`), pips als
  absolute dots per vlak (hergebruik de dot-posities die nu in `DiceRoller.TokenPips`
  staan). Props: `value (1-6)`, `size`, `color ('white'|'black')`, `rolling: boolean`,
  `onRollEnd?`.
- Rol-animatie: 0,9–1,2 s tuimeling (keyframes met meerdere rotaties + kleine
  translate/bounce), eindigend exact op de stand van `value`. Gebruik een mapping
  waarde→eindrotatie (bijv. 1: `rotateX(0) rotateY(0)`, 2: `rotateX(-90deg)`, …).
- Respecteer `prefers-reduced-motion`: dan geen tuimeling, alleen korte fade naar
  eindstand.
- Vervang hiermee: `DiceRoller`'s `DiceIcon`, `Gameroom`'s `DiceFace` (toss) en de
  pips in `FloatingDice`. Verwijder `DiceDisplay.tsx` (dood).
- **Acceptatie:** worp in spel, toss in gameroom en undo-tokens gebruiken allemaal
  dezelfde component; visueel een echte 3D-tuimeling.

### 2.2 Dobbelen óp het bord
**Bestanden:** `src/components/GameBoard.tsx`, `src/components/GameHUD.tsx`, `App.tsx`
- Render de worp-animatie als overlay **midden op de linker bordhelft** (image-space
  x ≈ 206, y ≈ 254 — midden van het linkerveld) i.p.v. in het HUD-paneel. Praktisch:
  absolute-positioned div in de GameBoard-container (procentueel: left 21 %, top 50 %),
  met de twee `<Die>`-componenten (~9 % van bordbreedte per steen).
- Na de tuimeling: stenen blijven ~0,7 s liggen, dan krimp-fade naar de HUD waar de
  `FloatingDice`-tokens verschijnen (continuïteit: de speler ziet waar de waarden heen
  gaan).
- **Skipbaar:** een tap op het bord tijdens de animatie beëindigt hem direct
  (dispatch `END_ROLL_ANIMATION` vervroegd; guard tegen dubbel dispatchen; in pvp
  alleen voor de actieve speler — zie de bestaande `isRemotePlayer`-guard in
  `App.tsx` regels 193–205).
- Verkort de totale roll-tijd van 2000 ms naar **1200 ms** (pas óók de setTimeout in
  `App.tsx` regel 200 aan én de animatieduur — houd ze gelijk).
- **Acceptatie:** op mobiel portret is de worp zichtbaar op het bord (niet meer
  onder de vouw); tap tijdens animatie slaat hem over; pvp-sync blijft werken
  (beide clients zien de animatie, alleen actieve speler muteert state).

### 2.3 Audio-engine + mute + haptics
**Nieuw bestand:** `src/audio/sound.ts`; **wijzig:** `src/components/DiceRoller.tsx`
(of diens opvolger), `GameHUD.tsx`
- Eén module met lazy singleton `AudioContext` (aangemaakt bij eerste user-gesture,
  hergebruikt, nooit opnieuw geïnstantieerd). API: `playDiceRoll()`, `playPieceMove()`,
  `playHit()`, `playBearOff()`, `setMuted(bool)` / `isMuted()` (persist in
  localStorage `tt-muted`).
- Verplaats de bestaande oscillator-synthese uit `DiceRoller.tsx` hierheen (die klinkt
  acceptabel); voeg een korte tik voor zetten en een lager "thud" voor hits toe
  (zelfde synthese-techniek, andere frequenties — geen externe samples nodig in deze fase).
- Mute-knop (🔊/🔇) in de HUD, 44×44, rechtsboven in het paneel.
- Haptics: `navigator.vibrate?.(…)` bij worp (30 ms), hit (2×40 ms), bear-off (60 ms) —
  alleen als niet gemuted.
- **Acceptatie:** 10× achter elkaar gooien → geluid blijft werken (het huidige
  AudioContext-lek is weg); mute persist na refresh.

### 2.4 Zet-animaties A→B + zichtbare hit naar de bar
**Bestanden:** `src/engine/gameReducer.ts` (klein), `src/App.tsx`, `src/components/GameBoard.tsx`, `src/App.css`
- **Reducer:** voeg aan `GameState` een veld `lastEvent` toe:
  `{ type: 'move'|'hit'|'bearoff'; from: number; to: number; player: Player; seq: number } | null`
  en zet dit in `MOVE_PIECE` (en bear-off-pad). `seq` = oplopend nummer zodat de UI
  elke event uniek ziet. Dit veld syncs automatisch mee via `stateJson` (pvp-animaties
  gratis aan beide kanten). **Geen andere reducer-logica aanraken.**
- **UI:** vervang de fragiele punten-diffing in `App.tsx` (regels 90–124) door
  reageren op `state.lastEvent`:
  - `move`: render een tijdelijke "vliegende steen" (SVG-circle) die in 250 ms van
    de from-positie naar de to-positie beweegt (positieberekening met bestaande
    `getPieceY` + `BOARD_LAYOUT`); onderdruk gedurende die 250 ms de popIn van de
    doelsteen (bijv. CSS-class op de laatst toegevoegde steen).
  - `hit`: geslagen steen vliegt zichtbaar van het punt naar de bar-positie (300 ms).
  - `bearoff`: behoud de bestaande `floatAway`-animatie, maar nu getriggerd door het
    event (fixt de false positives bij hits).
- **Acceptatie:** een zet toont zichtbare verplaatsing; een hit toont de steen die
  naar de bar gaat; bear-off animatie triggert alléén bij bear-off. Dev-scenario's
  (Ctrl+Z) gebruiken om endgame te testen.

### 2.5 Undo ontdekbaar maken
**Bestanden:** `src/components/FloatingDice.tsx`
- Toon op gebruikte (grijze) tokens de gespeelde waarde (pips in donkergrijs) + een
  klein ↩-icoon; tooltip/label eronder: "Tik op een gespeelde steen om terug te nemen"
  (één regel, 11 px, alleen zichtbaar zolang `usedCount > 0`).
- Vergroot de tokens naar min. 48 px en geef de klikbare (gebruikte) tokens een
  hover/active-state.
- In pvp: verberg undo-affordance voor de niet-actieve speler (bestaat al impliciet —
  verifieer).
- **Acceptatie:** nieuwe speler begrijpt zonder uitleg dat terugnemen kan (label
  zichtbaar); tokens ≥ 48 px.

### 2.6 Intro-video: eenmalig + skipbaar
**Bestanden:** `src/App.tsx`
- `objectFit: 'fill'` → `'cover'`.
- Overlay-knop "Overslaan ▸" (44 px, rechtsonder) die `setIntroPhase('game')` doet;
  hele video ook tapbaar om te skippen.
- Speel de video alleen bij het éérste potje per sessie (`sessionStorage 'tt-intro-seen'`).
- **Acceptatie:** tweede potje in dezelfde sessie start zonder video; skip werkt.

### 2.7 Bear-off: agency terug (optioneel automatisch)
**Bestanden:** `src/App.tsx`, `src/components/GameHUD.tsx`
- Voeg een instelling toe (toggle in HUD of leave-modal): "Automatisch uitspelen"
  (default áán, persist localStorage `tt-autobearoff`).
- Staat hij uit: het auto-bear-off-blok in `App.tsx` (regels 164–190) slaat over en
  de speler klikt zelf (herstel het handmatige pad in `handlePointClick`: bij
  `canBearOff` een klik op eigen punt met geldige bear-off → `MOVE_PIECE from→25`;
  `state.validTos` bevat 25 al via de engine — verifieer met `getValidMoves`).
- Climax-vertraging (slow-motion) alleen in automatische modus.
- **Acceptatie:** met toggle uit is handmatig uitspelen mogelijk; met toggle aan is
  gedrag identiek aan nu.

---

## FASE 3 — Visuele kwaliteit & commercieel fundament (branch `ux-fase-3`)

### 3.1 Scherpe bordgraphics
**Bestanden:** `public/afbeeldingen/`, `src/components/GameBoard.tsx`
- Zoek de hogere-resolutie bron van het bord (het originele `bord.png` is 5504×3072;
  `speelbord.png` 976×509 is daarvan een export). Exporteer een 1952×1018 (2×) WebP
  (kwaliteit ~82) als `speelbord@2x.webp` en serveer via
  `<img srcSet="speelbord.png 1x, speelbord@2x.webp 2x">`. **Let op:** de
  layoutconstanten blijven in 976×509-space — alleen de bitmap wordt scherper, de
  coördinaten veranderen NIET.
- Als de bron onvindbaar/afwijkend is: upscale met `sharp` (staat in devDependencies)
  of sla dit punt over en meld het.
- Stenen: verrijk de SVG-circles met radialGradient (ivoor/ebbenhout-look) en een
  fijne rand — puur SVG, geen bitmaps.
- **Acceptatie:** op een 2×-scherm (preview met deviceScaleFactor of gewoon visueel)
  is het bord merkbaar scherper; alle stukken liggen nog exact op hun punt.

### 3.2 Design tokens & één stijlsysteem
**Nieuw bestand:** `src/theme.css` (CSS custom properties); **wijzig:** alle componenten stapsgewijs
- Definieer tokens: kleuren (houttinten, crème, goud `#d4af37`, rood, blauw),
  radius-schaal, schaduw-schaal, font-families, knop-hoogtes.
- Eén `.btn`-basisklasse + varianten (`.btn--gold`, `.btn--blue`, `.btn--red`,
  `.btn--ghost`) ter vervanging van de drie dubbele "Supercell"-definities
  (`MenuScreen` `.btn-supercell`, `Gameroom` `styles.btnSupercell*`, `GameHUD`/
  `GameOverScreen` inline-knoppen). Migratie mag mechanisch: zelfde look, één bron.
- Font: vervang "Impact" door een zelf-gehost display-font (bijv. Lilita One via
  `@font-face` met woff2 in `public/fonts/` — download en commit het bestand;
  fallback: `Impact, sans-serif` behouden).
- Verwijder dode code: `DiceDisplay.tsx`, `LeaveGameModal.tsx`, `src/measure.ts`,
  en consolideer `src/firebase.ts` + `src/lib/firebase.ts` naar één module.
- **Acceptatie:** `npm run build` + alle Playwright-tests groen; visueel geen
  regressie op de 3 viewports; geen import van verwijderde bestanden.

### 3.3 Server-authoritative dobbelen + Firestore security rules
**Nieuw:** `firestore.rules` (+ deploy-instructie), evt. Cloud Function
- **Pragmatische aanpak zonder Cloud Functions (voorkeur, geen billing-afhankelijkheid):
  commit-reveal in Firestore.** Bij `ROLL_DICE` in pvp: actieve client schrijft
  `rollCommit` (hash van seed+nonce), daarna `rollReveal`; beide clients deriven de
  worp deterministisch uit `seed XOR gameId XOR turnNumber`. De tegenstander kan
  verifiëren dat de reveal bij de commit hoort. Implementeer in een nieuw
  `src/engine/fairDice.ts` (SHA-256 via `crypto.subtle`), en gebruik het alléén in
  pvp-modus (pva/local blijft `Math.random`).
  - Als dit te complex blijkt binnen de sessie: minimaal de toss én worp door de
    HOST laten zetten met de bestaande sync (huidige situatie) en dit punt als
    "known limitation" documenteren in README. Security rules zijn dan alsnog verplicht.
- **`firestore.rules`:** alleen authenticated users; een game-doc mag alleen gewijzigd
  worden door deelnemers (check op `request.auth != null`; velden `player1/player2`
  immutable na zetten; `status`-transities beperkt: waiting→playing→cancelled).
  Voeg `firebase deploy --only firestore:rules` toe aan README (niet zelf deployen
  zonder toestemming van de gebruiker).
- **Acceptatie:** rules-bestand aanwezig + gedocumenteerd; pvp-potje werkt end-to-end
  (handmatig testen met 2 browsertabs: host + join via game-id).

### 3.4 Lobby robuust: opruimen, limit, presence
**Bestanden:** `src/components/Gameroom.tsx`
- Query: `where('status','==','waiting')`, `where('isPrivate','==',false)`,
  `where('createdAt','>', Date.now() - 30*60*1000)`, `limit(20)`, order by createdAt
  desc. (Composite index nodig — vang de Firestore-error op en toon de index-URL in
  console + fallback naar de simpele query.)
- Host-cancel bij tab-sluiten: `beforeunload` → `updateDoc(status:'cancelled')`
  (best effort) + toon in de lijst alleen games < 30 min oud (bovenstaande filter
  vangt de rest).
- Toon in de lijst hoe lang een game al wacht ("2 min geleden").
- **Acceptatie:** verlaten games verschijnen niet meer in de lijst; lijst max 20 items.

### 3.5 Reconnect & persistentie
**Bestanden:** `src/App.tsx`, `src/components/Gameroom.tsx`, `src/engine/gameReducer.ts` (alleen init)
- **Lokaal/pva:** persist `state` (zonder `history`) naar localStorage
  (`tt-savegame`) bij elke `lastUpdateId`-wijziging; bij app-start met een opgeslagen
  spel: toon een "Doorgaan met vorig spel?"-dialoog (Hervat / Nieuw spel).
- **Online:** sla `{gameId, localPlayer}` op in localStorage zolang een pvp-potje
  loopt; bij herstart met actieve game: bied "Opnieuw verbinden" aan → laad
  `stateJson` uit Firestore en dispatch `SYNC_STATE`.
- Ruim op bij gameover/reset.
- **Acceptatie:** F5 midden in een pva-potje → hervatten mogelijk met exact dezelfde
  stand; F5 in pvp → reconnect brengt je terug in het lopende potje.

### 3.6 PWA
**Bestanden:** `public/manifest.webmanifest`, `index.html`, `vite.config.ts` (vite-plugin-pwa)
- `npm i -D vite-plugin-pwa`; manifest: naam "Tric-Trac", `display: fullscreen`,
  `orientation: landscape` (voorkeur), theme/background kleuren uit theme.css,
  iconen 192/512 (genereer met sharp uit `favicon.svg` of `trictrachome.png`).
- Service worker: precache app-shell + afbeeldingen (pva werkt offline; pvp vereist
  netwerk — vang offline netjes af met een melding).
- **Acceptatie:** Lighthouse PWA-installable check slaagt in `npm run preview`.

---

## FASE 4 — Onboarding, toegankelijkheid & groei (branch `ux-fase-4`)

### 4.1 Interactieve onboarding
**Nieuw:** `src/components/Coach.tsx`; **wijzig:** `App.tsx`
- Een lichtgewicht coach-laag die contextuele tooltips toont (pijl + tekstballon,
  verankerd aan bord-/HUD-posities), getriggerd door state:
  - eerste keer setup-fase → "Plaats je 15 stenen. De laagste dobbelsteen bepaalt het punt."
  - eerste dubbel → "Dubbel! Je speelt je worp én het spiegelbeeld (7 − ogen). Daarna mag je nóg een keer gooien."
  - eerste tric-trac (1+2) → uitleg bonussets.
  - eerste keer op de bar → "Je geslagen steen moet eerst terug het bord op."
- Elke tip éénmalig (localStorage `tt-coach-…`), wegtikbaar, uitzetbaar via een
  "Tips"-toggle in de HUD.
- **Acceptatie:** vers profiel (localStorage leeg) krijgt de tips op de juiste
  momenten; ervaren speler kan alles uitzetten.

### 4.2 Toegankelijkheid
**Bestanden:** `GameBoard.tsx`, `GameHUD.tsx`, `index.css`, overige schermen
- `aria-live="polite"`-region gekoppeld aan `state.msg` (komt gratis mee met 1.5 —
  voeg het attribuut toe).
- Keyboard: pijltjes ←/→ lopen door eigen punten met geldige zetten, Enter selecteert
  /bevestigt, Esc deselecteert, R = gooien, U = undo. Zichtbare focus-ring op het
  actieve punt (SVG-rect met dashed stroke).
- Kleurenblind-veilig: selectie-highlight (geel) krijgt óók een dikkere dashed rand;
  geldige doelen (groen) krijgen een klein ▼-driehoekje boven het punt.
- `prefers-reduced-motion`: schakel confetti, climax-pulse, shake en tuimel-animaties
  uit (fade-vervangers).
- Focus-trap + Esc in modals (leave-confirm, help-dialoog); `role="dialog"` bestaat
  al bij help — voeg focus-management toe.
- **Acceptatie:** volledig potje speelbaar zonder muis/touch (handmatig verifiëren);
  axe-core scan (playwright-axe of handmatig) zonder critical issues op de 4 schermen.

### 4.3 Statistieken & profiel
**Bestanden:** nieuw `src/stats.ts`, `GameOverScreen.tsx`, `MenuScreen.tsx`
- Persist per gebruiker (localStorage, key per uid): gespeelde potjes, winst/verlies
  per modus, dubbels, hits, snelste potje. Toon een compacte stats-kaart in het menu
  en uitgebreider op het gameover-scherm ("Jouw record: …").
- **Acceptatie:** stats overleven refresh en tellen correct op na 2 testpotjes
  (pva met dev-endgame is prima om te tellen).

### 4.4 Turn-timer & AFK-afhandeling online
**Bestanden:** `gameReducer.ts` (veld), `App.tsx`, `GameHUD.tsx`
- In pvp: 60 s per beurt (zichtbare countdown-ring om de beurt-indicator vanaf 20 s).
  Bij 0: automatische forfeit van de beurt (`FORFEIT_TURN` bestaat al) — géén
  auto-verlies van het potje. Timer-start = `lastUpdateId`-wijziging met
  beurtwissel; timestamp in state zodat beide clients dezelfde deadline zien.
- **Acceptatie:** in een 2-tabs-test loopt de timer synchroon en forfeit hij de
  beurt correct.

### 4.5 Vriendelijker online-instap
**Bestanden:** `Gameroom.tsx`, `AuthScreen.tsx`
- Deel-link: naast "Copy" een "Deel link"-knop die
  `location.origin + '?join=<ID>'` kopieert/`navigator.share`t; bij app-start met
  `?join=` → direct naar gameroom met vooringevuld join-id.
- Gastmodus: "Speel zonder account"-knop op AuthScreen → Firebase anonymous auth
  (`signInAnonymously`), naam vragen in de gameroom (gebeurt al via `onlineName`).
- **Acceptatie:** join-link in tweede tab → komt direct in het join-flow; anoniem
  potje pva werkt zonder Google-login.

---

## Werkafspraken voor de uitvoerende agent

1. **Volgorde:** fasen strikt in volgorde; binnen een fase mag je taken herordenen als
   dependencies dat vragen. Meld afgeronde taken per stuk.
2. **Verifiëren, niet aannemen:** na elke taak met UI-impact: dev server (poort 5199,
   launch-config `trictrac-dev`), de drie viewports, en de relevante `?test=1`-URL.
   Draai na elke fase `npm run build` en `npx playwright test`.
3. **Engine is heilig:** wijzig `moveEngine/diceEngine/setupEngine/aiEngine` niet;
   `gameReducer` alleen voor de expliciet genoemde velden (`lastEvent`, timer-veld).
   Bij twijfel over een spelregel: lees het doc-blok in `diceEngine.ts`.
4. **PvP-sync bewaken:** elk nieuw state-veld reist mee via `stateJson`; velden die
   NIET moeten syncen (zoals `history`, `localPlayer`) worden gestript in `App.tsx`
   regel 50 — volg dat patroon.
5. **Niet committen:** privé-/databestanden; `dist/` niet opnieuw toevoegen. Geen
   `firebase deploy` zonder expliciete toestemming van de gebruiker.
6. **Stijl:** Nederlands voor alle UI-teksten; bestaande naamgeving volgen;
   geen nieuwe dependencies behalve waar dit plan ze noemt (`vite-plugin-pwa`).
7. **Als iets niet klopt met dit plan** (bestand verplaatst, regel verschoven):
   de beschrijving + het grep-baar codefragment is leidend, niet het regelnummer.
