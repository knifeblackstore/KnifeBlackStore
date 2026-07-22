// Configuración de Firebase (Idéntica a script.js)
const firebaseConfig = {
    apiKey: "AIzaSyBIW_YWb2VlQsTArOV7fK2li4Aux8X0ucY",
    authDomain: "knifeblackstore-1791.firebaseapp.com",
    databaseURL: "https://knifeblackstore-1791-default-rtdb.firebaseio.com",
    projectId: "knifeblackstore-1791",
    storageBucket: "knifeblackstore-1791.firebasestorage.app",
    messagingSenderId: "395101425109",
    appId: "1:395101425109:web:905bb04ffadc1f7e38815c",
    measurementId: "G-75NNCB77H8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Verificación de Acceso Admin
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user || user.role !== 'admin') {
    alert("ACCESO DENEGADO. Solo el administrador puede usar el sistema POS.");
    window.location.href = 'index.html';
} else {
    document.getElementById('app').style.display = 'flex';
}

// Variables Globales POS
let allProducts = [];
let posCart = [];
let posDiscount = 0;

// Elementos del DOM
const gridEl = document.getElementById('pos-grid');
const searchEl = document.getElementById('pos-search');
const cartItemsEl = document.getElementById('pos-cart-items');
const subtotalEl = document.getElementById('pos-subtotal');
const discountEl = document.getElementById('pos-discount');
const totalEl = document.getElementById('pos-total');
const btnCheckout = document.getElementById('btn-checkout');
const inputManualDiscount = document.getElementById('manual-discount');

// Cargar Inventario desde Firebase
const loadInventory = () => {
    gridEl.innerHTML = '<p style="color:#888; width:100%; grid-column:1/-1;">Cargando inventario...</p>';
    db.ref('grids').once('value').then(snap => {
        const grids = snap.val() || {};
        allProducts = [];
        
        for (let gridKey in grids) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = grids[gridKey];
            
            const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
            items.forEach((item, itemIdx) => {
                const name = item.querySelector('h2, h3, .product-name, .platform-name')?.innerText || 'Sin nombre';
                const priceText = item.querySelector('.price, .product-price, .platform-price')?.innerText || '$0';
                // Extraer numero del precio
                const priceNum = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
                const stock = parseInt(item.getAttribute('data-stock')) || 0;
                const cat = gridKey.split('_')[1] || 'General';
                
                allProducts.push({
                    name: name,
                    price: priceNum,
                    priceRaw: priceText,
                    stock: stock,
                    cat: cat,
                    gridKey: gridKey,
                    itemIdx: itemIdx
                });
            });
        }
        renderProducts(allProducts);
    });
};

// Renderizar Catálogo POS
const renderProducts = (products) => {
    gridEl.innerHTML = '';
    if (products.length === 0) {
        gridEl.innerHTML = '<p style="color:#888; width:100%; grid-column:1/-1;">No hay productos encontrados.</p>';
        return;
    }
    
    products.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'pos-product-card';
        card.onclick = () => addToCart(p);
        
        let stockClass = p.stock <= 5 ? 'stock low' : 'stock';
        let stockText = p.stock > 0 ? `Stock: ${p.stock}` : 'AGOTADO';
        
        card.innerHTML = `
            <h3>${p.name}</h3>
            <div>
                <div class="price">${p.priceRaw}</div>
                <div class="${stockClass}">${stockText}</div>
            </div>
        `;
        gridEl.appendChild(card);
    });
};

// Búsqueda
searchEl.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.cat.toLowerCase().includes(q)
    );
    renderProducts(filtered);
});

// Lógica de Carrito
const addToCart = (product) => {
    if (product.stock <= 0) {
        alert("Este producto está agotado.");
        return;
    }
    
    const existing = posCart.find(item => item.gridKey === product.gridKey && item.itemIdx === product.itemIdx);
    if (existing) {
        if (existing.qty >= product.stock) {
            alert("No hay más stock disponible para este producto.");
            return;
        }
        existing.qty++;
    } else {
        posCart.push({ ...product, qty: 1 });
    }
    
    updateCartUI();
};

const removeFromCart = (index) => {
    posCart.splice(index, 1);
    updateCartUI();
};

document.getElementById('apply-pos-discount').onclick = () => {
    const val = parseInt(inputManualDiscount.value) || 0;
    posDiscount = val;
    updateCartUI();
};

const updateCartUI = () => {
    cartItemsEl.innerHTML = '';
    
    if (posCart.length === 0) {
        cartItemsEl.innerHTML = '<p style="color:#888; text-align:center; margin-top:50px;">El carrito está vacío</p>';
        btnCheckout.disabled = true;
        subtotalEl.innerText = '$0';
        discountEl.innerText = '-$0';
        totalEl.innerText = '$0';
        return;
    }
    
    btnCheckout.disabled = false;
    let subtotal = 0;
    
    posCart.forEach((item, idx) => {
        subtotal += item.price * item.qty;
        
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div class="cart-item-name">${item.name} <span style="color:#888;">(x${item.qty})</span></div>
            <div class="cart-item-price">$${(item.price * item.qty).toLocaleString()}</div>
            <button class="cart-item-del" onclick="removeFromCart(${idx})">✖</button>
        `;
        cartItemsEl.appendChild(el);
    });
    
    if (posDiscount > subtotal) posDiscount = subtotal; // No descontar más del subtotal
    let total = subtotal - posDiscount;
    
    subtotalEl.innerText = `$${subtotal.toLocaleString()}`;
    discountEl.innerText = `-$${posDiscount.toLocaleString()}`;
    totalEl.innerText = `$${total.toLocaleString()}`;
};

// Checkout & Ticket
btnCheckout.onclick = () => {
    const modal = document.getElementById('checkout-modal');
    const container = document.getElementById('ticket-items-container');
    
    // Llenar ticket
    let sub = 0;
    container.innerHTML = '';
    posCart.forEach(item => {
        sub += item.price * item.qty;
        container.innerHTML += `
            <div class="ticket-item">
                <span style="flex:2;">${item.name} x${item.qty}</span>
                <span style="flex:1; text-align:right;">$${(item.price * item.qty).toLocaleString()}</span>
            </div>
        `;
    });
    
    document.getElementById('ticket-date').innerText = new Date().toLocaleString();
    document.getElementById('ticket-subtotal').innerText = `$${sub.toLocaleString()}`;
    document.getElementById('ticket-discount').innerText = `-$${posDiscount.toLocaleString()}`;
    document.getElementById('ticket-total').innerText = `$${(sub - posDiscount).toLocaleString()}`;
    
    modal.style.display = 'flex';
};

document.getElementById('btn-cancel-sale').onclick = () => {
    document.getElementById('checkout-modal').style.display = 'none';
};

document.getElementById('btn-confirm-sale').onclick = async () => {
    document.getElementById('btn-confirm-sale').innerText = 'Procesando...';
    document.getElementById('btn-confirm-sale').disabled = true;
    
    const paymentMethod = document.getElementById('payment-method').value;
    let sub = posCart.reduce((sum, it) => sum + (it.price * it.qty), 0);
    let tot = sub - posDiscount;
    
    // 1. Guardar Venta en Firebase
    const saleData = {
        customer: 'Venta POS (' + paymentMethod + ')',
        email: user.email,
        items: posCart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total: tot,
        subtotal: sub,
        discountApplied: posDiscount > 0 ? 'Descuento Manual POS' : null,
        discountAmount: posDiscount,
        date: new Date().toISOString(),
        status: 'Completada (POS)'
    };
    await db.ref('sales').push(saleData);
    
    // 2. Descontar Stock modificando el HTML de los grids
    // Agrupar por gridKey para minimizar lecturas/escrituras
    const gridUpdates = {};
    posCart.forEach(item => {
        if (!gridUpdates[item.gridKey]) {
            gridUpdates[item.gridKey] = [];
        }
        gridUpdates[item.gridKey].push(item);
    });
    
    for (const gridKey in gridUpdates) {
        const snap = await db.ref('grids/' + gridKey).once('value');
        const html = snap.val();
        if (html) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const itemsNodeList = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
            
            gridUpdates[gridKey].forEach(cartItem => {
                const targetNode = itemsNodeList[cartItem.itemIdx];
                if (targetNode) {
                    let currentStock = parseInt(targetNode.getAttribute('data-stock')) || 0;
                    let newStock = currentStock - cartItem.qty;
                    if (newStock < 0) newStock = 0;
                    targetNode.setAttribute('data-stock', newStock);
                }
            });
            
            // Guardar HTML actualizado
            await db.ref('grids/' + gridKey).set(tempDiv.innerHTML);
        }
    }
    
    // 3. Imprimir
    window.print();
    
    // 4. Limpiar POS
    posCart = [];
    posDiscount = 0;
    inputManualDiscount.value = '';
    updateCartUI();
    document.getElementById('checkout-modal').style.display = 'none';
    document.getElementById('btn-confirm-sale').innerText = 'Procesar e Imprimir';
    document.getElementById('btn-confirm-sale').disabled = false;
    
    // Recargar inventario para reflejar nuevos stocks
    loadInventory();
};

// --- LOGICA DEL DASHBOARD ---
let allSalesData = [];

document.getElementById('btn-open-dash').onclick = () => {
    document.getElementById('dashboard-modal').style.display = 'flex';
    loadDashboardData();
};

document.getElementById('btn-close-dash').onclick = () => {
    document.getElementById('dashboard-modal').style.display = 'none';
};

const loadDashboardData = () => {
    // Calcular valor del inventario
    let invValue = 0;
    allProducts.forEach(p => {
        invValue += (p.price * p.stock);
    });
    document.getElementById('kpi-inventory-value').innerText = `$${invValue.toLocaleString()}`;

    // Cargar Ventas
    db.ref('sales').once('value').then(snap => {
        const salesObj = snap.val() || {};
        allSalesData = [];
        let totalRevenue = 0;
        
        for (let key in salesObj) {
            allSalesData.push({ id: key, ...salesObj[key] });
            totalRevenue += salesObj[key].total || 0;
        }
        
        // Ordenar por fecha descendente
        allSalesData.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        document.getElementById('kpi-revenue').innerText = `$${totalRevenue.toLocaleString()}`;
        document.getElementById('kpi-orders').innerText = allSalesData.length;
        
        // Llenar tabla (solo ultimas 20 para no saturar)
        const tbody = document.getElementById('dash-sales-table-body');
        tbody.innerHTML = '';
        allSalesData.slice(0, 20).forEach(sale => {
            const dateStr = new Date(sale.date).toLocaleString();
            let itemsText = sale.items ? sale.items.map(i => `${i.name}(x${i.qty || 1})`).join(', ') : 'N/A';
            if(itemsText.length > 50) itemsText = itemsText.substring(0, 47) + '...';
            
            tbody.innerHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${sale.customer}</td>
                    <td title="${sale.items ? sale.items.map(i => i.name).join(', ') : ''}">${itemsText}</td>
                    <td style="color:var(--neon-cyan); font-weight:bold;">$${(sale.total||0).toLocaleString()}</td>
                    <td>${sale.status || 'N/A'}</td>
                </tr>
            `;
        });
    });
};

// --- EXPORTACIONES EXCEL (CSV) ---
document.getElementById('btn-export-sales').onclick = () => {
    if(allSalesData.length === 0) {
        alert("Cargando datos o no hay ventas...");
        return;
    }
    
    let csv = '\uFEFF'; // BOM para Excel
    csv += 'Fecha,Cliente,Email,Items,Subtotal,Descuento,Total,Estado\n';
    
    allSalesData.forEach(s => {
        const date = new Date(s.date).toLocaleString().replace(/,/g, '');
        const cust = `"${s.customer || ''}"`;
        const email = `"${s.email || ''}"`;
        const items = s.items ? `"${s.items.map(i => `${i.name}(x${i.qty||1})`).join('; ')}"` : '""';
        const sub = s.subtotal || 0;
        const desc = s.discountAmount || 0;
        const tot = s.total || 0;
        const status = `"${s.status || ''}"`;
        
        csv += `${date},${cust},${email},${items},${sub},${desc},${tot},${status}\n`;
    });
    
    downloadCSV(csv, `Ventas_Knifeblack_${new Date().toISOString().split('T')[0]}.csv`);
};

document.getElementById('btn-export-inv').onclick = () => {
    if(allProducts.length === 0) {
        alert("No hay productos cargados...");
        return;
    }
    
    let csv = '\uFEFF';
    csv += 'Nombre,Categoria,Precio_Num,Stock,Valor_Total\n';
    
    allProducts.forEach(p => {
        const name = `"${p.name.replace(/"/g, '""')}"`;
        const cat = `"${p.cat}"`;
        const valTot = p.price * p.stock;
        csv += `${name},${cat},${p.price},${p.stock},${valTot}\n`;
    });
    
    downloadCSV(csv, `Inventario_Knifeblack_${new Date().toISOString().split('T')[0]}.csv`);
};

const downloadCSV = (csvContent, fileName) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Inicializar
loadInventory();
