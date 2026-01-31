# GameHub24 Client

Frontend xây dựng bằng React + TypeScript + Bun.

## 1. Kết Nối / Connection
Sử dụng `socket.io-client`. Thông tin kết nối và danh tính (User ID, Username) được lưu trong `localStorage`.

```mermaid
sequenceDiagram
    Client->>Server: Connect (UserId, Username)
    Server-->>Client: Connection Established
```
*Bạn có thể đổi server URL hoặc tạo danh tính mới trong phần **Settings**.*

---

## 2. Đồng Bộ Game / Game Synchronization
Kiến trúc **Host-Guest** (Host đóng vai trò Server xử lý logic).

```mermaid
sequenceDiagram
    participant Guest
    participant Server
    participant Host

    Note over Guest, Host: 1. Action Relay
    Guest->>Server: Emit "game:action"
    Server->>Host: Relay Action

    Note over Host: 2. Process & Sync
    Host->>Host: Validate & Update State
    Host->>Server: Emit "game:state:patch" (Optimized)
    Server->>Guest: Broadcast Patch

    Note over Guest: 3. Update UI
```

### Điểm Nổi Bật / Key Features:
- **Optimization**: Tự động gộp Patch (Compaction) và chỉ gửi thay đổi nhỏ nhất để tiết kiệm băng thông.
- **Structural Sharing**: Sử dụng Immer giúp React re-render cực nhanh và chính xác.
- **Persistence**: Host tự động lưu state vào `localStorage`. Nếu bị mất kết nối, Host có thể Resume game ngay lập tức.

---

## ⚙️ Cài Đặt / Development
```bash
# Cài đặt
bun install

# Chạy Dev
bun run dev

# Build
bun run build
```

Xem thêm [src/games/README.md](src/games/README.md) để biết cách tạo game mới.
