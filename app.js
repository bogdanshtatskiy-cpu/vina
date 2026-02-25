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

// Локализация
const i18n = {
    'ua': {
        name: 'Назва', expiry: 'Термін придатності', barcode: 'Штрих код', qty: 'Кількість',
        addBtn: 'Додати товар', editBtn: 'Зберегти зміни', cancelBtn: 'Скасувати',
        daysLeft: 'днів', expired: 'Прострочено!', barcodePref: 'ШК:', qtyPref: 'К-ть:',
        newStorePrompt: 'Введіть назву нового магазину:', loading: 'Завантаження...'
    },
    'ru': {
        name: 'Название', expiry: 'Срок годности', barcode: 'Штрих код', qty: 'Количество',
        addBtn: 'Добавить товар', editBtn: 'Сохранить изменения', cancelBtn: 'Отмена',
        daysLeft: 'дней', expired: 'Просрочено!', barcodePref: 'ШК:', qtyPref: 'Кол-во:',
        newStorePrompt: 'Введите название нового магазина:', loading: 'Загрузка...'
    }
};

let currentLang = localStorage.getItem('lang') === 'ru' ? 'ru' : 'ua';
let editingId = null;
let currentStoreId = null;

// Элементы UI
const toggleLang = document.getElementById('langToggle');
const storeSelect = document.getElementById('storeSelect');
const addStoreBtn = document.getElementById('addStoreBtn');
const productForm = document.getElementById('productForm');
const btnCancel = document.getElementById('btn-cancel');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    setInterval(updateDate, 60000);
    
    toggleLang.checked = currentLang === 'ru';
    updateLangUI();
    
    // Подписка на магазины в Firebase
    onSnapshot(collection(db, "stores"), (snapshot) => {
        const stores = [];
        snapshot.forEach(doc => stores.push({ id: doc.id, ...doc.data() }));
        
        // Если магазинов нет, создаем дефолтные
        if (stores.length === 0) {
            addDoc(collection(db, "stores"), { name: "Руставі 2" });
            addDoc(collection(db, "stores"), { name: "Незламна 1" });
            return;
        }
        
        renderStores(stores);
    });
});

// Смена языка
toggleLang.addEventListener('change', (e) => {
    currentLang = e.target.checked ? 'ru' : 'ua';
    localStorage.setItem('lang', currentLang);
    updateLangUI();
    if (currentStoreId) loadProducts(currentStoreId); // Перерисовка товаров с новым языком
});

// Добавление магазина
addStoreBtn.addEventListener('click', async () => {
    const storeName = prompt(i18n[currentLang].newStorePrompt);
    if (storeName && storeName.trim() !== "") {
        await addDoc(collection(db, "stores"), { name: storeName.trim() });
    }
});

// Смена магазина
storeSelect.addEventListener('change', (e) => {
    currentStoreId = e.target.value;
    loadProducts(currentStoreId);
});

// Отрисовка дропдауна магазинов
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

// Загрузка товаров для выбранного магазина
let unsubProducts = null;
function loadProducts(storeId) {
    if (unsubProducts) unsubProducts(); // Отписываемся от предыдущего слушателя

    const q = query(collection(db, "products"), where("storeId", "==", storeId));
    
    unsubProducts = onSnapshot(q, (snapshot) => {
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        
        // Сортировка на стороне клиента (чтобы не создавать индексы в Firebase)
        products.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
        renderProductsList(products);
    });
}

// Добавление/Обновление товара
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

// Удаление
window.deleteProduct = async (id) => {
    if(confirm("Удалить этот товар?")) {
        await deleteDoc(doc(db, "products", id));
    }
}

// Редактирование
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

// Отмена редактирования
btnCancel.addEventListener('click', resetForm);
function resetForm() {
    editingId = null;
    productForm.reset();
    document.getElementById('btn-submit').textContent = i18n[currentLang].addBtn;
    btnCancel.style.display = 'none';
}

// Отрисовка товаров
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
        
        // Передаем параметры в функцию редактирования экранируя кавычки
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

// Обновление интерфейса при смене языка
function updateLangUI() {
    const t = i18n[currentLang];
    document.getElementById('lbl-name').textContent = t.name;
    document.getElementById('lbl-expiry').textContent = t.expiry;
    document.getElementById('lbl-barcode').textContent = t.barcode;
    document.getElementById('lbl-qty').textContent = t.qty;
    document.getElementById('btn-submit').textContent = editingId ? t.editBtn : t.addBtn;
    document.getElementById('btn-cancel').textContent = t.cancelBtn;
    if(storeSelect.options.length === 0) storeSelect.innerHTML = `<option>${t.loading}</option>`;
    updateDate();
}

function updateDate() {
    const d = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'uk-UA', options);
}
