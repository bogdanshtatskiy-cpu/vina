import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_LfqCg7ipFvSrHesQtfJnJCmK2rUNAWY",
  authDomain: "vina-8c12b.firebaseapp.com",
  projectId: "vina-8c12b",
  storageBucket: "vina-8c12b.firebasestorage.app",
  messagingSenderId: "611398588014",
  appId: "1:611398588014:web:8f5e94ad8749c5c515787f",
  measurementId: "G-DWGQEGJ5X0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const i18n = {
    'ua': {
        name: 'Назва', expiry: 'Термін придатності', barcode: 'Штрих код', qty: 'Кількість',
        addBtn: 'Додати товар', editBtn: 'Зберегти зміни', cancelBtn: 'Скасувати',
        daysLeft: 'днів', expired: 'Прострочено!', barcodePref: 'ШК:', qtyPref: 'К-ть:',
        newStorePrompt: 'Введіть назву нового магазину:', loading: 'Завантаження...',
        closeCamera: 'Скасувати'
    },
    'ru': {
        name: 'Название', expiry: 'Срок годности', barcode: 'Штрих код', qty: 'Количество',
        addBtn: 'Добавить товар', editBtn: 'Сохранить изменения', cancelBtn: 'Отмена',
        daysLeft: 'дней', expired: 'Просрочено!', barcodePref: 'ШК:', qtyPref: 'Кол-во:',
        newStorePrompt: 'Введите название нового магазина:', loading: 'Загрузка...',
        closeCamera: 'Отмена'
    }
};

let currentLang = localStorage.getItem('lang') === 'ru' ? 'ru' : 'ua';
let editingId = null;
let currentStoreId = null;
let html5QrCode = null; // Переменная для камеры

const toggleLang = document.getElementById('langToggle');
const storeSelect = document.getElementById('storeSelect');
const addStoreBtn = document.getElementById('addStoreBtn');
const productForm = document.getElementById('productForm');
const btnCancel = document.getElementById('btn-cancel');

// Элементы сканера
const scanBtn = document.getElementById('scanBtn');
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');

document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    setInterval(updateDate, 60000);
    
    toggleLang.checked = currentLang === 'ru';
    updateLangUI();
    
    onSnapshot(collection(db, "stores"), (snapshot) => {
        const stores = [];
        snapshot.forEach(doc => stores.push({ id: doc.id, ...doc.data() }));
        if (stores.length === 0) {
            addDoc(collection(db, "stores"), { name: "Руставі 2" });
            addDoc(collection(db, "stores"), { name: "Незламна 1" });
            return;
        }
        renderStores(stores);
    });
});

toggleLang.addEventListener('change', (e) => {
    currentLang = e.target.checked ? 'ru' : 'ua';
    localStorage.setItem('lang', currentLang);
    updateLangUI();
    if (currentStoreId) loadProducts(currentStoreId);
});

addStoreBtn.addEventListener('click', async () => {
    const storeName = prompt(i18n[currentLang].newStorePrompt);
    if (storeName && storeName.trim() !== "") {
        await addDoc(collection(db, "stores"), { name: storeName.trim() });
    }
});

storeSelect.addEventListener('change', (e) => {
    currentStoreId = e.target.value;
    loadProducts(currentStoreId);
});

function renderStores(stores) {
    storeSelect.innerHTML = '';
    stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store.id;
        option.textContent = store.name;
        storeSelect.appendChild(option);
    });
    
    if (stores.length > 0 && !currentStoreId) {
        currentStoreId = stores[0].id;
        storeSelect.value = currentStoreId;
    }
    if (currentStoreId) loadProducts(currentStoreId);
}

let unsubProducts = null;
function loadProducts(storeId) {
    if (unsubProducts) unsubProducts();
    const q = query(collection(db, "products"), where("storeId", "==", storeId));
    unsubProducts = onSnapshot(q, (snapshot) => {
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        products.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
        renderProductsList(products);
    });
}

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentStoreId) return alert("Выберите магазин!");

    const productData = {
        name: document.getElementById('name').value,
        expiry: document.getElementById('expiry').value,
        barcode: document.getElementById('barcode').value,
        qty: document.getElementById('qty').value,
        storeId: currentStoreId
    };

    if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
    } else {
        await addDoc(collection(db, "products"), productData);
    }
    resetForm();
});

window.deleteProduct = async (id) => {
    if(confirm("Удалить этот товар?")) {
        await deleteDoc(doc(db, "products", id));
    }
}

window.editProduct = (id, name, expiry, barcode, qty) => {
    editingId = id;
    document.getElementById('name').value = name;
    document.getElementById('expiry').value = expiry;
    document.getElementById('barcode').value = barcode;
    document.getElementById('qty').value = qty;
    document.getElementById('btn-submit').textContent = i18n[currentLang].editBtn;
    btnCancel.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnCancel.addEventListener('click', resetForm);
function resetForm() {
    editingId = null;
    productForm.reset();
    document.getElementById('btn-submit').textContent = i18n[currentLang].addBtn;
    btnCancel.style.display = 'none';
}

function renderProductsList(products) {
    const list = document.getElementById('productList');
    list.innerHTML = '';
    const today = new Date();
    today.setHours(0,0,0,0);

    products.forEach(product => {
        const expDate = new Date(product.expiry);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        const isDanger = diffDays <= 15;
        
        let dateText = `${expDate.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'uk-UA')} `;
        dateText += diffDays < 0 ? `(${i18n[currentLang].expired})` : `(${diffDays} ${i18n[currentLang].daysLeft})`;

        const div = document.createElement('div');
        div.className = `product-card ${isDanger ? 'danger' : ''}`;
        const safeName = product.name.replace(/'/g, "\\'");
        
        div.innerHTML = `
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-details">
                    <span><strong class="exp-date">${dateText}</strong></span>
                    <span>${i18n[currentLang].barcodePref} <strong>${product.barcode}</strong></span>
                    <span>${i18n[currentLang].qtyPref} <strong>${product.qty}</strong></span>
                </div>
            </div>
            <div class="product-actions">
                <button class="action-btn edit" onclick="editProduct('${product.id}', '${safeName}', '${product.expiry}', '${product.barcode}', '${product.qty}')">✎</button>
                <button class="action-btn delete" onclick="deleteProduct('${product.id}')">✖</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function updateLangUI() {
    const t = i18n[currentLang];
    document.getElementById('lbl-name').textContent = t.name;
    document.getElementById('lbl-expiry').textContent = t.expiry;
    document.getElementById('lbl-barcode').textContent = t.barcode;
    document.getElementById('lbl-qty').textContent = t.qty;
    document.getElementById('btn-submit').textContent = editingId ? t.editBtn : t.addBtn;
    document.getElementById('btn-cancel').textContent = t.cancelBtn;
    document.getElementById('closeScannerBtn').textContent = t.closeCamera;
    if(storeSelect.options.length === 0) storeSelect.innerHTML = `<option>${t.loading}</option>`;
    updateDate();
}

function updateDate() {
    const d = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'uk-UA', options);
}

// --- ЛОГИКА СКАНЕРА ШТРИХКОДОВ ---

scanBtn.addEventListener('click', () => {
    scannerModal.style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    
    // Настройки сканера (environment - задняя камера)
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, 
        (decodedText) => {
            // Успешное сканирование
            document.getElementById('barcode').value = decodedText;
            stopScanner();
        },
        (errorMessage) => {
            // Ошибки сканирования в реальном времени игнорируем, пока не найдет код
        }
    ).catch((err) => {
        alert("Помилка доступу до камери / Ошибка доступа к камере");
        stopScanner();
    });
});

closeScannerBtn.addEventListener('click', stopScanner);

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            scannerModal.style.display = 'none';
        }).catch(err => {
            console.error("Failed to stop scanner", err);
            scannerModal.style.display = 'none';
        });
    } else {
        scannerModal.style.display = 'none';
    }
}
