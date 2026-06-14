// --- НАСТРОЙКИ ПРОЕКТА (Укажите ваши реальные данные) ---
const MY_WALLET_ADDRESS = "0xe27BBB352B87299a0367dE5D2Fa6A8dD265c8312"; // Кошелек для сбора средств пресейла
const LKING_TOKEN_ADDRESS = "0x15414caF78e82Ce6DCBb46a32b1CE0FE56A3FF01"; // Адрес смарт-контракта $LKING
const TOKEN_PRICE_USD = 0.003; 

const HARD_CAP_USD = 3000000;  
let currentRaisedUsd = 16450; 

// Официальный тестовый Project ID. Рекомендуется заменить на свой собственный с ://walletconnect.com
const WC_PROJECT_ID = "ef8720add5643262f284b54bff1ca34b"; 

const TOKEN_ADDRESSES = {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d",
    FDUSD: "0xc5f0f7b66764F6ec8C8Dff7BA68498885979679A"
};

// Импортируем модули универсального Web3Modal напрямую из официального CDN
import { createWeb3Modal, defaultWagmiConfig } from 'https://unpkg.com'
import { bsc } from 'https://unpkg.com'
import { watchAccount, getWalletClient, disconnect, signMessage } from 'https://unpkg.com'

let userAddress = null;
let walletClient = null;
let bnbPriceUsd = 600; 

// Элементы UI
const connectBtn = document.getElementById('connect-btn');
const buyBtn = document.getElementById('buy-btn');
const claimBtn = document.getElementById('claim-btn');
const currencySelect = document.getElementById('currency-select');
const amountInput = document.getElementById('amount-input');
const tokensOutput = document.getElementById('tokens-output');
const statusText = document.getElementById('status-text');

// Инициализация конфигурации сетей под Wagmi Core
const chains = [bsc];
const wagmiConfig = defaultWagmiConfig({ 
    chains, 
    projectId: WC_PROJECT_ID, 
    metadata: { 
        name: 'Lion King Presale', 
        description: 'Official LKING Presale Stage',
        url: window.location.origin,
        icons: [window.location.origin + '/Logo200x200png.png']
    } 
});

// Создаем и запускаем интерфейс модального окна выбора кошельков
const modal = createWeb3Modal({ 
    wagmiConfig, 
    projectId: WC_PROJECT_ID, 
    chains,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#ffbd59',
        '--w3m-border-radius-master': '12px'
    }
});

// Анимация прогресс-бара
function initProgressBar() {
    const percentage = Math.min((currentRaisedUsd / HARD_CAP_USD) * 100, 100);
    document.getElementById('raised-text').innerText = `Raised: $${currentRaisedUsd.toLocaleString()}`;
    document.getElementById('target-text').innerText = `Hard Cap: $${HARD_CAP_USD.toLocaleString()}`;
    document.getElementById('progress-percent').innerText = `${percentage.toFixed(1)}%`;
    setTimeout(() => {
        const fillEl = document.getElementById('progress-fill');
        if (fillEl) fillEl.style.width = `${percentage}%`;
    }, 300);
}
initProgressBar();

// Парсинг цены BNB онлайн
async function fetchBnbPrice() {
    try {
        const response = await fetch('https://coingecko.com');
        const data = await response.json();
        if(data.binancecoin.usd) bnbPriceUsd = data.binancecoin.usd;
    } catch (err) { console.log("Using default BNB price"); }
}
fetchBnbPrice();

// Логика клика по кнопке подключения
connectBtn.addEventListener('click', () => {
    if (userAddress) {
        disconnect(); // Если кошелек уже привязан — отключаем сессию
    } else {
        modal.open(); // Если пустой — открываем официальное окно выбора WalletConnect
    }
});

// Функция слежения за статусом подключения (Вызывается автоматически модулем)
watchAccount(async (account) => {
    if (account.isConnected) {
        userAddress = account.address;
        walletClient = await getWalletClient();
        
        connectBtn.innerText = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        buyBtn.disabled = false;
        buyBtn.innerText = "Buy $LKING Now";
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = "Claim $LKING";
        }
        updateStatus("Connected via Web3Modal AppKit! 🦊📱", "green");
    } else {
        userAddress = null;
        walletClient = null;
        connectBtn.innerText = "Connect Wallet";
        buyBtn.disabled = true;
        buyBtn.innerText = "Connect Wallet First";
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.innerText = "Claim $LKING";
        }
        updateStatus("Wallet disconnected.", "orange");
    }
});

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

// Отправка транзакций покупки
async function handlePurchase() {
    const amount = amountInput.value;
    if (!amount || amount <= 0 || !userAddress || !walletClient) {
        updateStatus("Please enter a valid amount.", "red");
        return;
    }

    const currency = currencySelect.value;
    buyBtn.disabled = true;
    if (claimBtn) claimBtn.disabled = true;
    buyBtn.innerText = "Processing...";
    updateStatus("Confirm transaction inside your active wallet app...", "orange");

    try {
        // Получаем провайдер через WalletConnect RPC сессию для выбранного кошелька
        const rawHexValue = "0x" + BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16);

        if (currency === "BNB") {
            const txHash = await walletClient.sendTransaction({
                account: userAddress,
                to: MY_WALLET_ADDRESS,
                value: BigInt(Math.floor(parseFloat(amount) * 1e18))
            });
            updateStatus("Success! Tx Hash: " + txHash.substring(0,10) + "...", "green");
        } else {
            const tokenAddress = TOKEN_ADDRESSES[currency];
            
            // Ручная сборка Data под смарт-контракты стандарта BEP-20
            const methodId = "0xa9059cbb"; 
            const paddedAddress = MY_WALLET_ADDRESS.substring(2).toLowerCase().padStart(64, '0');
            const tokensInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
            const paddedAmount = tokensInWei.toString(16).padStart(64, '0');
            const txData = methodId + paddedAddress + paddedAmount;

            const txHash = await walletClient.sendTransaction({
                account: userAddress,
                to: tokenAddress,
                data: txData
            });
            updateStatus("Token Tx sent! Hash: " + txHash.substring(0,10) + "...", "green");
        }
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
    if (!window.ethereum) {
        updateStatus("Auto-import works best in desktop extension wallets.", "orange");
        return;
    }
    try {
        await window.ethereum.request({
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
        updateStatus("Tokens added to wallet asset list! 🎉", "green");
    } catch (err) { console.error(err); }
}

function updateStatus(text, colorHex) {
    statusText.innerText = text;
    statusText.style.color = colorHex === "green" ? "#2ecc71" : colorHex === "red" ? "#e74c3c" : colorHex === "orange" ? "#f39c12" : "#a6a6a6";
}

if (buyBtn) buyBtn.addEventListener('click', handlePurchase);
if (claimBtn) claimBtn.addEventListener('click', handleClaim);
if (amountInput) amountInput.addEventListener('input', calculateTokens);
if (currencySelect) currencySelect.addEventListener('change', calculateTokens);
