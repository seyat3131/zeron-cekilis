document.addEventListener('DOMContentLoaded', () => {
    const userArea = document.getElementById('user-info');
    const loginBtn = document.getElementById('login-btn');
    const userNameSpan = document.getElementById('user-display-name');
    const cekilisListesi = document.getElementById('cekilis-listesi');
    const adminPanel = document.getElementById('admin-panel');
    const createCekilisForm = document.getElementById('create-cekilis-form');

    let currentUser = null; 

    // Süre hesaplama fonksiyonu
    const formatTimeRemaining = (dateString) => {
        const diff = new Date(dateString) - new Date();
        if (diff <= 0) return 'SÜRESİ DOLDU';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${days}G ${hours}S ${minutes}D`;
    };

    // Kullanıcı Bilgilerini Çekme ve Paneli Güncelleme
    const fetchUserInfo = async () => {
        const res = await fetch('/api/user');
        const userData = await res.json();
        
        if (userData.loggedIn) {
            currentUser = userData;
            loginBtn.style.display = 'none';
            userArea.style.display = 'flex';
            // Kullanıcının ismini ve e-postasını gösterir
            userNameSpan.textContent = `Hoş geldin, ${userData.displayName}`; 
            
            if (userData.isAdmin) {
                adminPanel.style.display = 'block';
                fetchAdminCekilisler(); // Admin çekiliş listesini yükle
            }
        } else {
            loginBtn.style.display = 'block';
            userArea.style.display = 'none';
            adminPanel.style.display = 'none';
        }
    };

    // Çekiliş Kartını Oluşturma
    const createCekilisCard = (cekilis) => {
        // ... (HTML oluşturma mantığı)
        const isExpired = new Date(cekilis.endDate) < new Date();
        const isParticipant = cekilis.katildiMi;

        let buttonHTML;
        if (isExpired) {
            buttonHTML = `<button class="actions-btn disabled-btn">SÜRESİ DOLDU</button>`;
        } else if (!currentUser || !currentUser.loggedIn) {
            buttonHTML = `<a href="/auth/google" class="actions-btn login-btn">Giriş Yap ve Katıl</a>`;
        } else if (isParticipant) {
            buttonHTML = `<button class="actions-btn katildi-btn">Zaten Katıldın</button>`;
        } else {
            buttonHTML = `<button class="actions-btn katil-btn" data-id="${cekilis.id}">Hemen Katıl</button>`;
        }

        const card = document.createElement('div');
        card.className = 'cekilis-card';
        card.setAttribute('data-id', cekilis.id);
        card.innerHTML = `
            <img src="${cekilis.imageUrl}" alt="${cekilis.title}">
            <h3>${cekilis.title}</h3>
            <p class="description">${cekilis.description}</p>
            <div class="info">
                <p>Kalan Süre: <span class="time-left" data-date="${cekilis.endDate}">${formatTimeRemaining(cekilis.endDate)}</span></p>
                <p>Katılımcı: <span class="katilimci-sayisi">${cekilis.participantCount}</span></p>
            </div>
            <div class="actions">
                ${buttonHTML}
            </div>
        `;
        return card;
    };

    // Tüm aktif çekilişleri çekme ve listeleme
    const fetchCekilisler = async () => {
        cekilisListesi.innerHTML = '<h2>✨ Aktif Çekilişler</h2><p>Yükleniyor...</p>';
        try {
            const res = await fetch('/api/cekilisler');
            const cekilisler = await res.json();

            cekilisListesi.innerHTML = '<h2>✨ Aktif Çekilişler</h2>';
            if (cekilisler.length === 0) {
                 cekilisListesi.innerHTML += '<p>Şu an aktif bir çekiliş bulunmamaktadır.</p>';
                 return;
            }

            cekilisler.forEach(cekilis => {
                cekilisListesi.appendChild(createCekilisCard(cekilis));
            });

            document.querySelectorAll('.katil-btn').forEach(button => {
                button.addEventListener('click', handleJoin);
            });

        } catch (error) {
            cekilisListesi.innerHTML = '<h2>✨ Aktif Çekilişler</h2><p>Çekilişler yüklenirken bir hata oluştu.</p>';
        }
    };

    // Çekilişe Katılma İşlemi
    const handleJoin = async (e) => {
        const cekilisId = e.target.getAttribute('data-id');
        try {
            const res = await fetch(`/api/cekilis/katil/${cekilisId}`, { method: 'POST' });
            const result = await res.json();

            if (result.success) {
                alert(result.message);
                const card = document.querySelector(`.cekilis-card[data-id="${cekilisId}"]`);
                if (card) {
                    card.querySelector('.katilimci-sayisi').textContent = result.newCount;
                    const actionsDiv = card.querySelector('.actions');
                    actionsDiv.innerHTML = `<button class="actions-btn katildi-btn">Zaten Katıldın</button>`;
                }
            } else {
                alert('Hata: ' + result.message);
            }
        } catch (error) {
            alert('Katılım sırasında sunucu hatası.');
        }
    };

    // Admin: Çekiliş Oluşturma
    if (createCekilisForm) {
        createCekilisForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const imageUrl = document.getElementById('imageUrl').value;
            const endDate = document.getElementById('endDate').value;

            try {
                const res = await fetch('/admin/cekilis/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description, imageUrl, endDate })
                });
                const result = await res.json();
                alert(result.message);
                if (result.success) {
                    createCekilisForm.reset();
                    fetchCekilisler(); 
                    fetchAdminCekilisler(); 
                }
            } catch (error) {
                alert('Çekiliş oluşturulurken sunucu hatası.');
            }
        });
    }

    // Admin: Kazanan Seçme ve Yönetim Listesi
    const fetchAdminCekilisler = async () => {
        const adminListDiv = document.getElementById('admin-cekilis-list');
        if (!adminListDiv) return;

        adminListDiv.innerHTML = '<p>Aktif çekilişler admin için yükleniyor...</p>';
        try {
            const res = await fetch('/api/cekilisler');
            const cekilisler = await res.json();

            adminListDiv.innerHTML = '';
            cekilisler.forEach(cekilis => {
                const isExpired = new Date(cekilis.endDate) < new Date();
                const btnText = isExpired ? `Kazananı Seç (${cekilis.participantCount} Katılımcı)` : 'Süresi Dolmadı';
                
                const card = document.createElement('div');
                card.className = 'admin-cekilis-item';
                card.innerHTML = `
                    <h4>${cekilis.title}</h4>
                    <p>Bitiş: ${new Date(cekilis.endDate).toLocaleString()}</p>
                    <button class="actions-btn select-winner-btn" data-id="${cekilis.id}" ${!isExpired ? 'disabled' : ''}>${btnText}</button>
                `;
                adminListDiv.appendChild(card);
            });

            document.querySelectorAll('.select-winner-btn').forEach(button => {
                button.addEventListener('click', handleSelectWinner);
            });

        } catch (error) {
            adminListDiv.innerHTML = '<p>Çekiliş yönetimi yüklenirken hata oluştu.</p>';
        }
    };

    const handleSelectWinner = async (e) => {
        const cekilisId = e.target.getAttribute('data-id');
        if (!confirm('Bu çekilişin kazananını rastgele seçmek istediğinizden emin misiniz?')) return;

        try {
            const res = await fetch(`/admin/cekilis/select-winner/${cekilisId}`, { method: 'POST' });
            const result = await res.json();

            if (result.success) {
                alert(`Tebrikler! Kazanan: ${result.winnerName} (${result.winnerEmail})`);
                e.target.disabled = true;
                e.target.textContent = 'Kazanan Seçildi';
                fetchCekilisler(); 
            } else {
                alert('Hata: ' + result.message);
            }

        } catch (error) {
            alert('Kazanan seçimi sırasında sunucu hatası.');
        }
    };


    // Başlangıç İşlemleri
    fetchUserInfo();
    fetchCekilisler();
    
    // Süre Güncelleme
    setInterval(() => {
        document.querySelectorAll('.time-left').forEach(span => {
            span.textContent = formatTimeRemaining(span.getAttribute('data-date'));
        });
    }, 1000);
});
