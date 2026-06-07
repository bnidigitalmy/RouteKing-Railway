import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-routeking';
let testEnv: RulesTestEnvironment;

function profile(uid: string, overrides = {}) {
  return {
    uid,
    riderName: `Rider ${uid}`,
    courierCompany: 'RouteKing Test',
    trialScansUsed: 0,
    ...overrides,
  };
}

function parcel(uid: string, id: string, overrides = {}) {
  return {
    id,
    uid,
    address: '123 Jalan Ampang, Kuala Lumpur',
    trackingNumber: `TRK-${id}`,
    status: 'pending',
    sequenceNumber: 1,
    scannedAt: Date.now(),
    ...overrides,
  };
}

function folder(uid: string, overrides = {}) {
  return {
    uid,
    name: 'Route A',
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('RouteKing Firestore rules', () => {
  test('user can create a safe own profile, but cannot self-upgrade', async () => {
    const db = testEnv.authenticatedContext('user-a').firestore();

    await assertSucceeds(setDoc(doc(db, 'profiles/user-a'), profile('user-a')));
    await assertFails(setDoc(doc(db, 'profiles/user-b'), profile('user-b')));
    await assertFails(setDoc(doc(db, 'profiles/user-a-pro'), profile('user-a', {
      isPro: true,
      role: 'admin',
    })));
  });

  test('users cannot create parcels directly because scan creation is server-authoritative', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a'));
      await setDoc(doc(ctx.firestore(), 'profiles/admin-a'), profile('admin-a', { role: 'admin' }));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    const adminDb = testEnv.authenticatedContext('admin-a').firestore();

    await assertFails(setDoc(doc(db, 'parcels/parcel-a'), parcel('user-a', 'parcel-a')));
    await assertFails(setDoc(doc(db, 'parcels/parcel-b'), parcel('user-b', 'parcel-b')));
    await assertSucceeds(setDoc(doc(adminDb, 'parcels/parcel-admin'), parcel('user-a', 'parcel-admin')));
  });

  test('parcel create rejects shadow fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a'));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    await assertFails(setDoc(doc(db, 'parcels/parcel-a'), parcel('user-a', 'parcel-a', {
      system_verified: true,
    })));
  });

  test('expired non-pro user cannot create parcel', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a', {
        trialScansUsed: 50,
        isPro: false,
      }));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    await assertFails(setDoc(doc(db, 'parcels/parcel-a'), parcel('user-a', 'parcel-a')));
  });

  test('expired pro user cannot fall back to unused scan trial for gated writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a', {
        trialScansUsed: 0,
        isPro: true,
        expiryDate: Date.now() - 1000,
      }));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    await assertFails(setDoc(doc(db, 'folders/folder-a'), folder('user-a')));
  });

  test('user cannot list all parcels without owner query', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a'));
      await setDoc(doc(ctx.firestore(), 'parcels/parcel-a'), parcel('user-a', 'parcel-a'));
      await setDoc(doc(ctx.firestore(), 'parcels/parcel-b'), parcel('user-b', 'parcel-b'));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    await assertFails(getDocs(collection(db, 'parcels')));
    await assertSucceeds(getDocs(query(collection(db, 'parcels'), where('uid', '==', 'user-a'))));
  });

  test('trial scan counter can increase but not decrease', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a', {
        trialScansUsed: 2,
      }));
    });

    const db = testEnv.authenticatedContext('user-a').firestore();
    await assertSucceeds(updateDoc(doc(db, 'profiles/user-a'), {
      dailyScanCount: 3,
      lastScanResetDate: '2026-06-04',
      monthlyScanCount: 3,
      lastScanResetMonth: '2026-06',
      trialScansUsed: 3,
    }));
    await assertFails(updateDoc(doc(db, 'profiles/user-a'), {
      dailyScanCount: 4,
      lastScanResetDate: '2026-06-04',
      monthlyScanCount: 4,
      lastScanResetMonth: '2026-06',
      trialScansUsed: 1,
    }));
  });

  test('admin can read another user profile', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/admin-a'), profile('admin-a', { role: 'admin' }));
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a'));
    });

    const adminDb = testEnv.authenticatedContext('admin-a').firestore();
    const userDb = testEnv.authenticatedContext('user-a').firestore();

    await assertSucceeds(getDoc(doc(adminDb, 'profiles/user-a')));
    await assertFails(getDoc(doc(userDb, 'profiles/admin-a')));
  });

  test('geocache writes are admin-only', async () => {
    const db = testEnv.authenticatedContext('user-a').firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/admin-a'), profile('admin-a', { role: 'admin' }));
    });
    const adminDb = testEnv.authenticatedContext('admin-a').firestore();
    const ref = doc(db, 'geocache/address_a');
    const adminRef = doc(adminDb, 'geocache/address_a');

    await assertFails(setDoc(ref, {
      address: '123 Jalan Ampang',
      lat: 3.1,
      lng: 101.7,
      lastUpdated: Date.now(),
    }));
    await assertSucceeds(setDoc(adminRef, {
      address: '123 Jalan Ampang',
      lat: 3.1,
      lng: 101.7,
      lastUpdated: Date.now(),
    }));
    await assertFails(updateDoc(ref, { lat: 4.1 }));
    await assertSucceeds(updateDoc(adminRef, { lat: 4.1 }));
  });

  test('sanity check keeps seeded data visible to admin context', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/admin-a'), profile('admin-a', { role: 'admin' }));
      await setDoc(doc(ctx.firestore(), 'profiles/user-a'), profile('user-a'));
    });

    const adminDb = testEnv.authenticatedContext('admin-a').firestore();
    const snapshot = await assertSucceeds(getDocs(collection(adminDb, 'profiles')));
    expect(snapshot.size).toBe(2);
  });
});
