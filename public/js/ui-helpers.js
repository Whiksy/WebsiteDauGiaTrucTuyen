/**
 * ui-helpers.js
 * Chứa các hàm và lớp tiện ích dùng chung cho toàn bộ giao diện người dùng.
 * Mục tiêu: Áp dụng nguyên tắc DRY (Don't Repeat Yourself).
 */

/**
 * Hiển thị thông báo toast
 * @param {string} msg - Nội dung thông báo
 * @param {boolean} isError - Là thông báo lỗi hay thành công
 */
const showNotification = (msg, isError = false) => {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: {
            background: isError ? "#dc3545" : "#28a745"
        }
    }).showToast();
};

/**
 * Định dạng số thành tiền tệ VND
 * @param {number} num - Số cần định dạng
 * @param {boolean} includeCurrencySymbol - Có bao gồm ký hiệu tiền tệ '₫' không
 */
const formatVND = (num, includeCurrencySymbol = true) => {
    try {
        const number = Number(num);
        if (isNaN(number)) return num; // Trả về nguyên nếu không phải số

        if (includeCurrencySymbol) {
            return number.toLocaleString('vi-VN', {
                style: 'currency',
                currency: 'VND',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        } else {
            // Chỉ định dạng số với dấu chấm phân cách hàng nghìn
            return number.toLocaleString('vi-VN');
        }
    } catch (e) {
        return String(num) + (includeCurrencySymbol ? ' ₫' : '');
    }
};

// Chuyển đổi chuỗi VND (ví dụ: "100.000 ₫") thành số
const parseVND = (str) => {
    if (!str) return 0;
    return Number(str.replace(/[^0-9]/g, ''));
};

/**
 * Xử lý đăng xuất
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
}

/**
 * Lớp WalletUI (OOP)
 * Quản lý tất cả các tương tác liên quan đến ví tiền trên giao diện.
 */
class WalletUI {
    constructor(token) {
        this.token = token;
        this.depositForm = document.getElementById('depositForm');
        this.withdrawForm = document.getElementById('withdrawForm');
    }

    /**
     * Khởi tạo các event listeners cho form nạp và rút tiền.
     */
    init() {
        if (this.depositForm) {
            this.depositForm.addEventListener('submit', this._handleDepositSubmit.bind(this));
        }
        if (this.withdrawForm) {
            this.withdrawForm.addEventListener('submit', this._handleWithdrawSubmit.bind(this));
        }
    }

    async _handleDepositSubmit(e) {
        e.preventDefault();
        const amountRaw = e.target.querySelector('#depositAmount').value;
        const amount = parseVND(amountRaw); // Lọc bỏ dấu chấm nếu có
        const btn = e.target.querySelector('button');
        
        if (!amount || amount < 1000 || amount > 1000000000) {
            showNotification('Số tiền nạp phải từ 1.000đ đến 1.000.000.000đ', true);
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

        try {
            const response = await fetch('/api/payments/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ amount })
            });
            const data = await response.json();
            if (response.ok && data.payUrl) {
                window.location.href = data.payUrl;
            } else {
                showNotification(data.message || 'Lỗi tạo giao dịch', true);
            }
        } catch (err) {
            showNotification('Lỗi kết nối', true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Tiếp tục thanh toán Momo';
        }
    }

    async _handleWithdrawSubmit(e) {
        e.preventDefault();
        const amountRaw = e.target.querySelector('#withdrawAmount').value;
        const amount = parseVND(amountRaw); // Lọc bỏ dấu chấm
        const momoPhoneNumber = e.target.querySelector('#momoPhoneNumber').value;
        const btn = e.target.querySelector('button');

        if (!amount || amount < 10000) {
            showNotification('Số tiền rút tối thiểu là 10.000đ', true);
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

        try {
            const response = await fetch('/api/user/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ amount, momoPhoneNumber })
            });
            const data = await response.json();
            showNotification(data.message || 'Yêu cầu đã được gửi', !response.ok);
            if (response.ok) {
                // Sử dụng e.target.closest('.modal') để tìm modal cha của form
                bootstrap.Modal.getInstance(e.target.closest('.modal')).hide();
                e.target.reset();
                // Thông báo cho các trang khác cập nhật lại ví
                window.dispatchEvent(new CustomEvent('walletUpdate'));
            }
        } catch (err) {
            showNotification('Lỗi kết nối khi thực hiện rút tiền', true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Xác nhận rút tiền';
        }
    }
}

/**
 * Lớp ProfileUI (OOP)
 * Quản lý các tương tác liên quan đến hồ sơ người dùng (cập nhật, đổi mật khẩu).
 */
class ProfileUI {
    constructor(token) {
        this.token = token;
        this.form = document.getElementById('editProfileForm');
        this.passwordForm = document.getElementById('changePasswordForm');
        this.modalElement = document.getElementById('editProfileModal');
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', this._handleSubmit.bind(this));
        }
        if (this.passwordForm) {
            this.passwordForm.addEventListener('submit', this._handleChangePassword.bind(this));
        }
        if (this.modalElement) {
            this.modalElement.addEventListener('show.bs.modal', this._populateForm.bind(this));
        }
        const avatarInput = document.getElementById('editProfileAvatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', this._previewAvatar.bind(this));
        }
    }

    _populateForm() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const currentUser = JSON.parse(userStr);
            document.getElementById('editProfileName').value = currentUser.name || '';

            const passInput = document.getElementById('editProfilePassword');
            const confirmInput = document.getElementById('editProfileConfirmPassword');
            if (passInput) passInput.value = '';
            if (confirmInput) confirmInput.value = '';

            document.getElementById('editProfileAvatar').value = '';
            document.getElementById('editProfilePreview').src = currentUser.avatar || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==';
        }
    }

    _previewAvatar(e) {
        const fileInput = e.target;
        if (fileInput.files && fileInput.files[0]) {
            document.getElementById('editProfilePreview').src = URL.createObjectURL(fileInput.files[0]);
        }
    }

    async _handleSubmit(e) {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang lưu...';
        btnSubmit.disabled = true;
        
        const name = document.getElementById('editProfileName').value;
        
        const passInput = document.getElementById('editProfilePassword');
        const confirmInput = document.getElementById('editProfileConfirmPassword');
        const password = passInput ? passInput.value : '';
        const confirmPassword = confirmInput ? confirmInput.value : '';

        if (password && password !== confirmPassword) {
            showNotification('Mật khẩu xác nhận không khớp', true);
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
            return;
        }
        
        const fileInput = document.getElementById('editProfileAvatar');
        const submitUpdate = async (avatarBase64 = null) => {
            try {
                const payload = { name };
                if (password) payload.password = password;
                if (avatarBase64) payload.avatar = avatarBase64;

                const response = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }, body: JSON.stringify(payload) });
                const data = await response.json();
                if (response.ok) {
                    showNotification('Cập nhật hồ sơ thành công');
                    bootstrap.Modal.getInstance(this.modalElement)?.hide();
                    window.dispatchEvent(new CustomEvent('profileUpdate', { detail: data.data }));
                } else { showNotification(data.message || 'Cập nhật thất bại', true); }
            } catch (err) { showNotification('Lỗi cập nhật hồ sơ', true); } 
            finally { btnSubmit.innerHTML = originalBtnText; btnSubmit.disabled = false; }
        };

        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onloadend = () => submitUpdate(reader.result);
            reader.readAsDataURL(fileInput.files[0]);
        } else { submitUpdate(null); }
    }

    async _handleChangePassword(e) {
        e.preventDefault();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            showNotification('Mật khẩu mới không khớp!', true);
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang đổi...';

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ oldPassword, newPassword })
            });
            const data = await res.json();
            showNotification(data.message, !res.ok);
            if (res.ok) {
                e.target.reset();
            }
        } catch (err) {
            showNotification('Lỗi kết nối server!', true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Đổi mật khẩu';
        }
    }
}

/**
 * Lớp BidModalUI (OOP)
 * Quản lý logic của Modal Đặt giá (hiển thị, format số, gửi API) dùng chung cho nhiều trang.
 */
class BidModalUI {
    constructor(token) {
        this.token = token;
        this.modalElement = document.getElementById('bidModal');
        if (this.modalElement) {
            this.modalInstance = new bootstrap.Modal(this.modalElement);
        }
        this.form = document.getElementById('bidForm');
        this.input = document.getElementById('bidAmountInput');
        this.auctionIdInput = document.getElementById('bidAuctionId');
        this.errorText = document.getElementById('bidErrorText');
    }

    init() {
        if (this.input) {
            this.input.setAttribute('type', 'text');
            this.input.setAttribute('inputmode', 'numeric');

            this.input.addEventListener('input', (e) => {
                if (e.isComposing) return; // Chặn format lúc bàn phím đang ghép chữ
                this._formatInput(this.input);
            });

            this.input.addEventListener('compositionend', () => {
                this._formatInput(this.input); // Áp dụng ngay khi ghép chữ xong
            });
        }

        if (this.form) {
            this.form.addEventListener('submit', this._handleSubmit.bind(this));
        }
    }

    _formatInput(input) {
        let originalValue = input.value;
        let rawValue = originalValue.replace(/[^0-9]/g, ''); 
        
        if (rawValue) {
            let formattedValue = parseInt(rawValue, 10).toLocaleString('vi-VN');
            if (originalValue !== formattedValue) {
                let caretPosFromEnd = originalValue.length - input.selectionEnd;
                input.value = formattedValue;
                let newCursorPos = formattedValue.length - Math.max(0, caretPosFromEnd);
                input.setSelectionRange(newCursorPos, newCursorPos);
            }
        } else {
            input.value = '';
        }
    }

    async open(auctionId) {
        this.token = localStorage.getItem('token'); // Lấy token mới nhất
        if (!this.token) {
            showNotification('Vui lòng đăng nhập để đặt giá', true);
            const loginModal = document.getElementById('loginModal');
            if (loginModal) new bootstrap.Modal(loginModal).show();
            return;
        }

        this.auctionIdInput.value = auctionId;
        this.errorText.textContent = ''; 
        this.input.value = ''; 
        this.input.placeholder = '0'; 

        try {
            const response = await fetch(`/api/auctions/${auctionId}`);
            if (!response.ok) throw new Error('Không thể tải thông tin đấu giá');
            const json = await response.json();
            const auction = json.data;

            const currentBid = Number((auction.currentBid ?? auction.current_price) || 0);
            const startingPrice = Number((auction.startingPrice ?? auction.starting_price) || 0);
            const minBidIncrement = Number((auction.minBidIncrement ?? auction.min_bid_increment) || 0);
            const highestBidderId = auction.highest_bidder_id;

            let minimumBid = startingPrice;
            if (highestBidderId) minimumBid = currentBid + minBidIncrement;

            document.getElementById('bidModalTitle').textContent = `Đặt giá cho: ${auction.productName}`;
            document.getElementById('bidProductName').textContent = auction.productName;
            document.getElementById('bidCurrentPrice').textContent = formatVND(currentBid);
            document.getElementById('bidMinIncrement').textContent = formatVND(minBidIncrement);
            this.errorText.innerHTML = `<span class="text-muted small"><i class="fas fa-info-circle"></i> Giá đặt tối thiểu: <strong class="text-primary">${formatVND(minimumBid)}</strong></span>`;

            this.modalInstance.show();
        } catch (e) {
            showNotification(e.message || 'Lỗi tải thông tin đấu giá', true);
        }
    }

    async _handleSubmit(e) {
        e.preventDefault();
        const auctionId = this.auctionIdInput.value;
        const bidAmountRaw = this.input.value;
        const bidAmount = parseVND(bidAmountRaw); 

        if (!bidAmount || bidAmount <= 0) {
            showNotification('Vui lòng nhập giá đặt hợp lệ', true);
            return;
        }

        try {
            const response = await fetch(`/api/auctions/${auctionId}/bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ bidAmount: Number(bidAmount) })
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message);
                this.modalInstance.hide();
                // Phóng sự kiện để các trang tự động update data của nó
                window.dispatchEvent(new CustomEvent('bidUpdateSuccess'));
            } else {
                showNotification(data.message || 'Đặt giá thất bại', true);
            }
        } catch (e) {
            showNotification('Lỗi khi đặt giá', true);
        }
    }
}