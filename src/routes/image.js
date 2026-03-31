const express = require('express');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const router = express.Router();

router.get('/product/:id', async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id);
        const index = parseInt(req.query.index) || 0;
        const db = RepositoryFactory.getDatabaseManager();
        
        const images = await db.query('SELECT image FROM ProductImages WHERE product_id = ? ORDER BY is_primary DESC, id ASC', [productId]);
        
        if (!images || images.length === 0 || !images[index]) {
            return res.redirect('https://via.placeholder.com/300x200/eee/aaa?text=No+Image');
        }

        let base64Data = images[index].image;
        if (Buffer.isBuffer(base64Data)) {
            base64Data = base64Data.toString('utf8');
        }

        if (base64Data.startsWith('http')) {
            return res.redirect(base64Data);
        }

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');

            res.set('Content-Type', mimeType);
            res.set('Cache-Control', 'public, max-age=86400'); // Trình duyệt tự cache ảnh 1 ngày
            return res.send(buffer);
        }

        return res.redirect('https://via.placeholder.com/300x200/eee/aaa?text=Invalid+Image');
    } catch (e) {
        next(e);
    }
});

module.exports = router;