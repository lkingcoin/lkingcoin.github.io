// --- НАСТРОЙКИ ПРОЕКТА (Укажите ваши реальные данные) ---
const MY_WALLET_ADDRESS = "0xe27BBB352B87299a0367dE5D2Fa6A8dD265c8312"; // <--- ВАШ КОШЕЛЕК ДЛЯ СБОРА СРЕДСТВ
const LKING_TOKEN_ADDRESS = "0x15414caF78e82Ce6DCBb46a32b1CE0FE56A3FF01"; // <--- АДРЕС ТОКЕНА $LKING
const TOKEN_PRICE_USD = 0.003; 

const HARD_CAP_USD = 1000000;  
let currentRaisedUsd = 16450; 

const TOKEN_ADDRESSES = {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d",
    FDUSD: "0xc5f0f7b66764F6ec8C8Dff7BA68498885979679A"
};

let userAddress = null;
let provider = null;
let onboard = null;
let bnbPriceUsd = 600; 

// Элементы интерфейса
const connectBtn = document.getElementById('connect-btn');
const buyBtn = document.getElementById('buy-btn');
const claimBtn = document.getElementById('claim-btn');
const currencySelect = document.getElementById('currency-select');
const amountInput = document.getElementById('amount-input');
const tokensOutput = document.getElementById('tokens-output');
const statusText = document.getElementById('status-text');

// Прогресс-бар
function updateProgressBar() {
    const percentage = Math.min((currentRaisedUsd / HARD_CAP_USD) * 100, 100);
    document.getElementById('raised-text').innerText = `Raised: $${currentRaisedUsd.toLocaleString()}`;
    document.getElementById('target-text').innerText = `Hard Cap: $${HARD_CAP_USD.toLocaleString()}`;
    document.getElementById('progress-percent').innerText = `${percentage.toFixed(1)}%`;
    setTimeout(() => {
        const fillElement = document.getElementById('progress-fill');
        if (fillElement) fillElement.style.width = `${percentage}%`;
    }, 300);
}
updateProgressBar();

// Курс BNB
async function fetchBnbPrice() {
    try {
        const response = await fetch('https://coingecko.com');
        const data = await response.json();
        if(data.binancecoin.usd) bnbPriceUsd = data.binancecoin.usd;
    } catch (err) { console.log("Using default BNB price"); }
}
fetchBnbPrice();

// Инициализация мульти-выбора кошельков (Blocknative)
function initOnboard() {
    const injected = window.injectedWallets.default();
    
    onboard = window.Onboard.default({
        wallets: [injected],
        chains: [
            {
                id: '0x38', // 56 в hex (BSC)
                token: 'BNB',
                label: 'BNB Smart Chain',
                rpcUrl: 'https://binance.org'
            }
        ],
        appMetadata: {
            name: 'Lion King Presale',
            icon: '<svg></svg>',
            description: 'Join $LKING Presale'
        },
        theme: 'dark'
    });
}
initOnboard();

// Логика кнопки Connect
async function connectWallet() {
    if (!onboard) initOnboard();
    
    try {
        updateStatus("Opening wallet choice...", "orange");
        const wallets = await onboard.connectWallet();
        
        if (wallets.length > 0) {
            provider = wallets[0].provider;
            userAddress = wallets[0].accounts[0].address;
            
            connectBtn.innerText = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
            buyBtn.disabled = false;
            buyBtn.innerText = "Buy $LKING Now";
            if (claimBtn) {
                claimBtn.disabled = false;
                claimBtn.innerText = "Claim $LKING";
            }
            updateStatus("Connected via " + wallets[0].label + "! 🎉", "green");
        } else {
            updateStatus("Connection cancelled.", "orange");
        }
    } catch (err) {
        console.error(err);
        updateStatus("Failed to open wallet modal.", "red");
    }
}

// Калькулятор токенов
function calculateTokens() {
    const amount = parseFloat(amountInput.value) || 0;
    const currency = currencySelect.value;
    let totalValueInUsd = 0;
    if (currency === "BNB") { totalValueInUsd = amount * bnbPriceUsd; } 
    else { totalValueInUsd = amount; }
    const tokensToReceive = totalValueInUsd / TOKEN_PRICE_USD;
    tokensOutput.innerText = tokensToReceive.toLocaleString(undefined, {maximumFractionDigits: 2}) + " $LKING";
}

// Обработка транзакции покупки
async function handlePurchase() {
    const amount = amountInput.value;
    if (!amount || amount <= 0 || !userAddress || !provider) {
        updateStatus("Please enter a valid amount.", "red");
        return;
    }

    const currency = currencySelect.value;
    buyBtn.disabled = true;
    if (claimBtn) claimBtn.disabled = true;
    buyBtn.innerText = "Processing...";
    updateStatus("Confirm the transaction in your wallet...", "orange");

    try {
        if (currency === "BNB") {
            const hexValue = "0x" + BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16);
            const txParams = { from: userAddress, to: MY_WALLET_ADDRESS, value: hexValue };
            await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
        } else {
            const tokenAddress = TOKEN_ADDRESSES[currency];
            const methodId = "0xa9059cbb"; 
            const paddedAddress = MY_WALLET_ADDRESS.substring(2).toLowerCase().padStart(64, '0');
            const tokensInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
            const paddedAmount = tokensInWei.toString(16).padStart(64, '0');
            const txData = methodId + paddedAddress + paddedAmount;

            const txParams = { from: userAddress, to: tokenAddress, data: txData, value: "0x0" };
            await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
        }

        updateStatus("Success! Transaction broadcasted. 🎉", "green");
        amountInput.value = "";
        calculateTokens();
    } catch (err) {
        console.error(err);
        updateStatus("Transaction rejected or failed.", "red");
    } finally {
        buyBtn.disabled = false;
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = "Claim $LKING";
        }
        buyBtn.innerText = "Buy $LKING Now";
    }
}

// Функция Claim 
async function handleClaim() {
    if (!userAddress || !provider) return;
    buyBtn.disabled = true;
    claimBtn.disabled = true;
    updateStatus("Adding $LKING to your asset list...", "orange");

    try {
        await provider.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: LKING_TOKEN_ADDRESS, 
                    symbol: 'LKING', 
                    decimals: 18, 
                    image: window.location.origin + '/Logo200x200png.png', 
                },
            },
        });
        updateStatus("Tokens successfully added to wallet! 🎉", "green");
    } catch (err) {
        console.error(err);
        updateStatus("Claim process rejected.", "red");
    } finally {
        buyBtn.disabled = false;
        claimBtn.disabled = false;
    }
}

function updateStatus(text, colorHex) {
    statusText.innerText = text;
    statusText.style.color = colorHex === "green" ? "#2ecc71" : colorHex === "red" ? "#e74c3c" : colorHex === "orange" ? "#f39c12" : "#a6a6a6";
}

connectBtn.addEventListener('click', connectWallet);
buyBtn.addEventListener('click', handlePurchase);
if (claimBtn) claimBtn.addEventListener('click', handleClaim);
amountInput.addEventListener('input', calculateTokens);
currencySelect.addEventListener('change', calculateTokens);
