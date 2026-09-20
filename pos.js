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


// ============================================================================
// MÓDULO ERP: FINANZAS Y SUSCRIPCIONES
// ============================================================================

let totalSalesRevenue = 0;
let additionalIncome = 0;
let totalExpenses = 0;

// Escuchar cambios en Ventas (POS y Web)
db.ref('sales').on('value', snap => {
    let salesTotal = 0;
    snap.forEach(child => {
        const sale = child.val();
        if (sale.status !== 'Cancelada') {
            salesTotal += (sale.total || 0);
        }
    });
    totalSalesRevenue = salesTotal;
    updateFinanceKPIs();
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
                <td data-label="Monto" class="${typeClass}">${sign}$${rec.amount.toLocaleString()}</td>
            </tr>
        `;
    });
    
    updateFinanceKPIs();
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

window.addSubscription = () => {
    const client = document.getElementById('sub-client').value.trim();
    const phone = document.getElementById('sub-phone').value.trim();
    const platform = document.getElementById('sub-platform').value.trim();
    const start = document.getElementById('sub-start').value;
    const end = document.getElementById('sub-end').value;
    
    if (!client || !phone || !platform || !start || !end) {
        alert('Por favor, completa todos los campos.');
        return;
    }
    
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            alert("Debug: Firebase Auth currentUser es null definitivo. Intentando sincronizar sesión...");
            // Force re-auth if possible or alert user
            return;
        }
        
        db.ref('subscriptions').push({
            client, phone, platform, start, end,
            createdAt: new Date().toISOString()
        }).then(() => {
            document.getElementById('sub-client').value = '';
            document.getElementById('sub-phone').value = '';
            document.getElementById('sub-platform').value = '';
            document.getElementById('sub-start').value = '';
            document.getElementById('sub-end').value = '';
            alert('Suscripción registrada con éxito.');
        }).catch(e => alert('Error al registrar suscripción: ' + e.message + ' | User: ' + user.email));
    });
};

db.ref('subscriptions').on('value', snap => {
    const tbody = document.getElementById('sub-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const records = [];
    snap.forEach(child => {
        records.push({ key: child.key, ...child.val() });
    });
    
    // Ordenar por fecha de vencimiento más próxima
    records.sort((a,b) => new Date(a.end) - new Date(b.end));
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    records.forEach(sub => {
        const endDate = new Date(sub.end);
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let badgeClass = 'badge-days';
        let statusText = diffDays + ' días';
        
        if (diffDays < 0) {
            badgeClass += ' expired';
            statusText = 'Vencida';
        } else if (diffDays <= 3) {
            badgeClass += ' danger';
        } else if (diffDays <= 7) {
            badgeClass += ' warning';
        }
        
        let waMessage = `Hola ${sub.client}, te recordamos que tu suscripción de ${sub.platform} vence en ${diffDays} días (${sub.end}). ¿Deseas renovarla? 💳 Puedes pagar aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY`;
        if (diffDays < 0) {
            waMessage = `Hola ${sub.client}, te informamos que tu suscripción de ${sub.platform} se encuentra VENCIDA desde el ${sub.end}. ¿Deseas reactivarla? 💳 Paga aquí: https://checkout.nequi.wompi.co/l/VPOS_mXUiKY`;
        }
        
        let waLink = `https://wa.me/${sub.phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`;
        
        tbody.innerHTML += `
            <tr>
                <td data-label="Cliente"><strong>${sub.client}</strong></td>
                <td data-label="WhatsApp">${sub.phone}</td>
                <td data-label="Plataforma">${sub.platform}</td>
                <td data-label="Activación">${sub.start}</td>
                <td data-label="Vencimiento">${sub.end}</td>
                <td data-label="Estado"><span class="${badgeClass}">${statusText}</span></td>
                <td data-label="Acción" style="display:flex; gap:10px; flex-wrap:wrap;">
                    <a href="${waLink}" target="_blank" class="btn-wa">📱 Notificar</a>
                    <button onclick="deleteSubscription('${sub.key}')" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer;" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    });
});

window.deleteSubscription = (key) => {
    if (confirm('¿Estás seguro de eliminar este registro de suscripción?')) {
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
        
        const updateEnd = () => {
            if(!subStart.value) return;
            // Parse local date strictly avoiding timezone shifts
            const parts = subStart.value.split('-');
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setDate(d.getDate() + 30); // 30 days of subscription
            
            const ey = d.getFullYear();
            const em = String(d.getMonth() + 1).padStart(2, '0');
            const ed = String(d.getDate()).padStart(2, '0');
            subEnd.value = `${ey}-${em}-${ed}`;
        };
        
        updateEnd();
        subStart.addEventListener('change', updateEnd);
    }
});

// ============================================================================
// GESTOR DE INVENTARIO / CATÁLOGO
// ============================================================================

let currentProductImageBase64 = '';
let currentProductImages = []; // Array for multiple photos
let currentEditKey = null;

// Compress and return a base64 string from a File
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('inv-canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/webp', 0.85));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.previewProductPhoto = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const previewContainer = document.getElementById('inv-preview-container');

    files.forEach(file => {
        compressImage(file, (b64) => {
            if (!currentProductImageBase64) {
                currentProductImageBase64 = b64; // first image = main
            }
            if (!currentProductImages.includes(b64)) {
                currentProductImages.push(b64);
            }

            // Show thumbnail
            const thumb = document.createElement('div');
            thumb.style.cssText = 'position:relative; display:inline-block; margin:4px;';
            const imgEl = document.createElement('img');
            imgEl.src = b64;
            imgEl.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px; border:2px solid var(--neon-cyan); cursor:pointer;';
            imgEl.onclick = () => window.openLightbox ? window.openLightbox(b64) : null;
            const delBtn = document.createElement('button');
            delBtn.innerText = '×';
            delBtn.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:0.7rem; line-height:18px; padding:0; text-align:center;';
            delBtn.onclick = () => {
                const idx = currentProductImages.indexOf(b64);
                if (idx > -1) currentProductImages.splice(idx, 1);
                if (currentProductImageBase64 === b64) {
                    currentProductImageBase64 = currentProductImages[0] || '';
                }
                thumb.remove();
            };
            thumb.appendChild(imgEl);
            thumb.appendChild(delBtn);
            if (previewContainer) previewContainer.appendChild(thumb);

            // Keep legacy preview visible
            const legacyPreview = document.getElementById('inv-preview');
            if (legacyPreview) {
                legacyPreview.src = currentProductImageBase64;
                legacyPreview.style.display = 'block';
            }
        });
    });
};

window.addProduct = () => {
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
        image: currentProductImageBase64,
        images: currentProductImages.length > 0 ? currentProductImages : (currentProductImageBase64 ? [currentProductImageBase64] : []),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditKey) {
        // Update existing product
        db.ref('products/' + currentEditKey).update(productData).then(() => {
            alert('Producto actualizado con éxito.');
            resetProductForm();
        }).catch(e => alert('Error al actualizar: ' + e.message));
    } else {
        // Add new product
        productData.createdAt = new Date().toISOString();
    if (!firebase.auth().currentUser) {
        const pass = prompt("⚠️ Tu sesión está desconectada. Ingresa tu contraseña de administrador para reconectar Firebase antes de guardar:");
        if (pass) {
            const userStore = JSON.parse(localStorage.getItem('currentUser'));
            firebase.auth().signInWithEmailAndPassword(userStore.email, pass)
                .then(() => {
                    alert("¡Reconectado! Guardando producto...");
                    db.ref('products').push(productData).then(() => {
                        alert('Producto añadido con éxito.');
                        resetProductForm();
                    }).catch(e => alert('Error: ' + e.message));
                })
                .catch(e => alert("Contraseña incorrecta."));
        }
    } else {
        db.ref('products').push(productData).then(() => {
            alert('Producto añadido con éxito.');
            resetProductForm();
        }).catch(e => alert('Error al crear producto: ' + e.message + ' | User: ' + (firebase.auth().currentUser ? firebase.auth().currentUser.email : 'NULL')));
    }
    }
};

window.editProduct = (key) => {
    db.ref('products/' + key).once('value').then(snap => {
        const p = snap.val();
        if(!p) return;
        
        currentEditKey = key;
        document.getElementById('inv-name').value = p.name || '';
        
        // Handle options carefully
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
        
        const btn = document.querySelector('.btn-add[onclick="addProduct()"]');
        if(btn) {
            btn.innerText = '💾 Guardar Cambios';
            btn.style.background = '#f39c12'; // Orange for editing
        }
        
        const previewContainer = document.getElementById('inv-preview-container');
        if (previewContainer) previewContainer.innerHTML = '';
        currentProductImages = [];
        
        const loadImagesToPreview = (imagesArray) => {
            imagesArray.forEach(b64 => {
                if (!currentProductImageBase64) currentProductImageBase64 = b64;
                if (!currentProductImages.includes(b64)) currentProductImages.push(b64);
                
                const thumb = document.createElement('div');
                thumb.style.cssText = 'position:relative; display:inline-block; margin:4px;';
                const imgEl = document.createElement('img');
                imgEl.src = b64;
                imgEl.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px; border:2px solid var(--neon-cyan); cursor:pointer;';
                imgEl.onclick = () => window.openLightbox ? window.openLightbox(b64) : null;
                const delBtn = document.createElement('button');
                delBtn.innerText = '❌';
                delBtn.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:0.7rem; line-height:18px; padding:0; text-align:center;';
                delBtn.onclick = () => {
                    const idx = currentProductImages.indexOf(b64);
                    if (idx > -1) currentProductImages.splice(idx, 1);
                    if (currentProductImageBase64 === b64) {
                        currentProductImageBase64 = currentProductImages[0] || '';
                    }
                    thumb.remove();
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
    document.getElementById('inv-preview').style.display = 'none';
    currentProductImageBase64 = '';
    currentProductImages = [];
    const previewContainer = document.getElementById('inv-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    const btn = document.querySelector('.btn-add[onclick="addProduct()"]');
    if(btn) {
        btn.innerText = '➕ Agregar Producto';
        btn.style.background = 'var(--neon-cyan)';
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
        const matchesType = typeFilter === 'all' || p.type === typeFilter;
        return matchesQuery && matchesType;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No se encontraron productos.</td></tr>';
        return;
    }
    
    filtered.forEach(pObj => {
        const p = pObj.val;
        const key = pObj.key;
        const imgTag = p.image ? `<img src="${p.image}" style="width:40px; height:40px; border-radius:5px; object-fit:cover;">` : '📸';
        
        tbody.innerHTML += `
            <tr>
                <td>${imgTag}</td>
                <td>${p.name}</td>
                <td><span class="badge-days" style="background:#3498db;color:#fff;">${p.type.toUpperCase()}</span></td>
                <td style="color:var(--neon-cyan); font-weight:bold;">${p.price.toLocaleString()}</td>
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
                <td data-label="Logo"><img src="${store.image}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
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
