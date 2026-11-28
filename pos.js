// Configuración de Firebase (Idéntica a script.js)
// Firebase inicializado dinámicamente vía Cloudflare Worker
const db = firebase.database();

// Verificación de Acceso Admin
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user || user.role !== 'admin') {
    alert("ACCESO DENEGADO. Solo el administrador puede usar el sistema POS.");
    window.location.href = 'index.html';
} else {
    document.getElementById('app').style.display = 'flex';
    
    // Check if Firebase Auth dropped the session (Opera GX issue)
    let authCheckComplete = false;
    firebase.auth().onAuthStateChanged((firebaseUser) => {
        authCheckComplete = true;
        if (!firebaseUser) {
            const pass = prompt("⚠️ Tu navegador (Opera GX) bloqueó la sesión de seguridad.\n\nIngresa tu contraseña de administrador aquí mismo para reconectar Firebase y poder guardar:");
            if (pass) {
                firebase.auth().signInWithEmailAndPassword(user.email, pass)
                    .then(() => alert("¡Reconectado con éxito! Ya puedes guardar."))
                    .catch(e => {
                        alert("Error: " + e.message);
                    });
            }
        }
    });
    
    // Fallback if listener doesn't fire
    setTimeout(() => {
        if (!authCheckComplete && !firebase.auth().currentUser) {
            console.warn("Auth listener delayed.");
        }
    }, 5000);
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
        card.className = 'pos-product-card bubble-card';
        card.onclick = () => addToCart(p);
        
        const isOne = p.stock === 1;
        const isOut = p.stock <= 0;
        let stockClass = isOut ? 'stock out' : (isOne ? 'stock low' : 'stock');
        let stockText = isOut ? '🚫 AGOTADO' : (isOne ? '⚠️ ¡Última unidad!' : `Stock: ${p.stock}`);
        
        card.innerHTML = `
            <h3>${p.name}</h3>
            <div>
                <div class="price">${p.priceRaw}</div>
                <div class="${stockClass}" style="margin-bottom:8px;">${stockText}</div>
                <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation()">
                    <button type="button" onclick="window.adjustPOSStock('${p.gridKey}', ${p.itemIdx}, -1, event)" style="background:#2a2a38; color:#fff; border:1px solid #444; padding:0 !important; width:28px !important; height:28px !important; min-width:28px !important; min-height:28px !important; border-radius:6px; cursor:pointer; font-weight:900; display:inline-flex; align-items:center; justify-content:center; font-size:1rem;">-</button>
                    <span style="font-size:0.88rem; color:var(--neon-cyan); font-weight:bold; min-width:26px; text-align:center;">${p.stock}</span>
                    <button type="button" onclick="window.adjustPOSStock('${p.gridKey}', ${p.itemIdx}, 1, event)" style="background:#2a2a38; color:#fff; border:1px solid #444; padding:0 !important; width:28px !important; height:28px !important; min-width:28px !important; min-height:28px !important; border-radius:6px; cursor:pointer; font-weight:900; display:inline-flex; align-items:center; justify-content:center; font-size:1rem;">+</button>
                    <button type="button" onclick="window.promptEditPOSStock('${p.gridKey}', ${p.itemIdx}, ${p.stock}, event)" style="background:transparent; color:#aaa; border:none; cursor:pointer;" title="Editar número exacto">✏️</button>
                </div>
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
    document.getElementById('btn-confirm-sale').innerText = 'Facturando...';
    document.getElementById('btn-confirm-sale').disabled = true;
    
    const paymentMethod = document.getElementById('payment-method').value;
    const custName = (document.getElementById('pos-cust-name') ? document.getElementById('pos-cust-name').value.trim() : '') || 'Consumidor Final';
    const custDoc = (document.getElementById('pos-cust-doc') ? document.getElementById('pos-cust-doc').value.trim() : '') || 'Consumidor Final';
    const custPhone = (document.getElementById('pos-cust-phone') ? document.getElementById('pos-cust-phone').value.trim() : '') || '';
    const custAddress = (document.getElementById('pos-cust-address') ? document.getElementById('pos-cust-address').value.trim() : '') || 'Mostrador / Local';

    let sub = posCart.reduce((sum, it) => sum + (it.price * it.qty), 0);
    let tot = sub - posDiscount;

    const orderSeq = (allSalesData ? allSalesData.length : 0) + 1;
    const invoiceNumber = 'KBS-' + String(orderSeq).padStart(4, '0');
    const now = new Date();
    
    // 1. Guardar Venta en Firebase
    const saleData = {
        invoiceNumber: invoiceNumber,
        customer: custName,
        customerDoc: custDoc,
        customerPhone: custPhone,
        customerAddress: custAddress,
        paymentMethod: paymentMethod,
        email: user.email,
        items: posCart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total: tot,
        subtotal: sub,
        discountApplied: posDiscount > 0 ? 'Descuento Manual POS' : null,
        discountAmount: posDiscount,
        date: now.toISOString(),
        status: 'Completada (POS)'
    };
    await db.ref('sales').push(saleData);
    
    // Actualizar historial local de clientes
    try {
        if (custName && custName !== 'Consumidor Final') {
            const cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
            const idx = cached.findIndex(c => (c.client || '').toLowerCase() === custName.toLowerCase());
            const clientObj = { client: custName, doc: custDoc, phone: custPhone, address: custAddress };
            if (idx >= 0) cached[idx] = { ...cached[idx], ...clientObj };
            else cached.push(clientObj);
            localStorage.setItem('knifeblack_client_history', JSON.stringify(cached));
            if (typeof window.updatePOSClientsDatalist === 'function') window.updatePOSClientsDatalist();
        }
    } catch (e) { console.warn('Error guardando cliente historial:', e); }

    // 2. Descontar Stock modificando el HTML de los grids
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
            
            await db.ref('grids/' + gridKey).set(tempDiv.innerHTML);
        }
    }
    
    // 3. Preparar estado de factura generada
    currentGeneratedInvoice = {
        invoiceNumber: invoiceNumber,
        date: now.toLocaleDateString('es-CO'),
        time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: paymentMethod,
        customerName: custName,
        customerDoc: custDoc,
        customerPhone: custPhone,
        customerAddress: custAddress,
        items: posCart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        subtotal: sub,
        discount: posDiscount,
        total: tot,
        ownerNit: '1088288308-0',
        ownerPhone: '3108014660',
        ownerEmail: 'knifeblackstore@gmail.com',
        ownerCity: 'Pereira - Risaralda, Colombia'
    };

    // 4. Limpiar POS
    posCart = [];
    posDiscount = 0;
    inputManualDiscount.value = '';
    updateCartUI();
    document.getElementById('checkout-modal').style.display = 'none';
    document.getElementById('btn-confirm-sale').innerText = '📄 Facturar y Generar PDF';
    document.getElementById('btn-confirm-sale').disabled = false;
    
    loadInventory();

    // 5. Mostrar Modal de Factura Generada y descargar automáticamente
    if (document.getElementById('inv-modal-number')) document.getElementById('inv-modal-number').innerText = invoiceNumber;
    if (document.getElementById('inv-modal-client')) document.getElementById('inv-modal-client').innerText = custName + (custDoc !== 'Consumidor Final' ? ' (CC: ' + custDoc + ')' : '');
    if (document.getElementById('inv-modal-total')) document.getElementById('inv-modal-total').innerText = '$' + tot.toLocaleString('es-CO') + ' COP';
    
    const successModal = document.getElementById('invoice-success-modal');
    if (successModal) successModal.style.display = 'flex';

    window.downloadCurrentInvoicePDF();
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
                    <td style="color:var(--neon-cyan); font-weight:bold;">$${(sale.total||0).toLocaleString('es-CO')}</td>
                    <td><span style="font-size:0.75rem; background:rgba(0,240,255,0.1); color:#00f0ff; padding:2px 8px; border-radius:10px;">${sale.status || 'N/A'}</span></td>
                    <td style="white-space:nowrap;">
                        <button onclick="window.downloadSaleInvoicePDF('${sale.id}')" title="Descargar Factura PDF" style="background:#00f0ff; color:#000; border:none; padding:4px 7px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.75rem; margin-right:4px;">📄 PDF</button>
                        <button onclick="window.sendSaleWA('${sale.id}')" title="Reenviar por WhatsApp" style="background:#25D366; color:#fff; border:none; padding:4px 7px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.75rem; margin-right:4px;">💬 WA</button>
                        <button onclick="window.sendSaleEmail('${sale.id}')" title="Reenviar Factura por Correo (EmailJS)" style="background:#ff007f; color:#fff; border:none; padding:4px 7px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.75rem;">✉️ Correo</button>
                    </td>
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


// ============================================================================
// MÓDULO ERP: FINANZAS Y SUSCRIPCIONES
// ============================================================================

let totalSalesRevenue = 0;
let allFinRecords = [];
let currentGeneratedInvoice = null;
let currentDianClientsList = [];
let additionalIncome = 0;
let totalExpenses = 0;

// Escuchar cambios en Ventas (POS y Web)
db.ref('sales').on('value', snap => {
    let salesTotal = 0;
    allSalesData = [];
    snap.forEach(child => {
        const sale = { id: child.key, ...child.val() };
        allSalesData.push(sale);
        const isAdminPurchase = (sale.email === 'knifeblackstore@gmail.com') ||
                                (sale.customer && sale.customer.toLowerCase().includes('admin')) ||
                                (sale.isAdminPurchase === true);
        if (sale.status !== 'Cancelada' && !isAdminPurchase) {
            salesTotal += (sale.total || 0);
        }
    });
    totalSalesRevenue = salesTotal;
    updateFinanceKPIs();
    if (typeof window.updatePOSClientsDatalist === 'function') {
        window.updatePOSClientsDatalist();
    }
    if (typeof window.renderDianReport === 'function') {
        window.renderDianReport();
    }
});

// Escuchar cambios en Finanzas (Ingresos Manuales y Egresos)
db.ref('finances').on('value', snap => {
    const tbody = document.getElementById('fin-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    additionalIncome = 0;
    totalExpenses = 0;
    
    const records = [];
    snap.forEach(child => {
        records.push({ key: child.key, ...child.val() });
    });
    
    // Ordenar descendente por fecha
    records.sort((a,b) => new Date(b.date) - new Date(a.date));
    allFinRecords = records;
    
    records.forEach(rec => {
        if (rec.type === 'income') {
            additionalIncome += rec.amount;
        } else {
            totalExpenses += rec.amount;
        }
        
        const dateStr = new Date(rec.date).toLocaleDateString() + ' ' + new Date(rec.date).toLocaleTimeString();
        const typeClass = rec.type === 'income' ? 'fin-type-income' : 'fin-type-expense';
        const typeLabel = rec.type === 'income' ? 'Ingreso' : 'Egreso';
        const sign = rec.type === 'income' ? '+' : '-';
        
        tbody.innerHTML += `
            <tr>
                <td data-label="Fecha">${dateStr}</td>
                <td data-label="Descripción">${rec.desc}</td>
                <td data-label="Tipo" class="${typeClass}">${typeLabel}</td>
                <td data-label="Monto" class="${typeClass}">${sign}${rec.amount.toLocaleString()}</td>
                <td data-label="Acción">
                    <button onclick="window.deleteFinancialRecord('${rec.key}')" style="background:#e74c3c; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="Eliminar registro">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    allFinRecords = records;
    updateFinanceKPIs();
    if (typeof window.renderDianReport === 'function') {
        window.renderDianReport();
    }
});

function updateFinanceKPIs() {
    const totalInc = totalSalesRevenue + additionalIncome;
    const net = totalInc - totalExpenses;
    
    const elInc = document.getElementById('fin-total-income');
    const elExp = document.getElementById('fin-total-expense');
    const elBal = document.getElementById('fin-balance');
    
    if(elInc) elInc.innerText = '$' + totalInc.toLocaleString();
    if(elExp) elExp.innerText = '$' + totalExpenses.toLocaleString();
    if(elBal) {
        elBal.innerText = '$' + net.toLocaleString();
        if (net < 0) {
            elBal.style.color = 'var(--neon-pink)';
            elBal.style.textShadow = '0 0 10px rgba(255,0,127,0.3)';
        } else {
            elBal.style.color = 'var(--neon-cyan)';
            elBal.style.textShadow = '0 0 10px rgba(0,240,255,0.3)';
        }
    }
}

window.addFinancialRecord = () => {
    const desc = document.getElementById('fin-desc').value.trim();
    const amount = parseFloat(document.getElementById('fin-amount').value);
    const type = document.getElementById('fin-type').value;
    
    if (!desc || isNaN(amount) || amount <= 0) {
        alert('Por favor, ingresa una descripción y un monto válido.');
        return;
    }
    
    db.ref('finances').push({
        desc: desc,
        amount: amount,
        type: type,
        date: new Date().toISOString()
    }).then(() => {
        document.getElementById('fin-desc').value = '';
        document.getElementById('fin-amount').value = '';
        alert('Registro añadido con éxito.');
    }).catch(e => alert('Error al guardar registro financiero: ' + e.message));
};

// ============================================================================
// GESTOR DE SUSCRIPCIONES (PANTALLAS)
// ============================================================================

window.handlePlatformChange = (selectEl) => {
    const customInput = document.getElementById('sub-platform-custom');
    if (!customInput) return;
    if (selectEl.value === 'otro') {
        customInput.style.display = 'block';
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
};

let currentSubFilter = 'all'; // 'all' | 'active' | 'warning' | 'expired' | 'norenew'
let allSubRecords = [];

window.setSubscriptionFilter = (filterType) => {
    currentSubFilter = filterType;
    document.querySelectorAll('.sub-filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('sub-filter-' + filterType);
    if (activeBtn) activeBtn.classList.add('active');
    renderSubscriptionsTable();
    window.populateClientHistory();
    populateClientHistory();
};


// ============================================================================
// FUNCIONES DE HISTORIAL DE CLIENTES Y DURACIÓN (1 AÑO / 1 MES)
// ============================================================================

window.updateSubscriptionDates = () => {
    const subStart = document.getElementById('sub-start');
    const subEnd = document.getElementById('sub-end');
    const durationSelect = document.getElementById('sub-duration');
    if (!subStart || !subEnd) return;
    if (!subStart.value) return;

    const parts = subStart.value.split('-');
    if (parts.length !== 3) return;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    const dur = durationSelect ? durationSelect.value : '1m';
    if (dur === '1y') {
        // 1 Año completo (365 días)
        d.setFullYear(d.getFullYear() + 1);
    } else if (dur === '6m') {
        d.setMonth(d.getMonth() + 6);
    } else if (dur === '3m') {
        d.setMonth(d.getMonth() + 3);
    } else {
        // 1m default: 30 días
        d.setDate(d.getDate() + 30);
    }

    const ey = d.getFullYear();
    const em = String(d.getMonth() + 1).padStart(2, '0');
    const ed = String(d.getDate()).padStart(2, '0');
    subEnd.value = `${ey}-${em}-${ed}`;
};

window.populateClientHistory = () => {
    const select = document.getElementById('sub-client-history-select');
    const datalist = document.getElementById('sub-client-datalist');
    if (!select && !datalist) return;

    const clientMap = new Map();

    // 1. Extraer de todas las suscripciones en Firebase
    if (Array.isArray(allSubRecords)) {
        allSubRecords.forEach(s => {
            const clientName = (s.client || s.customer || s.nombre || s.name || '').trim();
            const phone = (s.phone || s.telefono || s.tel || s.whatsapp || '').trim();
            if (clientName) {
                const keyLower = clientName.toLowerCase();
                if (!clientMap.has(keyLower)) {
                    clientMap.set(keyLower, {
                        client: clientName,
                        phone: phone,
                        platform: s.platform || '',
                        duration: s.duration || '1m'
                    });
                }
            }
        });
    }

    // 2. Extraer de caché persistente en localStorage
    try {
        const cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
        if (Array.isArray(cached)) {
            cached.forEach(c => {
                const name = (c.client || '').trim();
                if (name && !clientMap.has(name.toLowerCase())) {
                    clientMap.set(name.toLowerCase(), c);
                }
            });
        }
    } catch (e) {
        console.warn('Error leyendo knifeblack_client_history:', e);
    }

    // Guardar en localStorage
    try {
        const toSave = Array.from(clientMap.values());
        localStorage.setItem('knifeblack_client_history', JSON.stringify(toSave));
    } catch (e) {}

    // Ordenar alfabéticamente
    const sortedClients = Array.from(clientMap.values()).sort((a, b) => a.client.localeCompare(b.client));

    if (select) {
        const curVal = select.value;
        select.innerHTML = '<option value="">-- Seleccionar cliente del historial para no llenar datos de nuevo --</option>';
        sortedClients.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.client;
            opt.textContent = `${item.client} (${item.phone || 'Sin WhatsApp'}) - ${item.platform || 'Streaming'}`;
            select.appendChild(opt);
        });
        if (curVal) select.value = curVal;
    }

    if (datalist) {
        datalist.innerHTML = '';
        sortedClients.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.client;
            opt.label = item.phone ? `WhatsApp: ${item.phone}` : '';
            datalist.appendChild(opt);
        });
    }
};

window.selectHistoricalClient = (clientName) => {
    if (!clientName) return;
    const nameLower = clientName.trim().toLowerCase();

    let found = allSubRecords.find(s => ((s.client || s.customer || s.nombre || s.name || '').trim().toLowerCase()) === nameLower);
    
    if (!found) {
        try {
            const cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
            found = cached.find(c => ((c.client || '').trim().toLowerCase()) === nameLower);
        } catch (e) {}
    }

    if (found) {
        const clientInput = document.getElementById('sub-client');
        const phoneInput = document.getElementById('sub-phone');
        const durationSelect = document.getElementById('sub-duration');
        const platformSelect = document.getElementById('sub-platform-select');
        const platformCustom = document.getElementById('sub-platform-custom');

        if (clientInput) clientInput.value = found.client || found.customer || found.name || clientName;
        if (phoneInput) phoneInput.value = found.phone || found.telefono || found.tel || found.whatsapp || '';

        if (found.duration && durationSelect) {
            durationSelect.value = found.duration;
            window.updateSubscriptionDates();
        }

        const targetPlatform = found.platform || '';
        if (platformSelect && targetPlatform) {
            let pFound = false;
            for (let i = 0; i < platformSelect.options.length; i++) {
                if (platformSelect.options[i].value.toLowerCase() === targetPlatform.toLowerCase()) {
                    platformSelect.selectedIndex = i;
                    pFound = true;
                    break;
                }
            }
            if (pFound && platformCustom) {
                platformCustom.style.display = 'none';
                platformCustom.value = '';
                platformCustom.required = false;
            } else if (!pFound && platformCustom) {
                platformSelect.value = 'otro';
                platformCustom.style.display = 'block';
                platformCustom.value = targetPlatform;
                platformCustom.required = true;
            }
        }
    }
};

window.handleClientInput = (val) => {
    if (!val) return;
    const trimmed = val.trim().toLowerCase();
    let found = allSubRecords.find(s => ((s.client || s.customer || s.nombre || s.name || '').trim().toLowerCase()) === trimmed);
    if (!found) {
        try {
            const cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
            found = cached.find(c => ((c.client || '').trim().toLowerCase()) === trimmed);
        } catch (e) {}
    }

    if (found) {
        const phoneInput = document.getElementById('sub-phone');
        if (phoneInput && !phoneInput.value) {
            phoneInput.value = found.phone || found.telefono || found.tel || found.whatsapp || '';
        }
        const histSelect = document.getElementById('sub-client-history-select');
        if (histSelect) {
            for (let i = 0; i < histSelect.options.length; i++) {
                if (histSelect.options[i].value.toLowerCase() === trimmed) {
                    histSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
};

window.addSubscription = async () => {
    const client = document.getElementById('sub-client').value.trim();
    const phone = document.getElementById('sub-phone').value.trim();
    const platformSelect = document.getElementById('sub-platform-select');
    const platformCustom = document.getElementById('sub-platform-custom');
    
    let platform = platformSelect ? platformSelect.value.trim() : '';
    if (platform === 'otro') {
        platform = platformCustom ? platformCustom.value.trim() : '';
    }

    const durationSelect = document.getElementById('sub-duration');
    const duration = durationSelect ? durationSelect.value : '1m';
    const start = document.getElementById('sub-start').value;
    const end = document.getElementById('sub-end').value;
    
    if (!client || !phone || !platform || !start || !end) {
        alert('Por favor, completa todos los campos requeridos (Cliente, WhatsApp, Plataforma, Fechas).');
        return;
    }

    // Asegurar autenticación de Firebase
    if (!firebase.auth().currentUser) {
        const pass = prompt("⚠️ Tu sesión de Firebase está desconectada. Ingresa tu contraseña de administrador para reconectar antes de registrar:");
        if (pass) {
            const userStore = JSON.parse(localStorage.getItem('currentUser') || '{}');
            try {
                await firebase.auth().signInWithEmailAndPassword(userStore.email || 'knifeblackstore@gmail.com', pass);
            } catch (e) {
                alert("Contraseña incorrecta o error de autenticación: " + e.message);
                return;
            }
        } else {
            return;
        }
    }
    
    db.ref('subscriptions').push({
        client,
        phone,
        platform,
        duration,
        start,
        end,
        status: 'active',
        createdAt: new Date().toISOString()
    }).then(() => {
        document.getElementById('sub-client').value = '';
        document.getElementById('sub-phone').value = '';
        if (platformSelect) platformSelect.value = '';
        if (platformCustom) {
            platformCustom.value = '';
            platformCustom.style.display = 'none';
            platformCustom.required = false;
        }
        
        // Reset fechas
        const subStart = document.getElementById('sub-start');
        if (subStart) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            subStart.value = `${yyyy}-${mm}-${dd}`;
            subStart.dispatchEvent(new Event('change'));
        if (document.getElementById('sub-duration')) {
            document.getElementById('sub-duration').value = '1m';
        }
        if (typeof window.updateSubscriptionDates === 'function') {
            window.updateSubscriptionDates();
        }
        const histSelect = document.getElementById('sub-client-history-select');
        if (histSelect) histSelect.value = '';
        }
        alert('Suscripción registrada con éxito. 🎉');
    }).catch(e => alert('Error al registrar suscripción: ' + e.message));
};

function renderSubscriptionsTable() {
    const tbody = document.getElementById('sub-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let countAll = allSubRecords.length;
    let countActive = 0;
    let countWarning = 0;
    let countExpired = 0;
    let countNoRenew = 0;

    // Calcular contadores
    allSubRecords.forEach(sub => {
        const isNoRenew = sub.status === 'no_renovado';
        const endDate = new Date(sub.end);
        const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        if (isNoRenew) {
            countNoRenew++;
        } else if (diffDays < 0) {
            countExpired++;
        } else if (diffDays <= 3) {
            countWarning++;
            countActive++;
        } else {
            countActive++;
        }
    });

    // Actualizar badges de conteo en la barra de filtros
    const elAll = document.getElementById('sub-count-all');
    const elActive = document.getElementById('sub-count-active');
    const elWarning = document.getElementById('sub-count-warning');
    const elExpired = document.getElementById('sub-count-expired');
    const elNoRenew = document.getElementById('sub-count-norenew');
    if (elAll) elAll.innerText = countAll;
    if (elActive) elActive.innerText = countActive;
    if (elWarning) elWarning.innerText = countWarning;
    if (elExpired) elExpired.innerText = countExpired;
    if (elNoRenew) elNoRenew.innerText = countNoRenew;

    // Filtrar registros según filtro actual
    const filtered = allSubRecords.filter(sub => {
        const isNoRenew = sub.status === 'no_renovado';
        const endDate = new Date(sub.end);
        const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        if (currentSubFilter === 'norenew') return isNoRenew;
        if (currentSubFilter === 'expired') return !isNoRenew && diffDays < 0;
        if (currentSubFilter === 'warning') return !isNoRenew && diffDays >= 0 && diffDays <= 3;
        if (currentSubFilter === 'active') return !isNoRenew && diffDays >= 0;
        return true; // 'all'
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#888;">No hay suscripciones en esta categoría.</td></tr>`;
        return;
    }

    filtered.forEach(sub => {
        const isNoRenew = sub.status === 'no_renovado';
        const endDate = new Date(sub.end);
        const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        let badgeClass = 'badge-days';
        let statusText = diffDays + ' días';

        if (isNoRenew) {
            badgeClass = 'badge-days no-renew';
            statusText = '🚫 No Renueva';
        } else if (diffDays < 0) {
            badgeClass += ' expired';
            statusText = `🔴 Vencida (${Math.abs(diffDays)}d)`;
        } else if (diffDays <= 3) {
            badgeClass += ' danger';
            statusText = `⚠️ Vence en ${diffDays}d`;
        } else if (diffDays <= 7) {
            badgeClass += ' warning';
            statusText = `⏳ ${diffDays} días`;
        } else {
            statusText = `🟢 ${diffDays} días`;
        }

        // WhatsApp mensajes personalizados
        let waMessage = '';
        if (isNoRenew) {
            waMessage = `Hola ${sub.client}, esperamos que estés muy bien. Vimos que tu pantalla de ${sub.platform} no se renovó. ¿Te gustaría reactivarla hoy o probar otra de nuestras plataformas de streaming? Avísanos y te ayudamos con gusto. 🎬`;
        } else if (diffDays < 0) {
            waMessage = `Hola ${sub.client}, te informamos que tu suscripción de ${sub.platform} se encuentra VENCIDA desde el ${sub.end}. ¿Deseas reactivarla? 💳 Paga aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY`;
        } else {
            waMessage = `Hola ${sub.client}, te recordamos que tu suscripción de ${sub.platform} vence en ${diffDays} días (${sub.end}). ¿Deseas renovarla? 💳 Puedes pagar aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY`;
        }

        const waLink = `https://wa.me/${(sub.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`;

        // Botones de acción dinámicos
        let actionButtonsHtml = '';
        if (isNoRenew) {
            actionButtonsHtml = `
                <button type="button" onclick="renewSubscription('${sub.key}')" class="btn-sub-renew" title="Reactivar y renovar suscripción por 30 días">🔄 Renovar</button>
                <button type="button" onclick="reuseClientData('${sub.key}')" class="btn-sub-reuse" title="Cargar los datos de este cliente en el formulario de arriba">📋 Usar Datos</button>
                <a href="${waLink}" target="_blank" class="btn-wa">📱 WhatsApp</a>
                <button type="button" onclick="deleteSubscription('${sub.key}')" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;" title="Eliminar definitivamente">🗑️</button>
            `;
        } else {
            actionButtonsHtml = `
                <button type="button" onclick="renewSubscription('${sub.key}')" class="btn-sub-renew" title="Renovar +30 días">🔄 Renovar</button>
                <button type="button" onclick="markNoRenewSubscription('${sub.key}')" class="btn-sub-norenew" title="Marcar como No Renueva (se tacha sin borrar sus datos)">❌ No Renovar</button>
                <a href="${waLink}" target="_blank" class="btn-wa">📱 Notificar</a>
                <button type="button" onclick="deleteSubscription('${sub.key}')" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;" title="Eliminar definitivamente">🗑️</button>
            `;
        }

        tbody.innerHTML += `
            <tr class="${isNoRenew ? 'sub-row-no-renew' : ''}" id="sub-row-${sub.key}">
                <td data-label="Cliente"><strong>${sub.client}</strong></td>
                <td data-label="WhatsApp">${sub.phone}</td>
                <td data-label="Plataforma">${sub.platform}</td>
                <td data-label="Duración">${
                    sub.duration === '1y' 
                        ? '<span style="background:linear-gradient(135deg, #f1c40f, #e67e22); color:#000; font-weight:bold; padding:4px 9px; border-radius:12px; font-size:0.75rem; display:inline-block; box-shadow:0 0 10px rgba(241,196,15,0.4);">🌟 1 AÑO</span>' 
                        : (sub.duration === '6m' ? '<span style="background:#8e44ad; color:#fff; padding:3px 7px; border-radius:10px; font-size:0.75rem;">6 Meses</span>'
                        : (sub.duration === '3m' ? '<span style="background:#2980b9; color:#fff; padding:3px 7px; border-radius:10px; font-size:0.75rem;">3 Meses</span>'
                        : '<span style="color:#aaa; font-size:0.8rem;">1 Mes</span>'))
                }</td>
                <td data-label="Activación">${sub.start}</td>
                <td data-label="Vencimiento">${sub.end}</td>
                <td data-label="Estado"><span class="${badgeClass}">${statusText}</span></td>
                <td data-label="Acción" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    ${actionButtonsHtml}
                </td>
            </tr>
        `;
    });
}

db.ref('subscriptions').on('value', snap => {
    allSubRecords = [];
    snap.forEach(child => {
        allSubRecords.push({ key: child.key, ...child.val() });
    });
    
    // Ordenar: primero las activas por vencimiento más próximo, y al final las no renovadas
    allSubRecords.sort((a, b) => {
        const aNoRenew = a.status === 'no_renovado';
        const bNoRenew = b.status === 'no_renovado';
        if (aNoRenew && !bNoRenew) return 1;
        if (!aNoRenew && bNoRenew) return -1;
        return new Date(a.end) - new Date(b.end);
    });

    renderSubscriptionsTable();
    window.populateClientHistory();
});

window.renewSubscription = async (key) => {
    const sub = allSubRecords.find(s => s.key === key);
    if (!sub) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(sub.end);

    // Si ya venció o estaba no_renovado, inicia hoy; si aún está vigente, suma 30 días a la fecha actual de fin
    let newBaseDate;
    if (sub.status === 'no_renovado' || endDate < today) {
        newBaseDate = new Date(today);
    } else {
        newBaseDate = new Date(endDate);
    }

    const isOneYear = sub.duration === '1y';
    const calcNewEnd = new Date(newBaseDate);
    if (isOneYear) {
        calcNewEnd.setFullYear(calcNewEnd.getFullYear() + 1);
    } else if (sub.duration === '6m') {
        calcNewEnd.setMonth(calcNewEnd.getMonth() + 6);
    } else if (sub.duration === '3m') {
        calcNewEnd.setMonth(calcNewEnd.getMonth() + 3);
    } else {
        calcNewEnd.setDate(calcNewEnd.getDate() + 30);
    }

    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const newStartStr = formatDate(today);
    const newEndStr = formatDate(calcNewEnd);

    if (!confirm(`¿Renovar la suscripción de "${sub.client}" (${sub.platform}) por ${isOneYear ? '1 AÑO COMPLETO (365 días)' : '30 días'} más?\n\nNuevo vencimiento: ${newEndStr}`)) {
        return;
    }

    try {
        await db.ref('subscriptions/' + key).update({
            status: 'active',
            start: newStartStr,
            end: newEndStr,
            lastRenewedAt: new Date().toISOString()
        });
        alert(`¡Suscripción de ${sub.client} renovada con éxito hasta el ${newEndStr}! 🎉`);
    } catch (e) {
        alert('Error al renovar suscripción: ' + e.message);
    }
};

window.markNoRenewSubscription = async (key) => {
    const sub = allSubRecords.find(s => s.key === key);
    if (!sub) return;

    if (!confirm(`¿Marcar la suscripción de "${sub.client}" (${sub.platform}) como NO RENOVADA?\n\nEl registro se tachará visualmente de la lista para no confundirte, pero sus datos se conservarán intactos para que puedas reutilizarlos cuando el cliente vuelva.`)) {
        return;
    }

    try {
        await db.ref('subscriptions/' + key).update({
            status: 'no_renovado',
            markedNoRenewAt: new Date().toISOString()
        });
        alert(`Suscripción tachada como "No Renovada". Los datos de ${sub.client} se mantienen guardados.`);
    } catch (e) {
        alert('Error al actualizar estado: ' + e.message);
    }
};

window.reuseClientData = (key) => {
    const sub = allSubRecords.find(s => s.key === key);
    if (!sub) return;

    document.getElementById('sub-client').value = sub.client || '';
    document.getElementById('sub-phone').value = sub.phone || '';
    if (sub.duration && document.getElementById('sub-duration')) {
        document.getElementById('sub-duration').value = sub.duration;
        window.updateSubscriptionDates();
    }

    const platformSelect = document.getElementById('sub-platform-select');
    const platformCustom = document.getElementById('sub-platform-custom');

    if (platformSelect) {
        let found = false;
        for (let i = 0; i < platformSelect.options.length; i++) {
            if (platformSelect.options[i].value.toLowerCase() === (sub.platform || '').toLowerCase()) {
                platformSelect.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (found) {
            if (platformCustom) {
                platformCustom.style.display = 'none';
                platformCustom.value = '';
                platformCustom.required = false;
            }
        } else {
            platformSelect.value = 'otro';
            if (platformCustom) {
                platformCustom.style.display = 'block';
                platformCustom.value = sub.platform || '';
                platformCustom.required = true;
            }
        }
    }

    // Reiniciar fechas para iniciar hoy
    const subStart = document.getElementById('sub-start');
    if (subStart) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        subStart.value = `${yyyy}-${mm}-${dd}`;
        subStart.dispatchEvent(new Event('change'));
    }

    // Desplazarse al formulario y resaltar
    const form = document.getElementById('sub-registration-form');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.style.boxShadow = '0 0 24px var(--neon-cyan)';
        setTimeout(() => { form.style.boxShadow = ''; }, 1600);
    }
};

window.deleteSubscription = (key) => {
    if (confirm('¿Estás seguro de eliminar permanentemente este registro de suscripción?')) {
        db.ref('subscriptions/' + key).remove();
    }
};

// Auto-calculate subscription end date (30 days)
document.addEventListener('DOMContentLoaded', () => {
    const subStart = document.getElementById('sub-start');
    const subEnd = document.getElementById('sub-end');
    
    if (subStart && subEnd) {
        // Default to today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        subStart.value = `${yyyy}-${mm}-${dd}`;
        
        if (typeof window.updateSubscriptionDates === 'function') {
            window.updateSubscriptionDates();
        }
        subStart.addEventListener('change', () => {
            if (typeof window.updateSubscriptionDates === 'function') {
                window.updateSubscriptionDates();
            }
        });
    }
});

// ============================================================================
// GESTOR DE INVENTARIO / CATÁLOGO
// ============================================================================

let currentProductImageBase64 = '';
let currentProductImages = []; // Array for multiple photos
let currentEditKey = null;

// Compress and return a lightweight base64 string from a File
function compressImage(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
        alert('Error al leer el archivo desde el dispositivo.');
        const hint = document.getElementById('inv-photo-hint');
        if (hint) hint.innerHTML = '<span style="color:#e74c3c;">❌ Error al leer el archivo.</span>';
    };
    reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => {
            alert('No se pudo decodificar la imagen. Si fue tomada en formato HEIC de Samsung o iPhone, tómala en formato JPG o captura de pantalla.');
            const hint = document.getElementById('inv-photo-hint');
            if (hint) hint.innerHTML = '<span style="color:#e74c3c;">❌ Formato de imagen no compatible (usa JPG o PNG).</span>';
        };
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 800; // Optimal resolution for fast DB syncing and sharp display
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) {
                        height = Math.round(height * (MAX_DIM / width));
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width = Math.round(width * (MAX_DIM / height));
                        height = MAX_DIM;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                let b64 = '';
                try {
                    b64 = canvas.toDataURL('image/jpeg', 0.80);
                } catch (e) {
                    b64 = canvas.toDataURL('image/png');
                }

                if (!b64 || b64 === 'data:,') {
                    throw new Error('Canvas toDataURL returned empty string');
                }

                callback(b64);
            } catch (err) {
                console.error('Error al comprimir imagen:', err);
                alert('Error al optimizar la imagen: ' + err.message);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.previewProductPhoto = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const previewContainer = document.getElementById('inv-preview-container');
    const legacyPreview = document.getElementById('inv-preview');
    const saveBtn = document.getElementById('btn-save-product');
    const photoHint = document.getElementById('inv-photo-hint');

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = '⏳ Procesando fotos...';
    }
    if (photoHint) {
        photoHint.innerHTML = '<span style="color:var(--neon-cyan);">⏳ Comprimiendo y optimizando foto(s)...</span>';
    }

    let processedCount = 0;

    files.forEach(file => {
        compressImage(file, (b64) => {
            processedCount++;

            if (!currentProductImageBase64) {
                currentProductImageBase64 = b64;
            }
            if (!currentProductImages.includes(b64)) {
                currentProductImages.push(b64);
            }

            // Show thumbnail
            const thumb = document.createElement('div');
            thumb.style.cssText = 'position:relative; display:inline-block; margin:4px;';
            const imgEl = document.createElement('img');
            imgEl.src = b64;
            imgEl.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px; border:2px solid var(--neon-cyan); cursor:pointer; box-shadow:0 0 8px rgba(0,240,255,0.4);';
            imgEl.onclick = () => window.openLightbox ? window.openLightbox(b64) : null;
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.innerText = '×';
            delBtn.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:0.85rem; line-height:20px; padding:0; text-align:center; font-weight:bold;';
            delBtn.onclick = () => {
                const idx = currentProductImages.indexOf(b64);
                if (idx > -1) currentProductImages.splice(idx, 1);
                currentProductImageBase64 = currentProductImages[0] || '';
                thumb.remove();
                if (legacyPreview) {
                    if (currentProductImageBase64) {
                        legacyPreview.src = currentProductImageBase64;
                        legacyPreview.style.display = 'block';
                    } else {
                        legacyPreview.style.display = 'none';
                    }
                }
                if (photoHint) {
                    photoHint.innerHTML = currentProductImages.length > 0 
                        ? `<span style="color:#2ecc71;">✅ ${currentProductImages.length} foto(s) seleccionada(s)</span>`
                        : 'Puedes tomar foto o seleccionar varias fotos desde la galería';
                }
            };

            thumb.appendChild(imgEl);
            thumb.appendChild(delBtn);
            if (previewContainer) previewContainer.appendChild(thumb);

            if (legacyPreview) {
                legacyPreview.src = currentProductImageBase64;
                legacyPreview.style.display = 'block';
            }

            if (processedCount >= files.length) {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = currentEditKey ? '💾 Guardar Cambios' : 'Guardar Producto';
                }
                if (photoHint) {
                    photoHint.innerHTML = `<span style="color:#2ecc71;">✅ ${currentProductImages.length} foto(s) cargada(s) y lista(s) para guardar</span>`;
                }
            }
        });
    });

    // Reset input value so re-picking the same photo triggers onchange
    event.target.value = '';
};

window.addProduct = () => {
    const saveBtn = document.getElementById('btn-save-product');
    if (saveBtn && saveBtn.disabled) {
        alert('Por favor espera a que la imagen termine de procesarse.');
        return;
    }

    const name = document.getElementById('inv-name').value.trim();
    const type = document.getElementById('inv-type').value;
    const condition = document.getElementById('inv-condition').value;
    const franchise = document.getElementById('inv-franchise').value.trim() || 'Desconocida';
    const manufacturer = document.getElementById('inv-manufacturer').value.trim() || 'Desconocido';
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const stock = parseInt(document.getElementById('inv-stock').value) || 0;
    const stylesRaw = document.getElementById('inv-styles') ? document.getElementById('inv-styles').value.trim() : '';
    const styles = stylesRaw ? stylesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      
    const unavailableStyles = [];
    document.querySelectorAll('.unavailable-chk').forEach(chk => {
        if (chk.checked) unavailableStyles.push(chk.value);
    });
    
    if (!name || !type || price <= 0) {
        alert('Nombre, Tipo y Precio son obligatorios.');
        return;
    }

    // Ensure main image is synchronized with images array
    if (!currentProductImageBase64 && currentProductImages.length > 0) {
        currentProductImageBase64 = currentProductImages[0];
    }
    
    if (!currentProductImageBase64 && currentProductImages.length === 0) {
        if (!confirm('⚠️ No has añadido ninguna foto al producto.\n\n¿Deseas guardar este producto sin foto?')) {
            return;
        }
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = '💾 Guardando en base de datos...';
    }
    
    const productData = {
        name,
        type,
        condition,
        franchise,
        manufacturer,
        price,
        stock,
        styles,
        unavailableStyles,
        image: currentProductImageBase64 || '',
        images: currentProductImages.length > 0 ? currentProductImages : (currentProductImageBase64 ? [currentProductImageBase64] : []),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditKey) {
        // Update existing product
        db.ref('products/' + currentEditKey).update(productData).then(() => {
            alert('¡Producto actualizado con éxito!');
            resetProductForm();
        }).catch(e => {
            alert('Error al actualizar: ' + e.message);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '💾 Guardar Cambios';
            }
        });
    } else {
        // Add new product
        productData.createdAt = new Date().toISOString();
        if (!firebase.auth().currentUser) {
            const pass = prompt("⚠️ Tu sesión está desconectada. Ingresa tu contraseña de administrador para reconectar Firebase antes de guardar:");
            if (pass) {
                const userStore = JSON.parse(localStorage.getItem('currentUser'));
                firebase.auth().signInWithEmailAndPassword(userStore.email, pass)
                    .then(() => {
                        db.ref('products').push(productData).then(() => {
                            alert('¡Producto añadido con éxito al catálogo e inventario!');
                            resetProductForm();
                        }).catch(e => {
                            alert('Error: ' + e.message);
                            if (saveBtn) {
                                saveBtn.disabled = false;
                                saveBtn.innerText = 'Guardar Producto';
                            }
                        });
                    })
                    .catch(e => {
                        alert("Contraseña incorrecta.");
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerText = 'Guardar Producto';
                        }
                    });
            } else {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Guardar Producto';
                }
            }
        } else {
            db.ref('products').push(productData).then(() => {
                alert('¡Producto añadido con éxito al catálogo e inventario!');
                resetProductForm();
            }).catch(e => {
                alert('Error al crear producto: ' + e.message);
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Guardar Producto';
                }
            });
        }
    }
};

window.editProduct = (key) => {
    db.ref('products/' + key).once('value').then(snap => {
        const p = snap.val();
        if(!p) return;
        
        currentEditKey = key;
        document.getElementById('inv-name').value = p.name || '';
        
        const typeEl = document.getElementById('inv-type');
        if(typeEl) typeEl.value = p.type || 'figura';
        
        const condEl = document.getElementById('inv-condition');
        if(condEl) condEl.value = p.condition || 'Nuevo';
        
        document.getElementById('inv-franchise').value = p.franchise || '';
        document.getElementById('inv-manufacturer').value = p.manufacturer || '';
        document.getElementById('inv-price').value = p.price || 0;
        document.getElementById('inv-stock').value = p.stock || 0;
        const stylesEl = document.getElementById('inv-styles');
        if (stylesEl) {
            stylesEl.value = (p.styles && Array.isArray(p.styles)) ? p.styles.join(', ') : '';
            window.currentUnavailableStyles = p.unavailableStyles || [];
            updateUnavailableStylesUI();
        }
        
        const saveBtn = document.getElementById('btn-save-product');
        if(saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 Guardar Cambios';
            saveBtn.style.background = '#f39c12';
        }
        
        const previewContainer = document.getElementById('inv-preview-container');
        if (previewContainer) previewContainer.innerHTML = '';
        currentProductImages = [];
        currentProductImageBase64 = p.image || (Array.isArray(p.images) && p.images[0]) || '';
        
        const loadImagesToPreview = (imagesArray) => {
            imagesArray.forEach(b64 => {
                if (!b64) return;
                if (!currentProductImageBase64) currentProductImageBase64 = b64;
                if (!currentProductImages.includes(b64)) currentProductImages.push(b64);
                
                const thumb = document.createElement('div');
                thumb.style.cssText = 'position:relative; display:inline-block; margin:4px;';
                const imgEl = document.createElement('img');
                imgEl.src = b64;
                imgEl.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px; border:2px solid var(--neon-cyan); cursor:pointer; box-shadow:0 0 8px rgba(0,240,255,0.4);';
                imgEl.onclick = () => window.openLightbox ? window.openLightbox(b64) : null;
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.innerText = '×';
                delBtn.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:0.85rem; line-height:20px; padding:0; text-align:center; font-weight:bold;';
                delBtn.onclick = () => {
                    const idx = currentProductImages.indexOf(b64);
                    if (idx > -1) currentProductImages.splice(idx, 1);
                    currentProductImageBase64 = currentProductImages[0] || '';
                    thumb.remove();
                    const legacyPreview = document.getElementById('inv-preview');
                    if (legacyPreview) {
                        if (currentProductImageBase64) {
                            legacyPreview.src = currentProductImageBase64;
                            legacyPreview.style.display = 'block';
                        } else {
                            legacyPreview.style.display = 'none';
                        }
                    }
                };
                thumb.appendChild(imgEl);
                thumb.appendChild(delBtn);
                if (previewContainer) previewContainer.appendChild(thumb);
            });
        };

        if (p.images && Array.isArray(p.images) && p.images.length > 0) {
            loadImagesToPreview(p.images);
        } else if (p.image) {
            loadImagesToPreview([p.image]);
        }

        const legacyPreview = document.getElementById('inv-preview');
        if (legacyPreview) {
            if (currentProductImageBase64) {
                legacyPreview.src = currentProductImageBase64;
                legacyPreview.style.display = 'block';
            } else {
                legacyPreview.style.display = 'none';
            }
        }
        
        const photoHint = document.getElementById('inv-photo-hint');
        if (photoHint) {
            photoHint.innerHTML = currentProductImages.length > 0
                ? `<span style="color:var(--neon-cyan);">📸 ${currentProductImages.length} foto(s) cargada(s). Puedes añadir más o eliminar con la ×</span>`
                : 'Puedes tomar foto o seleccionar varias fotos desde la galería';
        }
        
        // Scroll to top
        window.scrollTo({top: 0, behavior: 'smooth'});
    });
};

function resetProductForm() {
    currentEditKey = null;
    document.getElementById('inv-name').value = '';
    document.getElementById('inv-type').value = '';
    document.getElementById('inv-condition').value = 'Nuevo';
    document.getElementById('inv-franchise').value = '';
    document.getElementById('inv-manufacturer').value = '';
    document.getElementById('inv-price').value = '';
    document.getElementById('inv-stock').value = '';
    const stylesEl = document.getElementById('inv-styles');
    if (stylesEl) stylesEl.value = '';
    window.currentUnavailableStyles = [];
    updateUnavailableStylesUI();
    const pCam = document.getElementById('inv-photo-cam');
    if(pCam) pCam.value = '';
    const pGal = document.getElementById('inv-photo-gal');
    if(pGal) pGal.value = '';
    const legacyPreview = document.getElementById('inv-preview');
    if(legacyPreview) legacyPreview.style.display = 'none';
    currentProductImageBase64 = '';
    currentProductImages = [];
    const previewContainer = document.getElementById('inv-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    const saveBtn = document.getElementById('btn-save-product');
    if(saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Guardar Producto';
        saveBtn.style.background = '';
    }

    const photoHint = document.getElementById('inv-photo-hint');
    if (photoHint) {
        photoHint.innerHTML = 'Puedes tomar foto o seleccionar varias fotos desde la galería';
    }
}

window.deleteProduct = (key) => {
    if(confirm('¿Seguro que deseas eliminar este producto del catálogo?')) {
        db.ref('products/' + key).remove();
        if(currentEditKey === key) resetProductForm();
    }
};

let allCatalogProducts = [];

window.renderCatalogTable = () => {
    const tbody = document.getElementById('inv-table-body');
    if (!tbody) return;
    
    const query = document.getElementById('inv-search')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('inv-filter-type')?.value || 'all';
    
    tbody.innerHTML = '';
    
    const filtered = allCatalogProducts.filter(pObj => {
        const p = pObj.val;
        const matchesQuery = p.name.toLowerCase().includes(query) || (p.franchise || '').toLowerCase().includes(query);
        let matchesType = true;
        if (typeFilter === 'all') {
            matchesType = true;
        } else if (typeFilter === 'pin_all') {
            matchesType = ['pin', 'pulsera', 'manilla', 'esclava', 'accesorio'].includes(p.type);
        } else {
            matchesType = p.type === typeFilter;
        }
        return matchesQuery && matchesType;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No se encontraron productos.</td></tr>';
        return;
    }
    
    filtered.forEach(pObj => {
        const p = pObj.val;
        const key = pObj.key;
        const photoSrc = p.image || (Array.isArray(p.images) && p.images[0]) || '';
        const imgTag = photoSrc 
            ? `<img src="${photoSrc}" style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #333; cursor:pointer;" onclick="window.openLightbox ? window.openLightbox('${photoSrc}') : null" title="Ver foto en grande">` 
            : '📸';
        
        tbody.innerHTML += `
            <tr>
                <td>${imgTag}</td>
                <td>${p.name}</td>
                <td><span class="badge-days" style="background:${
        {
            figura: '#3498db',
            pin: '#9b59b6',
            pulsera: '#e91e63',
            manilla: '#ff9800',
            esclava: '#00bcd4',
            accesorio: '#4caf50'
        }[p.type] || '#3498db'
    };color:#fff;">${(p.type || '').toUpperCase()}</span></td>
                <td style="color:var(--neon-cyan); font-weight:bold;">${(p.price || 0).toLocaleString()}</td>
                <td>${p.stock}</td>
                <td style="display:flex; gap:10px;">
                    <button onclick="editProduct('${key}')" style="background:#f39c12; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="Editar">✏️</button>
                    <button onclick="deleteProduct('${key}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="Eliminar">🗑</button>
                </td>
            </tr>
        `;
    });
};

document.getElementById('inv-search')?.addEventListener('input', window.renderCatalogTable);
document.getElementById('inv-filter-type')?.addEventListener('change', window.renderCatalogTable);

// Escuchar cambios en inventario
db.ref('products').on('value', snap => {
    allCatalogProducts = [];
    snap.forEach(child => {
        allCatalogProducts.push({ key: child.key, val: child.val() });
    });
    window.renderCatalogTable();
});


// ============================================================================
// GESTIÓN DE TIENDAS AMIGAS
// ============================================================================
let currentPartnerImage = '';

window.previewPartnerPhoto = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reuse existing compressImage function
    compressImage(file, (b64) => {
        currentPartnerImage = b64;
        const preview = document.getElementById('partner-preview');
        preview.src = b64;
        preview.style.display = 'block';
    });
};

window.addPartnerStore = () => {
    const name = document.getElementById('partner-name').value.trim();
    const url = document.getElementById('partner-url').value.trim();
    
    if (!name || !url || !currentPartnerImage) {
        alert('Nombre, Enlace y Logo son obligatorios.');
        return;
    }
    
    const partnerData = {
        name,
        url,
        image: currentPartnerImage,
        createdAt: new Date().toISOString()
    };
    
    db.ref('partner_stores').push(partnerData).then(() => {
        alert('Tienda Amiga añadida con éxito.');
        document.getElementById('partner-name').value = '';
        document.getElementById('partner-url').value = '';
        document.getElementById('partner-photo').value = '';
        document.getElementById('partner-preview').style.display = 'none';
        currentPartnerImage = '';
    }).catch(e => alert('Error al añadir tienda: ' + e.message));
};

window.deletePartnerStore = (key) => {
    if(confirm('¿Seguro que deseas eliminar esta tienda amiga?')) {
        db.ref('partner_stores/' + key).remove();
    }
};

// Listener para la tabla de tiendas amigas
db.ref('partner_stores').on('value', snap => {
    const tbody = document.getElementById('partner-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    const data = snap.val();
    
    if (data) {
        Object.keys(data).forEach(key => {
            const store = data[key];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Logo">
        <div class="partner-logo-box" style="width:55px; height:55px;">
            <img src="${store.image}">
        </div>
    </td>
                <td data-label="Nombre">${store.name}</td>
                <td data-label="Enlace"><a href="${store.url}" target="_blank" style="color:var(--neon-cyan);">Visitar</a></td>
                <td data-label="Acción">
                    <button class="btn-del" onclick="deletePartnerStore('${key}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
});
// ============================================================================
// GESTIÓN DE USUARIOS Y PERMISOS
// ============================================================================
const initUsersPanel = () => {
    const userLocal = JSON.parse(localStorage.getItem('currentUser'));
    if (!userLocal || userLocal.email !== 'knifeblackstore@gmail.com') {
        // Ocultar pestaña de usuarios si no es el master admin
        const usersNavBtn = document.querySelector('a[onclick="switchTab(\\\'usuarios\\\')"]');
        if (usersNavBtn) usersNavBtn.style.display = 'none';
        return; // Detener aquí para que no de error de Firebase
    }

    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    db.ref('usersDB').on('value', snap => {
        const users = snap.val() || {};
        tbody.innerHTML = '';
        
        for (const uid in users) {
            const u = users[uid];
            // No mostrar al Master Admin para evitar que se quite permisos a sí mismo
            if (u.email === 'knifeblackstore@gmail.com') continue;

            const perms = u.permissions || {};
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong style="color:#fff;">${u.name || 'Sin Nombre'}</strong><br>
                    <small style="color:#888;">${u.email}</small>
                </td>
                <td>
                    <select class="fin-input role-select" data-uid="${uid}" style="min-width:100px; padding:5px; margin:0;">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuario</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="perm-chk" data-uid="${uid}" data-perm="products" ${perms.products ? 'checked' : ''} style="transform: scale(1.5);">
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="perm-chk" data-uid="${uid}" data-perm="stores" ${perms.stores ? 'checked' : ''} style="transform: scale(1.5);">
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="perm-chk" data-uid="${uid}" data-perm="coupons" ${perms.coupons ? 'checked' : ''} style="transform: scale(1.5);">
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="perm-chk" data-uid="${uid}" data-perm="finances" ${perms.finances ? 'checked' : ''} style="transform: scale(1.5);">
                </td>
                <td style="text-align:center;">
                    <button class="btn-del" onclick="window.deleteUser('${uid}', '${u.email}')" title="Eliminar usuario y borrar todo rastro" style="background:#e74c3c; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">🗑️ Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        // Listeners para cambiar rol
        document.querySelectorAll('.role-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const newRole = e.target.value;
                db.ref('usersDB/' + uid + '/role').set(newRole);
                alert('Rango actualizado correctamente.');
            });
        });

        // Listeners para cambiar permisos
        document.querySelectorAll('.perm-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const perm = e.target.getAttribute('data-perm');
                const isChecked = e.target.checked;
                db.ref('usersDB/' + uid + '/permissions/' + perm).set(isChecked);
                // No spamming alerts on checkboxes, it saves instantly silently
            });
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Retrasar un poco para asegurar que Firebase cargó
    setTimeout(initUsersPanel, 1500);
});


window.currentUnavailableStyles = [];
window.updateUnavailableStylesUI = () => {
    const container = document.getElementById('inv-unavailable-styles-container');
    if (!container) return;
    
    const stylesRaw = document.getElementById('inv-styles').value.trim();
    const styles = stylesRaw ? stylesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    if (styles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div style="width:100%; color:#aaa; font-size:0.8rem; margin-bottom:5px;">Marcar estilos agotados:</div>';
    styles.forEach(s => {
        const isChecked = window.currentUnavailableStyles.includes(s) ? 'checked' : '';
        html += `<label style="background:#111; padding:5px 10px; border-radius:15px; border:1px solid #333; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:5px;">
            <input type="checkbox" class="unavailable-chk" value="${s}" ${isChecked}> ${s}
        </label>`;
    });
    container.innerHTML = html;
};


// Initial population of client history
if (typeof window.populateClientHistory === 'function') {
    window.populateClientHistory(); // Initial run
}


window.deleteUser = async (uid, email) => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente al usuario "${email || uid}"?\n\nEsta acción eliminará TODO rastro de este usuario en la base de datos.`)) {
        return;
    }
    try {
        await db.ref('usersDB/' + uid).remove();
        alert('Usuario eliminado correctamente sin dejar rastro.');
    } catch (err) {
        alert('Error al eliminar usuario: ' + err.message);
    }
};


window.deleteFinancialRecord = async (key) => {
    if (!confirm('¿Estás seguro de eliminar este registro financiero registrado por error?')) {
        return;
    }
    try {
        await db.ref('finances/' + key).remove();
        alert('Registro financiero eliminado correctamente.');
    } catch (err) {
        alert('Error al eliminar registro: ' + err.message);
    }
};


// ============================================================================
// FUNCIONES DE CÁMARA WEB EN VIVO (CAPTURA DIRECTA EN POS)
// ============================================================================
let activeWebcamStream = null;

window.openWebcamModal = async () => {
    const modal = document.getElementById('webcam-modal');
    const video = document.getElementById('webcam-video');
    if (!modal || !video) return;

    modal.style.display = 'flex';
    try {
        activeWebcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = activeWebcamStream;
    } catch (err) {
        console.warn('Cámara trasera no disponible, probando cámara frontal:', err);
        try {
            activeWebcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = activeWebcamStream;
        } catch (e2) {
            alert('No se pudo acceder a la cámara: ' + e2.message);
            window.closeWebcamModal();
        }
    }
};

window.closeWebcamModal = () => {
    const modal = document.getElementById('webcam-modal');
    if (modal) modal.style.display = 'none';
    if (activeWebcamStream) {
        activeWebcamStream.getTracks().forEach(track => track.stop());
        activeWebcamStream = null;
    }
};

window.captureWebcamSnapshot = () => {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const b64 = canvas.toDataURL('image/webp', 0.85);

    if (!currentProductImageBase64) {
        currentProductImageBase64 = b64;
    }
    if (!currentProductImages.includes(b64)) {
        currentProductImages.push(b64);
    }

    const previewContainer = document.getElementById('inv-preview-container');
    if (previewContainer) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative; display:inline-block; margin:4px;';
        const t = document.createElement('img');
        t.src = b64;
        t.style.cssText = 'width:60px; height:60px; object-fit:cover; border-radius:6px; border:2px solid var(--neon-cyan);';
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '✕';
        delBtn.style.cssText = 'position:absolute; top:-6px; right:-6px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;';
        delBtn.onclick = () => {
            currentProductImages = currentProductImages.filter(img => img !== b64);
            if (currentProductImageBase64 === b64) {
                currentProductImageBase64 = currentProductImages[0] || '';
            }
            wrap.remove();
        };
        wrap.appendChild(t);
        wrap.appendChild(delBtn);
        previewContainer.appendChild(wrap);
    }

    window.closeWebcamModal();
    alert('¡Foto capturada y guardada en el producto exitosamente!');
};


// ============================================================================
// MODAL DE NOTIFICACIONES MULTI-OPCIÓN DE SUSCRIPCIONES
// ============================================================================
let currentNotifySub = null;

window.openSubNotifyModal = (key) => {
    const sub = allSubRecords.find(s => s.key === key);
    if (!sub) return;
    currentNotifySub = sub;

    const modal = document.getElementById('sub-notify-modal');
    const info = document.getElementById('notify-modal-client-info');
    if (!modal || !info) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(sub.end);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    info.innerHTML = `Cliente: <strong style="color:#fff;">${sub.client}</strong> | WhatsApp: <strong style="color:var(--neon-cyan);">${sub.phone}</strong> | Plataforma: <strong style="color:#ff007f;">${sub.platform}</strong> | Vence: ${sub.end} (${diffDays} días)`;

    // Template inicial sugerido
    if (sub.status === 'no_renovado') {
        window.selectNotifyTemplate('promocional');
    } else if (diffDays < 0) {
        window.selectNotifyTemplate('vencida');
    } else if (diffDays <= 3) {
        window.selectNotifyTemplate('por_vencer');
    } else {
        window.selectNotifyTemplate('preventiva');
    }

    modal.style.display = 'flex';
};

window.closeSubNotifyModal = () => {
    const modal = document.getElementById('sub-notify-modal');
    if (modal) modal.style.display = 'none';
};

window.selectNotifyTemplate = (type) => {
    if (!currentNotifySub) return;
    const sub = currentNotifySub;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(sub.end);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const textarea = document.getElementById('sub-notify-custom-msg');
    if (!textarea) return;

    let msg = '';
    if (type === 'preventiva') {
        msg = `Hola ${sub.client} 👋 Te saludamos con gusto desde Knifeblack Store. Te recordamos cordialmente que a tu suscripción de ${sub.platform} le quedan ${diffDays} días de servicio (vence el ${sub.end}). ¡Si deseas asegurar tu cupo para el próximo periodo avísanos con gusto para renovártela! 🍿✨`;
    } else if (type === 'por_vencer') {
        msg = `¡Hola ${sub.client}! ⚠️ Te informamos que tu suscripción de ${sub.platform} vence en ${diffDays <= 0 ? 'pocas horas' : diffDays + ' día(s)'} (fecha: ${sub.end}). Para evitar la interrupción de tus perfiles, puedes renovar fácilmente por Nequi/Wompi aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY o escribirnos directamente. ¡Gracias por confiar en nosotros!`;
    } else if (type === 'vencida') {
        msg = `Hola ${sub.client}. ❌ Te notificamos que tu suscripción de ${sub.platform} se encuentra VENCIDA desde el ${sub.end}. Si deseas reactivarla de inmediato y seguir disfrutando sin perder tus perfiles, puedes pagar aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY o responder a este mensaje. ¡Quedamos a tu orden! 🚀`;
    } else if (type === 'promocional') {
        msg = `Hola ${sub.client} 👋 ¿Cómo has estado? Vimos que tu pantalla de ${sub.platform} no se renovó. Queríamos contarte que tenemos nuevas promociones en streaming, figuras y pines anime. ¿Te gustaría reactivar tu cuenta hoy con precio especial? ¡Avísanos y te ayudamos al instante! 🎉`;
    }

    textarea.value = msg;
};

window.sendSelectedWhatsAppNotification = () => {
    if (!currentNotifySub) return;
    const phone = (currentNotifySub.phone || '').replace(/\D/g, '');
    const textarea = document.getElementById('sub-notify-custom-msg');
    const msg = textarea ? textarea.value.trim() : '';
    if (!phone) {
        alert('Este cliente no tiene un número de teléfono válido.');
        return;
    }
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
    window.closeSubNotifyModal();
};


// ============================================================================
// GESTIÓN DEL DIRECTORIO DE CLIENTES EN FINANZAS / POS
// ============================================================================
window.renderClientDirectory = () => {
    const tbody = document.getElementById('client-dir-tbody');
    if (!tbody) return;

    const query = (document.getElementById('client-dir-search')?.value || '').toLowerCase().trim();
    let clients = [];
    try {
        clients = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
    } catch (e) {}

    // Completar con allSubRecords
    if (Array.isArray(allSubRecords)) {
        allSubRecords.forEach(s => {
            const name = (s.client || '').trim();
            if (name && !clients.some(c => (c.client || '').toLowerCase() === name.toLowerCase())) {
                clients.push({
                    client: name,
                    phone: s.phone || '',
                    platform: s.platform || '',
                    duration: s.duration || '1m'
                });
            }
        });
    }

    tbody.innerHTML = '';
    const filtered = clients.filter(c => 
        (c.client || '').toLowerCase().includes(query) ||
        (c.phone || '').includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding:20px;">No hay clientes que coincidan.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const nameLower = (c.client || '').toLowerCase();
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.client}</strong></td>
                <td>${c.phone || 'Sin número'}</td>
                <td>${c.platform || 'Streaming'}</td>
                <td>${c.duration === '1y' ? '🌟 1 Año' : '1 Mes'}</td>
                <td style="display:flex; gap:8px;">
                    <button onclick="window.editClientModal('${nameLower}')" style="background:#f39c12; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="Editar">✏️</button>
                    <button onclick="window.deleteClientRecord('${nameLower}')" style="background:#e74c3c; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="Eliminar del historial">🗑️</button>
                </td>
            </tr>
        `;
    });
};

window.editClientModal = (nameLower) => {
    let clients = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
    const client = clients.find(c => (c.client || '').toLowerCase() === nameLower);
    if (!client) return;

    const newName = prompt('Nombre del cliente:', client.client);
    if (newName === null) return;
    const newPhone = prompt('WhatsApp del cliente:', client.phone || '');
    if (newPhone === null) return;

    client.client = newName.trim();
    client.phone = newPhone.trim();

    localStorage.setItem('knifeblack_client_history', JSON.stringify(clients));
    window.renderClientDirectory();
    if (typeof window.populateClientHistory === 'function') window.populateClientHistory();
    alert('Datos de cliente actualizados correctamente.');
};

window.deleteClientRecord = (nameLower) => {
    if (!confirm('¿Eliminar a este cliente del historial de clientes frecuentes?')) return;
    let clients = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
    clients = clients.filter(c => (c.client || '').toLowerCase() !== nameLower);
    localStorage.setItem('knifeblack_client_history', JSON.stringify(clients));
    window.renderClientDirectory();
    if (typeof window.populateClientHistory === 'function') window.populateClientHistory();
    alert('Cliente eliminado del historial.');
};


// ============================================================================
// EDICIÓN DE STOCK EN EL PUNTO DE VENTA (IN-SITU)
// ============================================================================
window.adjustPOSStock = async (gridKey, itemIdx, delta, event) => {
    if (event) event.stopPropagation();
    try {
        const snap = await db.ref('grids/' + gridKey).once('value');
        const html = snap.val();
        if (!html) return;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
        const item = items[itemIdx];
        if (!item) return;

        let cur = parseInt(item.getAttribute('data-stock')) || 0;
        let nextStock = Math.max(0, cur + delta);
        item.setAttribute('data-stock', nextStock);

        const stockBadge = item.querySelector('.stock-badge');
        if (stockBadge) {
            stockBadge.innerText = nextStock > 0 ? `Stock: ${nextStock}` : 'AGOTADO';
            if (nextStock <= 0) stockBadge.classList.add('out-of-stock');
            else stockBadge.classList.remove('out-of-stock');
        }

        await db.ref('grids/' + gridKey).set(tempDiv.innerHTML);
        loadInventory();
    } catch (err) {
        alert('Error al ajustar stock: ' + err.message);
    }
};

window.promptEditPOSStock = async (gridKey, itemIdx, currentStock, event) => {
    if (event) event.stopPropagation();
    const input = prompt('Ingresa el nuevo stock para este producto:', currentStock);
    if (input === null) return;
    const val = parseInt(input);
    if (isNaN(val) || val < 0) {
        alert('Por favor ingresa un número válido.');
        return;
    }
    const delta = val - currentStock;
    await window.adjustPOSStock(gridKey, itemIdx, delta, event);
};


// Interactive Bubble Particle Effect on Hover (POS)
window.initBubbleHoverEffect = () => {
    let lastBubbleTime = 0;
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastBubbleTime < 50) return;
        
        const target = e.target.closest('.bubble-card, .pos-product-card, .sub-dashboard, .fin-dashboard, .nav-btn, .fin-btn');
        if (!target) return;

        lastBubbleTime = now;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const bubble = document.createElement('span');
        bubble.className = 'bubble-particle';
        const size = Math.floor(Math.random() * 14) + 8;
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        bubble.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px');

        target.appendChild(bubble);
        setTimeout(() => bubble.remove(), 900);
    });
};
document.addEventListener('DOMContentLoaded', () => {
    window.initBubbleHoverEffect();
    if (typeof window.renderClientDirectory === 'function') {
        window.renderClientDirectory();
    }
});


// ============================================================================
// MÓDULO DE FACTURACIÓN EN PDF (KNIFEBLACK STORE - NIT 1088288308-0)
// ============================================================================

window.onPOSClientInput = function(val) {
    if (!val) return;
    var valLower = val.trim().toLowerCase();
    var cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
    var found = cached.find(function(c) { return (c.client || '').toLowerCase() === valLower; });
    if (!found && allSalesData) {
        found = allSalesData.find(function(s) { return (s.customer || '').toLowerCase() === valLower && s.customerDoc; });
        if (found) {
            found = { client: found.customer, doc: found.customerDoc, phone: found.customerPhone, address: found.customerAddress };
        }
    }
    if (found) {
        if (document.getElementById('pos-cust-doc') && found.doc) document.getElementById('pos-cust-doc').value = found.doc;
        if (document.getElementById('pos-cust-phone') && found.phone) document.getElementById('pos-cust-phone').value = found.phone;
        if (document.getElementById('pos-cust-address') && found.address) document.getElementById('pos-cust-address').value = found.address;
    }
};

window.updatePOSClientsDatalist = function() {
    var datalist = document.getElementById('pos-clients-datalist');
    if (!datalist) return;
    var clientMap = new Map();
    var cached = JSON.parse(localStorage.getItem('knifeblack_client_history') || '[]');
    cached.forEach(function(c) {
        if (c.client) clientMap.set(c.client.toLowerCase(), c.client);
    });
    if (allSalesData) {
        allSalesData.forEach(function(s) {
            if (s.customer && s.customer !== 'Consumidor Final' && !s.customer.includes('POS')) {
                clientMap.set(s.customer.toLowerCase(), s.customer);
            }
        });
    }
    datalist.innerHTML = Array.from(clientMap.values())
        .sort(function(a, b) { return a.localeCompare(b); })
        .map(function(c) { return '<option value="' + c + '">'; })
        .join('');
};

window.generateInvoicePDF = function(data) {
    if (!window.jspdf) {
        alert("La librería de generación PDF está cargando. Por favor presiona de nuevo en 2 segundos.");
        return null;
    }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageWidth = 210;
    var pageHeight = 297;
    var margin = 14;

    // 1. Top Decorative Bar
    doc.setFillColor(15, 15, 22);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(0, 240, 255);
    doc.rect(0, 5, pageWidth, 1.5, 'F');

    // 2. Company Brand & Info (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 15, 22);
    doc.text('KNIFEBLACK STORE', margin, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 110);
    doc.text('Pines Metálicos, Figuras de Acción, Accesorios y Streaming', margin, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 60);
    doc.text('NIT: ' + (data.ownerNit || '1088288308-0'), margin, 29);
    doc.text('Teléfono / WhatsApp: ' + (data.ownerPhone || '3108014660'), margin, 34);
    doc.text('Email: ' + (data.ownerEmail || 'knifeblackstore@gmail.com'), margin, 39);
    doc.text('Ciudad: ' + (data.ownerCity || 'Pereira - Risaralda, Colombia'), margin, 44);
    doc.text('Régimen: No Responsable de IVA (Art. 499 E.T.)', margin, 49);

    // 3. Invoice Metadata Box (Right)
    var boxX = 130;
    var boxY = 12;
    var boxW = 66;
    var boxH = 39;
    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFillColor(15, 15, 22);
    doc.roundedRect(boxX, boxY, boxW, 10, 3, 3, 'F');
    doc.rect(boxX, boxY + 7, boxW, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('FACTURA DE VENTA', boxX + boxW / 2, boxY + 7, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(255, 0, 127);
    doc.text(data.invoiceNumber || 'Nº KBS-0001', boxX + boxW / 2, boxY + 17, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 70);
    doc.text('Fecha: ' + (data.date || new Date().toLocaleDateString('es-CO')), boxX + 4, boxY + 24);
    doc.text('Hora: ' + (data.time || new Date().toLocaleTimeString('es-CO')), boxX + 4, boxY + 29);
    doc.text('Pago: ' + (data.paymentMethod || 'Efectivo'), boxX + 4, boxY + 34);

    // 4. Client Info Box
    var clientY = 56;
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, clientY, pageWidth - (margin * 2), 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 15, 22);
    doc.text('DATOS DEL CLIENTE / ADQUIRENTE', margin + 4, clientY + 6);

    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.5);
    doc.line(margin + 4, clientY + 8, margin + 65, clientY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 60);

    var col1X = margin + 4;
    var col2X = margin + 100;

    doc.text('Cliente: ' + (data.customerName || 'Consumidor Final'), col1X, clientY + 14);
    doc.text('Cédula / NIT: ' + (data.customerDoc || 'Consumidor Final'), col1X, clientY + 20);

    doc.text('Teléfono / Cel: ' + (data.customerPhone || 'N/A'), col2X, clientY + 14);
    doc.text('Dirección: ' + (data.customerAddress || 'Mostrador / Local'), col2X, clientY + 20);

    // 5. Items Table
    var tableY = 88;
    var colW = { num: 12, desc: 95, qty: 18, unit: 28, total: 29 };

    doc.setFillColor(20, 20, 30);
    doc.rect(margin, tableY, pageWidth - (margin * 2), 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    var curX = margin;
    doc.text('#', curX + 3, tableY + 5.5);
    curX += colW.num;
    doc.text('DESCRIPCIÓN DEL ARTÍCULO', curX + 2, tableY + 5.5);
    curX += colW.desc;
    doc.text('CANT.', curX + colW.qty / 2, tableY + 5.5, { align: 'center' });
    curX += colW.qty;
    doc.text('PRECIO UNIT.', curX + colW.unit - 2, tableY + 5.5, { align: 'right' });
    curX += colW.unit;
    doc.text('SUBTOTAL', curX + colW.total - 2, tableY + 5.5, { align: 'right' });

    tableY += 8;

    var items = data.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    items.forEach(function(it, idx) {
        var isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 249, isEven ? 255 : 252);
        doc.rect(margin, tableY, pageWidth - (margin * 2), 7.5, 'F');
        
        doc.setDrawColor(235, 238, 242);
        doc.setLineWidth(0.2);
        doc.line(margin, tableY + 7.5, pageWidth - margin, tableY + 7.5);

        doc.setTextColor(60, 60, 70);
        curX = margin;
        doc.text(String(idx + 1), curX + 3, tableY + 5);
        curX += colW.num;

        var itemName = it.name ? (it.name.length > 55 ? it.name.substring(0, 52) + '...' : it.name) : 'Producto';
        doc.text(itemName, curX + 2, tableY + 5);
        curX += colW.desc;

        doc.text(String(it.qty || 1), curX + colW.qty / 2, tableY + 5, { align: 'center' });
        curX += colW.qty;

        var unitPrice = '$' + (it.price || 0).toLocaleString('es-CO');
        doc.text(unitPrice, curX + colW.unit - 2, tableY + 5, { align: 'right' });
        curX += colW.unit;

        var lineTotal = '$' + ((it.price || 0) * (it.qty || 1)).toLocaleString('es-CO');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 25);
        doc.text(lineTotal, curX + colW.total - 2, tableY + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        tableY += 7.5;
    });

    // 6. Totals Box
    tableY += 4;
    var totW = 85;
    var totX = pageWidth - margin - totW;
    var totY = tableY;

    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.4);
    doc.roundedRect(totX, totY, totW, 35, 2, 2, 'FD');

    var subtotal = data.subtotal || 0;
    var discount = data.discount || 0;
    var total = data.total || (subtotal - discount);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 80);
    doc.text('Subtotal:', totX + 6, totY + 7);
    doc.text('$' + subtotal.toLocaleString('es-CO'), totX + totW - 6, totY + 7, { align: 'right' });

    doc.text('Descuento:', totX + 6, totY + 13);
    doc.setTextColor(231, 76, 60);
    doc.text('-$' + discount.toLocaleString('es-CO'), totX + totW - 6, totY + 13, { align: 'right' });

    doc.setTextColor(70, 70, 80);
    doc.text('IVA (0% - Régimen Simplificado):', totX + 6, totY + 19);
    doc.text('$0', totX + totW - 6, totY + 19, { align: 'right' });

    doc.setFillColor(15, 15, 22);
    doc.roundedRect(totX + 2, totY + 23, totW - 4, 10, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 240, 255);
    doc.text('TOTAL A PAGAR:', totX + 6, totY + 29.5);
    doc.text('$' + total.toLocaleString('es-CO') + ' COP', totX + totW - 6, totY + 29.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 30);
    doc.text('CONDICIONES & GARANTÍA:', margin + 2, totY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 100);
    doc.text('• Cambios de mercancía dentro de los 5 días posteriores a la compra.', margin + 2, totY + 12);
    doc.text('• Conservar esta factura para hacer efectiva cualquier garantía.', margin + 2, totY + 16);
    doc.text('• Soporte y atención posventa inmediata vía WhatsApp: 3108014660', margin + 2, totY + 20);

    // 7. Footer
    var footerY = pageHeight - 18;
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.6);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 120);
    doc.text('Documento equivalente de venta expedido conforme a las normas del Estatuto Tributario para personas naturales', pageWidth / 2, footerY, { align: 'center' });
    doc.text('no obligadas a expedir factura electrónica. KnifeBlackStore • NIT: 1088288308-0 • Tel: 3108014660', pageWidth / 2, footerY + 4, { align: 'center' });

    doc.setFillColor(0, 240, 255);
    doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');

    return doc;
};

window.downloadCurrentInvoicePDF = function() {
    if (!currentGeneratedInvoice) return;
    try {
        var doc = window.generateInvoicePDF(currentGeneratedInvoice);
        if (doc) doc.save('Factura_' + (currentGeneratedInvoice.invoiceNumber || 'Venta') + '.pdf');
    } catch (e) {
        console.error('Error generando PDF de factura:', e);
        alert('Ocurrió un detalle generando el PDF: ' + e.message);
    }
};

window.shareCurrentInvoiceWA = function() {
    if (!currentGeneratedInvoice) return;
    var phone = (currentGeneratedInvoice.customerPhone || '').replace(/\D/g, '');
    var msg = '*KNIFEBLACK STORE - FACTURA DE VENTA*\n';
    msg += '📄 *Factura Nº:* ' + currentGeneratedInvoice.invoiceNumber + '\n';
    msg += '📅 *Fecha:* ' + currentGeneratedInvoice.date + ' ' + currentGeneratedInvoice.time + '\n';
    msg += '👤 *Cliente:* ' + currentGeneratedInvoice.customerName + '\n';
    if (currentGeneratedInvoice.customerDoc && currentGeneratedInvoice.customerDoc !== 'Consumidor Final') {
        msg += '🪪 *Cédula/NIT:* ' + currentGeneratedInvoice.customerDoc + '\n';
    }
    msg += '\n*DETALLE DE PRODUCTOS:*\n';
    (currentGeneratedInvoice.items || []).forEach(function(it) {
        msg += '• ' + it.name + ' (x' + (it.qty || 1) + ') - $' + ((it.price || 0) * (it.qty || 1)).toLocaleString('es-CO') + '\n';
    });
    msg += '\n*TOTAL FACTURADO:* $' + (currentGeneratedInvoice.total || 0).toLocaleString('es-CO') + ' COP\n';
    msg += '💳 *Método de Pago:* ' + (currentGeneratedInvoice.paymentMethod || 'Efectivo') + '\n\n';
    msg += 'NIT Emisor: 1088288308-0 • Tel: 3108014660\n';
    msg += '¡Gracias por tu compra en KnifeBlackStore!';

    var encoded = encodeURIComponent(msg);
    var targetPhone = phone.length >= 10 ? (phone.startsWith('57') ? phone : '57' + phone) : '';
    var url = targetPhone ? ('https://wa.me/' + targetPhone + '?text=' + encoded) : ('https://wa.me/?text=' + encoded);
    window.open(url, '_blank');
};

window.closeInvoiceSuccessModal = function() {
    var m = document.getElementById('invoice-success-modal');
    if (m) m.style.display = 'none';
};


// ============================================================================
// MÓDULO CONTABLE & FISCAL DIAN (DECLARACIÓN DE RENTA & EXÓGENA)
// ============================================================================

window.renderDianReport = function() {
    var yearSelect = document.getElementById('dian-year-select');
    var selectedYear = yearSelect ? yearSelect.value : '2026';

    var tbody = document.getElementById('dian-exogena-tbody');
    if (!tbody) return;

    var grossRev = 0;
    var electronicRev = 0;
    var cashRev = 0;
    var totalOrders = 0;
    var totalDiscounts = 0;

    var electronicMethods = ['nequi', 'daviplata', 'transferencia', 'bancolombia', 'tarjeta', 'wompi', 'epayco', 'pse', 'datafono'];

    var clientMap = new Map();

    (allSalesData || []).forEach(function(sale) {
        var isAdminPurchase = (sale.email === 'knifeblackstore@gmail.com') ||
                                (sale.customer && sale.customer.toLowerCase().includes('admin')) ||
                                (sale.isAdminPurchase === true);
        if (sale.status === 'Cancelada' || isAdminPurchase) return;

        var saleDate = sale.date ? new Date(sale.date) : new Date();
        var saleYear = String(saleDate.getFullYear());

        if (selectedYear !== 'all' && saleYear !== selectedYear) return;

        var saleTot = Number(sale.total) || 0;
        grossRev += saleTot;
        totalOrders += 1;
        totalDiscounts += Number(sale.discountAmount) || 0;

        var methodLower = (sale.paymentMethod || sale.payment_method || 'efectivo').toLowerCase();
        var isElectronic = electronicMethods.some(function(m) { return methodLower.includes(m); });
        if (isElectronic) {
            electronicRev += saleTot;
        } else {
            cashRev += saleTot;
        }

        var cDoc = (sale.customerDoc || sale.doc || '').trim();
        var cName = (sale.customer || sale.customerName || 'Consumidor Final').trim();
        if (!cDoc && (cName.toLowerCase().includes('pos') || cName.toLowerCase() === 'consumidor final')) {
            cDoc = '222222222222';
            cName = 'Consumidor Final (Cuantías Menores)';
        } else if (!cDoc) {
            cDoc = 'No registrado';
        }

        var mapKey = cDoc !== '222222222222' && cDoc !== 'No registrado' ? cDoc : cName.toLowerCase();
        if (!clientMap.has(mapKey)) {
            clientMap.set(mapKey, {
                doc: cDoc,
                name: cName,
                phone: sale.customerPhone || sale.phone || 'N/A',
                count: 0,
                total: 0
            });
        }
        var record = clientMap.get(mapKey);
        record.count += 1;
        record.total += saleTot;
        if (sale.customerPhone && record.phone === 'N/A') record.phone = sale.customerPhone;
    });

    var totalExpenses = 0;
    var inventoryCosts = 0;
    var operationalCosts = 0;

    (allFinRecords || []).forEach(function(rec) {
        if (rec.type === 'expense' || !rec.type) {
            var recDate = rec.date ? new Date(rec.date) : new Date();
            var recYear = String(recDate.getFullYear());
            if (selectedYear !== 'all' && recYear !== selectedYear) return;

            var amt = Number(rec.amount) || 0;
            totalExpenses += amt;
            var descLower = (rec.desc || rec.category || '').toLowerCase();
            if (descLower.includes('mercanc') || descLower.includes('inventario') || descLower.includes('producto') || descLower.includes('compra')) {
                inventoryCosts += amt;
            } else {
                operationalCosts += amt;
            }
        }
    });

    var netIncome = grossRev - totalExpenses;

    var elGross = document.getElementById('dian-kpi-gross');
    var elElec = document.getElementById('dian-kpi-electronic');
    var elCash = document.getElementById('dian-kpi-cash');
    var elExp = document.getElementById('dian-kpi-expenses');
    var elNet = document.getElementById('dian-kpi-net');

    if (elGross) elGross.innerText = '$' + grossRev.toLocaleString('es-CO');
    if (elElec) elElec.innerText = '$' + electronicRev.toLocaleString('es-CO');
    if (elCash) elCash.innerText = '$' + cashRev.toLocaleString('es-CO');
    if (elExp) elExp.innerText = '$' + totalExpenses.toLocaleString('es-CO');
    if (elNet) elNet.innerText = '$' + netIncome.toLocaleString('es-CO');

    currentDianClientsList = Array.from(clientMap.values()).map(function(c) {
        var pct = grossRev > 0 ? ((c.total / grossRev) * 100).toFixed(1) : 0;
        return { doc: c.doc, name: c.name, phone: c.phone, count: c.count, total: c.total, pct: pct };
    }).sort(function(a, b) { return b.total - a.total; });

    window.currentFiscalMetrics = {
        year: selectedYear,
        grossRevenue: grossRev,
        electronicRevenue: electronicRev,
        cashRevenue: cashRev,
        totalExpenses: totalExpenses,
        inventoryCosts: inventoryCosts,
        operationalCosts: operationalCosts,
        netIncome: netIncome,
        totalOrders: totalOrders,
        totalDiscounts: totalDiscounts,
        topClients: currentDianClientsList
    };

    window.filterDianClients('');
};

window.filterDianClients = function(query) {
    var tbody = document.getElementById('dian-exogena-tbody');
    if (!tbody) return;

    var list = window.currentDianClientsList || [];
    var qLower = (query || '').toLowerCase().trim();

    var filtered = qLower ? list.filter(function(c) {
        return (c.name && c.name.toLowerCase().includes(qLower)) ||
               (c.doc && c.doc.toLowerCase().includes(qLower)) ||
               (c.phone && c.phone.includes(qLower));
    }) : list;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888; padding:25px;">No hay registros fiscales para los criterios seleccionados.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(function(c) {
        return '<tr>' +
            '<td data-label="Cédula/NIT" style="font-family:monospace; font-weight:bold; color:var(--neon-cyan);">' + c.doc + '</td>' +
            '<td data-label="Nombre">' + c.name + '</td>' +
            '<td data-label="Teléfono">' + c.phone + '</td>' +
            '<td data-label="Nro. Facturas" style="text-align:center;">' + c.count + '</td>' +
            '<td data-label="Total ($)" style="font-weight:bold; color:#2ecc71;">$' + c.total.toLocaleString('es-CO') + ' COP</td>' +
            '<td data-label="% Ventas" style="font-weight:bold; color:#f39c12;">' + c.pct + '%</td>' +
        '</tr>';
    }).join('');
};

window.exportDianCSV = function() {
    var metrics = window.currentFiscalMetrics;
    if (!metrics || !metrics.topClients || metrics.topClients.length === 0) {
        alert("No hay registros fiscales disponibles para exportar.");
        return;
    }

    var csv = "Concepto;Tipo Documento;Numero Identificacion;Nombre o Razon Social;Telefono;Nro Operaciones;Valor Total Facturado ($);Porcentaje Ventas (%)\r\n";

    metrics.topClients.forEach(function(c) {
        var row = [
            '4001 - Ingresos Brutos Comerciales',
            c.doc && c.doc.length >= 9 && !c.doc.includes('22222') ? 'NIT / CC' : 'Cuantias Menores',
            '"' + c.doc + '"',
            '"' + (c.name || '').replace(/"/g, '""') + '"',
            '"' + (c.phone || '') + '"',
            c.count,
            c.total,
            c.pct + '%'
        ];
        csv += row.join(';') + '\r\n';
    });

    var blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", 'Reporte_Exogena_DIAN_' + metrics.year + '_KnifeBlackStore.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportDianPDF = function() {
    var metrics = window.currentFiscalMetrics;
    if (!metrics) {
        alert("Cargando métricas fiscales...");
        return;
    }
    if (!window.jspdf) {
        alert("Librería PDF no disponible. Por favor refresca la página.");
        return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageWidth = 210;
    var pageHeight = 297;
    var margin = 14;

    doc.setFillColor(15, 15, 22);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(0, 240, 255);
    doc.rect(0, 5, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 15, 22);
    doc.text('KNIFEBLACK STORE', margin, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 80);
    doc.text('NIT: 1088288308-0 • Tel: 3108014660 • Email: knifeblackstore@gmail.com', margin, 23);
    doc.text('Régimen: No Responsable de IVA (Régimen Simplificado - Art. 499 E.T.)', margin, 27);

    var boxY = 32;
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, boxY, pageWidth - (margin * 2), 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 15, 22);
    doc.text('CERTIFICADO CONTABLE Y BALANCE FISCAL - DIAN', margin + 6, boxY + 8);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 0, 127);
    doc.text('AÑO GRAVABLE FISCAL: ' + (metrics.year === 'all' ? 'Histórico Consolidado' : metrics.year), margin + 6, boxY + 14);
    doc.setTextColor(80, 80, 90);
    doc.text('Fecha de Emisión: ' + new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO'), pageWidth - margin - 65, boxY + 14);

    var kpiY = 57;
    var kpiW = (pageWidth - (margin * 2) - 9) / 4;
    var kpiH = 22;

    var kpis = [
        { label: 'INGRESOS BRUTOS', val: '$' + (metrics.grossRevenue || 0).toLocaleString('es-CO'), color: [46, 204, 113] },
        { label: 'MEDIOS ELECTRÓNICOS', val: '$' + (metrics.electronicRevenue || 0).toLocaleString('es-CO'), color: [0, 240, 255] },
        { label: 'COSTOS / GASTOS', val: '$' + (metrics.totalExpenses || 0).toLocaleString('es-CO'), color: [231, 76, 60] },
        { label: 'RENTA LÍQUIDA EST.', val: '$' + (metrics.netIncome || 0).toLocaleString('es-CO'), color: [155, 89, 182] }
    ];

    kpis.forEach(function(k, idx) {
        var kX = margin + idx * (kpiW + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.3);
        doc.roundedRect(kX, kpiY, kpiW, kpiH, 2, 2, 'FD');

        doc.setFillColor(k.color[0], k.color[1], k.color[2]);
        doc.roundedRect(kX, kpiY, kpiW, 2, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 110);
        doc.text(k.label, kX + 3, kpiY + 7);

        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 30);
        doc.text(k.val, kX + 3, kpiY + 16);
    });

    var curY = 84;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 15, 22);
    doc.text('1. CONSOLIDADO DE INGRESOS Y OPERACIONES DECLARABLES', margin, curY);

    curY += 4;
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.5);
    doc.line(margin, curY, margin + 70, curY);

    curY += 6;
    var summaryRows = [
        ['Total Facturas / Ventas Emitidas en el Periodo', (metrics.totalOrders || 0) + ' operaciones'],
        ['Ingresos Brutos por Canales Electrónicos / Bancarios (Nequi, Daviplata, Wompi, ePayco)', '$' + (metrics.electronicRevenue || 0).toLocaleString('es-CO') + ' COP'],
        ['Ingresos Brutos en Efectivo (Caja Física)', '$' + (metrics.cashRevenue || 0).toLocaleString('es-CO') + ' COP'],
        ['Total Descuentos Comerciales Otorgados', '$' + (metrics.totalDiscounts || 0).toLocaleString('es-CO') + ' COP'],
        ['Costos de Mercancía e Inventario Deducibles (Finanzas)', '$' + (metrics.inventoryCosts || 0).toLocaleString('es-CO') + ' COP'],
        ['Gastos Operativos, Logística y Servicios (Finanzas)', '$' + (metrics.operationalCosts || 0).toLocaleString('es-CO') + ' COP'],
        ['Renta Líquida Ordinaria Estimada (Base Gravable Aproximada)', '$' + (metrics.netIncome || 0).toLocaleString('es-CO') + ' COP']
    ];

    doc.setFontSize(8.5);
    summaryRows.forEach(function(r, idx) {
        var isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 249, isEven ? 255 : 252);
        doc.rect(margin, curY, pageWidth - (margin * 2), 6.5, 'F');

        doc.setFont('helvetica', idx === summaryRows.length - 1 ? 'bold' : 'normal');
        doc.setTextColor(idx === summaryRows.length - 1 ? 0 : 50, idx === summaryRows.length - 1 ? 100 : 50, idx === summaryRows.length - 1 ? 200 : 60);

        doc.text(r[0], margin + 4, curY + 4.5);
        doc.text(r[1], pageWidth - margin - 4, curY + 4.5, { align: 'right' });
        curY += 6.5;
    });

    curY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 15, 22);
    doc.text('2. REPORTE DE TERCEROS / MEDIOS MAGNÉTICOS (INFORMACIÓN EXÓGENA DIAN)', margin, curY);

    curY += 4;
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.5);
    doc.line(margin, curY, margin + 90, curY);

    curY += 5;
    doc.setFillColor(20, 20, 30);
    doc.rect(margin, curY, pageWidth - (margin * 2), 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    doc.text('NIT / CÉDULA', margin + 3, curY + 4.8);
    doc.text('NOMBRE O RAZÓN SOCIAL DEL TERCERO', margin + 35, curY + 4.8);
    doc.text('CONTACTO', margin + 110, curY + 4.8);
    doc.text('OPERACIONES', margin + 140, curY + 4.8);
    doc.text('TOTAL FACTURADO ($)', pageWidth - margin - 4, curY + 4.8, { align: 'right' });

    curY += 7;

    var clients = metrics.topClients || [];
    doc.setFontSize(7.5);

    clients.slice(0, 15).forEach(function(c, idx) {
        var isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 249, isEven ? 255 : 252);
        doc.rect(margin, curY, pageWidth - (margin * 2), 6, 'F');
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 70);

        doc.text(c.doc || 'Consumidor Final', margin + 3, curY + 4.2);
        var cName = c.name ? (c.name.length > 40 ? c.name.substring(0, 38) + '...' : c.name) : 'Cliente Mostrador';
        doc.text(cName, margin + 35, curY + 4.2);
        doc.text(c.phone || 'N/A', margin + 110, curY + 4.2);
        doc.text(c.count + ' compras', margin + 140, curY + 4.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 30);
        doc.text('$' + (c.total || 0).toLocaleString('es-CO'), pageWidth - margin - 4, curY + 4.2, { align: 'right' });

        curY += 6;
    });

    curY = Math.max(curY + 12, pageHeight - 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 100);
    doc.text('Certifico que la información aquí contenida ha sido tomada fielmente de los registros contables y base de datos digital de KnifeBlackStore.', margin, curY);

    curY += 15;
    doc.setDrawColor(150, 150, 160);
    doc.setLineWidth(0.4);
    doc.line(margin + 10, curY, margin + 75, curY);
    doc.line(pageWidth - margin - 75, curY, pageWidth - margin - 10, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 30);
    doc.text('KNIFEBLACK STORE', margin + 42.5, curY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('NIT: 1088288308-0 • Representante', margin + 42.5, curY + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CONTADOR PÚBLICO / REVISOR', pageWidth - margin - 42.5, curY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('T.P. Nº ____________________', pageWidth - margin - 42.5, curY + 8, { align: 'center' });

    doc.setFillColor(0, 240, 255);
    doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');

    doc.save('Balance_Fiscal_DIAN_' + metrics.year + '_KnifeBlackStore.pdf');
};


// ============================================================================
// FUNCIONES DE FACTURACIÓN & REENVÍO PARA EL ADMINISTRADOR (POS)
// ============================================================================
window.getSaleById = function(saleId) {
    if (!allSalesData) return null;
    return allSalesData.find(function(s) { return s.id === saleId; });
};

window.buildSaleInvoiceObj = function(sale) {
    var saleDate = sale.date ? new Date(sale.date) : new Date();
    return {
        invoiceNumber: sale.invoiceNumber || ('KBS-' + (sale.id ? sale.id.substring(sale.id.length - 4) : '0001')),
        date: saleDate.toLocaleDateString('es-CO'),
        time: saleDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: sale.paymentMethod || sale.payment_method || 'Efectivo',
        customerName: sale.customer || 'Consumidor Final',
        customerDoc: sale.customerDoc || sale.cedula || 'Consumidor Final',
        customerPhone: sale.customerPhone || sale.phone || 'N/A',
        customerAddress: sale.customerAddress || sale.address || 'Pereira - Risaralda',
        customerEmail: sale.email || '',
        items: (sale.items || []).map(function(i) { return { name: i.name || 'Producto', price: i.price || 0, qty: i.qty || 1 }; }),
        subtotal: sale.subtotal || sale.total || 0,
        discount: sale.discountAmount || 0,
        total: sale.total || 0,
        ownerNit: '1088288308-0',
        ownerPhone: '3108014660',
        ownerEmail: 'knifeblackstore@gmail.com',
        ownerCity: 'Pereira - Risaralda, Colombia'
    };
};

window.downloadSaleInvoicePDF = function(saleId) {
    var sale = window.getSaleById(saleId);
    if (!sale) {
        alert("No se encontró la venta.");
        return;
    }
    var invObj = window.buildSaleInvoiceObj(sale);
    try {
        var doc = window.generateInvoicePDF(invObj);
        if (doc) doc.save('Factura_' + invObj.invoiceNumber + '.pdf');
    } catch (e) {
        console.error('Error generando PDF:', e);
        alert('Error generando PDF: ' + e.message);
    }
};

window.sendSaleWA = function(saleId) {
    var sale = window.getSaleById(saleId);
    if (!sale) return;
    var inv = window.buildSaleInvoiceObj(sale);
    var phone = (inv.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
        phone = prompt("Ingresa el número celular / WhatsApp del cliente:", "");
        if (!phone) return;
        phone = phone.replace(/\D/g, '');
    }

    var msg = "*KNIFEBLACK STORE - FACTURA DE VENTA*\n";
    msg += "📄 *Factura N°:* " + inv.invoiceNumber + "\n";
    msg += "📅 *Fecha:* " + inv.date + " " + inv.time + "\n";
    msg += "👤 *Cliente:* " + inv.customerName + "\n";
    if (inv.customerDoc && inv.customerDoc !== 'Consumidor Final') {
        msg += "🪪 *Cédula/NIT:* " + inv.customerDoc + "\n";
    }
    msg += "\n*DETALLE DE PRODUCTOS:*\n";
    (inv.items || []).forEach(function(it) {
        msg += "• " + it.name + " (x" + (it.qty || 1) + ") - $" + ((it.price || 0) * (it.qty || 1)).toLocaleString('es-CO') + "\n";
    });
    msg += "\n*TOTAL FACTURADO:* $" + (inv.total || 0).toLocaleString('es-CO') + " COP\n";
    msg += "💳 *Método de Pago:* " + inv.paymentMethod + "\n\n";
    msg += "NIT Emisor: 1088288308-0 • Tel: 3108014660\n";
    msg += "¡Gracias por tu compra en KnifeBlackStore!";

    var encoded = encodeURIComponent(msg);
    var targetPhone = phone.length >= 10 ? (phone.startsWith('57') ? phone : '57' + phone) : '';
    var url = targetPhone ? ('https://wa.me/' + targetPhone + '?text=' + encoded) : ('https://wa.me/?text=' + encoded);
    window.open(url, '_blank');
};

window.sendSaleEmail = async function(saleId) {
    var sale = window.getSaleById(saleId);
    if (!sale) return;
    var inv = window.buildSaleInvoiceObj(sale);
    var email = inv.customerEmail;
    if (!email || !email.includes('@')) {
        email = prompt("Ingresa el correo del cliente para enviar la factura:", "");
        if (!email || !email.includes('@')) {
            alert("Correo no válido.");
            return;
        }
    }

    if (typeof emailjs === 'undefined') {
        alert("El servicio de correo (EmailJS) no está disponible en este momento.");
        return;
    }

    var itemsList = (inv.items || []).map(function(it, idx) {
        return (idx + 1) + '. ' + it.name + ' (x' + (it.qty || 1) + ') - $' + ((it.price || 0) * (it.qty || 1)).toLocaleString('es-CO') + ' COP';
    }).join('\n');

    var emailBody = '¡Hola ' + inv.customerName + '! Te adjuntamos el detalle de tu factura oficial de KnifeBlackStore.\n\n'
        + '==========================================\n'
        + 'FACTURA DE VENTA: ' + inv.invoiceNumber + '\n'
        + 'Fecha: ' + inv.date + ' ' + inv.time + '\n'
        + 'Cliente: ' + inv.customerName + ' (C.C./NIT: ' + inv.customerDoc + ')\n'
        + 'Dirección: ' + inv.customerAddress + '\n'
        + 'Teléfono: ' + inv.customerPhone + '\n'
        + '==========================================\n\n'
        + 'PRODUCTOS:\n' + itemsList + '\n\n'
        + 'Subtotal: $' + (inv.subtotal || 0).toLocaleString('es-CO') + ' COP\n'
        + (inv.discount > 0 ? ('Descuento: -$' + (inv.discount || 0).toLocaleString('es-CO') + ' COP\n') : '')
        + 'TOTAL FACTURADO: $' + (inv.total || 0).toLocaleString('es-CO') + ' COP\n'
        + 'Forma de Pago: ' + inv.paymentMethod + '\n\n'
        + 'Emisor: KnifeBlackStore • NIT: 1088288308-0\n'
        + 'Tel/WhatsApp: 3108014660 • Pereira - Risaralda, Colombia\n'
        + '¡Gracias por confiar en KnifeBlackStore!';

    try {
        await emailjs.send("service_5hy8csv", "template_lirlr2z", {
            to_name: inv.customerName,
            to_email: email,
            message: emailBody,
            from_name: "KnifeBlackStore"
        });
        alert("✅ Factura " + inv.invoiceNumber + " enviada exitosamente al correo " + email);
    } catch (err) {
        console.error("Error enviando factura por email:", err);
        alert("Ocurrió un error al enviar el correo: " + err.message);
    }
};
