const cron = require('node-cron');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ServiceFactory } = require('./ServiceFactory');
const { getLogger } = require('../logger');
const { CRON_JOBS } = require('../constants/AppConstants');

class SchedulerService {
    constructor() {
        this.logger = getLogger('SchedulerService');
        this.tasks = [];
        this.db = RepositoryFactory.getDatabaseManager();
    }

    start() {
        this.logger.info('Khởi động các tiến trình ngầm (Cron Jobs)...');

        // 1. Tiến trình xử lý các phiên đấu giá vừa kết thúc (mỗi 30 giây)
        const processEndedAuctionsTask = cron.schedule(CRON_JOBS.PROCESS_ENDED_AUCTIONS || '*/30 * * * * *', async () => {
            try {
                const auctionService = ServiceFactory.getAuctionService();
                const auctions = await auctionService.getAuctionsToProcess();
                
                for (const auction of auctions) {
                    this.logger.info(`Đang xử lý phiên đấu giá vừa kết thúc: ${auction.id}`);
                    // Chuyển trạng thái sang PROCESSING để tránh xử lý trùng lặp
                    await RepositoryFactory.getAuctionRepository().updateStatus(auction.id, 'PROCESSING');
                    await auctionService.markAuctionEnded(auction.id);
                }
            } catch (error) {
                this.logger.error('Lỗi khi xử lý phiên đấu giá kết thúc', error);
            }
        });
        this.tasks.push(processEndedAuctionsTask);

        // 2. Tiến trình dọn dẹp Database ban đêm (03:00 Sáng mỗi ngày)
        const nightlyCleanupTask = cron.schedule('0 3 * * *', async () => {
            this.logger.info('Bắt đầu tiến trình dọn dẹp Database ban đêm...');
            try {
                const res1 = await this.db.query(`DELETE FROM Auctions WHERE status = 'CANCELLED' AND updated_at < NOW() - INTERVAL 30 DAY`);
                this.logger.info(`Đã dọn dẹp ${res1?.affectedRows || res1[0]?.affectedRows || 0} phiên đấu giá đã hủy.`);

                const res2 = await this.db.query(`DELETE FROM Products WHERE is_active = FALSE AND updated_at < NOW() - INTERVAL 30 DAY`);
                this.logger.info(`Đã dọn dẹp ${res2?.affectedRows || res2[0]?.affectedRows || 0} sản phẩm rác.`);
            } catch (error) {
                this.logger.error('Lỗi khi chạy tiến trình dọn dẹp ban đêm', error);
            }
        });
        this.tasks.push(nightlyCleanupTask);
    }

    stop() {
        this.logger.info('Đang dừng các tiến trình ngầm...');
        for (const task of this.tasks) {
            task.stop();
        }
    }
}

let instance = null;
function getSchedulerService() {
    if (!instance) {
        instance = new SchedulerService();
    }
    return instance;
}

module.exports = { SchedulerService, getSchedulerService };