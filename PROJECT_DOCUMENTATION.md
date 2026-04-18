# Tài liệu tổng quan dự án Hệ thống Đấu giá

Tài liệu này cung cấp cái nhìn tổng quan về chức năng và vai trò của từng file trong dự án "Hệ thống Đấu giá", giúp bạn dễ dàng quản lý và hiểu rõ cấu trúc code.

## 1. Cấu trúc thư mục chính

- `public/`: Chứa các file frontend (HTML, CSS, JavaScript) mà trình duyệt có thể truy cập trực tiếp.
- `src/`: Chứa mã nguồn backend (Node.js).
  - `config/`: Cấu hình ứng dụng (database, JWT, Momo, v.v.).
  - `constants/`: Các hằng số được sử dụng trong ứng dụng.
  - `errors/`: Định nghĩa các lớp lỗi tùy chỉnh.
  - `logger/`: Cấu hình và quản lý hệ thống ghi nhật ký (logging).
  - `middleware/`: Các hàm middleware xử lý yêu cầu HTTP trước khi đến route handler.
  - `repositories/`: Lớp tương tác trực tiếp với cơ sở dữ liệu (CRUD).
  - `routes/`: Định nghĩa các endpoint API.
  - `services/`: Chứa logic nghiệp vụ chính của ứng dụng.
  - `utils/`: Các hàm tiện ích dùng chung.

---

## 2. Thư mục `public/js/` (Frontend JavaScript)

Các file này chứa logic JavaScript chạy trên trình duyệt để tương tác với API backend và cập nhật giao diện người dùng.

-   `c:\Project\AuctionSystem\public\js\ui-helpers.js`
    -   **Chức năng:** Chứa các hàm tiện ích chung cho giao diện người dùng, giúp tái sử dụng code và duy trì tính nhất quán.
    -   **Tính năng chính:**
        -   `showNotification`: Hiển thị thông báo toast (thành công/lỗi).
        -   `formatVND`: Định dạng số thành chuỗi tiền tệ VND.
        -   `parseVND`: Chuyển đổi chuỗi VND thành số.
        -   `logout`: Xử lý đăng xuất người dùng.
        -   `WalletUI` class: Quản lý form nạp/rút tiền, gửi yêu cầu API và cập nhật UI.
        -   `ProfileUI` class: Quản lý form cập nhật hồ sơ, đổi mật khẩu, xem trước avatar.

-   `c:\Project\AuctionSystem\public\js\seller.js`
    -   **Chức năng:** Logic JavaScript cho trang quản lý của người bán (`seller.html`).
    -   **Tính năng chính:**
        -   Kiểm tra quyền `Seller` khi truy cập trang.
        -   Tải và hiển thị thông tin người bán, số dư ví, thống kê thu chi.
        -   `loadProducts()`: Tải danh sách sản phẩm của người bán, hiển thị thẻ sản phẩm và lọc sản phẩm cho dropdown tạo đấu giá (còn hàng, chưa đấu giá).
        -   `loadAuctions()`: Tải và hiển thị danh sách các phiên đấu giá của người bán (đang diễn ra, đã kết thúc, đang xử lý).
        -   `loadSoldItems()`: Tải và hiển thị danh sách các mặt hàng đã bán thành công.
        -   `addProductForm`: Xử lý thêm sản phẩm mới (bao gồm tải ảnh Base64 và URL).
        -   `createAuctionForm`: Xử lý tạo phiên đấu giá mới.
        -   `editProduct()`, `deleteProduct()`: Chức năng sửa, xóa sản phẩm.
        -   `endAuction()`, `deleteAuction()`, `relistAuction()`: Chức năng quản lý phiên đấu giá.
        -   `viewProductDetails()`, `viewAuctionDetails()`: Hiển thị chi tiết sản phẩm/đấu giá trong modal.
        -   Lắng nghe sự kiện Socket.io (`productSold`, `bidUpdate`, `balanceUpdate`) để cập nhật UI theo thời gian thực.

-   `c:\Project\AuctionSystem\public\js\index.js`
    -   **Chức năng:** Logic JavaScript cho trang chủ công khai (`index.html`).
    -   **Tính năng chính:**
        -   `updateAuthUI()`: Cập nhật giao diện đăng nhập/đăng xuất và hiển thị menu người dùng dựa trên vai trò.
        -   `logout()`: Xử lý đăng xuất.
        -   `loadCategoriesForFilter()`: Tải danh mục để lọc sản phẩm.
        -   `loadAuctions()`: Tải và hiển thị danh sách các phiên đấu giá đang hoạt động (có hỗ trợ tìm kiếm, lọc theo giá, danh mục).
        -   `openBidModal()`: Mở modal đặt giá, hiển thị thông tin đấu giá và gợi ý giá.
        -   `placeBid()`: Gửi yêu cầu đặt giá lên server.
        -   Xử lý form đăng nhập (`loginForm`), đăng ký (`registerForm`), quên mật khẩu (`forgotPasswordForm`), đặt lại mật khẩu (`resetPasswordForm`).
        -   Xử lý đăng nhập bằng Google OAuth (nếu có token trên URL).
        -   Lắng nghe sự kiện Socket.io (`bidUpdate`) để cập nhật giá đấu giá theo thời gian thực.

-   `c:\Project\AuctionSystem\public\js\user.js`
    -   **Chức năng:** Logic JavaScript cho trang hồ sơ người dùng (`user.html`).
    -   **Tính năng chính:**
        -   Kiểm tra quyền `User` khi truy cập trang.
        -   `showSection()`: Chuyển đổi giữa các tab/phần trong trang (Hồ sơ, Ví, Đấu giá đang tham gia, Đấu giá đã thắng, Lịch sử đặt giá, Giao dịch).
        -   Tải và hiển thị thông tin hồ sơ người dùng, số dư ví, thống kê thu chi.
        -   `loadParticipating()`: Tải và hiển thị các phiên đấu giá người dùng đang tham gia, bao gồm đồng hồ đếm ngược và form đặt giá nhanh.
        -   `loadWonAuctions()`: Tải và hiển thị các phiên đấu giá người dùng đã thắng, bao gồm trạng thái thanh toán và nút thanh toán lại.
        -   `loadBidHistory()`: Tải và hiển thị lịch sử các lượt đặt giá của người dùng.
        -   `loadTransactions()`: Tải và hiển thị lịch sử giao dịch (nạp/rút/thanh toán).
        -   `requestSellerUpgrade()`: Gửi yêu cầu trở thành người bán.
        -   `retryPayment()`: Chức năng thanh toán lại cho đấu giá đã thắng nhưng thanh toán thất bại.
        -   Sử dụng `WalletUI` và `ProfileUI` từ `ui-helpers.js`.
        -   Lắng nghe sự kiện Socket.io (`bidUpdate`, `auctionWin`, `paymentFail`, `balanceUpdate`).

-   `c:\Project\AuctionSystem\public\js\admin.js`
    -   **Chức năng:** Logic JavaScript cho trang quản trị viên (`admin.html`).
    -   **Tính năng chính:**
        -   Kiểm tra quyền `Admin` khi truy cập trang.
        -   `showSection()`: Chuyển đổi giữa các tab/phần trong trang quản trị.
        -   `loadDashboardData()`: Tải và hiển thị các số liệu thống kê tổng quan (người dùng, sản phẩm, đấu giá, doanh thu), hoạt động gần đây, đấu giá mới kết thúc và biểu đồ.
        -   `renderCharts()`: Vẽ biểu đồ doanh thu và trạng thái đấu giá bằng Chart.js.
        -   `loadUsers()`: Tải và hiển thị danh sách người dùng, cho phép sửa vai trò và xóa người dùng.
        -   `loadProducts()`: Tải và hiển thị danh sách sản phẩm, cho phép xem chi tiết và xóa sản phẩm.
        -   `loadAuctions()`: Tải và hiển thị danh sách các phiên đấu giá, cho phép xem chi tiết và kết thúc đấu giá.
        -   `loadSellerRequests()`: Tải và hiển thị danh sách các yêu cầu nâng cấp lên người bán, cho phép phê duyệt.
        -   `loadCategories()`: Tải và hiển thị danh sách danh mục, cho phép thêm/sửa/xóa danh mục.
        -   `openEditUserModal()`, `deleteUser()`: Quản lý người dùng.
        -   `viewProductDetails()`, `deleteProduct()`: Quản lý sản phẩm.
        -   `viewAuctionDetails()`, `endAuction()`: Quản lý đấu giá.
        -   `openCategoryModal()`, `editCategory()`, `deleteCategory()`: Quản lý danh mục.

---

## 3. Thư mục `src/config/` (Cấu hình)

-   `c:\Project\AuctionSystem\src\config\index.js`
    -   **Chức năng:** Quản lý cấu hình ứng dụng, tải các biến môi trường từ file `.env` và cung cấp chúng cho các phần khác của ứng dụng.
    -   **Tính năng chính:**
        -   Tải các biến môi trường cho Server, Database, JWT, Redis, Session, Email, Payment (Momo), OAuth (Google, Facebook), Upload.
        -   Xác thực các cấu hình quan trọng (đặc biệt trong môi trường production).
        -   Cung cấp các phương thức `get()` để truy cập cấu hình lồng nhau.
        -   Cung cấp cấu hình riêng cho kết nối MySQL (`getDatabaseConfig()`) và Redis (`getRedisConfig()`).
        -   Kiểm tra môi trường hiện tại (`isProduction()`, `isDevelopment()`).

-   `c:\Project\AuctionSystem\src\config\redis.js`
    -   **Chức năng:** Quản lý kết nối đến Redis.
    -   **Tính năng chính:**
        -   `connectRedis()`: Khởi tạo kết nối pool đến Redis.
        -   `getRedisClient()`: Cung cấp client Redis đã kết nối.
        -   Xử lý lỗi kết nối Redis.

---

## 4. Thư mục `src/middleware/` (Middleware)

-   `c:\Project\AuctionSystem\src\middleware\error.js` (hoặc `errorHandler.js`)
    -   **Chức năng:** Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng.
    -   **Tính năng chính:**
        -   `errorHandler()`: Bắt và xử lý các lỗi phát sinh trong quá trình xử lý yêu cầu.
        -   Dịch thông báo lỗi sang tiếng Việt.
        -   Xử lý các loại lỗi cụ thể như `PayloadTooLargeError` (lỗi kích thước file), `ValidationError`, `ConflictError`, `UnauthorizedError`, `JsonWebTokenError`.
        -   `notFound()`: Xử lý các yêu cầu đến đường dẫn không tồn tại (404 Not Found).

-   `c:\Project\AuctionSystem\src\middleware\auth.js`
    -   **Chức năng:** Middleware xác thực và phân quyền người dùng.
    -   **Tính năng chính:**
        -   `authenticate()`: Xác thực người dùng bằng JWT token từ header `Authorization`. Giải mã token và gán `req.user`, `req.userId`.
        -   `authorize()`: Kiểm tra xem người dùng có vai trò cần thiết để truy cập một route cụ thể hay không.
        -   `optionalAuth()`: Xác thực người dùng nếu có token, nhưng không báo lỗi nếu không có token hoặc token không hợp lệ (dùng cho các route công khai nhưng muốn biết người dùng đã đăng nhập hay chưa).

-   `c:\Project\AuctionSystem\src\middleware\logger.js`
    -   **Chức năng:** Middleware ghi nhật ký các yêu cầu HTTP.
    -   **Tính năng chính:**
        -   `requestLogger()`: Ghi lại phương thức, đường dẫn của mỗi yêu cầu và thời gian phản hồi.

-   `c:\Project\AuctionSystem\src\middleware\index.js`
    -   **Chức năng:** Tập trung xuất các middleware để dễ dàng import và sử dụng.

---

## 5. Thư mục `src/repositories/` (Tương tác Database)

-   `c:\Project\AuctionSystem\src\repositories\BaseRepository.js`
    -   **Chức năng:** Lớp cơ sở cho tất cả các repository, cung cấp các thao tác CRUD cơ bản và quản lý giao dịch database.
    -   **Tính năng chính:**
        -   `findById()`, `findAll()`, `findByCriteria()`, `count()`: Truy vấn dữ liệu.
        -   `create()`, `update()`, `delete()`: Thao tác dữ liệu.
        -   `beginTransaction()`, `commit()`, `rollback()`: Quản lý giao dịch.
        -   `executeQuery()`: Thực thi truy vấn SQL thô.

-   `c:\Project\AuctionSystem\src\repositories\DatabaseManager.js`
    -   **Chức năng:** Quản lý kết nối đến cơ sở dữ liệu MySQL bằng `mysql2/promise`.
    -   **Tính năng chính:**
        -   `connect()`: Khởi tạo kết nối pool.
        -   `disconnect()`: Đóng kết nối.
        -   `query()`, `execute()`: Thực thi truy vấn.
        -   `createRequest()`: Tạo một đối tượng `DBRequest` để xây dựng và thực thi truy vấn an toàn (sử dụng tham số).

-   `c:\Project\AuctionSystem\src\repositories\RepositoryFactory.js`
    -   **Chức năng:** Áp dụng mẫu thiết kế Factory và Singleton để quản lý việc khởi tạo và cung cấp các instance của Repository.
    -   **Tính năng chính:**
        -   Cung cấp các phương thức tĩnh (`getUserRepository()`, `getProductRepository()`, v.v.) để lấy các instance Repository duy nhất.

-   `c:\Project\AuctionSystem\src\repositories\UserRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến người dùng.
    -   **Tính năng chính:**
        -   `findByEmail()`, `findWithRoles()`, `getUserRoles()`: Tìm kiếm người dùng.
        -   `addRole()`, `removeRole()`: Quản lý vai trò người dùng.
        -   `updateProfile()`, `search()`: Cập nhật và tìm kiếm người dùng.

-   `c:\Project\AuctionSystem\src\repositories\ProductRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến sản phẩm.
    -   **Tính năng chính:**
        -   `findWithDetails()`, `getImages()`, `addImage()`, `deleteImage()`: Quản lý sản phẩm và hình ảnh.
        -   `findBySeller()`, `findBySellerForAuctionCreation()`: Lấy sản phẩm theo người bán (có lọc điều kiện cho tạo đấu giá).
        -   `search()`: Tìm kiếm sản phẩm.

-   `c:\Project\AuctionSystem\src\repositories\AuctionRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến phiên đấu giá.
    -   **Tính năng chính:**
        -   `findWithDetails()`, `findActive()`, `findEnded()`, `findBySeller()`: Truy vấn phiên đấu giá.
        -   `findSoldItemsBySeller()`, `relist()`: Lấy/quản lý các mặt hàng đã bán/đăng lại.
        -   `findParticipatingByUserId()`, `findWonByUserId()`: Lấy đấu giá người dùng đang tham gia/đã thắng.
        -   `findJustEnded()`: Tìm các đấu giá vừa kết thúc (cho cron job).
        -   `updateStatus()`: Cập nhật trạng thái đấu giá và người thắng cuộc.
        -   `search()`: Tìm kiếm đấu giá.

-   `c:\Project\AuctionSystem\src\repositories\BidRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến lượt đặt giá.
    -   **Tính năng chính:**
        -   `findWithBidder()`, `getHighestBid()`, `getAuctionBids()`, `getAuctionBidsWithUserDetails()`: Truy vấn lượt đặt giá.
        -   `getUserBids()`, `hasBid()`, `bidCount()`: Lấy thông tin đặt giá của người dùng.
        -   `findHistoryByUserId()`: Lấy lịch sử đặt giá của người dùng với trạng thái thắng/thua.

-   `c:\Project\AuctionSystem\src\repositories\PaymentRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến thanh toán.
    -   **Tính năng chính:**
        -   `findByTransactionId()`, `getUserPayments()`, `getAuctionPayments()`: Truy vấn thanh toán.
        -   `updateStatus()`, `updateByTransactionId()`: Cập nhật trạng thái thanh toán.

-   `c:\Project\AuctionSystem\src\repositories\ActivityRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến nhật ký hoạt động.

-   `c:\Project\AuctionSystem\src\repositories\CategoryRepository.js`
    -   **Chức năng:** Thao tác database liên quan đến danh mục sản phẩm.

---

## 6. Thư mục `src/routes/` (API Endpoints)

-   `c:\Project\AuctionSystem\src\routes\index.js`
    -   **Chức năng:** File trung tâm để đăng ký tất cả các route API vào ứng dụng Express.

-   `c:\Project\AuctionSystem\src\routes\auth.js`
    -   **Chức năng:** Định nghĩa các endpoint API liên quan đến xác thực người dùng.
    -   **Endpoints:** `/register`, `/login`, `/me`, `/profile`, `/change-password`.

-   `c:\Project\AuctionSystem\src\routes\auction.js`
    -   **Chức năng:** Định nghĩa các endpoint API liên quan đến đấu giá.
    -   **Endpoints:** `/`, `/ended`, `/search`, `/:id`, `/:id/bid`, `/:id/bids`, `/seller/:sellerId`.

-   `c:\Project\AuctionSystem\src\routes\product.js`
    -   **Chức năng:** Định nghĩa các endpoint API liên quan đến sản phẩm.
    -   **Endpoints:** `/`, `/:id`, `/seller/:sellerId`, `/search`.

-   `c:\Project\AuctionSystem\src\routes\bid.js`
    -   **Chức năng:** Định nghĩa endpoint API để lấy lịch sử đặt giá của người dùng.
    -   **Endpoints:** `/` (lấy lịch sử đặt giá của người dùng hiện tại).

-   `c:\Project\AuctionSystem\src\routes\payment.js`
    -   **Chức năng:** Định nghĩa các endpoint API liên quan đến thanh toán.
    -   **Endpoints:** `/history`, `/deposit`, `/ipn` (Momo IPN), `/create`, `/complete`.

-   `c:\Project\AuctionSystem\src\routes\user.js`
    -   **Chức năng:** Định nghĩa các endpoint API dành riêng cho người dùng.
    -   **Endpoints:** `/balance`, `/participating`, `/won-auctions`, `/request-seller`, `/withdraw`, `/bids`, `/transactions`.

-   `c:\Project\AuctionSystem\src\routes\seller.js`
    -   **Chức năng:** Định nghĩa các endpoint API dành riêng cho người bán.
    -   **Endpoints:** `/products`, `/sold-items`, `/auctions`, `/auctions/:id` (DELETE), `/auctions/:id/end`, `/auctions/:id/relist`.

-   `c:\Project\AuctionSystem\src\routes\admin.js`
    -   **Chức năng:** Định nghĩa các endpoint API dành riêng cho quản trị viên.
    -   **Endpoints:** `/stats`, `/users`, `/seller-requests`, `/approve-seller/:id`, `/users/:id` (PUT/DELETE), `/products`, `/products/:id` (GET/DELETE), `/auctions`, `/auctions/:id` (GET/POST), `/categories`, `/categories/:id` (POST/PUT/DELETE).

-   `c:\Project\AuctionSystem\src\routes\category.js`
    -   **Chức năng:** Định nghĩa endpoint API để lấy danh sách danh mục.
    -   **Endpoints:** `/`.

---

## 7. Thư mục `src/services/` (Logic nghiệp vụ)

-   `c:\Project\AuctionSystem\src\services\ServiceFactory.js`
    -   **Chức năng:** Áp dụng mẫu thiết kế Factory và Singleton để quản lý việc khởi tạo và cung cấp các instance của Service.

-   `c:\Project\AuctionSystem\src\services\AuthService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến xác thực và ủy quyền người dùng.
    -   **Tính năng chính:** `register()`, `login()`, `getProfile()`, `updateProfile()`, `changePassword()`, `verifyToken()`.

-   `c:\Project\AuctionSystem\src\services\ProductService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến quản lý sản phẩm.
    -   **Tính năng chính:** `createProduct()`, `getProduct()`, `updateProduct()`, `deleteProduct()`, `addImage()`, `deleteImage()`, `getSellerProducts()`, `getSellerProductsForAuctionCreation()`, `searchProducts()`.

-   `c:\Project\AuctionSystem\src\services\AuctionService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến đấu giá.
    -   **Tính năng chính:** `createAuction()`, `getAuction()`, `getActiveAuctions()`, `getEndedAuctions()`, `getSellerAuctions()`, `searchAuctions()`, `getSoldItemsBySeller()`, `relistAuction()`, `getParticipatingAuctions()`, `getWonAuctions()`, `endAuctionEarly()`, `cancelAuction()`, `getAuctionsToProcess()`, `markAuctionEnded()`.

-   `c:\Project\AuctionSystem\src\services\BiddingService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến đặt giá.
    -   **Tính năng chính:** `placeBid()` (bao gồm kiểm tra ràng buộc và xử lý race condition), `getAuctionBidHistory()`, `getUserBids()`, `getAuctionBidHistoryDetails()`, `getBidHistoryForUser()`, `getHighestBid()`, `getBidCount()`, `hasUserBid()`.

-   `c:\Project\AuctionSystem\src\services\PaymentService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến thanh toán.
    -   **Tính năng chính:** `createPayment()`, `getPayment()`, `updatePaymentStatus()`, `getUserPayments()`, `getAuctionPayments()`, `processRefund()`, `_generateTransactionId()`, `processMomoIpn()`.

-   `c:\Project\AuctionSystem\src\services\WalletService.js`
    -   **Chức năng:** Quản lý logic nghiệp vụ ví tiền của người dùng.
    -   **Tính năng chính:** `getBalanceStats()` (tính toán số dư, thu, chi), `deposit()` (tạo yêu cầu nạp tiền qua Momo), `withdraw()` (xử lý yêu cầu rút tiền), `payForWonAuction()` (tự động thanh toán cho đấu giá đã thắng), `processSale()` (trừ tồn kho sản phẩm sau khi bán), `getTransactions()`.

-   `c:\Project\AuctionSystem\src\services\AdminService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ dành cho quản trị viên.
    -   **Tính năng chính:** `getDashboardStats()`, `getAllUsersWithRoles()`, `updateUserRole()`, `deleteUser()`, `getSellerRequests()`, `approveSellerRequest()`, `getAllProductsForAdmin()`, `getAllAuctionsForAdmin()`, `endAuctionByAdmin()`.

-   `c:\Project\AuctionSystem\src\services\CategoryService.js`
    -   **Chức năng:** Xử lý logic nghiệp vụ liên quan đến danh mục.
    -   **Tính năng chính:** `getAllCategories()`, `createCategory()`, `updateCategory()`, `deleteCategory()`.

-   `c:\Project\AuctionSystem\src\services\SchedulerService.js`
    -   **Chức năng:** Quản lý các tác vụ định kỳ (cron jobs).
    -   **Tính năng chính:** `start()`, `stop()`, `_scheduleProcessEndedAuctions()` (xử lý các phiên đấu giá đã kết thúc).

-   `c:\Project\AuctionSystem\src\services\CacheService.js`
    -   **Chức năng:** Cung cấp một dịch vụ cache đơn giản trong bộ nhớ.
    -   **Tính năng chính:** `get()`, `set()`, `delete()`, `clear()`, `size()`.

---

## 8. Thư mục `src/utils/` (Tiện ích)

-   `c:\Project\AuctionSystem\src\utils\index.js`
    -   **Chức năng:** Tập trung xuất tất cả các hàm tiện ích từ các file con.

-   `c:\Project\AuctionSystem\src\utils\QueryBuilder.js`
    -   **Chức năng:** Lớp tiện ích để xây dựng các truy vấn SQL động một cách an toàn và dễ đọc.
    -   **Tính năng chính:** `select()`, `join()`, `whereEquals()`, `whereLike()`, `whereGreaterThanOrEqual()`, `whereLessThanOrEqual()`, `orderBy()`, `paginate()`, `build()`.

-   `c:\Project\AuctionSystem\src\utils\validator.js`
    -   **Chức năng:** Các hàm tiện ích để xác thực dữ liệu đầu vào.
    -   **Tính năng chính:** `validateEmail()`, `validatePassword()`, `validateName()`, `validatePositiveNumber()`, `validateAmount()`, `validateFutureDate()`, `validateNotEmpty()`, `validateNonEmptyArray()`, `validateRequiredFields()`, `validateFileUpload()`.

-   `c:\Project\AuctionSystem\src\utils\crypto.js`
    -   **Chức năng:** Các hàm tiện ích liên quan đến mã hóa và bảo mật.
    -   **Tính năng chính:** `hashPassword()`, `comparePassword()`, `generateToken()`, `verifyToken()`, `generateRandomToken()`, `hashEmail()`, `generateHMAC()` (cho Momo), `encryptData()`, `decryptData()`, `generateUniqueId()`.

-   `c:\Project\AuctionSystem\src\utils\formatter.js`
    -   **Chức năng:** Các hàm tiện ích để định dạng chuỗi và giá trị.
    -   **Tính năng chính:** `formatCurrency()`, `maskUserName()`, `formatDate()`, `formatTimeRemaining()`, `truncate()`, `capitalize()`, `toSlug()`, `formatVND()`, `parseVND()`, `parseBuffer()` (chuyển đổi Buffer sang Base64).

---

## 9. File `AuctionWebsite.sql`

-   **Chức năng:** Định nghĩa cấu trúc cơ sở dữ liệu MySQL cho toàn bộ hệ thống.
-   **Tính năng chính:**
    -   Tạo các bảng: `Users`, `Roles`, `UserRoles`, `Categories`, `Products`, `ProductImages`, `Auctions`, `Bids`, `Payments`, `Reviews`, `Messages`, `Activities`, `SystemConfig`.
    -   Định nghĩa khóa chính, khóa ngoại, chỉ mục.
    -   Thêm dữ liệu mặc định cho `Roles` và `SystemConfig`.
    -   Định nghĩa các trigger (`update_user_rating`, `increment_bid_count`).
    -   Định nghĩa các view (`AuctionDetails`, `UserWithRoles`).

---

## 10. File `SETUP_MYSQL.md`

-   **Chức năng:** Hướng dẫn chi tiết cách cài đặt và cấu hình môi trường dự án với MySQL.
-   **Tính năng chính:**
    -   Yêu cầu môi trường (Node.js, npm, MySQL).
    -   Hướng dẫn chuẩn bị cơ sở dữ liệu (Laragon, MySQL CLI, phpMyAdmin).
    -   Hướng dẫn cài đặt dependencies (`npm install`).
    -   Hướng dẫn cấu hình file `.env`.
    -   Hướng dẫn khởi động máy chủ và kiểm tra API.
    -   Mô tả cấu trúc file sau cập nhật và các thay đổi chính.
    -   FAQ và hỗ trợ.

---

## 11. File `translate-comments.js`

-   **Chức năng:** Một script tiện ích dùng để tự động dịch các comment trong mã nguồn từ tiếng Anh sang tiếng Việt.
-   **Lưu ý:** Đây là một script hỗ trợ phát triển, không phải là một phần của ứng dụng chạy thực tế.

---

Hy vọng tài liệu này sẽ giúp bạn có cái nhìn rõ ràng và dễ dàng quản lý dự án hơn!