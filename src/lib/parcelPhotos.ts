import { getDownloadURL, ref, storage, uploadString } from "../firebase";

type ParcelPhotoKind = 'pod' | 'failed';

export async function uploadParcelPhoto(
  uid: string,
  parcelId: string,
  kind: ParcelPhotoKind,
  dataUrl: string
): Promise<string> {
  const safeParcelId = parcelId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const path = `users/${uid}/parcels/${safeParcelId}/${kind}-${timestamp}.jpg`;
  const photoRef = ref(storage, path);
  await uploadString(photoRef, dataUrl, 'data_url', {
    contentType: 'image/jpeg',
    customMetadata: {
      parcelId: safeParcelId,
      kind,
    },
  });
  return getDownloadURL(photoRef);
}
