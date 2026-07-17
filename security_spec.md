# Security Specification - Tableau de Bord de Planification

## 1. Data Invariants
- Each task, project, and reminder must belong to a specific authenticated user (`userId == request.auth.uid`).
- A user can only read, write, update, or delete their own tasks, projects, or reminders. No cross-user access is allowed.
- Field types must be strictly validated. For instance, title must be a string of reasonable length, status and priority must belong to their predefined enums.
- Creation timestamps (`createdAt`) must exactly match `request.time` (server timestamp) and be immutable afterwards.
- Update timestamps (`updatedAt`) must match `request.time` on updates.
- Standard alphanumeric document IDs must be enforced.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Identity Theft Create**: Creating a task with a `userId` belonging to a different user.
2. **Identity Theft Update**: Updating an existing task to change the `userId` to another user.
3. **Cross-User Data Scraping (List)**: Trying to query all tasks without filtering by the authenticated user's `userId`.
4. **Cross-User Read (Get)**: An authenticated user attempting to read another user's private project by direct ID.
5. **Privilege Escalation**: Attempting to insert an unauthorized `role` or administrator flag during profile write.
6. **Value Poisoning (Priority)**: Creating a task with `priority: "ultra-urgent-spam"`.
7. **Value Poisoning (Status)**: Creating a project with `status: "hack-mode-completed"`.
8. **Malicious ID Injection**: Injecting a 2MB string as a task document ID to cause storage overload or database slow down.
9. **Creation Timestamp Spoof**: Setting `createdAt` to a manual date in the past.
10. **Modification Timestamp Bypass**: Updating a document without setting `updatedAt` to the current server time or modifying `createdAt`.
11. **Shadow Field Injection**: Attempting to write an undocumented "ghost" field like `isSystemAdmin: true` to bypass logical checks.
12. **Milestone Array Overload**: Attempting to inject an array of 5,000 dummy milestones into a project document to deplete server/client memory.

## 3. Security Hardened Firestore Rules Design
All rules will enforce these constraints using specific helper functions (`isValidId`, `isSignedIn`, `isValidTask`, `isValidProject`, `isValidReminder`). All updates will use `diff().affectedKeys().hasOnly()` to ensure only validated fields can change during specific actions.
