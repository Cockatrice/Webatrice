---
"@cockatrice/webatrice": patch
---

Animate battlefield cards with the Card Preview's 3D flip when they are turned face-up/face-down.

The `rotateY` flip (with its mid-flip scale dip) previously lived only in the right-sidebar Card
Preview. It is now extracted into a shared `src/styles/card-flip.css` (neutral `cardflip` classes:
resting `--front`/`--back` plus one-shot `--animate-to-front`/`--animate-to-back` keyframes), imported
once via `index.css`. Both `CardPreview` and `CardSlot` consume it.

`CardSlot` now renders both faces (image front + face-down back) inside a `perspective` frame so the
flip reveals the other side. A small guard in `useCardSlot` adds the animate class only after
`card.faceDown` actually changes, so the keyframe plays on real flips (both directions) without every
slot spinning on initial board render. Honors `prefers-reduced-motion`.
