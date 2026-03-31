const socket = io();
let token = localStorage.getItem('token');
let currentUser = null;

// Check authentication and role
if (!token) {
    window.location.href = '/';
}

// Navigation Logic
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('d-none'));
    document.getElementById(`${sectionId}-section`).classList.remove('d-none');
    
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(el => el.getAttribute('onclick').includes(sectionId));
    if(activeLink) activeLink.classList.add('active');
}

// Check if user has User role
async function checkUserRole() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const json = await response.json();
            const userData = json.data || json;
            const roles = userData.roles || [];
            if (!roles.includes('User')) {
                showNotification('Bạn không có quyền truy cập trang này', true);
                setTimeout(() => window.location.href = '/', 2000);
                return null;
            }
            return userData;
        } else {
            logout();
            return null;
        }
    } catch (e) {
        console.error('Role check error:', e);
        logout();
        return null;
    }
}

// Load user data
async function loadUserData(userData) {
    if (userData) {
        currentUser = userData;
        updateSidebarInfo();
        updateUserUI();
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const json = await response.json();
            currentUser = json.data || json;
            updateSidebarInfo();
            updateUserUI();
        } else {
            console.error('Failed to load user data:', response.status);
            showNotification('Không thể tải thông tin người dùng', true);
        }
    } catch (e) {
        console.error('Load user data error:', e);
        showNotification('Lỗi tải thông tin người dùng', true);
    }
}

function updateSidebarInfo() {
    document.getElementById('navName').textContent = currentUser.name || 'User';
    if (currentUser.avatar) {
        document.getElementById('navAvatar').src = currentUser.avatar;
    }
}

function updateUserUI() {
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = currentUser.email || '';
    
    const userFullNameEl = document.getElementById('userFullName');
    if (userFullNameEl) userFullNameEl.textContent = currentUser.name || '';
    
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar && currentUser.avatar) {
        profileAvatar.src = currentUser.avatar;
    }

    loadWalletBalance();
    socket.emit('joinUser', currentUser.id);
}

// --- WALLET LOGIC ---
async function loadWalletBalance() {
    try {
        const response = await fetch(`/api/user/balance?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const json = await response.json();
            const data = json.data || json;
            document.getElementById('statBalance').textContent = formatVND(data.balance || 0);
            document.getElementById('walletBalanceBig').textContent = formatVND(data.balance || 0);
            
            // Cập nhật thống kê thu chi
            const incomeEl = document.getElementById('statIncome');
            const expenseEl = document.getElementById('statExpense');
            if (incomeEl) incomeEl.textContent = formatVND(data.totalIncome || 0);
            if (expenseEl) expenseEl.textContent = formatVND(data.totalExpense || 0);
        }
    } catch (e) { console.error('Load balance error:', e); }
}

// Load Participating Auctions
async function loadParticipating() {
    try {
        const response = await fetch(`/api/user/participating?t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await response.json();
        const auctions = json.data || json;
        const container = document.getElementById('participatingList');
        container.innerHTML = '';
        
        if (auctions.length === 0) {
            container.innerHTML = '<div class="col-12"><p class="text-muted">Bạn chưa tham gia phiên đấu giá nào. Hãy ra trang chủ để tìm kiếm sản phẩm nhé!</p></div>';
            document.getElementById('statParticipating').textContent = 0;
            return;
        }

        auctions.forEach(auction => {
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-4 fade-in';
            col.innerHTML = `
                <div class="card h-100 shadow-sm border-0 auction-card" data-id="${auction.id}">
                    <div class="position-relative">
                        <img class="card-img-top object-fit-cover item-img" style="height: 200px;">
                        <div class="position-absolute top-0 end-0 p-2">
                            <span class="badge bg-danger shadow-sm"><i class="fas fa-clock"></i> <span class="countdown" id="time-${auction.id}">...</span></span>
                        </div>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-truncate mb-3 item-title"></h5>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-muted small">Giá hiện tại:</span>
                            <strong class="text-primary fs-5 current-price-el"></strong>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="text-muted small">Dẫn đầu:</span>
                            <span class="top-bidder-el"></span>
                        </div>
                        <button class="btn btn-outline-primary w-100 mt-auto" onclick="window.bidModalUI.open(${auction.id})">
                            <i class="fas fa-gavel"></i> Đặt giá tiếp
                        </button>
                    </div>
                </div>
            `;
            
            const imgEl = col.querySelector('.item-img');
            imgEl.src = auction.image || '';
            imgEl.alt = auction.productName;
            imgEl.onerror = function() { this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCBmaWxsPSIjZWVlIiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjNlbSIgZmlsbD0iIzU1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9ImFyaWFsIiBmb250LXNpemU9IjI0Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='; };
            
            const titleEl = col.querySelector('.item-title');
            titleEl.title = auction.productName;
            titleEl.textContent = auction.productName;
            col.querySelector('.current-price-el').textContent = formatVND(auction.currentBid);
            
            if (auction.isWinning) {
                col.querySelector('.top-bidder-el').innerHTML = '<span class="badge bg-success"><i class="fas fa-crown"></i> Bạn</span>';
            } else {
                col.querySelector('.top-bidder-el').innerHTML = `<span class="fw-medium bidder-name"></span>`;
                col.querySelector('.bidder-name').textContent = auction.topBidder;
            }
            
            container.appendChild(col);
            startCountdown(auction.id, auction.endTime);
        });
        document.getElementById('statParticipating').textContent = auctions.length;
    } catch (e) {
        console.error('Load auctions error', e);
    }
}

function startCountdown(auctionId, endTime) {
    const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const distance = end - now;

        if (distance < 0) {
            document.getElementById(`time-${auctionId}`).textContent = 'Đã kết thúc';
            const card = document.querySelector(`.auction-card[data-id="${auctionId}"]`);
            if (card) {
                const btn = card.querySelector('button');
                if (btn && !btn.disabled) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-ban"></i> Đã kết thúc';
                    btn.className = 'btn btn-secondary w-100 mt-auto';
                }
            }
            clearInterval(timer);
        } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            document.getElementById(`time-${auctionId}`).textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }, 1000);
}

async function requestSellerUpgrade() {
    if (!confirm('Bạn có chắc muốn đăng ký trở thành Người bán (Seller)?\nYêu cầu sẽ được gửi đến Admin phê duyệt.')) return;
    try {
        const response = await fetch('/api/user/request-seller', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok) { showNotification(data.message); } 
        else { showNotification(data.message || 'Gửi yêu cầu thất bại', true); }
    } catch (e) { showNotification('Lỗi kết nối server', true); }
}

async function loadWonAuctions() {
    try {
        const response = await fetch(`/api/user/won-auctions?t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await response.json();
        const auctions = json.data || json;
        const container = document.getElementById('wonList');
        container.innerHTML = '';
        document.getElementById('statWon').textContent = auctions.length;

        if (auctions.length === 0) {
            container.innerHTML = '<div class="col-12"><p class="text-muted">Bạn chưa thắng phiên đấu giá nào.</p></div>';
            return;
        }
        auctions.forEach(a => {
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-4 fade-in';
            let headerClass = 'warning', headerText = 'Chờ xử lý', buttonHtml = `<button class="btn btn-warning w-100" disabled><span class="spinner-border spinner-border-sm"></span> Đang xử lý</button>`, footerText = `<p class="small text-muted">Hệ thống sẽ tự động trừ tiền từ ví của bạn.</p>`;
            
            if (a.paymentStatus === 'SUCCESS' || a.paymentStatus === 'Paid') { 
                headerClass = 'success'; headerText = 'Đã thanh toán'; buttonHtml = '<button class="btn btn-success w-100" disabled><i class="fas fa-check"></i> Hoàn tất</button>'; footerText = ''; 
            } else if (a.paymentStatus === 'FAILED' || a.paymentStatus === 'PaymentFailed') { 
                headerClass = 'danger'; headerText = 'Thanh toán thất bại'; 
                buttonHtml = `<button class="btn btn-danger w-100" onclick="retryPayment(${a.id})"><i class="fas fa-redo"></i> Thanh toán lại</button>`; 
                footerText = `<p class="small text-danger">Số dư không đủ. Vui lòng nạp tiền vào ví.</p>`; 
            }

            col.innerHTML = `
                <div class="card border-${headerClass} h-100">
                    <div class="card-header bg-${headerClass} ${headerClass === 'warning' ? 'text-dark' : 'text-white'}">${headerText}</div>
                    <img class="card-img-top item-img" style="height: 200px; object-fit: cover;">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-truncate item-title"></h5>
                        <p>Giá thắng: <strong class="item-price"></strong></p>
                        <p class="small text-muted">Người bán: <span class="item-seller"></span></p>
                        <div class="mt-auto">${footerText}${buttonHtml}</div>
                    </div>
                </div>`;
                
            const imgEl = col.querySelector('.item-img');
            imgEl.src = a.image || '';
            imgEl.onerror = function() { this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNTU1Ij5Ob24tSW1hZ2U8L3RleHQ+PC9zdmc+'; };
            
            col.querySelector('.item-title').textContent = a.productName;
            col.querySelector('.item-price').textContent = formatVND(a.winningPrice);
            col.querySelector('.item-seller').textContent = a.sellerName;
            
            container.appendChild(col);
        });
    } catch (e) { console.error('Load won auctions error', e); }
}

async function retryPayment(auctionId) {
    try {
        const res = await fetch(`/api/payments/retry-auction/${auctionId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            showNotification('Thanh toán thành công!');
            loadWonAuctions();
            loadWalletBalance();
            loadTransactions();
        } else {
            showNotification(data.message || 'Thanh toán thất bại', true);
        }
    } catch (e) { showNotification('Lỗi kết nối', true); }
}

async function loadBidHistory() {
    try {
        const response = await fetch(`/api/user/bids?t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await response.json();
        const bids = json.data || json;
        const tbody = document.getElementById('recentBidsBody');
        tbody.innerHTML = '';
        bids.slice(0, 10).forEach(bid => {
            const row = document.createElement('tr');
            row.innerHTML = `<td class="bid-name"></td><td class="fw-bold text-primary bid-amount"></td><td class="small text-muted bid-time"></td><td><span class="badge bg-${bid.status === 'WON' ? 'success' : bid.status === 'lost' ? 'danger' : 'warning'}">${bid.status}</span></td>`;
            row.querySelector('.bid-name').textContent = bid.productName;
            row.querySelector('.bid-amount').textContent = formatVND(bid.amount);
            row.querySelector('.bid-time').textContent = new Date(bid.timestamp).toLocaleString('vi-VN');
            tbody.appendChild(row);
        });
    } catch (e) { console.error('Load bid history error', e); }
}

async function loadTransactions() {
    try {
        const response = await fetch(`/api/user/transactions?t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await response.json();
        const transactions = json.data || json;
        const tbody = document.getElementById('transactionHistoryBody');
        tbody.innerHTML = '';
        transactions.forEach(t => {
            let typeText, typeBadge, amountPrefix, amountClass, infoText;

            if (t.type === 'DEPOSIT') {
                typeText = 'Nạp tiền';
                typeBadge = 'bg-success';
                amountPrefix = '+';
                amountClass = 'text-success';
                infoText = 'Thông tin: Nạp tiền ví MoMo';
            } else if (t.type === 'WITHDRAWAL') {
                typeText = 'Rút tiền';
                typeBadge = 'bg-info';
                amountPrefix = '-';
                amountClass = 'text-info';
                infoText = 'Thông tin: Rút tiền về ví MoMo';
            } else { // PAYMENT
                typeText = 'Thanh toán';
                typeBadge = 'bg-primary';
                amountPrefix = '-';
                amountClass = 'text-danger';
                infoText = 'Thông tin: Thanh toán đấu giá';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <tr>
                    <td><div class="fw-bold text-dark trans-id"></div><small class="text-muted trans-info"></small></td>
                    <td><span class="badge ${typeBadge}">${typeText}</span></td>
                    <td class="${amountClass} fw-bold trans-amount"></td>
                    <td><span class="badge bg-${t.status === 'SUCCESS' || t.status === 'Paid' ? 'success' : 'warning'}">${t.status}</span></td>
                    <td class="small trans-time"></td>
                </tr>
            `;
            
            row.querySelector('.trans-id').textContent = t.momoOrderId || t.id;
            row.querySelector('.trans-info').textContent = infoText;
            row.querySelector('.trans-amount').textContent = amountPrefix + t.formattedAmount;
            row.querySelector('.trans-time').textContent = new Date(t.createdAt).toLocaleString('vi-VN');
            tbody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

// Socket events
socket.on('bidUpdate', (data) => {
    // Cập nhật DOM trực tiếp thay vì load lại toàn bộ
    const card = document.querySelector(`.auction-card[data-id="${data.auctionId}"]`);
    if (card) {
        const priceEl = card.querySelector('.current-price-el');
        const bidderEl = card.querySelector('.top-bidder-el');
        if (priceEl) priceEl.textContent = formatVND(data.bidAmount);
        
        // Kiểm tra xem user hiện tại có vừa bị vượt mặt hay là người đặt giá
        if (currentUser && data.userId === currentUser.id) {
            if (bidderEl) bidderEl.innerHTML = '<span class="badge bg-success"><i class="fas fa-crown"></i> Bạn</span>';
        } else {
            if (bidderEl) bidderEl.innerHTML = `<span class="fw-medium">${data.bidderName || 'Khách'}</span>`;
        }
    }
});

socket.on('auctionWin', (data) => {
    showNotification(data.message, false);
    loadWonAuctions(); 
});

socket.on('paymentFail', (data) => {
    showNotification(data.message, true);
    loadWonAuctions(); 
});

socket.on('balanceUpdate', (data) => {
    document.getElementById('statBalance').textContent = formatVND(data.balance);
    document.getElementById('walletBalanceBig').textContent = formatVND(data.balance);
    showNotification(`💰 Số dư ví đã được cập nhật: ${formatVND(data.balance)}`);
});

socket.on('walletUpdate', (data) => {
    showNotification(data.message, data.isError || false);
    // Tải lại số dư và lịch sử giao dịch để đồng bộ
    loadWalletBalance();
    loadTransactions();
});

// Lắng nghe sự kiện từ ui-helpers để tải lại ví và giao dịch
window.addEventListener('walletUpdate', () => {
    loadWalletBalance();
    loadTransactions();
});

window.addEventListener('profileUpdate', (event) => {
    localStorage.setItem('user', JSON.stringify(event.detail));
    loadUserData(event.detail);
});


checkUserRole().then(userData => {
    if (userData) {
        loadUserData(userData);
        loadParticipating();
        loadBidHistory();
        loadWonAuctions();
        loadTransactions();

        window.bidModalUI = new BidModalUI(token);
        window.bidModalUI.init();
        window.addEventListener('bidUpdateSuccess', () => {
            loadParticipating();
            loadBidHistory();
        });

        // Khởi tạo lớp WalletUI
        const walletUI = new WalletUI(token);
        walletUI.init();
        // Khởi tạo lớp ProfileUI
        const profileUI = new ProfileUI(token);
        profileUI.init();
    }
});