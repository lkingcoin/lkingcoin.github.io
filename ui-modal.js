// Функция плавной анимации прогресс-бара лендинга
function initProgressBar(currentRaised, hardCap) {
    const percentage = Math.min((currentRaised / hardCap) * 100, 100);
    
    const raisedTextEl = document.getElementById('raised-text');
    const targetTextEl = document.getElementById('target-text');
    const percentEl = document.getElementById('progress-percent');
    const fillEl = document.getElementById('progress-fill');

    if (raisedTextEl) raisedTextEl.innerText = `Raised: $${currentRaised.toLocaleString()}`;
    if (targetTextEl) targetTextEl.innerText = `Hard Cap: $${hardCap.toLocaleString()}`;
    if (percentEl) percentEl.innerText = `${percentage.toFixed(1)}%`;
    
    setTimeout(() => {
        if (fillEl) fillEl.style.width = `${percentage}%`;
    }, 300);
}

// Создание и вывод кастомного HTML/CSS окна выбора кошельков
function openWalletModal(onSelectCallback) {
    if (document.getElementById('web3-custom-modal')) {
        document.getElementById('web3-custom-modal').style.display = 'flex';
        return;
    }

    // Внедряем изолированные CSS стили для модалки
    const style = document.createElement('style');
    style.innerText = `
        .w3-modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(5px); }
        .w3-modal-box { background:#1a1a1a; border:1px solid #ffbd59; padding:30px; border-radius:20px; max-width:360px; width:90%; text-align:center; box-shadow:0 10px 30px rgba(255,189,89,0.1); position:relative; }
        .w3-modal-close { position:absolute; top:15px; right:15px; background:transparent; border:none; color:#a6a6a6; font-size:20px; cursor:pointer; }
        .w3-modal-close:hover { color:#fff; }
        .w3-modal-box h2 { font-size:20px; color:#ffbd59; margin-bottom:20px; text-transform:uppercase; letter-spacing:1px; }
        .w3-wallet-option { display:flex; align-items:center; gap:15px; width:100%; background:#0d0d0d; border:1px solid rgba(255,255,255,0.05); padding:12px 20px; margin-bottom:12px; border-radius:12px; cursor:pointer; color:#fff; font-weight:bold; font-size:16px; transition:all 0.3s; text-align:left; }
        .w3-wallet-option:hover { border-color:#ffbd59; background:#1f190f; transform:translateY(-2px); }
        .w3-wallet-option img { width:30px; height:30px; object-fit:contain; border-radius:6px; }
    `;
    document.head.appendChild(style);

    // Создаем DOM узел оверлея
    const overlay = document.createElement('div');
    overlay.className = 'w3-modal-overlay';
    overlay.id = 'web3-custom-modal';
    overlay.innerHTML = `
        <div class="w3-modal-box">
            <button class="w3-modal-close" onclick="document.getElementById('web3-custom-modal').style.display='none'">&times;</button>
            <h2>Select a Wallet</h2>
            <div class="w3-wallet-option" data-wallet="metamask">
                <img src="https://seeklogo.com" alt="MetaMask">
                <span>MetaMask</span>
            </div>
            <div class="w3-wallet-option" data-wallet="trustwallet">
                <img src="https://seeklogo.com" alt="Trust">
                <span>Trust Wallet</span>
            </div>
            <div class="w3-wallet-option" data-wallet="binance">
                <img src="https://seeklogo.com" alt="Binance">
                <span>Binance Wallet</span>
            </div>
            <div class="w3-wallet-option" data-wallet="okx">
                <img src="https://okx.com" alt="OKX">
                <span>OKX Wallet</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Навешиваем слушатели на клики по плашкам
    document.querySelectorAll('.w3-wallet-option').forEach(option => {
        option.addEventListener('click', () => {
            const walletType = option.getAttribute('data-wallet');
            document.getElementById('web3-custom-modal').style.display = 'none';
            if (typeof onSelectCallback === 'function') {
                onSelectCallback(walletType);
            }
        });
    });
}
