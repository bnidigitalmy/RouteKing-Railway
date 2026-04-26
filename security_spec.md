# Security Specification for RouteKing

## 1. Data Invariants
- **Parcels**: A parcel MUST belong to the authenticated user (`uid` check). Only users with an active subscription (trial or pro) can create/update parcels.
- **Folders**: A folder MUST belong to the authenticated user (`uid` check).
- **Profiles**: A user can only manage their own profile. Sensitive fields like `isPro`, `role`, and `expiryDate` are immutable by the client and must be protected from escalation.
- **Geocache**: Shared collection. Users can read and add new entries, but cannot delete or modify existing ones without permission.
- **Discounts**: Publicly readable (by authenticated users), but only manageable by admins.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

### 1. Identity Spoofing (Parcels)
Target: `/parcels/some_parcel_id`
Attempt: Create a parcel with someone else's `uid`.
Payload:
```json
{
  "address": "123 Jalan Ampang",
  "trackingNumber": "MYR12345",
  "status": "pending",
  "uid": "ATTACKER_UID_123",
  "sequenceNumber": 1
}
```
Expect: PERMISSION_DENIED (User's ID doesn't match `request.auth.uid`).

### 2. Privilege Escalation (Profiles)
Target: `/profiles/MY_UID`
Attempt: Update profile to set `isPro: true` and `role: 'admin'`.
Payload:
```json
{
  "riderName": "Hacker",
  "courierCompany": "Evil Corp",
  "uid": "MY_UID",
  "isPro": true,
  "role": "admin"
}
```
Expect: PERMISSION_DENIED (Escalation attempt blocked).

### 3. Orphaned Write (Folders)
Target: `/folders/new_folder`
Attempt: Create folder without a name or with an invalid ID.
Payload:
```json
{
  "uid": "MY_UID",
  "createdAt": 123456789
}
```
Expect: PERMISSION_DENIED (Missing name).

### 4. Shadow Field Attack (Parcels)
Target: `/parcels/123`
Attempt: Inject hidden admin fields.
Payload:
```json
{
  "address": "Valid",
  "trackingNumber": "Valid",
  "status": "pending",
  "uid": "MY_UID",
  "sequenceNumber": 1,
  "system_verified": true
}
```
Expect: PERMISSION_DENIED (isValidParcel should block ghost fields).

### 5. Denial of Wallet (Geocache)
Target: `/geocache/HUGE_ID`
Attempt: Inject 1MB string as a document ID.
Expect: PERMISSION_DENIED (`isValidId` check).

### 6. State Shortcut (Parcels)
Target: `/parcels/123`
Attempt: Set `status` to an unsupported value.
Payload: { "status": "deleted_by_user" }
Expect: PERMISSION_DENIED (Enum check).

### 7. Resource Exhaustion (Profiles)
Target: `/profiles/MY_UID`
Attempt: Set `riderName` to a 50kb string.
Expect: PERMISSION_DENIED (Size constraint).

### 8. Unauthorized Deletion (Geocache)
Target: `/geocache/some_hash`
Attempt: Delete a shared geocache entry.
Expect: PERMISSION_DENIED (Only Admin can delete).

### 9. Cross-User Read (Parcels)
Target: `/parcels/OTHER_USER_PARCEL`
Attempt: Read another user's parcel.
Expect: PERMISSION_DENIED (Identity check).

### 10. Temporal Injection (Profiles)
Target: `/profiles/MY_UID`
Attempt: Set `trialStartedAt` to a future date manually.
Expect: PERMISSION_DENIED (Server timestamp sync check).

### 11. Immutable Lock Break (Folders)
Target: `/folders/123`
Attempt: Change `uid` of an existing folder.
Expect: PERMISSION_DENIED (Immutability check).

### 12. List Query Scraping
Target: `/parcels`
Attempt: List all parcels without a `where` clause.
Expect: PERMISSION_DENIED (Rule should enforce `resource.data.uid == request.auth.uid`).

## 3. Test Runner
(A separate `firestore.rules.test.ts` will verify these)
