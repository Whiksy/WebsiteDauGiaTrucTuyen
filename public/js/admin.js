// --- CÁC LỚP TIỆN ÍCH DÀNH RIÊNG CHO ADMIN ---
class AdminApi {
    constructor(token) {
        this.headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    }
    async getStats() { return fetch('/api/admin/stats', { headers: this.headers }); }
    async getUsers() { return fetch('/api/admin/users', { headers: this.headers }); }
    async getProducts() { return fetch('/api/admin/products', { headers: this.headers }); }
    async getAuctions() { return fetch('/api/admin/auctions', { headers: this.headers }); }
    async getSellerRequests() { return fetch('/api/admin/seller-requests', { headers: this.headers }); }
    async getCategories() { return fetch('/api/admin/categories', { headers: this.headers }); }
    async getWithdrawals() { return fetch('/api/admin/withdrawals', { headers: this.headers }); }
    
    async updateUser(id, data) { return fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: this.headers, body: JSON.stringify(data) }); }
    async deleteUser(id) { return fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: this.headers }); }
    async deleteProduct(id) { return fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: this.headers }); }
    async getAuctionDetails(id) { return fetch(`/api/admin/auctions/${id}`, { headers: this.headers }); }
    async endAuction(id) { return fetch(`/api/admin/auctions/${id}/end`, { method: 'POST', headers: this.headers }); }
    async approveSeller(id) { return fetch(`/api/admin/approve-seller/${id}`, { method: 'POST', headers: this.headers }); }
    async saveCategory(id, name, description) {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
        return fetch(url, { method, headers: this.headers, body: JSON.stringify({ name, description }) });
    }
    async deleteCategory(id) { return fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: this.headers }); }
    async processWithdrawal(id, action) { return fetch(`/api/admin/withdrawals/${id}/process`, { method: 'POST', headers: this.headers, body: JSON.stringify({ action }) }); }
}

class TableManager {
    constructor(tbodyId, fetchFn, renderFn) {
        this.tbody = document.getElementById(tbodyId);
        this.fetchFn = fetchFn;
        this.renderFn = renderFn;
        this.data = [];
        this.searchTerm = '';
    }
    async loadData() {
        try {
            const res = await this.fetchFn();
            if (res.ok) {
                const json = await res.json();
                this.data = json.data || [];
                this.render();
            }
        } catch (e) { console.error('Failed to load table data', e); }
    }
    setSearch(term) {
        this.searchTerm = (term || '').toLowerCase();
        this.render();
    }
    render() {
        if (!this.tbody) return;
        this.renderFn(this.tbody, this.data, this.searchTerm);
    }
}

/**
 * Hàm Debounce: Trì hoãn việc thực thi một hàm cho đến khi người dùng ngừng gõ.
 * @param {Function} func - Hàm cần thực thi.
 * @param {number} delay - Thời gian trì hoãn (ms).
 */
function debounce(func, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

class AdminApp {
    constructor() {
        this.api = new AdminApi(localStorage.getItem('token'));
        this.token = localStorage.getItem('token');
        if (!this.token) {
            window.location.href = '/';
            return;
        }
        
        this.charts = { revenue: null, status: null };
        // Thay thế mảng data bằng đối tượng quản lý phân trang
        this.tableManagers = {
            users: new TableManager('usersTableBody', this.api.getUsers.bind(this.api), this.renderUsers.bind(this)),
            products: new TableManager('productsTableBody', this.api.getProducts.bind(this.api), this.renderProducts.bind(this)),
            auctions: new TableManager('auctionsTableBody', this.api.getAuctions.bind(this.api), this.renderAuctions.bind(this)),
            requests: new TableManager('requestsTableBody', this.api.getSellerRequests.bind(this.api), this.renderSellerRequests.bind(this)),
            categories: new TableManager('categoriesTableBody', this.api.getCategories.bind(this.api), this.renderCategories.bind(this)),
            withdrawals: new TableManager('withdrawalsTableBody', this.api.getWithdrawals.bind(this.api), this.renderWithdrawals.bind(this)),
        };
        this.data = { users: [], products: [], auctions: [] };
        
        this.init();
    }

    async init() {
        const isValid = await this.checkAdminRole();
        if (isValid) {
            this.bindEvents();
            await this.loadDashboardData();
            this.tableManagers.users.loadData();
            this.tableManagers.products.loadData();
            this.tableManagers.auctions.loadData();
            this.tableManagers.requests.loadData();
            this.tableManagers.categories.loadData();
            this.tableManagers.withdrawals.loadData();

            // Khởi tạo các module OOP (DRY)
            const profileUI = new ProfileUI(this.token);
            profileUI.init();
            // Lắng nghe sự kiện cập nhật hồ sơ để tự động render lại Data trên DOM
            window.addEventListener('profileUpdate', (e) => this.updateProfileUI(e.detail));
        }
    }

    bindEvents() {
        // Bind search inputs
        document.getElementById('searchUserInput')?.addEventListener('input', debounce((e) => this.tableManagers.users.setSearch(e.target.value), 300));
        document.getElementById('searchProductInput')?.addEventListener('input', debounce((e) => this.tableManagers.products.setSearch(e.target.value), 300));
        document.getElementById('searchAuctionInput')?.addEventListener('input', debounce((e) => this.tableManagers.auctions.setSearch(e.target.value), 300));
        document.getElementById('searchRequestInput')?.addEventListener('input', debounce((e) => this.tableManagers.requests.setSearch(e.target.value), 300));
        document.getElementById('searchCategoryInput')?.addEventListener('input', debounce((e) => this.tableManagers.categories.setSearch(e.target.value), 300));
        document.getElementById('searchWithdrawalInput')?.addEventListener('input', debounce((e) => this.tableManagers.withdrawals.setSearch(e.target.value), 300));
        
        // Bind forms
        document.getElementById('editUserForm')?.addEventListener('submit', this.handleEditUser.bind(this));
        document.getElementById('categoryForm')?.addEventListener('submit', this.handleCategoryForm.bind(this));
    }

    async checkAdminRole() {
        try {
            const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${this.token}` } });
            if (response.ok) {
                const json = await response.json();
                const userData = json.data || json;
                if (!(userData.roles || []).includes('Admin')) {
                    showNotification('Bạn không có quyền truy cập trang này', true);
                    setTimeout(() => window.location.href = '/', 2000);
                    return false;
                }
                
                // Cập nhật thông tin Admin lên giao diện an toàn
                this.updateProfileUI(userData);
                return true;
            }
        } catch (e) { console.error('Role check error:', e); }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return false;
    }

    // Cập nhật DOM trực tiếp để ngăn ngừa rủi ro bảo mật XSS
    updateProfileUI(userData) {
        const nameEl = document.getElementById('userFullName');
        const emailEl = document.getElementById('userEmail');
        const avatarEl = document.getElementById('profileAvatar');
        if (nameEl) nameEl.textContent = userData.name || 'Admin';
        if (emailEl) emailEl.textContent = userData.email || '';
        if (avatarEl && userData.avatar) avatarEl.src = userData.avatar;
    }

    // --- DASHBOARD ---
    async loadDashboardData() {
        try {
            const response = await this.api.getStats();
            if (response.ok) {
                const json = await response.json();
                const data = json.data || json;
                
                document.getElementById('totalUsers').textContent = data.counts?.totalUsers || 0;
                document.getElementById('totalProducts').textContent = data.counts?.totalProducts || 0;
                document.getElementById('activeAuctions').textContent = data.counts?.activeAuctions || 0;
                document.getElementById('totalRevenue').textContent = formatVND(data.counts?.totalRevenue || 0);

                const activityDiv = document.getElementById('recentActivity');
                if (activityDiv) {
                    activityDiv.innerHTML = data.activity.map(act => `
                        <div class="d-flex justify-content-between border-bottom py-2">
                            <div>
                                <span class="badge bg-${act.Type === 'New User' ? 'info' : 'success'} me-2">${act.Type}</span>
                                ${act.Description}
                            </div>
                            <small class="text-muted">${new Date(act.CreatedAt).toLocaleDateString('vi-VN')}</small>
                        </div>
                    `).join('');
                }

                const endedDiv = document.getElementById('recentEndedAuctions');
                if (endedDiv) {
                    endedDiv.innerHTML = data.recentEnded.map(auc => `
                        <div class="d-flex justify-content-between border-bottom py-2">
                            <div><strong>${auc.Title}</strong></div>
                            <div class="text-end">
                                <div class="text-success fw-bold">${formatVND(auc.CurrentBid)}</div>
                                <small>Thắng: ${auc.Winner || 'Không có'}</small>
                            </div>
                        </div>
                    `).join('');
                }

                this.renderCharts(data.revenueChart, data.statusChart);
            }
        } catch (e) { console.error('Dashboard Error', e); }
    }

    renderCharts(revenueData, statusData) {
        if(this.charts.revenue) this.charts.revenue.destroy();
        if(this.charts.status) this.charts.status.destroy();

        const revCanvas = document.getElementById('revenueChart');
        if (revCanvas) {
            const ctxRev = revCanvas.getContext('2d');
            this.charts.revenue = new Chart(ctxRev, {
                type: 'line',
                data: {
                    labels: revenueData.map(d => d.Month),
                    datasets: [{
                        label: 'Doanh thu (VND)',
                        data: revenueData.map(d => d.Revenue),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true }
            });
        }

        const statCanvas = document.getElementById('auctionStatusChart');
        if (statCanvas) {
            const ctxStat = statCanvas.getContext('2d');
            this.charts.status = new Chart(ctxStat, {
                type: 'doughnut',
                data: {
                    labels: statusData.map(d => d.Status),
                    datasets: [{
                        data: statusData.map(d => d.Count),
                        backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
                    }]
                },
                options: { responsive: true }
            });
        }
    }

    // --- RENDER HÀM CHO TABLE MANAGER ---
    renderUsers(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) {
            filtered = filtered.filter(u => 
                (u.name || '').toLowerCase().includes(searchTerm) || 
                (u.email || '').toLowerCase().includes(searchTerm)
            );
        }
        filtered.sort((a, b) => {
            const getWeight = (r) => (r || '').includes('Admin') ? 3 : (r || '').includes('Seller') ? 2 : 1;
            return getWeight(b.role) - getWeight(a.role) || (a.name || '').localeCompare(b.name || '');
        });
        tbody.innerHTML = filtered.map(user => {
            let roleBadge = user.role.includes('Admin') ? 'danger' : user.role.includes('Seller') ? 'warning' : 'primary';
            return `
                <tr>
                    <td>#${user.id}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${user.avatar || 'https://via.placeholder.com/40'}" class="rounded-circle me-2" width="40" height="40" style="object-fit: cover;">
                            <div class="fw-bold">${user.name || 'Chưa có tên'}</div>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td><span class="badge bg-${roleBadge}">${user.role}</span></td>
                    <td>${user.is_active ? '<span class="badge bg-success">Hoạt động</span>' : '<span class="badge bg-secondary">Bị khóa</span>'}</td>
                    <td>
                        <button class="btn btn-outline-primary btn-sm" onclick="window.adminApp.openEditUserModal(${user.id}, '${user.name}', '${user.email}', '${user.role}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-danger btn-sm" onclick="window.adminApp.deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        }).join('');
    }

    openEditUserModal(id, name, email, role) {
        document.getElementById('editUserId').value = id;
        document.getElementById('editUserName').value = name;
        document.getElementById('editUserEmail').value = email;
        const mainRole = role.includes('Admin') ? 'Admin' : role.includes('Seller') ? 'Seller' : 'User';
        document.getElementById('editUserRole').value = mainRole;
        new bootstrap.Modal(document.getElementById('editUserModal')).show();
    }

    renderProducts(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) filtered = filtered.filter(p => (p.Name || '').toLowerCase().includes(searchTerm));
        tbody.innerHTML = filtered.map(product => `
            <tr>
                <td>#${product.Id}</td>
                <td><div class="text-truncate fw-bold" style="max-width: 250px;" title="${product.Name}">${product.Name}</div></td>
                <td class="text-success fw-bold">${formatVND(product.Price)}</td>
                <td>${product.Stock > 0 ? `<span class="badge bg-success">${product.Stock} sẵn có</span>` : '<span class="badge bg-danger">Hết hàng</span>'}</td>
                <td><i class="fas fa-store text-muted"></i> ${product.SellerName || 'Unknown'}</td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="window.adminApp.deleteProduct(${product.Id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }

    renderAuctions(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) filtered = filtered.filter(a => (a.productName || '').toLowerCase().includes(searchTerm));
        tbody.innerHTML = filtered.map(auction => {
            const status = (auction.status || '').toUpperCase();
            let badge = status === 'ACTIVE' ? 'success' : status === 'ENDED' ? 'secondary' : 'warning';
            let statusText = status === 'ACTIVE' ? 'Đang diễn ra' : status === 'ENDED' ? 'Kết thúc' : status;
            return `
                <tr>
                    <td>#${auction.id}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${auction.productImage || ''}" width="40" height="40" class="rounded me-2 object-fit-cover" onerror="this.src='https://via.placeholder.com/40'">
                            <div class="text-truncate fw-bold" style="max-width: 200px;" title="${auction.productName}">${auction.productName}</div>
                        </div>
                    </td>
                    <td><div class="text-primary fw-bold">${formatVND(auction.current_price || auction.currentBid)}</div><small class="text-muted">Top: ${auction.highestBidderName || 'Chưa có'}</small></td>
                    <td><span class="badge bg-info text-dark">${auction.total_bids || 0} lượt</span></td>
                    <td>${new Date(auction.end_date || auction.endTime).toLocaleString('vi-VN')}</td>
                    <td><span class="badge bg-${badge}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-outline-info btn-sm" onclick="window.adminApp.viewAuctionDetails(${auction.id})"><i class="fas fa-eye"></i></button>
                        ${status === 'ACTIVE' ? `<button class="btn btn-outline-danger btn-sm" onclick="window.adminApp.endAuction(${auction.id})"><i class="fas fa-stop"></i></button>` : ''}
                    </td>
                </tr>`;
        }).join('');
    }

    renderSellerRequests(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) {
            filtered = filtered.filter(req => 
                (req.Name || '').toLowerCase().includes(searchTerm) ||
                (req.Email || '').toLowerCase().includes(searchTerm)
            );
        }
        tbody.innerHTML = filtered.length === 0 
            ? '<tr><td colspan="5" class="text-center">Không có yêu cầu nào</td></tr>'
            : filtered.map(req => `
            <tr>
                <td>${req.Id}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${req.Avatar || 'https://via.placeholder.com/30'}" class="rounded-circle me-2" width="30" height="30">
                        ${req.Name}
                    </div>
                </td>
                <td>${req.Email}</td>
                <td>${new Date(req.CreatedAt).toLocaleDateString('vi-VN')}</td>
                <td><button class="btn btn-success btn-sm" onclick="window.adminApp.approveSeller(${req.Id})"><i class="fas fa-check"></i> Duyệt</button></td>
            </tr>`).join('');
    }

    renderCategories(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) filtered = filtered.filter(cat => (cat.name || '').toLowerCase().includes(searchTerm));
        tbody.innerHTML = filtered.map(cat => `
            <tr>
                <td>${cat.id}</td>
                <td class="fw-bold text-primary">${cat.name}</td>
                <td>${cat.description || ''}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.adminApp.editCategory(${cat.id}, '${cat.name}', '${cat.description || ''}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger btn-sm" onclick="window.adminApp.deleteCategory(${cat.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }

    renderWithdrawals(tbody, data, searchTerm) {
        let filtered = data;
        if (searchTerm) {
            filtered = filtered.filter(w => 
                (w.userName || '').toLowerCase().includes(searchTerm) ||
                (w.email || '').toLowerCase().includes(searchTerm) ||
                (w.phone || '').includes(searchTerm)
            );
        }
        tbody.innerHTML = filtered.length === 0 
            ? '<tr><td colspan="6" class="text-center text-muted py-4">Không có yêu cầu rút tiền nào đang chờ</td></tr>'
            : filtered.map(w => `
            <tr>
                <td>#${w.id}</td>
                <td><div class="fw-bold">${w.userName}</div><small class="text-muted">${w.email}</small></td>
                <td class="fw-bold text-danger">${formatVND(w.amount)}</td>
                <td class="fw-bold text-info">${w.phone}</td>
                <td>${new Date(w.created_at).toLocaleString('vi-VN')}</td>
                <td>
                    <button class="btn btn-success btn-sm mb-1 w-100" onclick="window.adminApp.processWithdrawal(${w.id}, 'APPROVE')"><i class="fas fa-check"></i> Đã chuyển khoản</button>
                    <button class="btn btn-outline-danger btn-sm w-100" onclick="window.adminApp.processWithdrawal(${w.id}, 'REJECT')"><i class="fas fa-times"></i> Từ chối</button>
                </td>
            </tr>`).join('');
    }

    async handleEditUser(e) {
        e.preventDefault();
        const id = document.getElementById('editUserId').value;
        const role = document.getElementById('editUserRole').value;
        try {
            const res = await this.api.updateUser(id, { role });
            if(res.ok) {
                showNotification('Cập nhật thành công');
                bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
                this.tableManagers.users.loadData();
            } else showNotification('Lỗi cập nhật', true);
        } catch(e) { showNotification('Lỗi server', true); }
    }

    async deleteUser(id) {
        if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
        try {
            const res = await this.api.deleteUser(id);
            if (res.ok) { showNotification('Đã xóa'); this.tableManagers.users.loadData(); }
        } catch (e) { showNotification('Lỗi', true); }
    }

    async deleteProduct(id) {
        if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
        try {
            const res = await this.api.deleteProduct(id);
            if (res.ok) { showNotification('Đã xóa'); this.tableManagers.products.loadData(); }
        } catch (e) { showNotification('Lỗi', true); }
    }

    async viewAuctionDetails(id) {
        try {
            const res = await this.api.getAuctionDetails(id);
            if(res.ok) {
                const data = (await res.json()).data;
                document.getElementById('viewAuctionProduct').textContent = data.info?.productName || 'N/A';
                document.getElementById('viewAuctionSeller').textContent = data.info?.sellerName || 'N/A';
                document.getElementById('viewAuctionStart').textContent = formatVND(data.info?.starting_price || data.info?.StartingBid);
                document.getElementById('viewAuctionCurrent').textContent = formatVND(data.info?.current_price || data.info?.CurrentBid);
                document.getElementById('viewAuctionWinner').textContent = data.info?.winnerName || data.info?.highestBidderName || 'Chưa có';
                document.getElementById('viewAuctionEnd').textContent = new Date(data.info?.end_date || data.info?.EndTime).toLocaleString('vi-VN');
                
                document.getElementById('viewAuctionBids').innerHTML = data.bids.map(b => `
                    <tr><td>${b.bidderName || b.Name}</td><td class="text-success fw-bold">${formatVND(b.amount || b.BidAmount)}</td><td>${new Date(b.bid_time || b.BidTime).toLocaleString('vi-VN')}</td></tr>
                `).join('');
                new bootstrap.Modal(document.getElementById('viewAuctionModal')).show();
            }
        } catch(e) { console.error(e); }
    }

    async endAuction(id) {
        if (!confirm('Bạn có chắc muốn kết thúc sớm đấu giá này?')) return;
        try {
            const res = await this.api.endAuction(id);
            if (res.ok) { showNotification('Đã kết thúc'); this.tableManagers.auctions.loadData(); this.loadDashboardData(); }
        } catch (e) { showNotification('Lỗi', true); }
    }

    async approveSeller(id) {
        if (!confirm('Bạn có chắc muốn phê duyệt người dùng này lên Seller?')) return;
        try {
            const res = await this.api.approveSeller(id);
            if (res.ok) { showNotification('Đã duyệt thành công'); this.tableManagers.requests.loadData(); this.tableManagers.users.loadData(); }
        } catch (e) { showNotification('Lỗi', true); }
    }

    editCategory(id, name, desc) {
        document.getElementById('categoryId').value = id;
        document.getElementById('categoryName').value = name;
        document.getElementById('categoryDescription').value = desc;
        document.getElementById('categoryModalTitle').textContent = 'Sửa danh mục';
        new bootstrap.Modal(document.getElementById('categoryModal')).show();
    }

    async handleCategoryForm(e) {
        e.preventDefault();
        const id = document.getElementById('categoryId').value;
        const name = document.getElementById('categoryName').value;
        const description = document.getElementById('categoryDescription').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';

        try {
            const res = await this.api.saveCategory(id, name, description);
            if(res.ok) {
                showNotification('Lưu danh mục thành công');
                bootstrap.Modal.getInstance(document.getElementById('categoryModal'))?.hide();
                this.tableManagers.categories.loadData();
            }
        } catch(e) { console.error(e); }
    }

    async deleteCategory(id) {
        if (!confirm('Xóa danh mục này? Sản phẩm thuộc danh mục sẽ không bị xóa (chỉ mất liên kết).')) return;
        try {
            const res = await this.api.deleteCategory(id);
            if(res.ok) { showNotification('Đã xóa'); this.tableManagers.categories.loadData(); }
        } catch(e) { console.error(e); }
    }

    async processWithdrawal(id, action) {
        const actionText = action === 'APPROVE' ? 'XÁC NHẬN ĐÃ CHUYỂN KHOẢN cho' : 'TỪ CHỐI';
        if (!confirm(`Bạn có chắc muốn ${actionText} yêu cầu rút tiền này?`)) return;
        try {
            const res = await this.api.processWithdrawal(id, action);
            if(res.ok) { showNotification('Xử lý thành công'); this.loadWithdrawals(); this.loadDashboardData(); };
        } catch(e) { console.error(e); }
    }
}

// Toàn cục (Global) để HTML có thể gọi được
window.adminApp = new AdminApp();

function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => section.classList.add('d-none'));
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) targetSection.classList.remove('d-none');
    
    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = Array.from(document.querySelectorAll('.sidebar .nav-link')).find(el => el.getAttribute('onclick') && el.getAttribute('onclick').includes(sectionName));
    if (activeLink) activeLink.classList.add('active');
}

function openCategoryModal() {
    document.getElementById('categoryForm')?.reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Thêm danh mục';
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
}