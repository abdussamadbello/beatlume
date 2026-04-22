# Product Requirements Document: Graph-Driven AI Fiction Planner

## Document purpose
This PRD defines a software product for fiction planning that uses graph relationships and tension timelines as the core planning model rather than treating story generation as a generic chat problem.[1][2][3] The product is designed around common novel-planning practice, where writers break stories into scenes, track character conflict, and shape rising tension toward climaxes and resolutions.[4][5][6]

## Product overview
The product is a web-based AI planning workspace for fiction writers that represents a story in two connected ways: a relationship graph and a narrative line chart.[4][7][8] The graph captures characters, scenes, subplots, and their links, while the chart captures tension, emotional intensity, stakes, and climactic rise over story time, usually measured scene by scene.[8][9][10]

The product is not primarily an "AI novel writer." It is a planning and analysis system that helps writers understand story structure, spot weak scenes, see relationship gaps, and shape narrative pacing before or during drafting.[4][5][11] This product direction aligns with common planning methods such as scene-based structuring, character studies, global story structure, and iterative rearrangement of scenes to maintain narrative logic.[4][5][11]

## Problem statement
Most fiction writers plan with fragmented tools such as notes apps, spreadsheets, corkboards, mind maps, and generic writing software, which makes it difficult to see story relationships and pacing in one coherent view.[4][5][12] Existing writing software often stores text well, but it does not make story dynamics legible enough for writers to visually inspect conflict networks, relationship density, or climactic distribution across scenes.[4][8][9]

As stories become more complex, writers struggle with continuity, uneven character presence, flat middles, disconnected subplots, and climaxes that arrive too early, too late, or without enough buildup.[4][7][9] The core product problem is therefore not only prose generation, but structural visibility: writers need a way to see who affects whom, where conflict rises or stalls, and how scenes contribute to the overall story arc.[4][8][10]

## Product vision
The product should become the operating system for story planning: a place where a writer can model a story as a living structure of scenes, characters, and tension patterns before, during, and after drafting.[4][5][8] The long-term vision is to make structural storytelling as inspectable as a data model, while preserving the creative and emotional judgment of the writer.[4][9]

## Target users
### Primary users
- Novel writers who plan stories scene by scene and want stronger control over pacing, conflict, and character arcs.[4][5][11]
- Writers of multi-POV or relationship-heavy fiction, where scene order and character interaction patterns are difficult to track manually.[4][8]
- Writers who already use outlines, scene cards, or writing software, but want more visual and analytical support.[4][12]

### Secondary users
- Short story writers who want compact structural planning and arc visualization.[13][10]
- Scriptwriters or interactive fiction designers who need interaction maps and tension curves, though the first product definition centers on prose fiction.[8][10]
- Editors, writing coaches, and developmental consultants who diagnose structure and pacing problems.[7][9]

## Product principles
- Scene is the core planning unit because structure guidance consistently treats the scene as the level where character desire, conflict, and emotional movement become concrete.[4][6]
- Chapters are grouping containers, not the primary analytical unit, because chapter length and grouping affect reading pace but do not reliably describe conflict structure.[14][15]
- Beats are useful but secondary because they are too granular for the product's primary planning layer and better suited to drill-down detail.[16][17]
- AI supports judgment rather than replacing it; the system recommends, flags, and visualizes rather than pretending to author the entire story autonomously.[4][18][19]
- Visual structure should stay interpretable, so graphs and charts must explain narrative problems in language a writer can act on.[8][9]

## Jobs to be done
- When planning a new story, the writer wants to convert a concept into scenes, relationships, and arc patterns so the whole structure becomes visible early.[5][11]
- When revising a story, the writer wants to detect low-conflict scenes, missing relationship tension, and pacing gaps so revision becomes targeted rather than intuitive guesswork.[4][9][6]
- When managing a long story, the writer wants to know whether characters disappear for too long, whether subplots connect to the main arc, and whether tension rises appropriately toward a climax.[4][8][9]

## Core concept model
The product models a story through two synchronized abstractions.

### 1. Relationship graph
The graph is a network of nodes and edges.[20][8][21] Nodes may represent characters, scenes, locations, factions, objects, or subplots depending on the selected visualization mode.[20][8] Edges describe the relationship between nodes, such as alliance, conflict, romance, dependency, mentorship, secrecy, betrayal, or recurring interaction frequency.[20][21][22]

### 2. Narrative timeline
The timeline is a line-chart system that plots story metrics over ordered story units.[7][9] In the core version, the ordered unit is the scene because scene-by-scene structure is the most actionable planning layer.[4][6] Metrics can include tension, stakes, emotional intensity, mystery load, romance intensity, danger, and character pressure.[7][9][10]

## Scope definition
The initial full product scope includes planning, visualization, analysis, AI assistance, and draft-linked story memory.[1][23][3] Draft generation may exist later as a support feature, but it is not the foundational product identity.[18][24][19]

### In scope
- Story creation and metadata setup.[5][11]
- Character, subplot, location, and scene management.[4][5]
- Relationship graph visualization and editing.[20][8][21]
- Tension and arc chart visualization.[7][9]
- AI structural analysis and recommendations.[4][9]
- Story memory for continuity and retrieval during planning or drafting.[24][19]
- Imports and exports for common writing workflows.[4]

### Out of scope for the first fully defined product vision
- Fully autonomous novel generation from a single prompt.[25][19]
- General copywriting, blogging, or marketing-writing workflows.[26][18]
- Publishing distribution, retailer upload, or formatting for print as the primary product purpose.
- Real-time multiplayer worldbuilding MMO-style environments.

## User workflow
### Story setup
The writer creates a story, defines genre, premise, theme, point-of-view design, structural preference, and optional planning method such as scene-first or high-level arc-first.[5][11] The system then scaffolds a story workspace with default views for graph, scene board, and timeline.[1][23]

### Story modeling
The writer adds characters, defines goals and conflicts, creates scenes, tags scene participants, and optionally defines high-level act breaks or major turning points.[4][5][6] As entries are added, the system generates graph edges and chart points automatically, while still allowing manual overrides.[8][9]

### Structural analysis
The writer opens the graph to understand character density and interaction patterns, then opens the line chart to inspect tension and pacing across scenes.[8][9] The AI assistant highlights likely weak areas such as isolated subplots, underused characters, repetitive scene intensity, or a climax without enough buildup.[4][9]

### Revision and iteration
The writer edits scene order, updates graph relationships, and rescoring propagates through the charts.[4][14] The system preserves revision history so the writer can compare different structural shapes and understand whether changes improve pacing.[23][3]

## Functional requirements
### Story workspace
1. The system shall allow users to create, duplicate, archive, and delete story projects.
2. The system shall store story title, logline, genre, subgenre, themes, target length, POV model, and status.
3. The system shall support manual and AI-assisted setup modes.
4. The system shall support multiple visualization tabs per story, including graph, scene board, chapter board, and timeline.

### Scene management
1. The system shall treat the scene as the primary atomic planning entity.[4][6]
2. Each scene shall support fields for order, title, summary, act, chapter, POV, location, participants, goal, conflict, outcome, emotional turn, and notes.[4][6]
3. The system shall allow drag-and-drop scene reordering because scene sequence affects structural logic and pacing.[4][14]
4. The system shall allow scenes to be grouped into chapters while preserving scene-level analytics.[14][15]
5. The system shall allow scenes to contain optional beats for future drill-down detail.[16][17]

### Character management
1. The system shall store character profiles with role, archetype, desire, fear, flaw, relationship notes, arc description, and appearance list.[5][11]
2. The system shall link characters to scenes and derive appearance frequency, gap length, and co-occurrence metrics from that linkage.[4][8]
3. The system shall allow a character-specific arc chart over scene order, showing presence and selected metrics.[8][9]

### Relationship graph
1. The system shall render a graph visualization of characters and their links.[20][8][21]
2. The system shall support multiple graph modes: character graph, scene graph, subplot graph, and mixed graph.
3. Each edge shall store relation type, intensity, polarity, interaction count, secrecy state, and last-updated scene.[20][21][22]
4. The system shall allow filtering by act, chapter range, subplot, POV, or character.[8]
5. The system shall support graph animation across story time so users can inspect how relationships change from scene to scene.[8]
6. The system shall highlight disconnected nodes, overly dominant hubs, and abrupt relationship reversals for user review.

### Timeline and charting
1. The system shall render a whole-story line chart by scene order.[7][9]
2. The system shall support metric layers including tension, emotional intensity, stakes, mystery, romance intensity, danger, and hope.
3. The system shall support per-character charts by selected metric and scene order.
4. The system shall support subplot timelines and compare multiple curves in one view.
5. The system shall mark inferred turning points, climaxes, troughs, and pacing plateaus.[4][7][9]
6. The system shall let users assign scores manually, use AI-generated suggestions, or mix both modes.

### AI assistance
1. The system shall analyze scene descriptions and suggest likely values for tension, conflict strength, and emotional movement.[9][10]
2. The system shall detect scenes that appear structurally weak, such as scenes without conflict, scenes with little consequence, or long flat sequences.[4][9][6]
3. The system shall detect character underuse, overuse, or unexplained disappearance across long scene gaps.[4]
4. The system shall suggest where a relationship needs reinforcement, escalation, reversal, or resolution based on graph patterns and timeline shape.[8][9]
5. The system shall generate structural prompts such as “increase conflict here,” “insert aftermath scene,” “bring rival back earlier,” or “shift reveal before midpoint.”[5][9]
6. The system shall explain every recommendation in plain language tied to scenes, characters, and metrics rather than returning opaque scores.[9][1]

### Draft-linked planning
1. The system shall allow draft text to be attached to scenes.
2. The system shall let users generate or revise text only within a scene context, using story memory from characters, relationships, and prior scenes.[24][19]
3. The system shall preserve the planner-first structure even when drafting features are used.
4. The system shall allow “update graph from draft” and “update timeline from draft” actions using AI extraction.

### Search, filter, and views
1. The system shall support full-text search across story objects.
2. The system shall support saved filters for POV, subplot, act, character, relation type, and unresolved conflict.
3. The system shall provide summary dashboards showing scene count, act distribution, character presence distribution, and tension distribution.

### Collaboration
1. The system shall support comments on scenes, characters, and chart points.
2. The system shall support role-based access for owner, editor, and viewer.
3. The system shall preserve audit history for structural changes.

### Import and export
1. The system shall import structured text from common writing workflows, including scenes pasted from Scrivener-style or outline-style formats.[4]
2. The system shall export stories and planning artifacts as markdown, PDF-friendly outlines, CSV, and image snapshots of graph and chart views.
3. The system shall support AI-assisted extraction from plain manuscript text into scene summaries and relationships.

## Data model requirements

## Story metadata
Story-level fields describe the project as a whole — the defaults that rarely change once the writer has committed to them. They live on the Story record itself and are edited in story setup, not in a dedicated "core" page.[27][28][32]

| Level | Field examples | Notes |
|---|---|---|
| Story | title, logline, genre, subgenre, tone, narrative mode, default POV, tense, target length, draft number | Edited during story creation; surfaced in the Overview header |
| Story | world rules, magic rules, technology rules, chronology model | Continuity reference; future "story bible" extension |
| Story | master character records, master locations, factions, glossary | Reusable entities referenced throughout the story [27][33][34] — see Characters page and future Locations/Glossary views |

## Chapter planning
Chapter-level fields capture what a run of scenes is *for* — the local narrative movement (setup, escalation, fallout, reveal). Surfaced on the Manuscript page as a Chapter Plan rail that updates with the active chapter while reading.[33][35][30]

| Level | Field examples | Notes |
|---|---|---|
| Chapter | chapter purpose, structural phase | What this chapter accomplishes; Setup / Escalation / Fallout / Reveal / Resolution [35][36] |
| Chapter | dominant POV, time window | When scenes share a viewpoint or situational frame [33][30] |
| Chapter | target tension band | Helps interpret scene-level fluctuations within the chapter [35][30] |

## Scene dramatic engine
Scene-level fields are the core analytical layer because scenes are where goals, conflict, change, and interaction become concrete. Surfaced on Scene Detail as a "Dramatic structure" section.[30][29][6]

| Level | Field examples | Notes |
|---|---|---|
| Scene | POV, location, time of day, duration, participating characters | The concrete dramatic unit being analyzed [30][29] |
| Scene | goal, conflict, obstacle, outcome, emotional turn | Core structural ingredients of scene planning [6][30] — editable in Scene Detail |
| Scene | tension, stakes, mystery, romance, danger, mood | Powers chart analytics and pacing diagnosis [9][30] |
| Scene | scene tags, subplot link, reveal flag, aftermath flag | Helps analysis, filtering, and revision [30][29] |

## Beats
Beats are optional micro-units inside a scene — not a primary planning layer. Surfaced in the Beats section of Scene Detail when authors want finer-grained dramatic control.[16][37]

| Level | Field examples | Notes |
|---|---|---|
| Beat | action, reaction, reveal, decision, interruption | Micro-turns inside a scene [16][37] |
| Beat | emotional spike, power shift, dialogue turn | Fine pacing control [16][37] |
| Beat | beat-level intensity or emphasis score | Supports future granular visualization [16] |

### Core entities
| Entity | Required fields | Notes |
|---|---|---|
| Story | id, title, logline, genre, theme, target_length, status | Root container for all planning data |
| Chapter | id, story_id, order, title, summary | Container for grouped scenes; not the primary analysis unit [14][15] |
| Scene | id, story_id, chapter_id, order, title, pov, summary, goal, conflict, outcome, location_id | Primary analysis unit [4][6] |
| Beat | id, scene_id, order, type, summary | Optional fine-grained subunit [16][17] |
| Character | id, story_id, name, role, goal, flaw, arc_summary | Supports arc and presence analytics [5][11] |
| RelationshipEdge | id, story_id, source_node_id, target_node_id, relation_type, polarity, intensity | Powers graph visualization [20][21] |
| SceneParticipant | id, scene_id, character_id, role_in_scene, interaction_weight | Supports co-occurrence and presence metrics [8] |
| MetricPoint | id, story_id, scene_id, metric_type, score, source, confidence | Powers line charts [7][9] |
| Subplot | id, story_id, title, purpose, status | Optional secondary planning entity |
| Location | id, story_id, name, type, notes | Supports setting continuity |

### Derived analytics
The system shall compute the following derived metrics from source data:
- Character appearance frequency and longest absence gap.
- Scene conflict density.
- Relationship volatility across story time.
- Tension slope, local peaks, troughs, and plateau spans.[7][9]
- POV distribution by act and by chapter.[4]
- Subplot connectivity to main plot via scene overlap and shared character edges.[8]

## Scoring model requirements
The timeline system depends on a disciplined scoring model so that charts become useful rather than decorative.[9] Each scene should support at least one required score and several optional scores.

### Required base score
- Narrative tension: a 1–10 score describing how much unresolved pressure, urgency, or conflict is present in the scene.[4][7][9]

### Optional scores
- Emotional intensity
- Stakes level
- Mystery load
- Romance intensity
- Danger level
- Character pressure by selected character
- Hope level or relief level

### Score source modes
- Manual score by writer
- AI-estimated score from scene summary or draft text
- Hybrid score where AI proposes and writer confirms

### Score interpretation rules
- Low score is not automatically bad; troughs are necessary if they function as recovery, setup, reflection, or aftermath.[7][10]
- A healthy chart typically shows variation rather than constant escalation.[7][9]
- The system should distinguish global climax from local scene peaks.[7][10]

## AI requirement details
### Recommendation engine
The AI system shall produce recommendations in categories such as pacing, relationship structure, character distribution, scene effectiveness, subplot integration, and climax placement.[4][9] Every recommendation shall cite the data basis internally, including which scenes, edges, or chart segments triggered the suggestion.

### Explainability
The AI system shall never return unexplained judgments such as “this is weak.” Instead, it shall say things like: “Scenes 9–13 remain between tension 3 and 4 and repeat similar argument patterns between the same two characters, which may flatten the middle.”[9] Explanations must connect chart patterns with scene content.

### Prompt design requirements
Prompting should separate tasks into planning, extraction, analysis, and drafting. Planning prompts should ask for structure and conflict. Extraction prompts should convert text into entities and metrics. Analysis prompts should reason over chart and graph patterns. Drafting prompts, if used, should remain scene-bound and retrieve relevant story memory.[18][24][19]

## UX requirements
### Main navigation
The main workspace shall include at least these primary tabs:
- Overview
- Scene Board
- Graph View
- Timeline View
- Characters
- AI Insights
- Draft
- Manuscript

### Interaction patterns
- Clicking a chart point shall open the related scene.
- Clicking a graph node shall filter scenes and chart segments involving that node.
- Scrubbing the timeline shall update the graph to the selected story point.[8]
- Reordering scenes shall update chart sequencing and time-sensitive graph states.
- Hover or selection states shall reveal why a point or edge looks the way it does.

### Accessibility and interpretability
The product shall not rely on color alone to convey meaning. Graph edges shall support label, thickness, and pattern distinctions. Chart peaks and troughs shall include tooltips and textual summaries. Keyboard navigation and screen-reader labels shall be supported across interactive views.[23][38]

## Non-functional requirements
### Performance
- Graph rendering shall remain responsive for at least 500 nodes and 2,000 edges in standard story projects.
- Timeline interactions shall feel immediate for at least 2,000 scene-level metric points.
- Scene reordering shall update dependent analytics within a practical interactive threshold.

### Reliability
- All structural edits shall be autosaved.
- Version history shall allow rollback to prior planning states.
- The system shall preserve referential integrity between scenes, characters, edges, and metric points.

### Security and privacy
- Story content shall be private by default.
- AI processing boundaries shall be transparent to users.
- Users shall be able to opt out of model training or external reuse where applicable.

### Extensibility
- The data model shall support future beat-level analytics without reworking scene-level architecture.[16][17]
- The product shall support additional visual layers such as heatmaps, act overlays, and subplot networks in future releases.

## Success metrics
### User outcome metrics
- Time to first complete story plan.
- Percentage of stories with scene-level completion above a defined threshold.
- Frequency of chart and graph usage during planning sessions.
- Percentage of AI recommendations accepted, edited, or rejected.
- Retention of users creating more than one story project.

### Product health metrics
- Median scenes created per active story.
- Number of relationship edges per active story.
- Number of timeline adjustments per revision session.
- Export frequency of graph snapshots and outlines.

### Quality metrics
- Precision of AI-detected flat sections versus user feedback.
- Agreement rate between AI-proposed scene tension scores and writer-confirmed values.
- Reduction in continuity issues reported during revision.

## Risks and mitigations
| Risk | Why it matters | Mitigation |
|---|---|---|
| Product becomes too academic | Writers may reject over-quantified planning tools [4] | Keep all metrics editable, optional, and explained in natural language |
| Charts become decorative rather than useful | Visuals can create noise without clear scoring rules [9] | Use a strict scene scoring model and clear recommendation logic |
| Graph becomes unreadable in large stories | Dense stories can create visual clutter [8] | Add filters, clustering, time slicing, and mode switching |
| AI advice feels generic | Writers need scene-specific help, not clichés [18][19] | Tie every recommendation to specific scenes, nodes, and metrics |
| Writers still expect drafting first | Market expectations are shaped by AI writing tools [25][24] | Position clearly as a planning-first tool with optional drafting support |

## Competitive position
The main market contrast is between generic AI writers and a planning-native fiction system. Existing tools for fiction writing often emphasize prose help, brainstorming, or broad writing assistance, while this product differentiates through structural visualization, graph-linked relationships, and chart-based pacing analysis.[25][39][24][19] The closest strategic moat is not larger text generation alone, but the combination of scene-first modeling, explainable analysis, and visual story intelligence.[4][8][9]

## Release strategy
The full product should be built in layers even if the long-term PRD is broader. The dependency order should be: canonical story data model, scene system, graph engine, timeline engine, AI extraction and analysis, draft-linked planning, then collaboration and advanced exports.[1][23][3] This sequencing reflects PRD best practice by defining functionality, user flow, and technical requirements before implementation details.[2][23][38]

## Open questions
- Should relationship edges be manually authored first, AI-inferred first, or hybrid by default?
- Should chart scoring default to one metric only at story creation, or to a preset bundle by genre?
- How much of the graph should support non-character nodes in the first general release?
- Should the product center on prose fiction only, or include a script mode later?
- Should act structure be optional, suggested, or required in setup?

## Final product definition
The product is a fiction-planning platform centered on scene-based structure, relationship graphs, and tension timelines.[4][8][9] Its core promise is that writers will be able to see and improve the hidden structure of a story—who is connected, where conflict is active, how tension moves, and whether climaxes are earned—before structural problems become expensive to fix in draft form.[4][7][10]