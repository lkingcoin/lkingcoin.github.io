// --- НАСТРОЙКИ ПРОЕКТА (Укажите ваши реальные данные) ---
const MY_WALLET_ADDRESS = "0xe27BBB352B87299a0367dE5D2Fa6A8dD265c8312"; // Ваш кошелек для приема средств
const LKING_TOKEN_ADDRESS = "0x15414caF78e82Ce6DCBb46a32b1CE0FE56A3FF01"; // Адрес вашего токена $LKING
const TOKEN_PRICE_USD = 0.003; // Цена токена в долларах

const HARD_CAP_USD = 1000000;  
let currentRaisedUsd = 16450; 

// Официальные смарт-контракты стейблкоинов в сети BSC Mainnet
const TOKEN_ADDRESSES = {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d",
    FDUSD: "0xc5f0f7b66764F6ec8C8Dff7BA68498885979679A"
};

let userAddress = null;
let provider = null;
let bnbPriceUsd = 600; 

// Динамическое подключение скрипта выбора кошельков (Web3Modal) в обход блокировок GitHub
function loadWeb3Modal() {
    return new Promise((resolve) => {
        if (window.Web3Modal) return resolve();
        const script = document.createElement('script');
        script.src = "https://unpkg.com";
        script.onload = () => {
            // Дополнительно подгружаем WalletConnect для мобильных (QR-код)
            const wcScript = document.createElement('script');
            wcScript.src = "https://unpkg.com";
            wcScript.onload = () => resolve();
            document.head.appendChild(wcScript);
        };
        document.head.appendChild(script);
    });
}

// Захват элементов DOM
const connectBtn = document.getElementById('connect-btn');
const buyBtn = document.getElementById('buy-btn');
const claimBtn = document.getElementById('claim-btn');
const currencySelect = document.getElementById('currency-select');
const amountInput = document.getElementById('amount-input');
const tokensOutput = document.getElementById('tokens-output');
const statusText = document.getElementById('status-text');

// Анимация прогресс-бара
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

// Парсинг цены BNB онлайн
async function fetchBnbPrice() {
    try {
        const response = await fetch('https://coingecko.com');
        const data = await response.json();
        if(data.binancecoin.usd) bnbPriceUsd = data.binancecoin.usd;
    } catch (err) { console.log("Using default BNB price"); }
}
fetchBnbPrice();

// Инициализация меню выбора кошельков
let web3Modal;
async function initWeb3Modal() {
    await loadWeb3Modal();
    
    const providerOptions = {
        walletconnect: {
            package: window.WalletConnectProvider,
            options: {
                rpc: {
                    56: "https://binance.org" // BSC RPC
                },
                network: "binance"
            }
        }
    };

    web3Modal = new window.Web3Modal.default({
        cacheProvider: false, 
        providerOptions,
        theme: "dark"
    });
}
initWeb3Modal();

// Клик по кнопке запускает Окно Выбора
async function connectWallet() {
    if (!web3Modal) await initWeb3Modal();
    
    try {
        updateStatus("Opening wallet selection...", "orange");
        provider = await web3Modal.connect();
        
        // Запрос ID сети напрямую
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        
        if (chainId !== 56) {
            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }], 
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x38',
                            chainName: 'BNB Smart Chain Mainnet',
                            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                            rpcUrls: ['https://binance.org'],
                            blockExplorerUrls: ['https://bscscan.com']
                        }],
                    });
                } else {
                    updateStatus("Please switch network to BSC Mainnet.", "red");
                    return;
                }
            }
        }

        const accounts = await provider.request({ method: 'eth_accounts' });
        userAddress = accounts[0];

        connectBtn.innerText = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        buyBtn.disabled = false;
        buyBtn.innerText = "Buy $LKING Now";
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = "Claim $LKING";
        }
        updateStatus("Wallet connected successfully!", "green");

        // Слушатели событий внутри выбранного кошелька
        provider.on("accountsChanged", (accounts) => { window.location.reload(); });
        provider.on("chainChanged", (chainId) => { window.location.reload(); });

    } catch (err) {
        console.error(err);
        updateStatus("Connection cancelled or failed.", "red");
    }
}

// Конвертер валюты в токены
function calculateTokens() {
    const amount = parseFloat(amountInput.value) || 0;
    const currency = currencySelect.value;
    let totalValueInUsd = 0;
    if (currency === "BNB") { totalValueInUsd = amount * bnbPriceUsd; } 
    else { totalValueInUsd = amount; }
    const tokensToReceive = totalValueInUsd / TOKEN_PRICE_USD;
    tokensOutput.innerText = tokensToReceive.toLocaleString(undefined, {maximumFractionDigits: 2}) + " $LKING";
}

// Обработка покупки через выбранный кошелек
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
    updateStatus("Please confirm transaction in your wallet app...", "orange");

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

        updateStatus("Success! Transaction sent to blockchain. 🎉", "green");
        amountInput.value = "";
        calculateTokens();
    } catch (err) {
        console.error(err);
        updateStatus("Transaction failed or rejected.", "red");
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
        updateStatus("Tokens tracked successfully! 🎉", "green");
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
