        const socket = io();
        let token = localStorage.getItem('token');
        
        // Hàm cập nhật giao diện Login/Logout
        function updateAuthUI() {
            const authArea = document.getElementById('authButtonArea');
            const userStr = localStorage.getItem('user');
            token = localStorage.getItem('token');
            
            if (token && userStr) {
                const user = JSON.parse(userStr);
                const roles = user.roles || [];
                
                // Tạo menu dropdown cho người dùng
                let menuItems = '';
                if (roles.includes('User')) {
                    menuItems += `<li><a class="dropdown-item" href="/user.html">Hồ sơ & Đấu giá</a></li>`;
                }
                
                if (roles.includes('Seller')) {
                    menuItems += `<li><a class="dropdown-item fw-bold text-primary" href="/seller.html">Kênh người bán</a></li>`;
                }
                if (roles.includes('Admin')) {
                    menuItems += `<li><a class="dropdown-item fw-bold text-danger" href="/admin.html">Trang quản trị</a></li>`;
                }

                authArea.innerHTML = `
                    <div class="dropdown ms-3">
                        <button class="btn btn-outline-light dropdown-toggle text-dark border-0" type="button" data-bs-toggle="dropdown">
                            <img src="${user.avatar || 'https://via.placeholder.com/30'}" class="rounded-circle me-1" style="width: 30px; height: 30px; object-fit: cover;">
                            ${user.name}
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            ${menuItems}
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="logout()">Đăng xuất</a></li>
                        </ul>
                    </div>`;
            } else {
                // Nếu chưa: Hiện nút Đăng nhập
                authArea.innerHTML = `<button class="btn btn-primary ms-3" data-bs-toggle="modal" data-bs-target="#loginModal">Đăng nhập</button>`;
            }
        }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            token = null;
            updateAuthUI();
            loadAuctions(); // Bổ sung: Render lại danh sách để hiển thị nút Đặt Giá
            showNotification('Đã đăng xuất thành công');
        }

        function checkStartAction() {
            if (token) {
                document.getElementById('auctions').scrollIntoView({behavior: 'smooth'});
            } else {
                // Mở modal login bằng Bootstrap 5 JS thuần
                new bootstrap.Modal(document.getElementById('loginModal')).show();
            }
        }
    // Lọc danh mục    
    async function loadCategoriesForFilter() {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) {
                const json = await res.json();
                const select = document.getElementById('categoryFilter');
                const categories = json.data || [];
                
                categories.forEach(c => {
                    select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                });
            }
        } catch (e) {
            console.error('Lỗi tải danh mục', e);
        }
    }

        // --- LOAD DỮ LIỆU ĐẤU GIÁ ---
        async function loadAuctions() {
            console.log('Loading auctions...');
            try {
                // Lấy giá trị từ bộ lọc
                const q = document.getElementById('searchInput')?.value || '';
                const min = document.getElementById('minPrice')?.value || '';
                const max = document.getElementById('maxPrice')?.value || '';
                const category = document.getElementById('categoryFilter')?.value || '';

                // Tạo query string
                const params = new URLSearchParams();
                if (q) params.append('q', q);
                if (min) params.append('minPrice', min);
                if (max) params.append('maxPrice', max);
                if (category) params.append('category', category);

                const response = await fetch(`/api/auctions/search?${params.toString()}`);
                const result = await response.json();
                let auctions = result.data || result; 
                
                // LỌC Ở FRONTEND: Kiểm tra xem người dùng có muốn xem đấu giá đã kết thúc không
                const showEnded = document.getElementById('showEndedAuctions')?.checked;
                if (!showEnded) {
                    auctions = auctions.filter(a => (a.status || '').toUpperCase() === 'ACTIVE');
                }
                
                const container = document.getElementById('auctionList');
                container.innerHTML = '';
                
                // Lấy thông tin user hiện tại để kiểm tra nút bấm
                const userStr = localStorage.getItem('user');
                const currentUserObj = userStr ? JSON.parse(userStr) : null;
                const currentUserId = currentUserObj ? currentUserObj.id : null;
                
                const template = document.getElementById('auction-card-template');

                auctions.forEach(auction => {
                    const currentBid = auction.currentBid ?? auction.current_price;
                    const highestBidder = auction.highestBidderName ?? auction.topBidder ?? 'Chưa có';
                    
                    // Clone template để đảm bảo không bị XSS Attack
                    const clone = template.content.cloneNode(true);
                    
                    const card = clone.querySelector('.auction-item');
                    card.setAttribute('data-id', auction.id);
                    
                    const img = clone.querySelector('.item-img');
                    img.src = auction.productImage || 'https://via.placeholder.com/300x200/eee/aaa?text=No+Image';
                    img.alt = auction.productName;
                    img.onclick = () => viewPublicAuctionDetails(auction.id);
                    img.onerror = function() { this.src='https://via.placeholder.com/300x200/eee/aaa?text=Error'; };
                    
                    if (auction.reservePrice) {
                        clone.querySelector('.item-badges').innerHTML = `<span class="badge bg-warning text-dark shadow-sm"><i class="fas fa-bolt"></i> Mua đứt: ${formatVND(auction.reservePrice)}</span>`;
                    }
                    
                    clone.querySelector('.item-title').textContent = auction.productName || 'Sản phẩm'; // textContent chống XSS
                    clone.querySelector('.countdown-timer').setAttribute('data-endtime', auction.endTime);
                    clone.querySelector('.item-price').textContent = formatVND(currentBid);
                    clone.querySelector('.item-bidder').textContent = highestBidder;
                    
                    const actionArea = clone.querySelector('.item-action-area');
                    if ((auction.status || '').toUpperCase() === 'ACTIVE') {
                        if (currentUserId && currentUserId === auction.productSellerId) actionArea.innerHTML = `<button class="btn btn-secondary w-100" disabled><i class="fas fa-ban"></i> Sản phẩm của bạn</button>`;
                        else actionArea.innerHTML = `<button class="btn btn-primary w-100" onclick="window.bidModalUI.open(${auction.id})">Đặt giá ngay</button>`;
                    } else if ((auction.status || '').toUpperCase() === 'PROCESSING') {
                        actionArea.innerHTML = `<button class="btn btn-warning w-100" disabled><i class="fas fa-cog fa-spin"></i> Đang xử lý</button>`;
                    } else {
                        actionArea.innerHTML = `<button class="btn btn-secondary w-100" disabled>Đã kết thúc</button>`;
                    }
                    
                    container.appendChild(clone);
                });
            } catch (e) {
                console.error('Load auctions error', e);
            }
        }

        // --- LOGIC ĐẾM NGƯỢC THỜI GIAN VÀ KHÓA NÚT KHẮP TRANG CHỦ ---
        function startGlobalCountdown() {
            setInterval(() => {
                document.querySelectorAll('.countdown-timer').forEach(el => {
                    const end = new Date(el.getAttribute('data-endtime')).getTime();
                    const now = new Date().getTime();
                    const distance = end - now;
                    if (distance < 0) {
                        if (el.textContent !== 'Đã kết thúc') {
                            el.textContent = 'Đã kết thúc';
                            el.classList.replace('text-danger', 'text-muted');
                            const card = el.closest('.auction-item');
                            if (card) {
                                const btn = card.querySelector('button');
                                if (btn && !btn.disabled && !btn.textContent.includes('Sản phẩm của bạn')) {
                                    btn.disabled = true;
                                    btn.className = 'btn btn-secondary w-100';
                                    btn.innerHTML = 'Đã kết thúc';
                                }
                            }
                        }
                    } else {
                        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        el.textContent = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m ${seconds}s`;
                    }
                });
            }, 1000);
        }

        // --- BỔ SUNG: XEM CHI TIẾT ẢNH SẢN PHẨM TRÊN TRANG CHỦ ---
        window.viewPublicAuctionDetails = async function(id) {
            try {
                const res = await fetch(`/api/auctions/${id}`);
                const data = await res.json();
                const auction = data.data;

                let modalEl = document.getElementById('publicAuctionModal');
                if (!modalEl) {
                    modalEl = document.createElement('div');
                    modalEl.className = 'modal fade';
                    modalEl.id = 'publicAuctionModal';
                    modalEl.innerHTML = `
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title fw-bold text-primary" id="publicModalTitle"></h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body p-0">
                                    <div id="publicCarousel" class="carousel slide" data-bs-ride="carousel">
                                        <div class="carousel-inner bg-dark" id="publicCarouselInner"></div>
                                        <button class="carousel-control-prev" type="button" data-bs-target="#publicCarousel" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
                                        <button class="carousel-control-next" type="button" data-bs-target="#publicCarousel" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
                                    </div>
                                    <div class="p-3 bg-light" id="publicModalDesc" style="white-space: pre-line;"></div>
                                </div>
                            </div>
                        </div>`;
                    document.body.appendChild(modalEl);
                }
                document.getElementById('publicModalTitle').textContent = auction.productName;
                document.getElementById('publicModalDesc').textContent = auction.productDescription || 'Chưa có thông tin mô tả.';
                
                const carouselInner = document.getElementById('publicCarouselInner');
                carouselInner.innerHTML = (auction.images && auction.images.length > 0) 
                    ? auction.images.map((img, idx) => `<div class="carousel-item ${idx===0?'active':''}"><img src="${img}" class="d-block w-100 object-fit-contain" style="height: 450px;"></div>`).join('')
                    : `<div class="carousel-item active"><img src="${auction.productImage}" class="d-block w-100 object-fit-cover" style="height: 450px;"></div>`;
                
                new bootstrap.Modal(modalEl).show();
            } catch (e) { showNotification('Không thể tải chi tiết', true); }
        };

        // --- XỬ LÝ ĐĂNG NHẬP (QUAN TRỌNG) ---
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                const payload = data.data; // Dữ liệu thực sự nằm bên trong data.data

                if (response.ok && payload && payload.token) {
                    // 1. Ghi đè token mới (Xóa sạch nghi ngờ về dữ liệu cũ)
                    localStorage.setItem('token', payload.token);
                    localStorage.setItem('user', JSON.stringify(payload));
                    
                    showNotification('Đăng nhập thành công');
                    
                    // 2. Đóng Modal (Dùng Bootstrap 5 Standard - FIX LỖI)
                    const modalElement = document.getElementById('loginModal');
                    const modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstance) modalInstance.hide();

                    // 3. Cập nhật giao diện
                    updateAuthUI();
                    loadAuctions(); // Bổ sung: Đồng bộ trạng thái ngay lập tức

                    // 4. Kiểm tra quyền và Chuyển hướng
                    const roles = payload.roles || [];
                    console.log('User Roles:', roles);

                    setTimeout(() => {
                        if (roles.includes('Admin')) {
                            window.location.href = '/admin.html';
                        }
                        // Seller và User sẽ ở lại trang chủ, menu Dropdown đã được cập nhật
                    }, 100); // Delay 1s để user thấy thông báo
                } else {
                    showNotification(data.message || 'Đăng nhập thất bại', true);
                }
            } catch (e) {
                console.error(e);
                showNotification('Lỗi kết nối server', true);
            }
        });

        // --- XỬ LÝ ĐĂNG KÝ ---
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const avatarFile = document.getElementById('regAvatar').files[0];

            const submitRegistration = async (avatarBase64 = null) => {
                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: document.getElementById('regName').value,
                            email: document.getElementById('regEmail').value,
                            password: document.getElementById('regPassword').value,
                            role: document.getElementById('regRole').value,
                            avatar: avatarBase64
                        })
                    });
                    const data = await response.json();
                    
                    if (response.ok) {
                        showNotification('Đăng ký thành công! Vui lòng đăng nhập.');
                        // Chuyển sang modal đăng nhập
                        const regModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                        regModal.hide();
                        new bootstrap.Modal(document.getElementById('loginModal')).show();
                    } else {
                        showNotification(data.message || data.error || 'Đăng ký thất bại', true);
                    }
                } catch (e) {
                    console.error(e);
                    showNotification('Lỗi kết nối server', true);
                }
            };

            // Nếu có ảnh, chuyển sang Base64 rồi mới gửi
            if (avatarFile) {
                const reader = new FileReader();
                reader.onloadend = () => submitRegistration(reader.result);
                reader.readAsDataURL(avatarFile);
            } else {
                submitRegistration(null);
            }
        });

        // --- XỬ LÝ QUÊN MẬT KHẨU ---
        document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            const btn = e.target.querySelector('button');
            
            btn.disabled = true;
            btn.textContent = 'Đang gửi...';

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                showNotification(data.message, !response.ok);
                if (response.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal')).hide();
                }
            } catch (e) {
                showNotification('Lỗi kết nối server', true);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Gửi yêu cầu';
            }
        });

        // --- XỬ LÝ ĐẶT LẠI MẬT KHẨU (Khi có token trên URL) ---
        document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('resetToken');
            const newPassword = document.getElementById('newResetPassword').value;
            const confirmPassword = document.getElementById('confirmResetPassword').value;

            if (newPassword !== confirmPassword) {
                showNotification('Mật khẩu xác nhận không khớp', true);
                return;
            }

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                });
                const data = await response.json();
                showNotification(data.message, !response.ok);
                if (response.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
                    // Xóa token khỏi URL để sạch đẹp
                    window.history.replaceState({}, document.title, "/");
                    // Mở modal đăng nhập
                    new bootstrap.Modal(document.getElementById('loginModal')).show();
                }
            } catch (e) {
                showNotification('Lỗi kết nối server', true);
            }
        });

        // Socket events
        socket.on('bidUpdate', (data) => {
            // TỐI ƯU: Chỉ cập nhật DOM, TUYỆT ĐỐI KHÔNG GỌI loadAuctions() ở đây
            const card = document.querySelector(`.auction-item[data-id="${data.auctionId}"]`);
            if (card) {
                const priceEl = card.querySelector('.price-text');
                const bidderEl = card.querySelector('.bidder-text');
                if (priceEl) priceEl.innerHTML = `Giá hiện tại: <strong class="text-danger">${formatVND(data.bidAmount)}</strong>`;
                if (bidderEl) bidderEl.innerHTML = `Người dẫn đầu: ${data.bidderName || 'Khách'}`;
            }
        });

        socket.on('auctionEnded', (data) => {
            const card = document.querySelector(`.auction-item[data-id="${data.auctionId}"]`);
            if (card) {
                const btn = card.querySelector('button');
                if (btn) {
                    btn.className = 'btn btn-secondary w-100';
                    btn.disabled = true;
                    btn.innerHTML = 'Đã kết thúc';
                }
            }
        });

        socket.on('newAuction', (data) => {
            showNotification(`Một phiên đấu giá mới vừa bắt đầu!`, false);
            setTimeout(loadAuctions, 2000); // Trì hoãn nhẹ 2s rồi mới load để phân tải
        });

        // Init page
        document.addEventListener('DOMContentLoaded', () => {
            loadCategoriesForFilter();
            loadAuctions();
            startGlobalCountdown();

            window.bidModalUI = new BidModalUI(token);
            window.bidModalUI.init();
            window.addEventListener('bidUpdateSuccess', () => loadAuctions());
            
            const urlParams = new URLSearchParams(window.location.search);

            // --- 1. XỬ LÝ ĐĂNG NHẬP GOOGLE ---
            if (urlParams.has('token')) {
                const token = urlParams.get('token');
                localStorage.setItem('token', token);
                
                // Gọi API lấy thông tin user để lưu vào localStorage (cần thiết cho updateAuthUI)
                fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(response => {
                    // Trích xuất dữ liệu thực tế từ response.data
                    const user = response.data || response;
                    
                    localStorage.setItem('user', JSON.stringify(user));
                    updateAuthUI();
                    showNotification(`Đăng nhập thành công! Xin chào ${user.name}`);
                    
                    // Xóa token trên thanh địa chỉ để nhìn gọn gàng hơn
                    window.history.replaceState({}, document.title, "/");

                    // Chuyển hướng vào trang User (hoặc trang tương ứng với Role)
                    setTimeout(() => {
                        if (user.roles && user.roles.includes('Admin')) window.location.href = '/admin.html';
                    }, 1000);
                })
                .catch(err => console.error('Lỗi lấy thông tin user:', err));
            } else {
                updateAuthUI(); // Kiểm tra token cũ trong localStorage
            }

            // --- 2. XỬ LÝ RESET PASSWORD ---
            if (urlParams.has('resetToken')) {
                const resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
                resetModal.show();
            }
        });