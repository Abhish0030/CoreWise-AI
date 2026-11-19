# ADR 0001: Build and verify the M0 foundation first

Status: Accepted for M0, 2026-11-12.

The product has seven later milestones requiring authenticated data, local hardware, trained artifacts, or a configured model provider. M0 therefore ships only the monorepo, responsive design system, honest dashboard states, and operational Express/PostgreSQL foundation.

The user's locked stack is retained. Shared Zod contracts compile to ESM so the compiled Express application works without a TypeScript runtime. PostgreSQL uses a committed Prisma migration. A separate liveness route and database readiness route distinguish process health from service readiness.

M0 navigation destinations explain their future milestone rather than simulate unfinished workflows. Fixed synthetic sensor fixtures are available only through an explicit demo switch. Metrics never imply measured hardware access, and no synthetic benchmark or prediction is shown.

The expected Armoury Crate reference image was absent from the supplied attachment and repository images. Existing images were inspected; none was that screenshot. No unrelated image is renamed as the missing reference. The design follows the user's detailed structure and palette. The original processor illustration is code-native SVG without third-party artwork.

Services, dependencies, and entity models specific to later milestones will be added when implemented and tested. This keeps the foundation small and avoids misleading scaffolding.
