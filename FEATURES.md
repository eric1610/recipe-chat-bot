# Recipe Chat Bot Feature Checklist

This document tracks the product capabilities already in place, the focused minimum viable
product (MVP), and possible enhancements beyond the MVP.

## Status legend

- `[x]` Complete and present in the application
- `[ ]` Planned or not yet complete
- **Foundation only** means supporting UI or data storage exists, but the end-user feature is not
  complete yet
- **TBD** means the idea is not committed scope and still needs prioritization

## Current foundation

### Application and experience

- [x] SvelteKit 2 and Svelte 5 application written in TypeScript 7
- [x] pnpm package management with a committed lockfile
- [x] Skeleton 5 and Tailwind CSS 4 design system
- [x] Responsive landing page and dedicated `/chat` workspace
- [x] Responsive desktop sidebar and mobile conversation-history drawer
- [x] Adaptive light and dark themes with a user-controlled theme switch
- [x] Accessible labels, focusable controls, and semantic page structure
- [x] Example prompts that can populate the chat composer

### Accounts and user context

- [x] Google and GitHub sign-in through Auth.js
- [x] Database-backed user sessions
- [x] Account-scoped access to conversations, messages, and preferences
- [x] Cooking context for diets, allergies, disliked ingredients, preferred cuisines, cooking skill,
  household size, and free-form notes
- [x] Complete account deletion for application-owned accounts, sessions, preferences,
  conversations, and messages
- [ ] Connect saved cooking context to AI responses — **Foundation only**

### Conversations and storage

- [x] Create, select, continue, and delete conversations
- [x] Store signed-in conversation messages in Neon Postgres
- [x] Store guest conversations in browser `sessionStorage`
- [x] Keep guest data limited to the current browser tab/session
- [x] Clearly warn guests that their data will be lost when the session ends
- [x] Offer signed-in users an explicit import of guest history
- [x] Clear local guest history only after a successful import
- [x] Generate, stream, display, and persist assistant responses for signed-in users
- [x] Complete the signed-in user-message-to-AI-response chat lifecycle
- [x] Keep signed-in AI usage separate from guest, browser-only conversation history

### Platform and delivery

- [x] Drizzle ORM schema and committed database migration
- [x] Neon Postgres production database
- [x] Vercel production deployment
- [x] Sensitive production environment variables managed outside the repository
- [x] OpenRouter API credentials configured as encrypted, production-only Vercel secrets
- [x] Production-only Vercel secrets and least-privileged Neon runtime credentials
- [x] Hashed database session tokens without retained OAuth provider tokens
- [x] Same-origin JSON request enforcement, payload limits, per-user rate limits, and storage quotas
- [x] Security headers and Content Security Policy
- [x] GitHub Actions secret scanning, checks, tests, and dependency auditing
- [x] Automated dependency updates with pinned GitHub Action revisions
- [x] Automated tests for guest storage, request guards, session hashing, redirects, import
  validation, AI quotas, context limits, and provider-error sanitization
- [x] Production database migration, deployment, and signed-out API security boundaries validated

## Focused MVP

The MVP is a safe, reliable, preference-aware recipe assistant. Signed-in AI conversation is now
live; the primary remaining milestones are preference-aware responses, structured recipe quality,
anonymous AI access, broader end-to-end testing, and production observability.

### AI recipe conversation

- [x] Connect OpenRouter through a server-only API integration
- [x] Route requests through `openrouter/free` with provider data collection disabled
- [x] Stream assistant responses into the chat workspace
- [x] Save completed assistant messages to the correct signed-in conversation
- [x] Include bounded recent, server-owned conversation history in each model request
- [ ] Apply saved diets, allergies, dislikes, cuisines, cooking skill, household size, and notes to
  signed-in conversations
- [ ] Keep anonymous chat functional without requiring an account
- [x] Prevent model credentials, system instructions, and other server secrets from reaching the
  browser
- [x] Provide clear sending, streaming, completed, cancelled, and failed states
- [x] Allow users to stop an in-progress generation
- [ ] Allow users to retry or regenerate a failed response
- [x] Recover without leaking provider details from network failures, model timeouts, malformed
  responses, and rate limits
- [x] Show exact personal daily usage and qualitative shared-capacity warnings

### Next implementation slice — successful-response accounting

- [x] Count a request against the user's daily allowance only after the assistant response finishes
  successfully and is persisted
- [x] Do not consume the user's completed-response allowance for provider failures, timeouts,
  cancellations, empty responses, or assistant-persistence failures
- [x] Keep a separate pre-request reservation count for the shared OpenRouter ceiling so concurrent
  requests cannot exceed the provider's hard daily limit
- [x] Make completion accounting idempotent so retries, duplicate callbacks, and concurrent updates
  cannot charge a successful response more than once
- [ ] Add an authenticated, idempotent daily cron job that removes expired quota-counter windows
  without deleting conversations, messages, preferences, or current-day reservations
- [ ] Define a limited retention period for AI-attempt and token metadata, then have the cleanup job
  prune records older than that period
- [ ] Test successful completion, every failure state, concurrent reservations, UTC-day rollover,
  repeated cleanup runs, and cleanup safety boundaries

### Recipe quality and usefulness

- [ ] Return recipes with a clear title, servings, estimated time, ingredients, quantities, and
  ordered steps
- [ ] Support ingredient substitutions and cooking-method alternatives
- [ ] Scale recipes for the requested household or serving count
- [ ] Ask a concise follow-up question when essential cooking context is missing
- [ ] Keep guidance practical for the user's selected cooking skill
- [ ] Add food-safety guidance where relevant
- [ ] Treat allergy preferences as important context while clearly stating that generated guidance
  does not replace professional medical advice
- [ ] Avoid claiming that uncertain ingredient, nutrition, or safety information is verified

### Conversation experience

- [ ] Generate useful conversation titles from the opening request
- [ ] Allow users to rename conversations
- [ ] Preserve message ordering and prevent duplicate messages during retries
- [ ] Automatically keep the latest streaming content visible without trapping manual scrolling
- [x] Submit with Enter, add a new line with Shift+Enter, and keep an accessible send button
- [ ] Confirm the complete chat flow works on mobile, tablet, and desktop layouts
- [ ] Confirm the complete chat flow works with keyboard navigation and screen readers

### Security, reliability, and operations

- [x] Validate and limit message size, conversation context, and accepted request payloads
- [x] Add per-user rate limiting, storage quotas, and abuse protection for authenticated persistence
- [x] Enforce the current 10-successful-response per-user UTC-day AI cap with a server-configured
  exempt account
- [x] Enforce a shared 50-request UTC-day cap and latch provider exhaustion after upstream `429`
- [x] Enforce ownership checks for every conversation and message operation
- [ ] Add tests for anonymous chat, authenticated persistence, authorization boundaries, imports,
  streaming, cancellation, retries, and AI failures
- [ ] Add structured production logging without recording secrets or unnecessary conversation data
- [ ] Add error monitoring and health visibility for the application, database, and AI provider
- [x] Track per-user/shared request attempts and token consumption without duplicating message text
- [x] Keep exact shared usage counts server-side while exposing only qualitative capacity states
- [ ] Track end-to-end model latency and paid-model cost
- [x] Document AI data retention, provider routing, limits, and account deletion behavior

## Enhanced roadmap — TBD

The following ideas are placeholders for future prioritization. They are not committed scope for
the MVP.

### Kitchen toolkit

- [ ] **TBD:** Pantry and ingredient inventory
- [ ] **TBD:** Ingredient expiry reminders and use-it-soon suggestions
- [ ] **TBD:** Saved recipes, favorites, tags, and collections
- [ ] **TBD:** Weekly meal planning with a calendar view
- [ ] **TBD:** Reusable meal-plan templates
- [ ] **TBD:** Grocery-list generation from recipes and meal plans
- [ ] **TBD:** Grocery-list grouping, quantities, and checked-item state
- [ ] **TBD:** Serving-size scaling with adjusted ingredient quantities
- [ ] **TBD:** More advanced substitutions based on pantry contents and dietary needs
- [ ] **TBD:** Nutritional estimates with source and uncertainty disclosures

### Inputs and cooking modes

- [ ] **TBD:** Ingredient, pantry, or dish photo input
- [ ] **TBD:** Recipe import from a photo, URL, or pasted text
- [ ] **TBD:** Voice input for hands-free questions
- [ ] **TBD:** Step-by-step cooking mode with large controls, timers, and wake-lock support
- [ ] **TBD:** Multiple languages and localized measurements
- [ ] **TBD:** Metric and US customary unit conversion

### Sharing and integrations

- [ ] **TBD:** Shareable read-only recipe links
- [ ] **TBD:** Print-friendly recipes and PDF export
- [ ] **TBD:** Export recipes and grocery lists in common structured formats
- [ ] **TBD:** Optional external recipe, calendar, or grocery-service integrations
- [ ] **TBD:** Household profiles and collaborative lists or meal plans

### Deeper personalization

- [ ] **TBD:** Learn from saved recipes, ratings, and explicit feedback
- [ ] **TBD:** Long-term preference controls with transparent editing and deletion
- [ ] **TBD:** Personalized recipe recommendations and meal-plan suggestions
- [ ] **TBD:** Configurable creativity, complexity, budget, and time preferences

## MVP completion definition

The MVP is complete when an anonymous or signed-in user can submit a cooking request, receive a
streamed and useful recipe response, continue the conversation, and recover from expected failure
states. Guest history must remain session-only, signed-in history must remain private and durable,
saved preferences must influence responses, and the production service must have appropriate
testing, safety controls, monitoring, and cost visibility.
