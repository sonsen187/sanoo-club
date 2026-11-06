# 🎛️ TikTok Live DJ Club (Vũ Trường DJ TikTok 9:16)

Dự án game tương tác livestream TikTok định dạng dọc **9:16**, được xây dựng trên nền tảng **HTML5 Canvas 2D + Web Audio API + Node.js WebSocket**, gồm 2 giao diện chuyên biệt: **Màn hình Overlay Stream 9:16** (dành cho OBS / TikTok Live Studio) và **Bảng Điều Khiển Admin** dành cho Streamer.

---

## 🌟 Điểm Nổi Bật & Tính Năng Nâng Cao

### 1. Hệ thống Nhân Vật Đa Dạng: Mèo & Người (Nam / Nữ)
- **Bộ Sprite Mèo Quẩy Nguyên Bản**: 41 frame hoạt hình trích xuất từ repo Unity gốc (3 nhân vật mèo `char1`, `char2`, `char3`).
- **Bộ Sprite Người Nam & Nữ Hoàn Toàn Mới**:
  - Tự động kết xuất 336 frame chất lượng cao trên Offscreen Canvas.
  - Phân chia **4 cấp bậc đồng phục sang trọng**: Thường (Regular), Top 3 Đồng (Bronze), Top 2 Bạc (Silver Overlord), Top 1 Hoàng Gia (Imperial Gold Dragon).
  - Tự do chuyển đổi chế độ hiển thị trong Admin: **Người (Humans)**, **Mèo (Cats)** hoặc **Hỗn hợp (Mixed)**.

### 2. Hệ Thống 3 Vũ Đạo Độc Quyền (Multi-Dance Styles)
Khán giả và đám đông không bị trùng lặp động tác, tự do chọn lựa hoặc phân phối đều:
- **⚡ Vũ đạo 1 - Rave Wave & Slash**: Quơ gậy dạ quang quét vòng cung rộng, chém tay dứt khoát theo từng cú bass drop.
- **👟 Vũ đạo 2 - Shuffle Dance & Cutting Shapes**: Giậm chân đảo gót liên tục, lắc hông sang 2 bên, tay xoay gậy tầm thấp quanh eo cực kỳ điệu nghệ.
- **🚀 Vũ đạo 3 - Hands Up In The Air & Party Hype**: Cả hai tay giơ cao vút lên trời hình chữ V, quét gạt qua lại ăn mừng và nhảy bật tưng bừng.

### 3. Phụ Kiện Cool Ngầu & Bục Vinh Danh Top 1, 2, 3
- **🕶️ Kính DJ Siêu Ngầu (Dual-Lens 24K Gold DJ Sunglasses)**: Hai tròng kính đa giác tách rời thể thao, cầu mũi cong chữ U mạ vàng, tráng gương Obsidian phản chiếu vệt bóng chéo, lóe sáng ngôi sao vàng theo từng nhịp bass (xóa bỏ hoàn toàn gạch ngang trên mặt).
- **👑 Vương Miện Hoàng Gia Top 1**: Vòm cong ngọc uốn lượn ôm đầu đính đá quý Ruby & Emerald lấp lánh.
- **🏆 3 Bục Vinh Danh Bậc Thang VIP**:
  - Bục Top 1 ở chính giữa cao nhất mạ vàng 24K.
  - Bục Top 2 (bên trái) viền bạc & Neon Cyan.
  - Bục Top 3 (bên phải) viền đồng Hổ phách.
- **🎧 Resident DJ Nổi Bật**: Đứng trên bục sân khấu riêng với kính DJ 2 tròng màn hình Equalizer, bàn xoay Pioneer DJ và tai nghe RGB.

### 4. Âm Nhạc & Bắt Nhịp Bass Chuẩn Xác
- **68 Bài nhạc DJ / Electronic / Remix**: Kho nhạc phong phú với metadata BPM và hồ sơ tần số Sub-Bass được phân tích bằng bộ lọc 2-Pole IIR Low-Pass ở 110Hz.
- Nhân vật tự động chuyển trạng thái:
  - Khi có Bass dồn dập: Nhún nảy 32-45px, cắt bớt frame để tạo động tác chém tay/giậm chân dứt khoát theo nhịp trống Kick.
  - Khi nhạc dạo / không có bass: Nhún người êm dịu 24px, nén gối đàn hồi 12%, gậy sáng giữ yên trước ngực.

---

## 🎮 Các Lệnh Tương Tác Của Người Xem

Khán giả trên livestream TikTok có thể gõ các lệnh sau trong khung chat:

| Lệnh Chat | Ý nghĩa |
| :--- | :--- |
| `1` hoặc `!join` hoặc `nhay` | Tham gia sàn nhảy và trở thành một vũ công |
| `!nam` / `!male` | Đổi sang vũ công Nam 👦 |
| `!nu` / `!female` | Đổi sang vũ công Nữ 👧 |
| `!meo` / `!cat` | Đổi sang Mèo quẩy 🐱 |
| `!dance 1` | Đổi sang Vũ đạo 1: Rave Wave (Quơ que sáng ⚡) |
| `!dance 2` | Đổi sang Vũ đạo 2: Shuffle Dance (Giậm chân & Lắc hông 👟) |
| `!dance 3` | Đổi sang Vũ đạo 3: Hands Up (Hai tay giơ cao & Nhảy bật 🚀) |
| `!song <số>` hoặc `!song <tên bài>` | Yêu cầu bài hát DJ từ danh sách 68 bài |
| `!skip` hoặc `!next` | Yêu cầu chuyển sang bài kế tiếp |
| `!fire` hoặc `!lua` | Kích hoạt súng phun lửa sân khấu |
| `!smoke` hoặc `!khoi` | Kích hoạt vòi phun khói CO2 lạnh |
| `!rave` hoặc `!quay` | Kích hoạt chế độ quẩy tung nóc (Tất cả hiệu ứng) |

---

## 🎁 Cơ Chế Quà Tặng TikTok (TikTok Gifts)

Khi khán giả tặng quà trên TikTok Live, hệ thống tự động nhận diện và phản hồi:
- **Hoa hồng (1 xu)**: Tham gia sàn nhảy + Pháo sáng + Cộng 1 xu vào BXH VIP.
- **Trái tim (5 xu)**: Mưa kim tuyến + Vũ công nhảy mừng + Cộng 5 xu.
- **Bánh rán (30 xu)**: Phun khói CO2 + Đèn laser tăng tốc + Cộng 30 xu.
- **Pháo hoa (100 xu)**: Bắn pháo hoa + Cột lửa DJ rực cháy + Âm thanh chúc mừng.
- **Súng bắn tiền (500 xu)**: Mưa tiền bay + Nhạc rave + Tăng hạng thần tốc.
- **Sư tử / Vũ trụ TikTok (29.999 xu)**: **NGÔI VƯƠNG DJ KING!** Bùng nổ toàn bộ hiệu ứng sân khấu, vinh danh màn hình lớn, chiếm trọn bục DJ trung tâm!

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Khởi động Web Server
```bash
npm start
```

Server sẽ khởi động tại cổng `3000`:
- **Màn hình Overlay Stream (9:16)**: `http://localhost:3000/`
- **Bảng Điều Khiển Admin**: `http://localhost:3000/admin.html`
- **Bộ Sưu Tập Xem Thử Vũ Đạo**: `http://localhost:3000/preview_sprites.html`

### 3. Thiết Lập Vào OBS Studio / TikTok LIVE Studio
1. Mở **OBS Studio** hoặc **TikTok LIVE Studio**.
2. Thêm nguồn mới: Chọn **Browser** (Trình duyệt).
3. Cấu hình thông số:
   - **URL**: `http://localhost:3000/`
   - **Width**: `1080`
   - **Height**: `1920`
   - Tích chọn: **Control audio via OBS** (nếu muốn chỉnh âm lượng trực tiếp từ bàn trộn OBS).
4. *(Tùy chọn)* Nếu muốn lồng sàn nhảy lên trên webcam/camera của streamer, vào Bảng Admin bật tùy chọn **"Chế độ nền trong suốt (Transparent Background)"**.

---

## 📁 Cấu Trúc Thư Mục

```
dj-club/
├── package.json               # Cấu hình dependency (express, ws, tiktok-live-connector, ...)
├── server.js                  # Backend: WebSocket hub, TikTok Live Connector, chat commands, state
├── start-tunnel.bat           # Script mở Cloudflare Tunnel công khai
├── public/
│   ├── index.html             # Màn hình Overlay 9:16 cho OBS
│   ├── admin.html             # Bảng điều khiển Admin cho Streamer
│   ├── preview_sprites.html   # Bộ sưu tập xem thử 3 vũ đạo & 4 cấp đồng phục
│   ├── css/
│   │   ├── overlay.css        # Giao diện Cyberpunk 9:16 Neon Club
│   │   └── admin.css          # Giao diện Dark Cyber Dashboard của Admin
│   ├── js/
│   │   ├── overlay.js         # Canvas engine: 60 FPS, âm thanh Web Audio, đèn tia laser, vũ công
│   │   ├── human_sprites.js   # Hệ thống 336 frame procedural Nam/Nữ & 3 bài vũ đạo
│   │   ├── admin.js           # Xử lý tương tác, bảng giả lập và điều khiển toàn sàn
│   │   └── sfx.js             # Bộ tổng hợp âm thanh DJ procedurally sinh bằng Web Audio
│   └── assets/
│       ├── characters/        # 41 Sprite animation trích xuất từ repo gốc (char1, char2, char3)
│       ├── music/             # 68 Bài nhạc DJ MP3 được sao chép và chuẩn hóa
│       ├── textures/          # Textures loa, thiết bị sân khấu
│       └── playlist.json      # Metadata và hồ sơ sub-bass của 68 bài hát
└── scripts/
    └── analyze_all_music.js   # Công cụ phân tích BPM và lọc Sub-bass 110Hz
```
