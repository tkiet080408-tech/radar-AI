# Radar Live – Hướng dẫn cài đặt và đưa lên Netlify

Website có 3 chế độ: **Demo mẫu** (không cần gì), **AI thật** (Gemini + Google Search, cần khóa API và mã truy cập) và **Tạo prompt** (sao chép prompt sang chatbot).

## Cấu trúc thư mục
```
radar-live/
├─ public/index.html            giao diện website
├─ netlify/functions/ai.js      hàm máy chủ, giữ khóa API và gọi Gemini
├─ netlify.toml                 cấu hình Netlify
└─ README.md
```

## Bước 1: Lấy khóa API Gemini
1. Vào Google AI Studio (aistudio.google.com), đăng nhập, chọn **Get API key** và tạo khóa.
2. Giữ khóa bí mật: không dán vào file HTML, không đưa vào GitHub, không gửi cho ai.
3. Xem trang giá chính thức của Gemini API về phí và hạn mức của công cụ Google Search, vì có thể thay đổi. Nếu có thể, đặt cảnh báo hoặc hạn mức chi tiêu cho dự án.

## Bước 2: Đưa mã lên GitHub
1. Tạo tài khoản GitHub (miễn phí), tạo repository mới (Private hoặc Public đều được).
2. Tải toàn bộ thư mục này lên repository (nút **Add file → Upload files**), giữ nguyên cấu trúc thư mục.

## Bước 3: Kết nối Netlify
1. Tạo tài khoản Netlify (miễn phí), chọn **Add new site → Import an existing project**, kết nối GitHub và chọn repository vừa tạo.
2. Netlify sẽ tự đọc `netlify.toml`. Giữ nguyên các mục mặc định, chưa cần bấm Deploy ngay nếu chưa đặt biến môi trường.

## Bước 4: Đặt biến môi trường (đặt khóa)
Vào **Site configuration → Environment variables** và thêm:

| Tên | Bắt buộc | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Có | Khóa API của bạn |
| `ACCESS_CODE` | Nên có | Mã truy cập, chỉ ai biết mã mới dùng được AI thật. Đưa mã này cho thầy/cô và bạn bè |
| `RATE_LIMIT` | Không | Số lượt gọi tối đa mỗi người mỗi giờ (mặc định 20) |
| `GEMINI_MODEL` | Không | Tên mô hình (mặc định `gemini-2.5-flash`). Đổi nếu mô hình này không còn dùng được |

Sau khi thêm biến, vào **Deploys → Trigger deploy** để triển khai lại.

## Bước 5: Kiểm tra
1. Mở link `.netlify.app` của site. Chế độ **Demo mẫu** phải chạy đủ 3 bước.
2. Chọn **AI thật**, nhập mã truy cập, bấm Bước 1, chọn một công ty, bấm Bước 2 rồi Bước 3.
3. Mở từng link nguồn để kiểm chứng công ty có thật.
4. Nhờ người khác mở thử trên điện thoại.

## Lỗi thường gặp
| Thông báo | Cách xử lý |
|---|---|
| Server is not configured | Chưa đặt `GEMINI_API_KEY`, hoặc chưa deploy lại sau khi đặt |
| Wrong or missing access code | Sai hoặc thiếu mã truy cập |
| Too many requests | Vượt giới hạn lượt gọi, chờ hoặc tăng `RATE_LIMIT` |
| AI service error | Khóa sai, hết hạn mức, hoặc tên mô hình không còn dùng được. Xem log ở **Functions** |
| Hết thời gian chờ (timeout) | Tìm kiếm web có thể chậm. Thử lại, dùng mô hình nhanh hơn, hoặc xem giới hạn thời gian của hàm trong cài đặt Netlify |

## An toàn
- Giới hạn lượt gọi trong hàm chỉ ở mức tương đối (bộ nhớ có thể bị đặt lại), nên hãy dựa thêm vào hạn mức chi tiêu của Google.
- Chỉ chia sẻ link và mã truy cập cho người cần dùng. Sau ngày chấm điểm, hãy xóa hoặc thu hồi khóa API để không phát sinh chi phí.
- Kết quả AI có thể sai. Luôn mở nguồn để kiểm chứng trước khi dùng. Ứng dụng không thu thập email hay số điện thoại cá nhân.
