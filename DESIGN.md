# NIYA employee app design

The approved direction is a simple, calm mobile layout inspired by the supplied CareSure reference. The user approved the later sky-blue and orange colour variant on 18 October 2026. Use the existing implemented tokens as the exact colour source.

## Visual rules

- Use sky blue for primary brand surfaces and orange for a restrained action or emphasis. Keep reading surfaces light, with strong text contrast.
- Give each screen one clear title and one primary task. Use compact summaries, plain rows and spacious forms.
- Preserve consistent rounded corners, spacing, icon weight and readable type. Use one accent at a time within a component.
- Keep Home, Cover and Profile navigation predictable. Family opens from its relevant summary or profile entry.
- Use company identity as content; the layout remains NIYA's shared product design.

## Content and states

Render backend-provided content with its own loading, empty, error and retry states. Omit absent policy sections. A visible button must lead to a working action in the current release. Future-module artwork and marketing banners require an actual enabled service before they become app navigation.

Make shared family cover prominent. Keep lower parent/in-law limits adjacent to their own policy. Member tables or rows distinguish covered members from the roster list and never imply an individual sum insured for every person.

Forms use visible labels, accessible focus, inline errors near the field or action, and a usable keyboard order. Support narrow phones without horizontal page scrolling and allow text enlargement. Respect device safe areas.

The layout should feel clean on a phone and remain comfortable in a browser with a bounded content width. Decorative routes, oversized illustrations, dense icon grids and nested cards are outside the approved direction.

## Components

### E-card rows

Use plain divided rows with a small blue card icon, a named title, a muted source description and one explicit action. Website cards use Open e-card; uploaded files use Download e-card on web and Open e-card on native. Keep long titles wrapping within the bounded content width.

Home links to E-cards independently of enrolment or current cover. Keep list loading, empty and retry states, show file-open errors beside the affected row, and retain the card's action for retry. Place the explanation that a card identifies its holder while policy terms determine cover after the list.
