const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'candle2024';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 确保 uploads 目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 数据文件路径（优先使用 Railway Volume 挂载点）
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// ========== 并发安全的文件读写 ==========

function readData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
    const tmp = DATA_FILE + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
}

// ========== 后台认证中间件 ==========

function checkAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
        return res.status(401).send('未授权访问');
    }
    next();
}

// ========== API 路由 ==========

app.post('/api/submit', (req, res) => {
    try {
        const data = readData();
        const answer = req.body;
        answer.id = Date.now().toString(36);
        answer.time = new Date().toLocaleString('zh-CN');
        data.push(answer);
        writeData(data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/responses', checkAdmin, (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 图片上传
app.post('/api/upload', (req, res) => {
    try {
        const { filename, mimetype, data: base64 } = req.body;
        if (!filename || !base64) return res.status(400).json({ success: false, error: '缺少参数' });

        const ext = path.extname(filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return res.status(400).json({ success: false, error: '不支持的文件格式' });
        }

        const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
        const savedName = id + ext;
        const filePath = path.join(UPLOAD_DIR, savedName);
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

        res.json({ success: true, url: `/uploads/${savedName}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
