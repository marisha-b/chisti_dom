const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Раздаем статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../frontend/components')));
app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, './')));

// ========== МАРШРУТЫ API ==========
app.use('/api/services', require('./routes/services'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));

// ========== HTML СТРАНИЦЫ ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin-cabinet.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin-cabinet.html'));
});

app.get('/manager-cabinet.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/manager-cabinet.html'));
});

app.get('/worker-cabinet.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/worker-cabinet.html'));
});

app.get('/prices.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/prices.html'));
});

app.get('/order.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/order.html'));
});

app.get('/schedule.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/schedule.html'));
});

app.get('/client-cabinet.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/client-cabinet.html'));
});

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    console.log(`📦 Доступные страницы:`);
    console.log(`   - http://localhost:${PORT}/`);
    console.log(`   - http://localhost:${PORT}/admin-cabinet.html`);
    console.log(`   - http://localhost:${PORT}/manager-cabinet.html`);
    console.log(`   - http://localhost:${PORT}/worker-cabinet.html`);
    console.log(`   - http://localhost:${PORT}/client-cabinet.html`);
    console.log(`   - http://localhost:${PORT}/prices.html`);
    console.log(`   - http://localhost:${PORT}/order.html`);
    console.log(`   - http://localhost:${PORT}/schedule.html`);
});