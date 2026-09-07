import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Добро пожаловать в AutoForge02!',
    timestamp: new Date().toISOString()
  });
});

// Проверка здоровья (для Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// API endpoint пример
app.get('/api/info', (req, res) => {
  res.json({
    app: 'AutoForge02',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

app.listen(PORT, () => {
  console.log(`🚀 AutoForge02 запущен на порту ${PORT}`);
});

