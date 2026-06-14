// --- НАСТРОЙКИ ПРОЕКТА (Укажите ваши реальные данные) ---
const MY_WALLET_ADDRESS = "0x0000000000000000000000000000000000000000"; // Кошелек для приема средств пресейла
const LKING_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // Адрес смарт-контракта $LKING
const TOKEN_PRICE_USD = 0.01; // Стоимость токена в USD

const HARD_CAP_USD = 50000;  
let currentRaisedUsd = 16450; 

const TOKEN_ADDRESSES = {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d",
    FDUSD: "0xc5f0f7b66764F6ec8C8Dff7BA68498885979679A"
};

let userAddress = null;
let activeProvider = null;
let bnbPriceUsd = 600; 

// Элементы UI
const connectBtn = document.getElementById('connect-btn');
const buyBtn = document.getElementById('buy-btn');
const claimBtn = document.getElementById('claim-btn');
const currencySelect = document.getElementById('currency-select');
const amountInput = document.getElementById('amount-input');
const tokensOutput = document.getElementById('tokens-output');
const statusText = document.getElementById('status-text');

// Синхронизация прогресс-бара (вызов внешней функции из ui-modal.js)
if (typeof initProgressBar === 'function') {
    initProgressBar(currentRaisedUsd, HARD_CAP_USD);
}

// Загрузка курса BNB с CoinGecko API
async function fetchBnbPrice() {
    try {
        const response = await fetch('https://coingecko.com');
        const data = await response.json();
        if(data.binancecoin.usd) bnbPriceUsd = data.binancecoin.usd;
    } catch (err) { console.log("Using default BNB price"); }
}
fetchBnbPrice();

// Отслеживание клика кнопки Connect
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        if (typeof openWalletModal === 'function') {
            // Передаем функцию обработки выбора кошелька в качестве коллбэка
            openWalletModal(handleSelectedWallet);
        }
    });
}

// Маршрутизатор выбора кошелька (ПК расширения + Мобильные диплинки)
async function handleSelectedWallet(walletType) {
    let providerFound = null;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        const currentUrl = window.location.href.replace('https://', '');
        if (walletType === 'metamask') {
            window.location.href = `https://app.link{currentUrl}`;
        } else if (walletType === 'trustwallet') {
            window.location.href = `https://trustwallet.com{encodeURIComponent(window.location.href)}`;
        } else if (walletType === 'okx') {
            window.location.href = `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(window.location.href)}`;
        } else {
            window.location.href = `https://app.link{currentUrl}`;
        }
        return;
    }

    // ПК Сценарий
    if (walletType === 'metamask' && window.ethereum?.isMetaMask) {
        providerFound = window.ethereum;
    } else if (walletType === 'trustwallet' && window.trustWallet) {
        providerFound = window.trustWallet;
    } else if (walletType === 'binance' && window.BinanceChain) {
        providerFound = window.BinanceChain;
    } else if (walletType === 'okx' && window.okxwallet) {
        providerFound = window.okxwallet;
    } else if (window.ethereum) {
        providerFound = window.ethereum;
    }

    if (!providerFound) {
        updateStatus(`Please install the ${walletType} extension or open on mobile!`, "red");
        return;
    }

    activeProvider = providerFound;
    await processConnection();
}

// Валидация BSC сети и получение аккаунта
async function processConnection() {
    try {
        updateStatus("Connecting to wallet...", "orange");
        const chainIdHex = await activeProvider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        
        if (chainId !== 56) {
            try {
                await activeProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
                window.location.reload();
                return;
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await activeProvider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x38',
                            chainName: 'BNB Smart Chain Mainnet',
                            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                            rpcUrls: ['https://binance.org'],
                            blockExplorerUrls: ['https://bscscan.com']
                        }],
                    });
                    window.location.reload();
                    return;
                }
            }
        }

        const accounts = await activeProvider.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        connectBtn.innerText = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        buyBtn.disabled = false;
        buyBtn.innerText = "Buy $LKING Now";
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = "Claim $LKING";
        }
        updateStatus("Wallet connected successfully! 🎉", "green");

    } catch (err) {
        console.error(err);
        updateStatus("Connection rejected.", "red");
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

// Сборка транзакций покупки (Нативный RPC метод)
async function handlePurchase() {
    const amount = amountInput.value;
    if (!amount || amount <= 0 || !userAddress || !activeProvider) {
        updateStatus("Please enter a valid amount.", "red");
        return;
    }

    const currency = currencySelect.value;
    buyBtn.disabled = true;
    if (claimBtn) claimBtn.disabled = true;
    buyBtn.innerText = "Processing...";
    updateStatus("Confirm transaction in your wallet app...", "orange");

    try {
        if (currency === "BNB") {
            const hexValue = "0x" + BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16);
            const txParams = { from: userAddress, to: MY_WALLET_ADDRESS, value: hexValue };
            await activeProvider.request({ method: 'eth_sendTransaction', params: [txParams] });
        } else {
            const tokenAddress = TOKEN_ADDRESSES[currency];
            const methodId = "0xa9059cbb"; 
            const paddedAddress = MY_WALLET_ADDRESS.substring(2).toLowerCase().padStart(64, '0');
            const tokensInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
            const paddedAmount = tokensInWei.toString(16).padStart(64, '0');
            const txData = methodId + paddedAddress + paddedAmount;

            const txParams = { from: userAddress, to: tokenAddress, data: txData, value: "0x0" };
            await activeProvider.request({ method: 'eth_sendTransaction', params: [txParams] });
        }

        updateStatus("Success! Transaction sent to blockchain. 🎉", "green");
        amountInput.value = "";
        calculateTokens();
    } catch (err) {
        console.error(err);
        updateStatus("Transaction rejected.", "red");
    } finally {
        buyBtn.disabled = false;
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = "Claim $LKING";
        }
        buyBtn.innerText = "Buy $LKING Now";
    }
}

// Добавление иконки и контракта токена в интерфейс кошелька инвестора
async function handleClaim() {
    if (!userAddress || !activeProvider) return;
    buyBtn.disabled = true;
    claimBtn.disabled = true;
    updateStatus("Adding $LKING to your asset list...", "orange");

    try {
        await activeProvider.request({
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
        updateStatus("Tokens tracked! Check your asset list. 🎉", "green");
    } catch (err) {
        console.error(err);
        updateStatus("Claim rejected.", "red");
    } finally {
        buyBtn.disabled = false;
        claimBtn.disabled = false;
    }
}

function updateStatus(text, colorHex) {
    statusText.innerText = text;
    statusText.style.color = colorHex === "green" ? "#2ecc71" : colorHex === "red" ? "#e74c3c" : colorHex === "orange" ? "#f39c12" : "#a6a6a6";
}

// Принудительное обновление при переключении сетей пользователем
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => { window.location.reload(); });
    window.ethereum.on('chainChanged', () => { window.location.reload(); });
}

if (buyBtn) buyBtn.addEventListener('click', handlePurchase);
if (claimBtn) claimBtn.addEventListener('click', handleClaim);
if (amountInput) amountInput.addEventListener('input', calculateTokens);
if (currencySelect) currencySelect.addEventListener('change', calculateTokens);
