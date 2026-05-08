const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../frontend/uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ========== ПОЛУЧЕНИЕ ОТЧЁТОВ ==========

// Получить все отчёты (для менеджера)
router.get('/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                r.shift_id,
                r.before_photo_url,
                r.after_photo_url,
                r.comment,
                r.submitted_at,
                u.full_name as worker_name,
                s.shift_date,
                s.start_time,
                s.end_time,
                s.order_id,
                o.address
            FROM reports r
            JOIN shifts s ON r.shift_id = s.id
            JOIN users u ON s.worker_id = u.id
            LEFT JOIN orders o ON s.order_id = o.id
            ORDER BY r.submitted_at DESC
        `);
        console.log(`📸 Найдено отчётов: ${result.rows.length}`);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения всех отчётов:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получить отчёты сотрудника
router.get('/worker/:workerId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, s.shift_date, s.start_time, s.end_time, o.address
            FROM reports r
            JOIN shifts s ON r.shift_id = s.id
            LEFT JOIN orders o ON s.order_id = o.id
            WHERE s.worker_id = $1
            ORDER BY r.submitted_at DESC
        `, [req.params.workerId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения отчётов сотрудника:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получить отчёты по заказу
router.get('/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query(`
            SELECT r.*, u.full_name as worker_name, s.shift_date
            FROM reports r
            JOIN shifts s ON r.shift_id = s.id
            JOIN users u ON s.worker_id = u.id
            WHERE s.order_id = $1
            ORDER BY r.submitted_at DESC
        `, [orderId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения отчётов по заказу:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получить один отчёт по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                r.id,
                r.shift_id,
                r.before_photo_url,
                r.after_photo_url,
                r.comment,
                r.submitted_at,
                s.shift_date,
                s.start_time,
                s.end_time,
                u.full_name as worker_name,
                o.address
            FROM reports r
            JOIN shifts s ON r.shift_id = s.id
            JOIN users u ON s.worker_id = u.id
            LEFT JOIN orders o ON s.order_id = o.id
            WHERE r.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Отчёт не найден' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка получения отчёта:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== СОЗДАНИЕ ОТЧЁТА ==========

// Добавить отчёт
router.post('/', upload.fields([{ name: 'before_photo' }, { name: 'after_photo' }]), async (req, res) => {
    try {
        const { shift_id, comment } = req.body;
        const beforePhoto = req.files['before_photo'] ? `/uploads/${req.files['before_photo'][0].filename}` : null;
        const afterPhoto = req.files['after_photo'] ? `/uploads/${req.files['after_photo'][0].filename}` : null;
        
        console.log(`📸 Создание отчёта для смены ${shift_id}`);
        
        const result = await pool.query(
            'INSERT INTO reports (shift_id, before_photo_url, after_photo_url, comment, submitted_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [shift_id, beforePhoto, afterPhoto, comment]
        );
        
        // Обновляем статус смены на "completed"
        await pool.query('UPDATE shifts SET status = $1 WHERE id = $2', ['completed', shift_id]);
        
        // Обновляем статус заказа, если все смены выполнены
        const shift = await pool.query('SELECT order_id FROM shifts WHERE id = $1', [shift_id]);
        const orderId = shift.rows[0].order_id;
        
        if (orderId) {
            const remainingShifts = await pool.query(
                'SELECT COUNT(*) FROM shifts WHERE order_id = $1 AND status != $2',
                [orderId, 'completed']
            );
            
            if (parseInt(remainingShifts.rows[0].count) === 0) {
                await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['completed', orderId]);
                console.log(`✅ Заказ #${orderId} выполнен полностью`);
            } else {
                await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['in_progress', orderId]);
                console.log(`🔄 Заказ #${orderId} в процессе выполнения`);
            }
        }
        
        console.log(`✅ Отчёт для смены ${shift_id} сохранён`);
        res.json(result.rows[0]);
        
    } catch (err) {
        console.error('Ошибка сохранения отчёта:', err);
        res.status(500).json({ error: 'Ошибка сохранения отчёта' });
    }
});

// ========== УДАЛЕНИЕ ОТЧЁТА ==========

// Удалить отчёт
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем информацию об отчёте перед удалением
        const report = await pool.query('SELECT before_photo_url, after_photo_url FROM reports WHERE id = $1', [id]);
        
        if (report.rows.length === 0) {
            return res.status(404).json({ error: 'Отчёт не найден' });
        }
        
        // Удаляем файлы
        if (report.rows[0].before_photo_url) {
            const filePath = path.join(__dirname, '../../frontend', report.rows[0].before_photo_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        if (report.rows[0].after_photo_url) {
            const filePath = path.join(__dirname, '../../frontend', report.rows[0].after_photo_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        
        // Удаляем запись из базы
        await pool.query('DELETE FROM reports WHERE id = $1', [id]);
        
        console.log(`🗑️ Отчёт #${id} удалён`);
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка удаления отчёта:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;