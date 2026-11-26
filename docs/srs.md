# SRS: Visual Math, Interactive Visual Math from Basics to Advanced

Nov 25, 2026 · @Fahd

## 1. Introduction

Visual Math is a web application that helps anyone understand math by seeing it. Every topic is a 3D or 2D visual that a person can drag, rotate, zoom and adjust, with a short explanation beside it. Math is organized as category, subcategory, chapter and topic, from the first steps to advanced ideas. There are no classes, teachers, students or schools: anyone can open the site and start. Version 1 is free. In version 2, three topics per device stay free for good, and more topics need a paid subscription.

### 1.1 Purpose

This SRS defines what the system must do, for whom, and under what limits. It is the input to the BMAD workflow (product brief, PRD, architecture, epics and stories; see section 10) and the reference for building, testing and accepting version 1 and version 2.

### 1.2 Problem statement

Many people meet math only as symbols on a page. Textbooks show flat drawings of 3D objects, graphs that cannot be moved, and formulas without a reason. Tools such as GeoGebra and Desmos are powerful but start blank: the person must build the scene first. Photo-solver apps give text steps with few interactive visuals. Visual Math offers ready-made visual topics across every area of math that anyone can open and explore, so the idea is seen before the rule is memorized.

### 1.3 Scope

Version 1 delivers:

- A visual engine that supports every area of math: 3D solids, 2D graphs, number and fraction models, algebra tools, trigonometry, complex plane, calculus visuals, statistics and matrices
- A math tree of 12 categories, each split into subcategories, chapters and topics (section 5), with a first wave of topics at launch and more waves after
- Search, a learning map and progress marks kept on the visitor's device
- English and Urdu, with a language system ready for more languages
- Help and contact pages
- An admin panel to upload content as JSON or MD files, preview it, and publish it
- Free use for everyone, with no account and no limit
- Feature switches for the free limit and subscriptions, built in but off

Version 2 adds:

- A permanent free allowance of 3 topics per device, with no account
- Paid subscriptions for unlimited topics, with an account for subscribers only
- Admin tools to manage subscriptions

Later: quizzes, more languages, and more topics.

Out of scope: teachers, classes, students, schools and parents as user types; native mobile apps; AI problem solving from photos; live tutoring; offline mode; content written by visitors; and languages other than English and Urdu in version 1.

### 1.4 Definitions and abbreviations

| Term | Meaning |
| --- | --- |
| SRS | Software Requirements Specification |
| BMAD | Breakthrough Method of Agile AI-driven Development, the process used to build the product |
| PRD | Product requirements document, produced from this SRS in the BMAD planning phase |
| Version 1 (v1) | The first public version, free for everyone |
| Version 2 (v2) | The version that adds the 3-topic free allowance and paid subscriptions |
| Visitor | Any person using the site; no account is needed |
| Subscriber | A visitor with a paid subscription and an account (v2) |
| Admin | The person who manages content and subscriptions |
| Category | One area of math, such as Algebra or Calculus (12 categories, section 5) |
| Subcategory | A group of related chapters inside a category |
| Chapter | A group of 2 to 3 related topics |
| Topic | One idea taught with a visual, steps and formulas; the unit a visitor opens |
| Level | Foundation, Intermediate or Advanced: how hard a topic is (section 5.3) |
| Learning map | The graph of categories, chapters, topics and prerequisites |
| Scene | The interactive visual of a topic |
| Scene type | A kind of scene, such as 3D solid, 2D graph, fraction bar or Argand diagram |
| Parameter | A value the visitor can change, such as radius or angle |
| Content package | A JSON or MD file that describes one topic (section 5.7) |
| Preview | The admin's view of a draft topic, exactly as visitors will see it |
| Publish | Make a topic visible to all visitors |
| Device | One browser on one phone or computer, recognized by a random id stored in it |
| Free topic allowance | The 3 topics each device can open without paying (v2) |
| Content wave | A batch of topics released together |
| Feature flag | A switch that turns a feature on or off without a new release |
| RTL | Right-to-left text layout, needed for Urdu |
| WebGL | Browser technology that draws 3D graphics |

### 1.5 References

- IEEE Std 830-1998 and ISO/IEC/IEEE 29148 (structure of this document)
- [BMad Method documentation](https://docs.bmad-method.org/reference/workflow-map/) (phases, artifacts and workflows)
- Three.js and KaTeX documentation
- Regulation (EU) 2016/679 (GDPR) and the data-protection laws of each target country

### 1.6 Product name and web address

| Item | Proposal | Notes |
| --- | --- | --- |
| Working name | Visual Math | Short, easy to say in English and Urdu, not tied to one topic |
| Preferred web address | To be bought later | Availability not checked |
| Alternatives | To be chosen when the domain is bought | Availability not checked |
| Names rejected | MathOrbit, Mathoria, MathVerse, Ganit, Numera | A web search found each already used by another math app or game |
| Still to do | Check the domain, trademark and social handles | "Visual Math" is a generic name, hard to trademark and to find in search. Check the domain and trademark before buying |

## 2. Overall description

### 2.1 Product perspective

Visual Math is a standalone web product with no dependency on other systems. It has two parts that share one codebase and one database: the public site that visitors use, and the admin panel that only the admin uses. Version 1 is hosted in the EU behind a global content network with edge points in Asia and Europe (assumption; see 11.2).

### 2.2 Product vision and how a visit works

A beginner drags fraction bars to see that 2/4 and 1/2 cover the same length. A curious adult drags a point around the unit circle, watches sine and cosine trace a wave, and sees that multiplying a complex number by i is a quarter turn. In both cases the person sees why before memorizing the rule.

&#91;embedded content: visitor path · version 1 and 2\]

In version 1 nothing is locked. In version 2 each device gets 3 free topics for good; the fourth topic asks the visitor to subscribe. Browsing the tree, searching and reading topic summaries always stay open.

### 2.3 User classes

| User class | Description | Main goals | Technical skill |
| --- | --- | --- | --- |
| Visitor | Anyone on the site, with no account | Understand a math idea by exploring a visual | Low; often a mid-range phone |
| Subscriber (v2) | A visitor who pays, with an account | Unlimited topics on any device; saved progress | Low |
| Admin | The product owner or a trusted editor | Upload and publish content; manage subscriptions | Medium |

There are no teacher, student, parent or school roles.

### 2.4 Operating environment

- Modern browsers: Chrome, Edge, Firefox and Safari, latest two versions
- Devices: phones (360 px wide and up), tablets and laptops; older or shared computers need a lighter 2D mode
- Server: cloud hosting with a managed database and file storage, plus a content delivery network with edge points in Asia and Europe
- Network: must work on slow mobile connections (section 8)

### 2.5 Design and implementation constraints

- 3D scenes use WebGL (Three.js); 2D graphs and models use Canvas or SVG so they also run on older devices
- Every scene type uses one shared scene format, so a topic is data, not code; this is what makes uploading JSON or MD files possible
- Math notation is shown with KaTeX; Urdu needs right-to-left layout and a Nastaliq-style font, which is heavy and must be loaded carefully
- Visitors may include children, so the product stores almost no personal data (section 8.2)
- A small team builds with the BMAD method and AI coding agents, so coding standards, automated tests and human review are required to keep quality
- Full coverage is about 600 topics, so content tools matter as much as the viewer

### 2.6 Assumptions and dependencies

- The owner pays hosting and network costs while the product is free
- Visitors have a phone or computer and a data connection
- An email delivery service is available
- Someone with math knowledge checks every topic for accuracy, and a fluent speaker checks every Urdu text, before publishing; this matters most because AI helps write the content
- A payment provider that supports each target country will be chosen before subscriptions are switched on; not every provider operates in every country
- A legal review of privacy rules in each target country is done before launch; this SRS is not legal advice

## 3. System architecture

The system is one web application with one database; there are no separate services to run. The browser draws every scene (3D and 2D) and runs the topic, so moving a slider needs no network call. The server delivers the math tree and topic data, checks and stores uploaded content, handles the admin panel, and in version 2 handles accounts, subscriptions and the free-topic count. Subscriptions, the free allowance and payment hooks exist from the start but are switched off by feature flags, so version 1 is free.

- **Browser:** Three.js for 3D, Canvas or SVG for 2D, KaTeX for formulas, a web framework such as Next.js for pages (to be confirmed by the architect agent)
- **Server:** content API, upload validation, admin API, and in v2 account, subscription and limit logic
- **Storage:** managed database for the tree, topics, versions and subscriptions; file storage for images; a content delivery network in front
- **Payment (v2):** a hosted checkout from an outside provider, linked to Visual Math by webhooks; Visual Math never handles card numbers
- **Content flow:** a package is uploaded, validated, saved as a draft, previewed and then published; visitors only ever see published topics
- **Suggested stack (to be confirmed by the architect agent):** TypeScript and Next.js; Postgres with file storage (for example Supabase, EU region); hosting on Vercel or Cloudflare with a global CDN; Noto Nastaliq Urdu font; email through Resend or Postmark; privacy-friendly analytics such as Plausible; error monitoring such as Sentry; for v2 payments, a merchant-of-record provider such as Paddle or Lemon Squeezy (verify support for the owner's country first)

## 4. Functional requirements

Each requirement has an ID (FR-x.y, where x is the subsection number), a priority and is written to be testable. Priority M = must have in v1, S = should have in v1 if time allows, V2 = version 2, L = later. "The system" means the Visual Math web application.

### 4.1 Browsing and search

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1.1 | The system shall show a home page that explains Visual Math in a few lines, with a search box, the 12 categories, featured topics and a Start button; no login is asked for anywhere. | M |
| FR-1.2 | The system shall show the math tree as category, subcategory, chapter and topic, each level with its name and the number of topics inside. | M |
| FR-1.3 | The system shall list the topics of a chapter as cards with title, short summary, level and a mark if the visitor has viewed it. | M |
| FR-1.4 | The system shall let visitors search topics by name, summary and tags in the current language, show results with their category path, and answer in under 1 second. | M |
| FR-1.5 | The system shall let visitors filter search results and lists by category and level. | S |
| FR-1.6 | The system shall open any published topic from a direct link, with no login, in the visitor's chosen language. | M |
| FR-1.7 | The system shall show a learning map per category: a graph of chapters and topics with prerequisites, so a visitor can see what comes before and after a topic, with viewed topics marked. | S |
| FR-1.8 | The system shall show on each topic page what to learn before it and what to learn next. | M |
| FR-1.9 | The system shall never show unpublished topics in lists, search or direct links. | M |
| FR-1.10 | The system shall show a friendly page when a link or search finds nothing. | M |
| FR-1.11 | The system shall provide a Share button that copies the topic link. | S |

### 4.2 Topic page

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-2.1 | The system shall show on the topic page the scene, its controls, the step-by-step explanation, the formulas and a worked example, laid out as in section 7.2. | M |
| FR-2.2 | The system shall provide Previous and Next buttons that move through the topics of the chapter. | M |
| FR-2.3 | The system shall show the path (category, subcategory, chapter, topic) at the top as links. | M |
| FR-2.4 | The system shall provide a Report a problem button that sends the topic id and a short note to the admin, with no login. | M |
| FR-2.5 | The system shall provide a button that resets all sliders and the camera to the topic's starting values. | S |
| FR-2.6 | The system shall show a short explanation when a visitor taps a marked math term. | S |
| FR-2.7 | The system shall keep the visitor's place when the language is switched on a topic page. | M |
| FR-2.8 | The system shall show a short first-time hint over the scene (drag to rotate, pinch to zoom) that can be dismissed and not shown again. | M |

### 4.3 Interactive visual engine

This is the core of the product: one engine with many scene types, so every category from counting to calculus can be shown visually. FR-3.1 to FR-3.16 describe the 3D solid scene, which also sets the common controls; FR-3.17 onward add the other scene types.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-3.1 | The system shall draw the topic's 3D objects in the browser and let the visitor rotate them by dragging with mouse or one finger. | M |
| FR-3.2 | The system shall let the visitor zoom with the mouse wheel or a two-finger pinch. | M |
| FR-3.3 | The system shall let the visitor pan the view with right-drag or a two-finger drag. | S |
| FR-3.4 | The system shall provide a Reset view button that returns the camera to the topic's starting position. | M |
| FR-3.5 | The system shall show labelled dimensions on the object (such as r, h, l, a, b, c) with lines or arrows attached to the correct edges. | M |
| FR-3.6 | The system shall provide sliders for each parameter the topic defines, with minimum, maximum, step and unit, and redraw the object smoothly as the slider moves. | M |
| FR-3.7 | The system shall also allow typing an exact value next to each slider and reject values outside the allowed range with a short message. | M |
| FR-3.8 | The system shall show the topic's formulas with the current numbers substituted and the result updating live (for example V = (1/3) × π × r² × h = 94.2 cm³). | M |
| FR-3.9 | The system shall offer view toggles where relevant: solid, wireframe, transparent, show or hide labels, show or hide axes. | S |
| FR-3.10 | The system shall support a cross-section tool in topics that define one: a movable cutting plane and a side panel showing the flat shape produced (circle, triangle, rectangle and so on) with its measurements. | M |
| FR-3.11 | The system shall support an unfold animation in topics that define one, showing the net of the solid (for surface area) and playing it forward and backward. | S |
| FR-3.12 | The system shall support a fill animation in topics that define one, such as pouring a cone into a cylinder to show the one-third relationship. | S |
| FR-3.13 | The system shall keep the view responsive: at least 30 frames per second on a mid-range phone for scenes within the topic size limits (see 8.1). | M |
| FR-3.14 | The system shall show a plain message and a static 2D image if the device cannot run WebGL. | M |
| FR-3.15 | The system shall support full-screen mode for a larger view or for projecting. | S |
| FR-3.16 | The system shall allow the visitor to take a snapshot image of the current view and download it. | L |
| FR-3.17 | The system shall draw 2D graphs of functions, equations and inequalities with draggable points and parameter sliders, trace and zoom, and mark intercepts, turning points and asymptotes. | M |
| FR-3.18 | The system shall support 2D geometry scenes: points, lines, circles and polygons that can be dragged, with live measures of length and angle, and the transformations reflect, rotate, translate and scale. | M |
| FR-3.19 | The system shall provide number and fraction models for Foundation topics: number line, place-value blocks, ten-frames, fraction bars and circles, and area models, all with drag and drop. | M |
| FR-3.20 | The system shall provide algebra tools: balance scales for equations, algebra tiles for expanding and factoring, function machines, and a step-by-step equation solver that shows each move. | M |
| FR-3.21 | The system shall provide a trigonometry scene: a unit circle with a draggable angle that shows sine, cosine and tangent and the wave they trace, and a right triangle with changeable sides. | M |
| FR-3.22 | The system shall provide 3D axes with vectors (add, scale, dot product, cross product), lines and planes that can be rotated and edited. | M |
| FR-3.23 | The system shall draw 3D surfaces z = f(x, y) with rotation and parameter sliders. | S |
| FR-3.24 | The system shall provide a complex-number scene: an Argand diagram with draggable numbers that shows addition, multiplication as rotation and scaling, polar form, powers and roots of unity. | M |
| FR-3.25 | The system shall provide calculus scenes: a limit shown by zooming in, a tangent line linked to the derivative graph, Riemann sums with an adjustable number of rectangles, area under a curve, and solids of revolution in 3D. | M |
| FR-3.26 | The system shall provide statistics and probability scenes: dot plots, histograms, box plots, scatter plots with a fitted line, dice, coin and spinner simulations with many trials, and a normal distribution with adjustable mean and standard deviation. | M |
| FR-3.27 | The system shall show a 2 by 2 or 3 by 3 matrix applied to a grid or a 3D shape to show the transformation, with the determinant shown as area or volume. | S |
| FR-3.28 | The system shall show all formulas in proper math notation (KaTeX), including on Urdu pages, with formulas kept left-to-right inside right-to-left text. | M |
| FR-3.29 | Every scene shall have a short text description and keyboard controls, so a visitor who cannot use a mouse or see the screen can follow the idea (see 8.3). | S |
| FR-3.30 | All scene types shall use one scene format (parameters, formulas, steps, labels), so a new scene type can be added without changing the topic page and so a topic can be defined entirely by an uploaded package. | M |

### 4.4 Topic content and guided steps

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-4.1 | Each topic shall contain: title, level, chapter, summary, learning goal, a scene, steps, formulas, a worked example, prerequisites and tags, in English and Urdu. | M |
| FR-4.2 | Each topic shall have 3 to 6 steps; a step can change parameters, move the camera or highlight part of the scene. | M |
| FR-4.3 | The system shall let the visitor move through steps with Next and Back and also explore freely at any time. | M |
| FR-4.4 | The system shall show a worked example with real numbers that the visitor can change. | M |
| FR-4.5 | The system shall support a short Watch out note for a common mistake. | S |
| FR-4.6 | Topic text shall use short sentences and plain words, suitable for a general reader. | M |
| FR-4.7 | Each topic shall end with 2 to 3 Try this prompts that suggest things to explore in the scene; this gives a hands-on finish while quizzes are not yet built. | S |

### 4.5 Progress on the device

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-5.1 | The system shall mark a topic as viewed when the visitor interacts with its scene or reaches its last step. | M |
| FR-5.2 | In v1 the system shall store viewed marks on the visitor's device only, with no account and nothing sent to the server. | M |
| FR-5.3 | The system shall provide a My progress page showing viewed topics per category and a Continue button for the last topic opened. | M |
| FR-5.4 | The system shall let the visitor clear their progress. | M |
| FR-5.5 | In v2 the system shall save a subscriber's progress to their account so it follows them across devices, and merge the device's marks when they sign in. | V2 |

### 4.6 Languages

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-6.1 | The system shall offer the interface and all topics in English and Urdu, switchable at any time, with the choice remembered. | M |
| FR-6.2 | Urdu pages shall use right-to-left layout and a Nastaliq-style font, with formulas kept left-to-right. | M |
| FR-6.3 | The system shall pick the first language from the browser setting, and use English if it is not supported. | M |
| FR-6.4 | A topic shall not be published unless it has both English and Urdu text. | M |
| FR-6.5 | All interface text shall live in language files, never in code. | M |
| FR-6.6 | The language shall appear in the page address, so links keep their language. | S |
| FR-6.7 | The system shall let a new language be added by adding a language file and translated content, with no code change. | L |

### 4.7 Free topic allowance (version 2)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-7.1 | The free allowance shall sit behind a feature flag that is off in v1, so every topic is free in v1. | M |
| FR-7.2 | When the flag is on, the system shall let each device open 3 different topics for free, with no account, permanently: the allowance does not reset. | V2 |
| FR-7.3 | Opening the same free topic again shall not use another free topic. | V2 |
| FR-7.4 | The system shall recognize a device by a random id stored in the browser, containing no personal data. | V2 |
| FR-7.5 | The system shall keep the count of free topics per device id on the server, so it is checked on the server and not only in the browser. | V2 |
| FR-7.6 | When a visitor asks for a fourth topic, the system shall keep the visual locked and show a message with a Subscribe button; browsing, search and the title and summary of every topic stay open. | V2 |
| FR-7.7 | The system shall show how many free topics are left (for example 1 of 3 left). | V2 |
| FR-7.8 | A direct link to a topic shall use one free topic if the device has not opened it yet. | V2 |
| FR-7.9 | A signed-in subscriber shall have no limit on any device. | V2 |
| FR-7.10 | The admin shall be able to change the number of free topics without a code change. | V2 |
| FR-7.11 | The system shall let search engines read each topic's title and summary but not unlock the scene. | V2 |

### 4.8 Accounts and subscriptions (version 2)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-8.1 | The system shall ask for an account only when a visitor chooses to subscribe; sign-up uses email and password, with email verification. | V2 |
| FR-8.2 | The system shall provide login, logout and password reset by email. | V2 |
| FR-8.3 | The system shall show a Plans page with each plan's name, price, period (for example monthly and yearly) and what it includes. | V2 |
| FR-8.4 | The system shall take payment through the provider's hosted checkout; Visual Math shall never see or store card numbers. | V2 |
| FR-8.5 | The system shall activate a subscription as soon as the provider confirms payment, using the provider's webhook, and shall unlock all topics. | V2 |
| FR-8.6 | The system shall provide an Account page showing subscription status, renewal date, a Cancel button and receipts. | V2 |
| FR-8.7 | When a subscriber cancels, the system shall keep access until the end of the paid period. | V2 |
| FR-8.8 | When a payment fails, the system shall email the subscriber, allow a grace period, and then end access. | V2 |
| FR-8.9 | The system shall let a subscriber delete their account and data. | V2 |
| FR-8.10 | The system shall show prices and taxes correctly for the visitor's country, as the payment provider supports. | V2 |
| FR-8.11 | In v1 the Plans page shall say that Visual Math is free for now and may offer a waiting-list form with consent. | S |
| FR-8.12 | The system shall offer a login with a Google account as an alternative to a password. | L |

### 4.9 Admin: content

&#91;embedded content: admin tools · content and subscriptions\]

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-9.1 | The system shall let the admin sign in with email and password, and only admins shall see the panel; a second step (a code from an authenticator app) should be required. | M |
| FR-9.2 | The system shall let the admin upload a content package in JSON or MD format for one topic (section 5.7), and shall accept several files at once. | M |
| FR-9.3 | The system shall check every upload and list each problem with file, field and message, such as an unknown chapter, a missing Urdu text, a scene parameter out of range or a broken formula; an invalid package shall not be saved. | M |
| FR-9.4 | After a valid upload the system shall save the topic as a draft and let the admin open a Preview that looks exactly like the live topic page, in either language. | M |
| FR-9.5 | The Preview shall be visible only to the admin, never to visitors or search engines. | M |
| FR-9.6 | The Preview should also show the phone and laptop layouts. | S |
| FR-9.7 | The system shall let the admin Publish a draft so that it appears in the tree, search and direct links within a minute, and Unpublish it to hide it. | M |
| FR-9.8 | When a package for an existing topic id is uploaded, the system shall keep the published version live until the admin publishes the new one, and shall keep earlier versions. | M |
| FR-9.9 | The system shall let the admin restore an earlier version of a topic. | S |
| FR-9.10 | The system shall let the admin create, rename and reorder categories, subcategories and chapters (names in both languages), or load them from an uploaded tree file. | M |
| FR-9.11 | The system shall let the admin delete a topic only when it is unpublished, and keep it recoverable for 30 days. | M |
| FR-9.12 | The system shall list all topics with status (draft or published), last change and language completeness. | M |
| FR-9.13 | The system shall keep an audit log of who uploaded, published, unpublished or deleted what and when. | M |
| FR-9.14 | The system shall accept images referenced by a package, up to a size limit set in section 8.1. | S |
| FR-9.15 | The system shall treat every upload as data: only the fields and scene types defined in section 5.7 are accepted, and no executable code in a package is ever run. | M |
| FR-9.16 | The system shall let the admin export all content as packages, as a backup. | S |

### 4.10 Admin: subscriptions and system

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10.1 | The system shall let the admin list and search subscribers by email and status. | V2 |
| FR-10.2 | The system shall let the admin grant, extend or cancel a subscription by hand, with a note of the reason. | V2 |
| FR-10.3 | The system shall show each subscriber's plan, start date, renewal date and payment status as reported by the provider. | V2 |
| FR-10.4 | The system shall let the admin delete a subscriber's data on request. | V2 |
| FR-10.5 | The system shall let the admin switch the feature flags (free allowance, subscriptions) and set the number of free topics. | M |
| FR-10.6 | The system shall show the admin problem reports and contact messages, and let the admin mark each as handled. | M |
| FR-10.7 | The system shall show simple usage numbers without personal data: visitors per day, topics opened, most opened topics and language split. | S |

### 4.11 Quizzes (later)

Quizzes are not part of v1. The content format keeps a place for them so they can be added without redesign.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-11.1 | The content package format shall reserve an empty quiz field, ignored in v1. | M |
| FR-11.2 | A later release shall add a short quiz of 3 to 5 questions to a topic, with multiple-choice and typed numeric answers, hints and immediate feedback. | L |
| FR-11.3 | A later release shall save quiz results in the visitor's progress. | L |

### 4.12 Help, contact and pages

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-12.1 | The system shall provide a Help page explaining how to use the viewer (drag, zoom, sliders, steps) with short pictures. | M |
| FR-12.2 | The system shall provide a contact form with spam protection; messages are stored and emailed to the owner. | M |
| FR-12.3 | The system shall provide About, Privacy policy and Terms pages; v2 adds a refund and cancellation policy. | M |
| FR-12.4 | The system shall show a notice about browser storage where the law requires it, and let the visitor decline what is not essential. | M |
| FR-12.5 | The system shall provide a short FAQ page. | S |

## 5. Math catalog

Visual Math organizes math by subject. Math is split into categories; each category into subcategories; each subcategory into chapters; each chapter into topics. A visitor can start any category from the beginning and go as far as they want. The structure is designed by the owner with AI help, and this section is the starting proposal.

### 5.1 Structure

Four levels of nesting run from broad to specific. The counts are planning estimates for full coverage, not measured.

&#91;embedded content: catalog structure · 4 levels\]

- **Category:** a main area of math, such as Algebra or Calculus
- **Subcategory:** a group of related chapters, such as Integration
- **Chapter:** one theme, such as Area under a curve; usually 2 to 3 topics
- **Topic:** one idea taught with a scene, steps and formulas, about 10 to 15 minutes

Every topic also has a level: Foundation, Intermediate or Advanced (5.3).

### 5.2 Categories and subcategories

The 12 categories and their subcategories are drawn below. Calculus is highlighted because the example path in 5.1 runs through it.

&#91;embedded content: 12 categories · subcategories\]

| Category | Example chapters | Levels covered |
| --- | --- | --- |
| Arithmetic and Numbers | Place value to 1,000; Adding fractions with unlike denominators; Percent change; Prime factors | Foundation to Intermediate |
| Algebra | Solving one-step equations; Expanding brackets; Factoring quadratics; Solving two equations together | Foundation to Advanced |
| Geometry | Angles in a triangle; Area of a circle; Volume of a cone; Reflections and rotations; Circle theorems | Foundation to Advanced |
| Trigonometry | Sine, cosine and tangent in a right triangle; Radians; Graphs of sine and cosine; Double-angle identities | Intermediate to Advanced |
| Coordinate Geometry | Distance between two points; Equation of a line; Equation of a circle; Ellipse and parabola | Foundation to Advanced |
| Functions and Graphs | What is a function; Quadratic graphs; Exponential growth; Inverse functions | Foundation to Advanced |
| Vectors | Adding vectors; Vectors in 3D; Dot product; Equation of a plane | Intermediate to Advanced |
| Complex Numbers | The imaginary unit; Adding and multiplying; Polar form; Roots of unity | Intermediate to Advanced |
| Calculus | Limit of a function; Derivative of x squared; Maximum and minimum problems; Area under a curve | Intermediate to Advanced |
| Series and Discrete Maths | Number patterns; Sum of an arithmetic series; Permutations; Proof by induction | Foundation to Advanced |
| Statistics and Probability | Reading bar charts; Mean, median and mode; Probability of two events; Normal distribution | Foundation to Advanced |
| Linear Algebra | Adding and multiplying matrices; Determinant of a 2 by 2 matrix; Solving linear systems; Eigenvalues | Intermediate to Advanced |

### 5.3 Levels

| Level | Meaning |
| --- | --- |
| Foundation | Starts from zero: basic ideas shown with pictures and objects |
| Intermediate | Core methods and why they work |
| Advanced | Deeper topics, proofs and the first university-level ideas |

Levels describe difficulty, not school year. A category may start at Foundation and reach Advanced, while others such as Complex Numbers start at Intermediate. A school grade or curriculum name may be added later as an optional tag, but no part of the product depends on it.

### 5.4 Prerequisite links

Each topic links to the topics that should come first. Links run inside a category and across categories, and the learning map draws them. Prerequisites advise; they never lock a topic.

Example: the Calculus topic Riemann sums points back to Area of a rectangle (Geometry), What is a function (Functions and Graphs) and Sigma notation (Series and Discrete Maths).

### 5.5 Content waves

| Wave | When | Size (estimate) | What it adds |
| --- | --- | --- | --- |
| 1 | Version 1 (launch) | 48 topics | Four launch topics per category, chosen for strong visual impact (5.6) |
| 2 | After launch | about 150 topics | Foundation and Intermediate chapters of Arithmetic, Algebra, Geometry, Coordinate Geometry and Statistics |
| 3 | Version 2 | about 200 topics | Trigonometry, Functions, Vectors, Complex Numbers, Calculus and Linear Algebra beyond the launch topics |
| 4 | After version 2 | about 200 topics | Remaining chapters and more Advanced topics |

Full coverage is about 12 categories, 60 subcategories, 250 chapters and 600 topics; these are planning estimates, not measured. Writing, checking and translating that many topics is the largest cost of the product, larger than the software itself.

### 5.6 Wave 1 topics (version 1)

Order rule: topics go from easy to hard inside each category, and the first topics of a category need no prior knowledge. Every topic opens with a short "what you need first" box that lists its prerequisite topics with links.

Level: F = Foundation, I = Intermediate, A = Advanced.

| Category | Four launch topics |
| --- | --- |
| Arithmetic and Numbers | Place value blocks (F); Fractions as bars and on a number line (F); Percent and ratio with bar models (I); Powers and roots on a number line (I) |
| Algebra | Balance-scale equations (F); Algebra tiles: expand and factor (I); Quadratics: roots and vertex with sliders (I); Polynomial roots and graphs (A) |
| Geometry | Shapes and symmetry (F); Area by cutting and moving shapes (F); Nets, surface area and volume (I); Cone, sphere and cross-sections (I) |
| Trigonometry | Right-triangle ratios with a slider (I); Unit circle and the sine wave (I); Radians and arc length (A); Trig identities as shapes (A) |
| Coordinate Geometry | Points and distance on a grid (F); Gradient and y = mx + c (I); Circles and their equations (I); Ellipse and parabola from a cone cut (A) |
| Functions and Graphs | Function machines (F); Linear graphs from tables (F); Transformations of graphs (I); Exponential and logarithm graphs (A) |
| Vectors | Arrows as vectors in 2D (I); 3D vectors: add and scale (A); Dot product and angle (A); Lines and planes in 3D (A) |
| Complex Numbers | The imaginary unit and the number plane (I); Argand diagram: plot and add (A); Multiplication as rotation and scaling (A); Roots of unity and De Moivre (A) |
| Calculus | Rates of change as slope (I); Limits by zooming in (A); Derivative as the slope of a tangent (A); Riemann sums and the integral (A) |
| Series and Discrete Maths | Patterns and skip counting (F); Arithmetic and geometric sequences (I); Counting with permutations and combinations (I); Proof by induction (A) |
| Statistics and Probability | Pictograms and bar charts (F); Mean and median on dot plots (I); Dice and coin experiments (I); The normal distribution (A) |
| Linear Algebra | Systems of equations as lines and planes (I); Matrices as transformations of the plane (A); Determinant as area (A); Eigenvectors on a grid (A) |

### 5.7 Content package format

The admin adds a topic by uploading one file, either JSON or MD. Both describe the same fields, so the system reads them into one internal form. The architect agent will turn this table into an exact schema (a JSON Schema file) that authors can check against before uploading.

| Field | Meaning |
| --- | --- |
| id | Unique, stable id of the topic, such as calc-riemann-sums |
| path | Category, subcategory and chapter ids the topic belongs to |
| title, summary, goal | Text in English and Urdu |
| level | Foundation, Intermediate or Advanced |
| tags | Search words in both languages |
| prerequisites | List of topic ids that should come first |
| scene | Scene type, its parameters (name, label, minimum, maximum, step, unit, default), camera start and options |
| steps | 3 to 6 steps, each with text in both languages and the parameters or highlight it sets |
| formulas | Formulas in LaTeX with a label in both languages |
| example | A worked example with numbers, in both languages |
| tryThis | 2 to 3 things to explore, in both languages |
| quiz | Reserved and empty in v1 |

In an MD file the fields that are not long text sit in a front-matter block at the top, and each language has its own section for the written text. A small example of the idea:

```
---
id: calc-riemann-sums
path: calculus / integration / area-under-curve
level: advanced
scene: riemann-sums
---
## English
Title, summary, steps and formulas...
## Urdu
(the same text in Urdu)
```

The exact layout is fixed in the architecture step. Rules: ids never change once published; a package with a field or scene type the system does not know is rejected (FR-9.3, FR-9.15).

### 5.8 Rules for every topic

Every topic shall show its prerequisites at the top and shall be placed after them in the category order, so a visitor can always go from easy to hard.

- One idea per topic, about 10 to 15 minutes
- Parts: a scene, 3 to 6 steps, formulas, a worked example and Try this prompts (FR-4.1 to FR-4.7)
- Placed in one chapter, with a level and prerequisite topics
- Written in English and Urdu before publishing
- Checked for math accuracy by a qualified person before publishing, because AI helps write the content
- Formulas tested against known values by automated tests (NFR-6.2)

## 6. Data requirements

The database stores the following. Version 2 items are marked.

| Entity | Main fields |
| --- | --- |
| Category | id, name (English, Urdu), order |
| Subcategory | id, category id, name (English, Urdu), order |
| Chapter | id, subcategory id, name (English, Urdu), order |
| Topic | id, chapter id, title and summary (English, Urdu), level, status (draft or published), current version, content wave |
| TopicVersion | id, topic id, package content, created at, created by, published at |
| TopicPrerequisite | topic id, prerequisite topic id |
| ContentUpload | id, file name, result (accepted or rejected), list of problems, uploaded by, uploaded at |
| Asset | id, file, type, size, used by topic ids |
| FeatureFlag and Setting | name, value (free allowance on or off, number of free topics, subscriptions on or off) |
| ProblemReport | id, topic id, note, created at, handled |
| ContactMessage | id, email (optional), message, created at, handled |
| AdminUser | id, email, password hash, second-step secret, created at |
| AuditLog | id, admin id, action, target, time |
| Device (v2) | id (random), free topics used, first seen |
| User (v2) | id, email, password hash, language, email verified, created at |
| Plan (v2) | id, name, price, currency, period, provider plan id, active |
| Subscription (v2) | id, user id, plan id, status, start, renewal date, source (payment or granted by admin), note |
| PaymentEvent (v2) | id, subscription id, provider event id, type, time |
| ProgressRecord (v2) | user id, topic id, viewed at |

### 6.1 Key relationships

- A Category has many Subcategories; a Subcategory has many Chapters; a Chapter has many Topics
- A Topic has many TopicVersions, of which at most one is published
- Topics are linked by TopicPrerequisite into the learning map
- A User has at most one active Subscription; a Subscription belongs to a Plan

### 6.2 Data rules

- A visitor's progress in v1 lives only in the browser; the server holds no personal data about visitors
- In v2 the server stores a random device id and a free-topic count; no name, email or location
- Published topics are never edited in place; a new version is made and published
- Deleted topics stay recoverable for 30 days
- Subscriber data is deleted on request, except records the law requires (such as invoices)
- Daily database backups, kept for at least 30 days (assumption)

## 7. External interface requirements

### 7.1 User interface: screens

| # | Screen | Who | Content and main actions |
| --- | --- | --- | --- |
| 1 | Home | All | Product explanation, search, the 12 categories, featured topics, Start, language switch |
| 2 | Category and subcategory pages | All | Subcategories and chapters with topic counts |
| 3 | Chapter page | All | Topic cards with level, summary and viewed mark |
| 4 | Topic page | All | Scene, controls, live formulas, steps, worked example, Try this, previous and next, report a problem |
| 5 | Search results | All | Results with category path; filters by category and level |
| 6 | Learning map | All | One graph per category with prerequisites and viewed marks |
| 7 | My progress | All | Viewed topics per category and a Continue button |
| 8 | Help | All | How to use the viewer, short pictures |
| 9 | About, Privacy, Terms | All | Static pages |
| 10 | Contact | All | Contact form |
| 11 | Plans | All | v1: free for now and waiting list; v2: plans and Subscribe |
| 12 | Free topics used (v2) | All | Message, topics left, Subscribe button; browsing stays open |
| 13 | Sign up, log in, reset password (v2) | Visitor | Forms with clear messages |
| 14 | Account (v2) | Subscriber | Subscription status, renewal, cancel, receipts, delete account |
| 15 | Admin: dashboard | Admin | Counts, flags, recent problems |
| 16 | Admin: topics | Admin | List with status; open, preview, publish, unpublish, delete |
| 17 | Admin: upload | Admin | Choose files; list of problems; draft created |
| 18 | Admin: preview | Admin | The topic page as visitors will see it, in either language |
| 19 | Admin: math tree | Admin | Create, rename and reorder categories, subcategories and chapters |
| 20 | Admin: subscribers (v2) | Admin | Search, grant, extend, cancel |
| 21 | Admin: reports and messages | Admin | Problem reports and contact messages |
| 22 | Admin: audit log | Admin | Who changed what and when |

### 7.2 Layout of the topic page

The topic page decides whether the product feels good, so its layout is fixed here.

- **Laptop and projector:** the viewer fills the left two-thirds. The right third holds the step text, sliders and formulas.
- **Phone, portrait:** the viewer takes the top half of the screen and stays visible while the page below scrolls. Sliders sit directly under the viewer so the visitor can move a slider and see the change at once.
- **Controls:** buttons at least 44 px tall for touch; slider handles large enough for a finger.
- **Urdu:** the whole layout mirrors to right-to-left; the viewer and formulas keep their own direction.

### 7.3 Software interfaces

| Interface | Purpose | Version |
| --- | --- | --- |
| Managed database and file storage | Tree, topics, versions, subscriptions, images | 1 |
| Content delivery network | Fast delivery in Asia and Europe | 1 |
| Email delivery service | Contact messages, admin alerts; in v2 verification, receipts and reset | 1 |
| Error monitoring | Find crashes and slow scenes | 1 |
| Privacy-friendly analytics | Usage numbers without personal data | 1 |
| Payment provider (hosted checkout and webhooks) | Subscriptions and receipts, chosen per country | 2 |

### 7.4 Communication interfaces

- All traffic uses HTTPS
- The payment provider sends signed webhooks, which the system verifies before it trusts them
- The admin panel is served on the same site but only after admin login

## 8. Non-functional requirements

### 8.1 Performance

| ID | Requirement |
| --- | --- |
| NFR-1.1 | A topic page shall become usable within 3 seconds on a mid-range phone on a 4G connection. |
| NFR-1.2 | Scenes shall run at 30 frames per second or better on a mid-range phone. |
| NFR-1.3 | The 3D engine and a scene type shall load only when needed, so the first page stays small. |
| NFR-1.4 | A content package shall be at most 1 MB, and an image at most 2 MB (assumptions to confirm). |
| NFR-1.5 | Search shall answer within 1 second. |
| NFR-1.6 | The Urdu font shall load without blocking text; text shows first in a fallback font. |

### 8.2 Security and privacy

| ID | Requirement |
| --- | --- |
| NFR-2.1 | All traffic shall use HTTPS. |
| NFR-2.2 | Visitors shall never be asked for personal data in v1; nothing about them is stored on the server. |
| NFR-2.3 | In v2 the only visitor data stored is a random device id and its free-topic count; subscribers give an email and a password. |
| NFR-2.4 | Passwords shall be stored only as strong hashes. |
| NFR-2.5 | Card numbers shall never reach Visual Math; payment happens on the provider's hosted page. |
| NFR-2.6 | Admin accounts shall use a second step at login, and admin actions shall be logged. |
| NFR-2.7 | Uploaded packages shall be validated and treated as data; no uploaded code is ever executed. |
| NFR-2.8 | The system shall limit repeated requests, login attempts and contact-form posts to slow abuse. |
| NFR-2.9 | Subscribers shall be able to see, export and delete their data. |
| NFR-2.10 | A legal review of privacy and consumer rules in each target country shall be done before launch and before v2 subscriptions are switched on. |

### 8.3 Usability and accessibility

| ID | Requirement |
| --- | --- |
| NFR-3.1 | The site shall aim to meet WCAG 2.1 level AA: contrast, keyboard use, focus marks and text size. |
| NFR-3.2 | Every scene shall have a text description and keyboard controls (FR-3.29). |
| NFR-3.3 | Animations shall respect the visitor's reduced-motion setting. |
| NFR-3.4 | Interface text shall be simple; sentences in topics shall be short. |
| NFR-3.5 | A first-time visitor shall be able to open and use a topic without any explanation (tested with real people). |

### 8.4 Compatibility

| ID | Requirement |
| --- | --- |
| NFR-4.1 | The site shall work on the latest two versions of Chrome, Edge, Firefox and Safari. |
| NFR-4.2 | The site shall work on phones from 360 px wide, tablets and laptops. |
| NFR-4.3 | Without WebGL, the site shall fall back to 2D views and images (FR-3.14). |

### 8.5 Reliability and availability

| ID | Requirement |
| --- | --- |
| NFR-5.1 | The site shall aim for 99.5% availability each month (assumption). |
| NFR-5.2 | The database shall be backed up daily, with a tested restore. |
| NFR-5.3 | A failed upload shall never change published content. |
| NFR-5.4 | If the payment provider is down, visitors with an active subscription shall keep access. |

### 8.6 Maintainability and content quality

| ID | Requirement |
| --- | --- |
| NFR-6.1 | Code shall follow written standards and pass automated checks before merging. |
| NFR-6.2 | Formulas and calculations in scenes shall be tested against known values by automated tests. |
| NFR-6.3 | Every topic shall be checked for accuracy by a qualified person before publishing. |
| NFR-6.4 | Every Urdu text shall be checked by a fluent speaker before publishing. |
| NFR-6.5 | Each story built under BMAD shall have acceptance tests. |

### 8.7 Localization

| ID | Requirement |
| --- | --- |
| NFR-7.1 | All interface text shall come from language files. |
| NFR-7.2 | Numbers, dates and prices shall follow the visitor's language and country format. |
| NFR-7.3 | Layout shall support right-to-left text from the start. |
| NFR-7.4 | A new language shall need only new language files and translated content. |

## 9. Business model and pricing

Version 1 is free for everyone, with no account. In version 2, every device keeps 3 free topics for good, and the rest of the topics need a subscription bought by an individual. Subscriptions and the free allowance are built in from the start behind feature flags, so version 2 is a switch and a payment provider, not a rebuild.

### 9.1 Plans (version 2)

| Plan | Who | What it gives | Price |
| --- | --- | --- | --- |
| Free | Anyone | 3 topics per device, permanently | Free |
| Subscription | Individuals | All topics on any device, saved progress | To be decided (monthly and yearly) |

### 9.2 When to switch version 2 on

- The owner decides the date; no target is set here
- A payment provider that works in the target countries is chosen and tested
- Prices, refund and cancellation rules, and tax handling are decided with advice
- The privacy and consumer-law review (NFR-2.10) is done
- Enough topics are published that three free topics make a good sample and the rest are worth paying for

### 9.3 Notes

- Success measures for the free period: visitors per week, topics opened per visit, share of visitors who come back, and the most opened topics
- Success measures for v2: share of visitors who reach the fourth topic, and share of those who subscribe
- The free allowance counts per device, so someone who clears their browser storage may get a fresh count; this soft limit is accepted and watched
- Prices and taxes (such as VAT in Europe) need advice before payment is switched on

## 10. Release plan and BMAD workflow

Visual Math is built with the BMAD method. AI agents (analyst, product manager, architect, scrum master, developer, QA) work through four phases, and each phase produces documents the next one uses: analysis, planning (PRD), solutioning (architecture, epics and stories, then a readiness check) and implementation (story by story). This SRS is the starting input. The readiness check after solutioning and a review at the end of each epic act as gates.

| Release | Contents |
| --- | --- |
| Version 1 | Visual engine, math tree, search, learning map, device progress, English and Urdu, help pages, admin content tools, wave 1 of 48 topics; everything free |
| Version 2 | Free allowance of 3 topics per device, accounts, subscriptions and payment, admin subscription tools; more topics |
| Later | Quizzes, more languages, more topics |

No dates are set: the order matters, and durations depend on the team and on how fast topics can be written and checked.

### 10.1 Proposed epics for the BMAD planning phase

The product manager and architect agents turn this SRS into a PRD and an architecture, then the scrum master agent splits the epics below into stories. Each story needs acceptance tests (NFR-6.5).

| Epic | Name | Requirements | Depends on |
| --- | --- | --- | --- |
| E1 | Foundation: site shell, languages, hosting, admin login | FR-6.x, FR-9.1, NFR-2, NFR-7 | None |
| E2 | Scene engine core and topic page | FR-3.1 to FR-3.16, FR-3.28 to FR-3.30, FR-2.x, FR-4.x | E1 |
| E3 | Scene types for Foundation and Intermediate topics: number models, algebra tools, 2D graphs, geometry, trigonometry, statistics | FR-3.17 to FR-3.21, FR-3.26 | E2 |
| E4 | Scene types for Advanced topics: vectors, surfaces, complex numbers, calculus, matrices | FR-3.22 to FR-3.25, FR-3.27 | E2 |
| E5 | Math tree, search and learning map | FR-1.x | E2 |
| E6 | Progress on the device, help and contact pages | FR-5.1 to FR-5.4, FR-12.x | E2 |
| E7 | Admin content tools: upload, validation, preview, publish, versions | FR-9.x, FR-10.5, FR-10.6, FR-11.1 | E2 |
| E8 | Wave 1 content: 48 topics in English and Urdu | Section 5.6 | E3, E4, E7 |
| E9 | Hardening: performance, security, accessibility, privacy | NFR-1 to NFR-6 | All above |
| E10 | Version 2: free allowance, accounts, subscriptions | FR-7.x, FR-8.x, FR-5.5 | E9 |
| E11 | Version 2: admin subscription tools | FR-10.1 to FR-10.4 | E10 |
| E12 | Quizzes (later) | FR-11.2, FR-11.3 | E2 |

E8 is content work and runs alongside E5 to E7 once the scene types exist.

## 11. Risks, assumptions and open questions

### 11.1 Risks

| Risk | Effect | Response |
| --- | --- | --- |
| Scope is very large: 12 categories from basics to advanced, two languages | Launch slips | Release in waves; start with 48 topics; BMAD epics keep work in small stories |
| About 600 topics to write, check and translate | Content cost is larger than software cost | Content package format and admin tools let AI-drafted topics be uploaded fast; a checker approves each one |
| AI-written math may contain mistakes | Wrong teaching damages trust | Human accuracy check before publishing; automated formula tests |
| 3D is slow on old phones | Visitors leave | 2D fallback, size limits, performance tests on mid-range phones |
| Urdu text and right-to-left layout are hard to get right | Poor reading experience | Build right-to-left from day one; a fluent reviewer |
| The name Visual Math is generic and may be hard to trademark or to find in search | Rename after launch | Check domain and trademark before building the brand |
| Visitors may include children | Privacy rules apply | Store almost nothing; legal review before launch |
| One admin is a single point of failure | Content stops if they are away | Accepted for v1: one admin only; keep backups and the audit log |

### 11.2 Assumptions to verify

- EU hosting with edge points in Asia and Europe is acceptable and fast enough for both markets
- Package and image size limits (1 MB and 2 MB) are enough for the scenes planned
- The list of 12 categories, the level names and the topic counts are good starting estimates

### 11.3 Open questions

- [ ] Decided: v1 has one admin and no second editor. The admin checks the math accuracy and the Urdu text before publishing.
- [ ] Confirm the suggested services (section 3) in the architecture step.
- [ ] Decided: topics go from easy to hard and each starts with its prerequisites. Refine the 48 wave 1 topics with AI help during the PRD step.
- [ ] Decided: the name is Visual Math. Check the domain and trademark, then buy the address later.
