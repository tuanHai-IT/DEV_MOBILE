# EcoShare Firebase backend

TypeScript/Node 22, Firebase Functions v2, Firestore, Auth, Storage. Giữ 20 collection nghiệp vụ, kiểm tra xác minh cả người mua và người bán.

```powershell
npm ci
npm run test:emulators
npm run emulators
```

Cần Java 21+ cho Emulator. Các lệnh trên chạy từ thư mục `backend`, dùng project local `demo-recycling-share`.

- [Cài đặt, seed, cấu hình và deploy](../docs/firebase-backend.md)
- [API v1](../docs/firebase-api.md)
- [MoMo/VNPay và Secret Manager](../docs/payments-firebase.md)
- [Kết quả kiểm thử và giới hạn](../docs/backend-verification.md)
- [Client Android](../docs/android-firebase.md)

Admin kết nối API: `http://127.0.0.1:5174/backend.html` sau khi seed/configure. Chưa có projectId thật được cấu hình; không nhúng service account hoặc khóa merchant vào source.
