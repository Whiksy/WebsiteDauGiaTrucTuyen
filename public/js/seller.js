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

/// Mã JavaScript cho trang Seller
        const devLog = (context, data, isError = false) => {
            const timestamp = new Date().toLocaleTimeString();
            if (isError) {
                console.error(`[${timestamp}] ❌ ERROR @ ${context}:`, data);
            } else {
                console.log(`[${timestamp}] ℹ️ INFO @ ${context}:`, data);
            }
        };

        const socket = io();
        let token = localStorage.getItem('token');
        let currentSeller = null;
        let currentViewingAuctionId = null;
        
        // Biến lưu trữ cho Phân trang (Server-side)
        let currentProductPage = 1;
        let currentAuctionPage = 1;
        let currentSoldPage = 1;

        // Check authentication and role
        if (!token) {
            devLog('Auth', 'No token found in localStorage. Redirecting to login.');
            window.location.href = '/';
        }

        async function checkSellerRole() {
            devLog('Auth', 'Checking seller roles...');
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const json = await response.json();
                    const userData = json.data || json;
                    devLog('Auth', userData);
                    const roles = userData.roles || [];
                    if (!roles.includes('Seller')) {
                        devLog('Auth', 'Access denied: User is not a Seller', true);
                        showNotification('Bạn không có quyền truy cập trang này', true);
                        setTimeout(() => window.location.href = '/', 2000);
                        return null;
                    }
                    return userData;
                } else {
                    devLog('Auth', `Fetch failed with status: ${response.status}`, true);
                    logout();
                    return null;
                }
            } catch (e) {
                devLog('Auth/checkSellerRole', e, true);
                logout();
                return null;
            }
        }

        async function loadSellerData(userData) {
            // Nếu đã có dữ liệu từ bước checkRole, dùng luôn không cần gọi API lại
            if (userData) {
                currentSeller = userData;
                updateSellerUI();
                return;
            }

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const json = await response.json();
                    currentSeller = json.data || json;
                    updateSellerUI();
                } else {
                    devLog('API/loadSellerData', 'Failed to fetch user data', true);
                    logout();
                }
            } catch (e) {
                devLog('API/loadSellerData', e, true);
                logout();
            }
        }

        function updateSellerUI() {
            document.getElementById('sellerName').textContent = currentSeller.name || 'Người bán';
            
            // Update Navbar Info
            document.getElementById('navName').textContent = currentSeller.name || 'Seller';
            if (currentSeller.avatar) {
                document.getElementById('navAvatar').src = currentSeller.avatar;
            }

            // Load Wallet & Join Socket
            loadWalletBalance();
            socket.emit('joinUser', currentSeller.id);
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
                    document.getElementById('walletBalance').textContent = formatVND(data.balance || 0);
                    
                    // Cập nhật thống kê thu chi
                    const incomeEl = document.getElementById('statIncome');
                    const expenseEl = document.getElementById('statExpense');
                    const revenueEl = document.getElementById('totalRevenue');
                    if (incomeEl) incomeEl.textContent = formatVND(data.totalIncome || 0);
                    if (expenseEl) expenseEl.textContent = formatVND(data.totalExpense || 0);
                    if (revenueEl) revenueEl.textContent = formatVND(data.totalSales || 0);
                }
            } catch (e) { devLog('Wallet', e, true); }
        }

        // Hàm dùng chung để vẽ thanh phân trang Bootstrap
        function renderPagination(containerId, totalPages, currentPage, loadFunctionStr) {
            const container = document.getElementById(containerId);
            if (!container) return;
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }

            let html = '<nav><ul class="pagination justify-content-center mb-0">';
            html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="${currentPage > 1 ? `${loadFunctionStr}(${currentPage - 1})` : ''}">Trước</a></li>`;
            
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    html += `<li class="page-item ${currentPage === i ? 'active' : ''}"><a class="page-link" href="javascript:void(0)" onclick="${loadFunctionStr}(${i})">${i}</a></li>`;
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                    html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
            }
            
            html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="${currentPage < totalPages ? `${loadFunctionStr}(${currentPage + 1})` : ''}">Sau</a></li>`;
            html += '</ul></nav>';
            container.innerHTML = html;
        }

        async function loadProducts(page = 1, searchTerm = '') {
      devLog('API', 'Loading product list...');
      currentProductPage = page;
      try {
          const response = await fetch(`/api/seller/products?page=${page}&limit=6&q=${encodeURIComponent(searchTerm)}&t=${Date.now()}`, { 
              headers: { 'Authorization': `Bearer ${token}` }
          });

          // Kiểm tra nếu response không thành công (lỗi 500, 404, 401...)
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
              throw new Error(errorData.message || `Server error: ${response.status}`);
          }

          const json = await response.json();
          
          // Lấy mảng sản phẩm từ thuộc tính 'data' của response JSON
          // Sửa lỗi: Frontend đang gọi đến /api/products/seller/:id, không có trong các file đã cung cấp.
          // Ta sẽ sửa lại để gọi /api/seller/products và lấy dữ liệu từ json.data
          const productData = json.data || [];
          const pagination = json.pagination || { totalPages: 1, total: 0 };
          devLog('API/loadProducts', `Fetched ${productData.length} items`);
          devLog('API/loadProducts', 'Raw product data received:', productData);

          const container = document.getElementById('productList');
          const select = document.getElementById('auctionProduct');
          container.innerHTML = '';
          select.innerHTML = '<option value="">Chọn sản phẩm...</option>';

          // BỔ SUNG: Hiển thị trống nếu chưa có sản phẩm
          if (productData.length === 0) {
              container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fas fa-box-open fa-3x mb-3 text-secondary"></i><h5>Chưa có sản phẩm nào</h5><p>Bạn hãy thêm sản phẩm mới để bắt đầu bán hàng nhé!</p></div>';
          }

          productData.forEach(product => {
              const col = document.createElement('div');
              col.className = 'col-md-4 mb-4 fade-in';
              const productName = product.Name || 'Sản phẩm';
              const imgSrc = product.Thumbnail || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3QgZmlsbD0iI2VlZSIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZHk9Ii4zZW0iIGZpbGw9IiM1NTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJhcmlhbCIgZm9udC1zaXplPSIyNCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
              const isOutOfStock = product.Stock <= 0;

              col.innerHTML = `
                  <div class="card product-card h-100 ${isOutOfStock ? 'out-of-stock' : ''}">
                      <div class="position-relative product-img-wrapper" style="cursor: pointer;">
                          <!-- LAZY LOADING ẢNH -->
                          <img loading="lazy" class="card-img-top product-img" style="height: 200px; object-fit: cover;" alt="Product">
                          ${isOutOfStock ? '<div class="out-of-stock-overlay"><span class="badge bg-danger fs-6">Hết hàng</span></div>' : ''}
                          <div class="position-absolute top-0 end-0 p-2">
                              <span class="badge bg-dark opacity-75 product-img-count"></span>
                          </div>
                      </div>
                      <div class="card-body d-flex flex-column">
                          <h5 class="card-title text-truncate product-title" style="cursor: pointer;"></h5>
                          <p class="card-text text-truncate product-desc"></p>
                          <div class="mt-auto">
                              <p class="card-text mb-1"><span class="badge bg-secondary me-2 product-category"></span> <strong class="product-price"></strong></p>
                              <p class="card-text mb-3"><strong>Tồn kho:</strong> <span class="product-stock"></span></p>
                              <div class="d-flex justify-content-between gap-2 action-buttons">
                              </div>
                          </div>
                      </div>
                  </div>
              `;
              
              // Gán dữ liệu an toàn chống XSS
              col.querySelector('.product-img-wrapper').onclick = () => viewProductDetails(product.Id);
              const imgEl = col.querySelector('.product-img');
              imgEl.src = imgSrc;
              imgEl.onerror = function() { this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3QgZmlsbD0iI2VlZSIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZHk9Ii4zZW0iIGZpbGw9IiM1NTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJhcmlhbCIgZm9udC1zaXplPSIyNCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'; };
              col.querySelector('.product-img-count').innerHTML = `<i class="fas fa-images"></i> ${product.ImageCount || 0}`;
              
              const titleEl = col.querySelector('.product-title');
              titleEl.textContent = product.Name || 'Sản phẩm';
              titleEl.onclick = () => viewProductDetails(product.Id);
              
              col.querySelector('.product-desc').textContent = product.Description || 'Không có mô tả';
              col.querySelector('.product-category').textContent = product.CategoryName || 'Khác';
              col.querySelector('.product-price').textContent = formatVND(product.Price);
              col.querySelector('.product-stock').textContent = product.Stock;
              col.querySelector('.action-buttons').innerHTML = `
                  <button class="btn btn-outline-info btn-sm flex-grow-1" onclick="viewProductDetails(${product.Id})" ${isOutOfStock ? 'disabled' : ''}><i class="fas fa-eye"></i> Chi tiết</button>
                  <button class="btn btn-outline-primary btn-sm flex-grow-1" onclick="editProduct(${product.Id})" ${isOutOfStock ? 'disabled' : ''}><i class="fas fa-edit"></i> Sửa</button>
                  <button class="btn btn-outline-danger btn-sm flex-grow-1" onclick="deleteProduct(${product.Id})" ${product.IsInActiveAuction ? 'disabled' : ''}><i class="fas fa-trash"></i> Xóa</button>
              `;
              container.appendChild(col);
          });

          renderPagination('productPagination', pagination.totalPages, page, 'loadProducts');

      } catch (e) {
          devLog('API/loadProducts', e.message, true);
          // Hiển thị thông báo lỗi lên giao diện nếu cần
          document.getElementById('productList').innerHTML = `<p class="text-danger text-center">Lỗi: ${e.message}</p>`;
      }
  }

  // Hàm lấy riêng danh sách sản phẩm hợp lệ cho form Dropdown Tạo Đấu Giá (Không cần pagination)
  async function loadProductsForDropdown() {
      try {
          // Lấy limit lớn để cover hết kho của seller cho mục đích dropdown
          const res = await fetch(`/api/seller/products?limit=1000`, { headers: { 'Authorization': `Bearer ${token}` }});
          const json = await res.json();
          const select = document.getElementById('auctionProduct');
          if(select) {
              select.innerHTML = '<option value="">Chọn sản phẩm...</option>';
              (json.data || []).forEach(product => {
                  if (product.Stock > 0 && !product.IsInActiveAuction) {
                      const option = document.createElement('option');
                      option.value = product.Id;
                      option.textContent = `${product.Name} (Tồn kho: ${product.Stock})`;
                      select.appendChild(option);
                  }
              });
          }
      } catch(e) {}
  }

  async function loadAuctions(page = 1, searchTerm = '') {
      devLog('API', 'Loading auctions...');
      currentAuctionPage = page;
      try {
          const response = await fetch(`/api/seller/auctions?page=${page}&limit=10&q=${encodeURIComponent(searchTerm)}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.status === 401) {
              showNotification('Phiên làm việc hết hạn', true);
              setTimeout(logout, 2000);
              return;
          }

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
              devLog('API/loadAuctions', `Server error: ${response.status} - ${errorData.message}`, true);
              throw new Error(errorData.message || `Server error: ${response.status}`);
          }

          const json = await response.json();
          const auctionData = json.data || [];
          const pagination = json.pagination || { totalPages: 1, total: 0 };
          devLog('API/loadAuctions', `Fetched ${auctionData.length} auctions`);

          const tbody = document.getElementById('auctionTableBody');
          tbody.innerHTML = '';

          auctionData.forEach(auction => {
              const status = (auction.status || '').toLowerCase();
              const isActive = status === 'active';
              const isProcessing = status === 'processing';
              
              // Tương thích với cả chuẩn DB snake_case và DTO camelCase
              const startingPrice = auction.startingPrice ?? auction.starting_price;
              const currentBid = auction.currentBid ?? auction.current_price;
              const endTime = auction.endTime ?? auction.end_date;
              const image = auction.image ?? auction.productImage ?? auction.Thumbnail;
              const bidCount = auction.bidCount ?? auction.total_bids ?? 0;
              const hasBids = (currentBid > startingPrice) || (bidCount > 0); 

              let statusBadge = '';
              if (isActive) statusBadge = '<span class="badge bg-success">Đang diễn ra</span>';
              else if (isProcessing) statusBadge = '<span class="badge bg-warning text-dark">Đang xử lý</span>';
              else statusBadge = '<span class="badge bg-secondary">Đã kết thúc</span>';

              const row = document.createElement('tr');
              row.setAttribute('data-auction-row', auction.id);
              row.innerHTML = `
                  <td><img loading="lazy" width="50" height="50" class="rounded object-fit-cover auction-img"></td>
                  <td><div style="max-width: 150px;" class="text-truncate auction-name"></div></td>
                  <td class="auction-start-price"></td>
                  <td>
                      <div class="fw-bold text-primary current-price"></div>
                      <small class="text-muted">Dẫn đầu: <strong class="text-dark highest-bidder"></strong></small>
                  </td>
                  <td class="auction-end-time"></td>
                  <td class="auction-status"></td>
                  <td class="auction-actions"></td>
              `;
              
              // Gán an toàn
              const imgEl = row.querySelector('.auction-img');
              imgEl.src = image || '';
              imgEl.onerror = function() { this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjY2NjIi8+PC9zdmc+'; };
              
              row.querySelector('.auction-name').title = auction.productName || 'N/A';
              row.querySelector('.auction-name').textContent = auction.productName || 'N/A';
              row.querySelector('.auction-start-price').textContent = formatVND(startingPrice);
              row.querySelector('.current-price').textContent = formatVND(currentBid);
              row.querySelector('.highest-bidder').textContent = auction.highestBidderName || 'Chưa có';
              row.querySelector('.auction-end-time').textContent = endTime ? new Date(endTime).toLocaleString('vi-VN') : 'N/A';
              row.querySelector('.auction-status').innerHTML = statusBadge;
              row.querySelector('.auction-actions').innerHTML = `
                  <button class="btn btn-outline-info btn-sm mb-1" onclick="viewAuctionDetails(${auction.id})">Chi tiết</button>
                  ${isActive ? `<button class="btn btn-outline-warning btn-sm mb-1" onclick="endAuction(${auction.id})" title="Kết thúc ngay"><i class="fas fa-stop-circle"></i></button>` : (!hasBids ? `<button class="btn btn-outline-primary btn-sm" onclick="relistAuction(${auction.id})" title="Đăng lại"><i class="fas fa-redo"></i></button>` : '')}
                  ${!hasBids && !isActive && !isProcessing ? `<button class="btn btn-outline-danger btn-sm mb-1" onclick="deleteAuction(${auction.id})" title="Xóa"><i class="fas fa-trash"></i></button>` : ''}
              `;
              
              tbody.appendChild(row);
        });
          
          // Thêm Container Pagination bằng DOM DOMManipulation (nếu bạn chưa thêm sẵn div vào HTML)
          if (!document.getElementById('auctionPagination')) {
              const nav = document.createElement('div');
              nav.id = 'auctionPagination';
              nav.className = 'mt-3';
              document.getElementById('auctionTableBody').parentElement.after(nav);
          }
          renderPagination('auctionPagination', pagination.totalPages, page, 'loadAuctions');

      } catch (e) {
          devLog('API/loadAuctions', e.message, true);
          const tbody = document.getElementById('auctionTableBody');
          if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Không thể tải dữ liệu: ${e.message}</td></tr>`;
      }
  }

  async function loadSoldItems(page = 1, searchTerm = '') {
      currentSoldPage = page;
      try {
          const response = await fetch(`/api/seller/sold-items?page=${page}&limit=10&q=${encodeURIComponent(searchTerm)}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
              const json = await response.json();
              const items = json.data || json;
              const pagination = json.pagination || { totalPages: 1 };
              const tbody = document.getElementById('soldItemsTableBody');
              tbody.innerHTML = '';
              items.forEach(item => {
                  const buyerName = item.buyerName || `<span class="text-muted fst-italic">Chưa có người thắng</span>`;
                  const buyerEmail = item.buyerEmail || '';
                  
                  const deliveryAction = item.isDelivered 
                      ? `<div class="mt-2"><span class="badge bg-success"><i class="fas fa-check-circle"></i> Đã giao hàng</span></div>`
                      : `<div class="mt-2"><button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); verifyPickupCode(${item.id})"><i class="fas fa-qrcode"></i> Nhập mã xác nhận</button></div>`;

                  const row = document.createElement('tr');
                  row.onclick = () => viewAuctionDetails(item.id);
                  row.style.cursor = 'pointer';
                  row.innerHTML = `
                        <td>
                            <div class="d-flex align-items-center">
                                <img loading="lazy" width="40" height="40" class="rounded me-2 sold-img">
                                <div class="sold-name"></div>
                            </div>
                        </td>
                        <td class="sold-price"></td>
                        <td>
                            <div class="d-flex align-items-center buyer-info">
                                <img width="30" height="30" class="rounded-circle me-2 buyer-avatar">
                                <div>
                                    <div class="buyer-name"></div>
                                    <small class="text-muted buyer-email"></small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="badge bg-${item.paymentStatus === 'Paid' || item.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}">${item.paymentStatus}</span>
                            ${deliveryAction}
                        </td>
                  `;
                  
                  row.querySelector('.sold-img').src = item.image || '';
                  row.querySelector('.sold-name').textContent = item.productName || 'Sản phẩm không tên';
                  row.querySelector('.sold-price').textContent = formatVND(item.soldPrice);
                  
                  row.querySelector('.buyer-info').title = buyerEmail;
                  const bImg = row.querySelector('.buyer-avatar');
                  bImg.src = item.buyerAvatar || '';
                  bImg.onerror = function() { this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjY2NjIi8+PC9zdmc+'; };
                  
                  if (item.buyerName) row.querySelector('.buyer-name').textContent = item.buyerName;
                  else row.querySelector('.buyer-name').innerHTML = `<span class="text-muted fst-italic">Chưa có người thắng</span>`;
                  row.querySelector('.buyer-email').textContent = buyerEmail;
                  
                  tbody.appendChild(row);
              });

              if (!document.getElementById('soldPagination')) {
                  const nav = document.createElement('div');
                  nav.id = 'soldPagination';
                  nav.className = 'mt-3';
                  document.getElementById('soldItemsTableBody').parentElement.after(nav);
              }
              renderPagination('soldPagination', pagination.totalPages, page, 'loadSoldItems');
          }
      } catch (e) { devLog('API/loadSoldItems', e, true); }
  }

  // BỔ SUNG: Tải Thống kê tổng quan cho Seller (Chuẩn Doanh nghiệp)
  async function loadSellerStats() {
      try {
          const res = await fetch('/api/seller/stats', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
              const json = await res.json();
              if (json.success) {
                  document.getElementById('totalProducts').textContent = json.data.totalProducts || 0;
                  document.getElementById('activeAuctions').textContent = json.data.activeAuctions || 0;
                  document.getElementById('completedAuctions').textContent = json.data.completedAuctions || 0;
              }
          }
      } catch(e) {}
  }

  // BỔ SUNG: Các hàm xử lý hành động đấu giá
  async function endAuction(id) {
      if(!confirm('Kết thúc phiên đấu giá này ngay lập tức?')) return;
      try {
          const res = await fetch(`/api/seller/auctions/${id}/end`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const data = await res.json();
          if(res.ok) { 
              showNotification(data.message || 'Đã kết thúc phiên đấu giá'); 
              loadAuctions(); // Tải lại để cập nhật trạng thái mới
          } else { 
              showNotification(data.message || 'Lỗi kết thúc', true);
              // Vẫn tải lại danh sách để đồng bộ trạng thái nếu bị lệch
              loadAuctions(); 
          }
      } catch(e) { 
          console.error(e);
          showNotification('Lỗi kết nối server', true); 
      }
  }

  async function deleteAuction(id) {
      if(!confirm('Xóa phiên đấu giá này? Hành động không thể hoàn tác.')) return;
      try {
          const res = await fetch(`/api/seller/auctions/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if(res.ok) { showNotification('Đã xóa thành công'); loadAuctions(); }
          else showNotification('Không thể xóa (có thể đã có người đặt giá)', true);
      } catch(e) { showNotification('Lỗi server', true); }
  }

  async function relistAuction(id) {
      const days = prompt("Nhập số ngày muốn gia hạn (VD: 3):", "3");
      if(!days) return;
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + parseInt(days));
      
      try {
          const res = await fetch(`/api/seller/auctions/${id}/relist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ endTime: endTime.toISOString() })
          });
          if(res.ok) { showNotification('Đã đăng lại thành công'); loadAuctions(); }
          else showNotification('Lỗi đăng lại', true);
      } catch(e) { showNotification('Lỗi server', true); }
  }

  // BỔ SUNG: Hàm xác nhận mã nhận hàng (quét vạch/QR hoặc nhập tay)
  async function verifyPickupCode(auctionId) {
      const code = prompt("Vui lòng nhập Mã Nhận Hàng (VD: AP-000123) hoặc quét mã QR/mã vạch:", "");
      if (!code) return;

      try {
          const res = await fetch('/api/seller/verify-pickup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ pickupCode: code.trim() })
          });
          const data = await res.json();
          if (res.ok) {
              showNotification(data.message);
              loadSoldItems(); // Tải lại bảng để lên trạng thái "Đã giao"
          } else {
              showNotification(data.message || 'Xác nhận thất bại', true);
          }
      } catch(e) {
          showNotification('Lỗi kết nối server', true);
      }
  }

    // --- CATEGORY ---
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories');
            if(res.ok) {
                const json = await res.json();
                const categories = json.data || [];
                const addSelect = document.getElementById('productCategory');
                const editSelect = document.getElementById('editProductCategory');
                const options = '<option value="">Chọn danh mục...</option>' + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                if (addSelect) addSelect.innerHTML = options;
                if (editSelect) editSelect.innerHTML = options;
            }
        } catch(e) {
            devLog('API/loadCategories', e, true);
        }
    }

        // Hàm thêm ô nhập URL ảnh
        function addUrlInput() {
            const div = document.createElement('div');
            div.className = 'input-group mb-2';
            div.innerHTML = `
                <input type="url" class="form-control" placeholder="https://example.com/image.jpg">
                <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
            `;
            document.getElementById('urlInputsContainer').appendChild(div);
        }

        document.getElementById('addProductForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            devLog('Form', 'Submitting addProductForm');
            
            const btnSubmit = e.target.querySelector('button[type="submit"]');
            const originalBtnText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang lưu...';
            btnSubmit.disabled = true;
            
            const name = document.getElementById('productName').value;
            const description = document.getElementById('productDescription').value;
            const price = document.getElementById('productPrice').value;
            const stock = document.getElementById('productStock').value;
            const categoryId = document.getElementById('productCategory').value;

            const files = document.getElementById('addProductImages').files;

            // Lấy danh sách URL ảnh từ tab Link Online
            const imageUrls = [];
            const urlInputs = document.querySelectorAll('#urlInputsContainer input');
            urlInputs.forEach(input => {
                if (input.value && input.value.trim() !== '') {
                    imageUrls.push(input.value.trim());
                }
            });

            // Đọc ảnh local thành Base64
            const filePromises = Array.from(files).map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            });

            try {
                const base64Images = await Promise.all(filePromises);
                const allImages = [...base64Images, ...imageUrls];

                const payload = {
                    name,
                    description,
                    price: Number(price),
                    stock: Number(stock),
                categoryId: categoryId ? Number(categoryId) : null,
                    images: allImages
                };

                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification('Thêm sản phẩm thành công');
                    bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
                    loadProducts(1); // Load lại trang 1
                    loadProductsForDropdown(); // Update lại dropdown
                    e.target.reset();
                    // Reset container URL
                    document.getElementById('urlInputsContainer').innerHTML = '';
                } else {
                    devLog('API/POST-Product', data, true);
                    showNotification(data.message || 'Thêm sản phẩm thất bại', true);
                }
            } catch (e) {
                devLog('API/POST-Product', e, true);
                showNotification('Lỗi kết nối server', true);
        } finally {
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
            }
        });

        document.getElementById('createAuctionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            devLog('Form', 'Submitting createAuctionForm');
            const productId = Number(document.getElementById('auctionProduct').value);
            const startingPrice = Number(document.getElementById('startingPrice').value);
            const endTime = document.getElementById('endTime').value;

            // Lấy thêm các tham số mới cho ràng buộc chuyên nghiệp
            const reservePriceEl = document.getElementById('reservePrice');
            const minBidIncrementEl = document.getElementById('minBidIncrement');
            
            const reservePrice = reservePriceEl && reservePriceEl.value ? Number(reservePriceEl.value) : null;
            const minBidIncrement = minBidIncrementEl && minBidIncrementEl.value ? Number(minBidIncrementEl.value) : null;

            if (new Date(endTime) <= new Date()) {
                showNotification('Thời gian kết thúc phải ở trong tương lai.', true);
                return;
            }

            try {
                const response = await fetch('/api/auctions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        productId, 
                        startingPrice, 
                        endTime,
                        reservePrice,
                        minBidIncrement
                    })
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification('Tạo đấu giá thành công');
                    bootstrap.Modal.getInstance(document.getElementById('createAuctionModal')).hide();
                    loadAuctions(1);
                    loadProductsForDropdown(); // Cập nhật lại list sản phẩm (ẩn sp vừa tạo)
                    e.target.reset();
                } else {
                    devLog('API/POST-Auction', data, true);
                    showNotification(data.message || 'Tạo đấu giá thất bại', true);
                }
            } catch (e) {
                devLog('API/POST-Auction', e, true);
                showNotification('Lỗi tạo đấu giá', true);
            }
        });

        async function editProduct(id) {
            try {
                const response = await fetch(`/api/products/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Không thể tải thông tin sản phẩm');
                
                const json = await response.json();
                const product = json.data || json; // Trích xuất đúng dữ liệu
                
                document.getElementById('editProductId').value = product.Id;
                document.getElementById('editProductName').value = product.Name;
                document.getElementById('editProductDescription').value = product.Description;
                document.getElementById('editProductPrice').value = product.Price;
                document.getElementById('editProductStock').value = product.Stock;
            document.getElementById('editProductCategory').value = product.CategoryId || '';

                // Hiển thị ảnh cũ
                const imgContainer = document.getElementById('editCurrentImages');
                imgContainer.innerHTML = '';
                if (product.images && product.images.length > 0) {
                    product.images.forEach(url => {
                        const div = document.createElement('div');
                        div.className = 'position-relative d-inline-block';
                        div.innerHTML = `
                            <img src="${url}" class="edit-preview-img" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;">
                            <button type="button" class="btn-close position-absolute top-0 end-0 bg-white p-1" 
                                    style="font-size: 0.5rem;" onclick="this.parentElement.remove()"></button>
                        `;
                        imgContainer.appendChild(div);
                    });
                } else {
                    imgContainer.innerHTML = '<span class="text-muted small">Chưa có ảnh</span>';
                }

                new bootstrap.Modal(document.getElementById('editProductModal')).show();
            } catch (e) {
                showNotification(e.message, true);
            }
        }

        document.getElementById('editProductForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = e.target.querySelector('button[type="submit"]');
            const originalBtnText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang cập nhật...';
            btnSubmit.disabled = true;
            
            const id = document.getElementById('editProductId').value;
            
            const name = document.getElementById('editProductName').value;
            const description = document.getElementById('editProductDescription').value;
            const price = document.getElementById('editProductPrice').value;
            const stock = document.getElementById('editProductStock').value;
            const categoryId = document.getElementById('editProductCategory').value;

            // Lấy danh sách ảnh cũ còn giữ lại
            const keepImages = [];
            const currentImages = document.querySelectorAll('#editCurrentImages img.edit-preview-img');
            currentImages.forEach(img => {
                keepImages.push(img.getAttribute('src'));
            });

            // Ảnh mới
            const files = document.getElementById('editProductImages').files;
            const filePromises = Array.from(files).map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            });

            try {
                const newImages = await Promise.all(filePromises);
                const payload = {
                    name,
                    description,
                    price: Number(price),
                    stock: Number(stock),
                categoryId: categoryId ? Number(categoryId) : null,
                    keepImages,
                    newImages
                };

                const response = await fetch(`/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    showNotification('Cập nhật sản phẩm thành công');
                    bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide();
                    loadProducts(currentProductPage); // Giữ nguyên trang hiện tại
                } else {
                    const data = await response.json();
                    showNotification(data.message || 'Cập nhật thất bại', true);
                }
            } catch (e) {
                showNotification('Lỗi kết nối server', true);
        } finally {
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
            }
        });

        async function deleteProduct(id) {
            if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
            devLog('API', `Deleting product ID: ${id}`);
            try {
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification('Xóa sản phẩm thành công');
                    loadProducts(currentProductPage);
                    loadProductsForDropdown();
                } else {
                    devLog('API/DELETE-Product', data, true);
                    showNotification(data.message || 'Xóa sản phẩm thất bại', true);
                }
            } catch (e) {
                devLog('API/DELETE-Product', e, true);
                showNotification('Lỗi xóa sản phẩm', true);
            }
        }

        async function viewProductDetails(id) {
            try {
                const response = await fetch(`/api/products/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Không thể tải thông tin sản phẩm');
                
                const json = await response.json();
                const product = json.data || json; // Trích xuất đúng dữ liệu
                
                document.getElementById('viewProductName').textContent = product.Name;
                document.getElementById('viewProductDescription').textContent = product.Description || 'Không có mô tả';
                document.getElementById('viewProductPrice').textContent = formatVND(product.Price);
                document.getElementById('viewProductStock').textContent = product.Stock;
                document.getElementById('viewProductCreated').textContent = new Date(product.CreatedAt).toLocaleString('vi-VN');
                
                // Setup Edit button
                document.getElementById('btnEditFromDetail').onclick = () => {
                    bootstrap.Modal.getInstance(document.getElementById('productDetailModal')).hide();
                    editProduct(product.Id);
                };

                // Images Carousel
                const carouselInner = document.getElementById('productCarouselInner');
                const listImg = document.getElementById('productDetailImagesList');
                carouselInner.innerHTML = '';
                listImg.innerHTML = '';

                if (product.images && product.images.length > 0) {
                    product.images.forEach((url, index) => {
                        // Slide
                        const slide = document.createElement('div');
                        slide.className = `carousel-item ${index === 0 ? 'active' : ''}`;
                        slide.innerHTML = `<img src="${url}" class="d-block w-100 rounded" style="height: 300px; object-fit: cover;" alt="Slide ${index}">`;
                        carouselInner.appendChild(slide);

                        // Thumbnail
                        const img = document.createElement('img');
                        img.src = url;
                        img.style.width = '60px';
                        img.style.height = '60px';
                        img.style.objectFit = 'cover';
                        img.className = 'rounded border cursor-pointer opacity-75 hover-opacity-100';
                        img.onclick = () => new bootstrap.Carousel(document.getElementById('productCarousel')).to(index);
                        listImg.appendChild(img);
                    });
                } else {
                    carouselInner.innerHTML = `<div class="carousel-item active"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNTU1Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=" class="d-block w-100 rounded"></div>`;
                }

                new bootstrap.Modal(document.getElementById('productDetailModal')).show();
            } catch (e) {
                showNotification(e.message, true);
            }
        }

        async function viewAuctionDetails(id) {
            currentViewingAuctionId = id;
            const modal = new bootstrap.Modal(document.getElementById('auctionDetailModal'));
            
            try {
                // TỐI ƯU: Gửi cả 2 request cùng lúc thay vì đợi nhau
                const [resDetail, resBids] = await Promise.all([
                    fetch(`/api/auctions/${id}`),
                    fetch(`/api/auctions/${id}/bids`)
                ]);

                if (!resDetail.ok) throw new Error(`Không thể tải chi tiết đấu giá: ${resDetail.status}`);
                const detailData = await resDetail.json();
                const auction = detailData.data;
                
                const bidsData = await resBids.json();
                const bids = bidsData.data || [];

                // Cập nhật nội dung Modal
                document.getElementById('detailProductName').textContent = auction.productName || 'Sản phẩm không tên';
                document.getElementById('detailDescription').textContent = auction.productDescription || 'Không có mô tả.';
                document.getElementById('detailStartingPrice').textContent = formatVND(auction.starting_price);
                document.getElementById('detailCurrentPrice').textContent = formatVND(auction.current_price);
                document.getElementById('detailHighestBidder').textContent = auction.highestBidderName || 'Chưa có';
                document.getElementById('detailEndTime').textContent = new Date(auction.end_date).toLocaleString('vi-VN');
                
                const statusBadge = auction.status === 'ACTIVE' 
                    ? '<span class="badge bg-success">Đang diễn ra</span>' 
                    : '<span class="badge bg-secondary">Đã kết thúc</span>';
                
                let statusHtml = statusBadge;
                if (auction.reserve_price) {
                    statusHtml += ` <span class="badge bg-warning text-dark ms-2"><i class="fas fa-bolt"></i> Mua đứt: ${formatVND(auction.reserve_price)}</span>`;
                }
                if (auction.min_bid_increment) {
                    statusHtml += ` <span class="badge bg-info text-dark ms-2"><i class="fas fa-level-up-alt"></i> Bước giá: ${formatVND(auction.min_bid_increment)}</span>`;
                }
                document.getElementById('detailStatus').innerHTML = statusHtml;

                // Ảnh
                const carouselInner = document.getElementById('carouselInner');
                const thumbList = document.getElementById('detailImagesList');
                carouselInner.innerHTML = '';
                thumbList.innerHTML = '';
                
                if (auction.images && auction.images.length > 0) {
                    auction.images.forEach((url, index) => {
                        // Add to Carousel
                        const slide = document.createElement('div');
                        slide.className = `carousel-item ${index === 0 ? 'active' : ''}`;
                        slide.innerHTML = `<img src="${url}" class="d-block w-100 rounded" style="height: 300px; object-fit: cover;" alt="Slide ${index}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNTU1Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg=='">`;
                        carouselInner.appendChild(slide);

                        // Add to Thumbnails list
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'rounded border cursor-pointer opacity-75 hover-opacity-100 p-1';
                        img.style.width = '60px'; img.style.height = '60px'; img.style.objectFit = 'cover';
                        // Click thumbnail to switch slide
                        img.onclick = () => new bootstrap.Carousel(document.getElementById('auctionCarousel')).to(index);
                        thumbList.appendChild(img);
                    });
                } else {
                    carouselInner.innerHTML = `<div class="carousel-item active"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNTU1Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=" class="d-block w-100 rounded"></div>`;
                }

                // Lịch sử bid
                const bidBody = document.getElementById('detailBidHistory');
                bidBody.innerHTML = '';
                if (!bids || bids.length === 0) {
                    bidBody.innerHTML = '<tr><td colspan="3" class="text-center">Chưa có lượt đặt giá nào</td></tr>';
                } else {
                    bids.forEach(bid => {
                        bidBody.innerHTML += `
                            <tr>
                                <td>${bid.bidderName || 'Người dùng ẩn'}</td>
                                <td class="text-success fw-bold">${formatVND(bid.amount)}</td>
                                <td class="small">${new Date(bid.bid_time).toLocaleString('vi-VN')}</td>
                            </tr>
                        `;
                    });
                }

                modal.show();
            } catch (e) {
                console.error(e);
                showNotification('Lỗi tải chi tiết đấu giá', true);
            }
        }

        // Socket: Thông báo sản phẩm đã bán
        socket.on('productSold', (data) => {
            showNotification(data.message);
            loadAuctions(currentAuctionPage);    
            loadSoldItems(1);   
            loadWalletBalance(); // Cập nhật số dư ví
        });

        // Socket events: Lắng nghe sự kiện đặt giá mới
        socket.on('bidUpdate', async (data) => {
            // 1. Cập nhật DOM Table trực tiếp, KHÔNG gọi lại API gây quá tải server
            const row = document.querySelector(`tr[data-auction-row="${data.auctionId}"]`);
            if (row) {
                const priceEl = row.querySelector('.current-price');
                const bidderEl = row.querySelector('.highest-bidder');
                if (priceEl) priceEl.innerHTML = formatVND(data.bidAmount);
                if (bidderEl) bidderEl.innerHTML = data.bidderName || 'Khách';
            }

            // 2. Nếu đang mở modal chi tiết của đúng phiên đấu giá đó -> Cập nhật nội dung modal
            if (currentViewingAuctionId && Number(currentViewingAuctionId) === Number(data.auctionId) && document.getElementById('auctionDetailModal').classList.contains('show')) {
                try {
                    // Cập nhật giá hiện tại
                    const priceEl = document.getElementById('detailCurrentPrice');
                    if (priceEl) priceEl.textContent = formatVND(data.bidAmount);

                    // Tải lại lịch sử đấu giá
                    const resBids = await fetch(`/api/auctions/${data.auctionId}/bids`);
                    const bidsData = await resBids.json();
                    const bids = bidsData.data || [];

                    const bidBody = document.getElementById('detailBidHistory');
                    if (bidBody) {
                        bidBody.innerHTML = '';
                        if (bids.length === 0) {
                            bidBody.innerHTML = '<tr><td colspan="3" class="text-center">Chưa có lượt đặt giá nào</td></tr>';
                        } else {
                            bids.forEach(bid => {
                                // Ensure bid.bidderName, bid.amount, bid.bid_time are correctly accessed
                                // based on the API response structure.
                                // Assuming API returns { bidderName, amount, bid_time }
                                bidBody.innerHTML += `
                                    <tr>
                                        <td>${bid.bidderName || 'Người dùng ẩn'}</td>
                                        <td class="text-success fw-bold">${formatVND(bid.amount)}</td>
                                        <td class="small">${new Date(bid.bid_time).toLocaleString('vi-VN')}</td>
                                    </tr>
                                `;
                            });
                        }
                    }
                } catch (e) {
                    console.error('Socket update error', e);
                }
            }
        });

        // Socket: Balance Update
        socket.on('balanceUpdate', (data) => {
            document.getElementById('walletBalance').textContent = formatVND(data.balance);
            showNotification(`💰 Số dư ví đã được cập nhật: ${formatVND(data.balance)}`);
        });

        // Reset ID khi đóng modal để tránh update sai
        document.getElementById('auctionDetailModal').addEventListener('hidden.bs.modal', () => {
            currentViewingAuctionId = null;
        });

        // Lắng nghe sự kiện từ ui-helpers để tải lại ví
        window.addEventListener('walletUpdate', () => {
            loadWalletBalance();
        });
        
        // Lắng nghe sự kiện từ ui-helpers để tải lại hồ sơ
        window.addEventListener('profileUpdate', (event) => {
            localStorage.setItem('user', JSON.stringify(event.detail));
            loadSellerData(event.detail);
        });

        // BIND SEARCH EVENTS
        document.getElementById('searchProductInput')?.addEventListener('input', debounce((e) => loadProducts(1, e.target.value), 300));
        document.getElementById('searchAuctionInput')?.addEventListener('input', debounce((e) => loadAuctions(1, e.target.value), 300));
        document.getElementById('searchSoldItemInput')?.addEventListener('input', debounce((e) => loadSoldItems(1, e.target.value), 300));


        
        // Initialize App
        (async () => {
            devLog('System', 'Initializing Seller Dashboard...');
            const userData = await checkSellerRole();
            if (userData) {
                await loadSellerData(userData);
                await loadSellerStats(); // Gọi API thống kê để cập nhật 3 thẻ số
                await loadProducts();
                await loadProductsForDropdown();
                await loadAuctions();
                await loadSoldItems(); // Load thêm hàng đã bán
                await loadCategories(); // Load list danh mục cho dropdown

                // Khởi tạo lớp WalletUI
                const walletUI = new WalletUI(token);
                walletUI.init();
                // Khởi tạo lớp ProfileUI
                const profileUI = new ProfileUI(token);
                profileUI.init();
                devLog('System', 'Initialization complete.');
            }
        })();