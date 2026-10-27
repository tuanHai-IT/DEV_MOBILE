These three JPEG files are local development seed fixtures, downloaded on 2026-10-18 from the image URLs already used in the project's Figma frontend. The seed script uploads the bytes to Firebase Storage and writes MediaAsset records in Firestore. Android and the admin panel load those records through the API; they do not use these external URLs as frontend sample data.

| Fixture | Source image |
| --- | --- |
| `reuse-plants.jpg` | [Can planters on Unsplash](https://images.unsplash.com/photo-1525695230005-efd074980869) |
| `reuse-glass.jpg` | [Glass flower bottle on Unsplash](https://images.unsplash.com/photo-1757626065729-a13f763423e1) |
| `reuse-corks.jpg` | [Cork wind chime on Unsplash](https://images.unsplash.com/photo-1773612973407-3b65988ce51a) |

Downloaded as 720 × 800 JPEG, quality 82, cropped by the image service. They are illustrative local test photos, not product inventory claims. See the [Unsplash license](https://unsplash.com/license). Only `demo-*` projects with Auth, Firestore, and Storage emulators are accepted by the seed script. Re-running it preserves existing content and admin edits.
