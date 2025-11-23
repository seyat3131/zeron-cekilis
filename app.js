const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./User');
const Cekilis = require('./Cekilis');
const path = require('path');
const cookieParser = require('cookie-parser');

// 1. GİZLİ ANAHTARLAR (RAILWAY'den gelecek)
const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || 'cok-gizli-bir-oturum-anahtari-default'; 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler (Oturum, Google Auth, JSON İşleme)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// Statik dosyaları sunma
app.use(express.static(path.join(__dirname, 'public'))); 

// MongoDB Bağlantısı
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Bağlantısı Başarılı'))
    .catch(err => console.error('MongoDB Bağlantı Hatası:', err));

// PASSPORT YAPILANDIRMASI
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    // Railway domaininizi Google Console'a eklemeyi unutmayın!
    callbackURL: '/auth/google/callback' 
},
async (accessToken, refreshToken, profile, done) => {
    const newUser = {
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        // ***BURAYI KENDİ E-POSTANIZLA DEĞİŞTİRİN***
        isAdmin: profile.emails[0].value === 'SİZİN_ADMIN_EPOSTANIZ@example.com' 
    };
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            done(null, user);
        } else {
            user = await User.create(newUser);
            done(null, user);
        }
    } catch (err) {
        console.error(err);
        done(err, null);
    }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});


// YARDIMCI MIDDLEWARE (Admin Kontrolü)
const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/google'); // Giriş yapılmamışsa Google Girişine yönlendir
};
const ensureAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).send('Yasak. Bu sayfaya erişim yetkiniz yok.');
};


// ROTALAR (Routes)
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => { res.redirect('/'); }
);
app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});
app.get('/api/user', (req, res) => { // Frontend için kullanıcı bilgisini döndürür
    if (req.isAuthenticated()) {
        res.json({
            loggedIn: true,
            displayName: req.user.displayName,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });
    } else { res.json({ loggedIn: false }); }
});

// ÇEKİLİŞ API'LERİ
app.get('/api/cekilisler', async (req, res) => {
    try {
        const cekilisler = await Cekilis.find({ isActive: true }).sort({ endDate: 1 });
        const responseData = cekilisler.map(cekilis => ({
            id: cekilis._id,
            title: cekilis.title,
            // ... diğer çekiliş detayları
            participantCount: cekilis.participants.length,
            // Kullanıcının katılıp katılmadığını kontrol eder
            katildiMi: req.isAuthenticated() ? cekilis.participants.includes(req.user._id) : false
        }));
        res.json(responseData);
    } catch (err) { res.status(500).send('Hata oluştu.'); }
});

app.post('/api/cekilis/katil/:id', ensureAuth, async (req, res) => { // Çekilişe Katıl
    try {
        const cekilis = await Cekilis.findById(req.params.id);
        if (!cekilis) return res.status(404).json({ success: false, message: 'Çekiliş bulunamadı.' });
        if (cekilis.endDate < new Date()) return res.status(400).json({ success: false, message: 'Süresi doldu.' });
        if (cekilis.participants.includes(req.user._id)) {
            return res.status(400).json({ success: false, message: 'Zaten katıldınız.' });
        }
        cekilis.participants.push(req.user._id);
        await cekilis.save();
        res.json({ success: true, message: 'Başarıyla katıldınız!', newCount: cekilis.participants.length });
    } catch (err) { res.status(500).json({ success: false, message: 'Katılım sırasında bir hata oluştu.' }); }
});

// ADMIN ROTALARI
app.post('/admin/cekilis/create', ensureAdmin, async (req, res) => { // Yeni Çekiliş Oluştur
    try {
        const { title, description, imageUrl, endDate } = req.body;
        const newCekilis = new Cekilis({ title, description, imageUrl, endDate: new Date(endDate) });
        await newCekilis.save();
        res.status(201).json({ success: true, message: 'Yeni çekiliş oluşturuldu.' });
    } catch (err) { res.status(500).json({ success: false, message: 'Çekiliş oluşturulamadı.' }); }
});

app.post('/admin/cekilis/select-winner/:id', ensureAdmin, async (req, res) => { // Kazanan Seç
    try {
        const cekilis = await Cekilis.findById(req.params.id).populate('participants');
        if (!cekilis) return res.status(404).json({ success: false, message: 'Çekiliş bulunamadı.' });
        if (cekilis.participants.length === 0) return res.status(400).json({ success: false, message: 'Hiç katılımcı yok.' });
        
        const randomIndex = Math.floor(Math.random() * cekilis.participants.length);
        const winner = cekilis.participants[randomIndex];
        
        cekilis.winner = winner._id;
        cekilis.isActive = false;
        await cekilis.save();

        res.json({ 
            success: true, 
            message: 'Kazanan başarıyla seçildi!', 
            winnerName: winner.displayName,
            winnerEmail: winner.email
        });
    } catch (err) { res.status(500).json({ success: false, message: 'Kazanan seçilirken hata oluştu.' }); }
});


// Ana Sayfa Yönlendirmesi
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
