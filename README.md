# Radar – Trợ lý tìm khách hàng xuất khẩu bằng AI

Website demo quy trình 3 bước dùng AI để tìm khách hàng ở nước ngoài:

1. **Tìm khách hàng tiềm năng** (có điểm số và link nguồn)
2. **Xác định người cần liên hệ** (chức danh và từ khóa LinkedIn, không có thông tin cá nhân)
3. **Hồ sơ khách hàng và email chào hàng nháp**

Website có 3 chế độ, dùng nút quả địa cầu để đổi Việt/Anh:

| Chế độ | Cần gì | Ghi chú |
|---|---|---|
| **Demo (kết quả mẫu)** | Không cần gì | Dữ liệu hư cấu, luôn chạy được, dùng làm phương án dự phòng |
| **AI thật (tìm web)** | Khóa Tavily và khóa Gemini (đều có gói miễn phí) | Tìm web thật, có link nguồn |
| **Tạo prompt** | Không cần gì | Tạo prompt để dán vào ChatGPT, Gemini hoặc Claude |

> Kết quả do AI tạo ra chỉ để tham khảo. Tên công ty, số liệu và thông tin liên hệ cần được kiểm chứng với nguồn chính thức trước khi dùng.

## 1. Cấu trúc thư mục (phải đúng như sau)

```
radar-live/
├─ public/
│  └─ index.html              giao diện website
├─ netlify/
│  └─ functions/
│     └─ ai.js                hàm máy chủ: giữ khóa API, tìm web và gọi Gemini
├─ netlify.toml               cấu hình Netlify
└─ README.md
```

Khi tải lên GitHub bằng cách kéo thả, các file có thể bị đưa hết ra ngoài cùng. Nếu vậy, mở từng file, bấm biểu tượng cây bút chì, rồi thêm đường dẫn thư mục vào đầu tên file (ví dụ gõ `public/` trước `index.html`, gõ `netlify/functions/` trước `ai.js`) và bấm **Commit changes**.

## 2. Lấy các khóa API miễn phí

**Tavily (tìm web)**
1. Vào **tavily.com**, đăng ký miễn phí (không cần thẻ tín dụng).
2. Trong trang API Playground, sao chép khóa API (nút Copy cạnh khóa có tên `default`).

**Gemini (viết kết quả)**
1. Vào **aistudio.google.com/api-keys**, đăng nhập và bấm **Create API key**.
2. Sao chép khóa.
3. **Không bấm "Set up billing"** để chắc chắn không phát sinh phí.

Quy tắc an toàn: không dán khóa vào file HTML, không đưa lên GitHub, không gửi cho người khác và không chụp màn hình để lộ khóa. Nếu lỡ lộ, xóa khóa cũ và tạo khóa mới.

## 3. Đưa mã lên GitHub

1. Tạo tài khoản GitHub, tạo repository mới (ví dụ `radar-AI`).
2. Tải các file lên theo đúng cấu trúc ở mục 1 (nút **Add file**, chọn **Upload files**, hoặc mở đường dẫn `github.com/TÊN-TÀI-KHOẢN/TÊN-REPO/upload/main`).
3. Kiểm tra: `index.html` nằm trong `public/`, `ai.js` nằm trong `netlify/functions/`, `netlify.toml` ở ngoài cùng.

## 4. Tạo website trên Netlify

1. Vào **netlify.com**, đăng nhập bằng GitHub.
2. Chọn **Add new project**, rồi **Import an existing project**, chọn GitHub và repository vừa tạo.
3. Giữ các giá trị Netlify tự điền: Branch `main`, Publish directory `public`, Functions directory `netlify/functions`.
4. Thêm biến môi trường (mục dưới đây), rồi bấm **Deploy**.

### Biến môi trường (Project configuration, Environment variables)

| Tên (Key) | Giá trị (Value) | Bí mật? |
|---|---|---|
| `GEMINI_API_KEY` | Khóa Gemini | Có (tích Contains secret values) |
| `TAVILY_API_KEY` | Khóa Tavily | Có (tích Contains secret values) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Không |
| `RATE_LIMIT` | Số lượt tối đa mỗi người mỗi giờ (mặc định 20), không bắt buộc | Không |

Lưu ý quan trọng: ô **Key** là tên biến, ô **Value** mới là khóa. Nếu dán khóa vào ô Key, hàm sẽ báo thiếu `GEMINI_API_KEY`.

Sau khi thêm hoặc sửa biến, vào **Deploys**, bấm **Trigger deploy**, chọn **Deploy project without cache** để áp dụng.

## 5. Kiểm tra website

1. Mở link dạng `tên-project.netlify.app` bằng **cửa sổ ẩn danh** để chắc chắn người ngoài vào được. Nếu bị yêu cầu đăng nhập hoặc thấy chế độ **Private**, bấm **Make public** trong thanh công cụ của Netlify hoặc vào phần cài đặt truy cập của project.
2. Chế độ **Demo** phải chạy đủ 3 bước.
3. Chọn **AI thật**, bấm Bước 1 và chờ vài chục giây. Chọn một công ty rồi bấm Bước 2 và Bước 3.
4. Mở thử vài link ở phần "Nguồn tìm thấy" để kiểm chứng.

## 6. Cách hàm hoạt động

- Khi có `TAVILY_API_KEY`: Bước 1 nhờ Gemini viết 2 câu tìm kiếm tiếng Anh, tìm trên Tavily, rồi Gemini chỉ chọn công ty xuất hiện trong kết quả tìm được. Bước 2 và 3 tìm thông tin về công ty đã chọn rồi tổng hợp.
- Khi **không** có `TAVILY_API_KEY`: hàm dùng công cụ Google Search của Gemini (có thể cần gói trả phí và dễ báo lỗi 429 ở gói miễn phí).
- Giới hạn lượt gọi theo từng người chỉ ở mức tương đối vì bộ nhớ của hàm có thể bị đặt lại.

## 7. Lỗi thường gặp

| Thông báo | Nguyên nhân và cách xử lý |
|---|---|
| Server is not configured (missing GEMINI_API_KEY) | Chưa đặt biến `GEMINI_API_KEY`, đặt sai tên, hoặc chưa deploy lại |
| AI service error (404) | Tên mô hình không còn dùng được. Đổi `GEMINI_MODEL` (thử `gemini-3.1-flash-lite`, `gemini-3.5-flash` hoặc `gemini-flash-latest`) và deploy lại |
| AI service error (429) hoặc "hết lượt miễn phí" | Hết hạn mức miễn phí. Chờ rồi thử lại, đổi mô hình khác, hoặc dùng Demo. Không cần bật thanh toán |
| Web search failed | Sai khóa Tavily hoặc hết 1.000 credit trong tháng. Kiểm tra `TAVILY_API_KEY` |
| Chưa tìm thấy công ty phù hợp | Kết quả tìm kiếm không có công ty rõ ràng. Bấm lại, hoặc ghi sản phẩm và thị trường rõ hơn (thử tiếng Anh) |
| Hết thời gian chờ (timeout) | Tìm kiếm quá chậm so với giới hạn của hàm. Thử lại sau |

## 8. Mã truy cập (tùy chọn, mặc định không dùng)

Hàm hỗ trợ biến `ACCESS_CODE` để chỉ người biết mã mới dùng được AI thật. Hiện ô nhập mã trong giao diện đang **bị ẩn**, nên **đừng đặt `ACCESS_CODE`** trừ khi bạn hiện lại ô đó (xóa thuộc tính `hidden` ở nhãn và ô nhập có `id="k"` trong `index.html`). Nếu đặt mã mà ô bị ẩn, không ai dùng được AI thật.

## 9. An toàn và chi phí

- Dùng hoàn toàn gói miễn phí: Netlify, GitHub, Tavily và Gemini (không bật thanh toán). Gói miễn phí có giới hạn lượt và điều kiện có thể thay đổi, nên xem lại trang của từng nhà cung cấp.
- Chỉ gửi link cho người cần test, vì mỗi lượt AI thật dùng hạn mức của bạn.
- Sau ngày chấm điểm, bạn có thể xóa khóa trong Google AI Studio và Tavily, hoặc xóa biến môi trường trên Netlify. Khi đó AI thật sẽ báo lỗi, còn Demo và Tạo prompt vẫn chạy.
- Ứng dụng không thu thập email hay số điện thoại cá nhân.
