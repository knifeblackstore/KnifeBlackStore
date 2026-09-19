// Lógica del Catálogo Dinámico

let allProducts = [];
let currentFilterType = document.body.getAttribute('data-catalog-type') || 'pin';
let currentStockFilter = 'all'; // 'all' | 'in_stock' | 'out_stock'

// Lightbox Logic
window.openLightbox = (src) => {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').style.display = 'flex';
    // Push a history state so the mobile "back" button closes the lightbox
    history.pushState({ lightboxOpen: true }, '', window.location.href);
};
window.closeLightbox = () => {
    document.getElementById('lightbox').style.display = 'none';
    document.getElementById('lightbox-img').src = '';
};

// When user presses back on mobile, close lightbox instead of leaving the page
window.addEventListener('popstate', (e) => {
    const lb = document.getElementById('lightbox');
    if (lb && lb.style.display === 'flex') {
        lb.style.display = 'none';
        document.getElementById('lightbox-img').src = '';
    }
});

// Close lightbox on backdrop click
document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('lightbox');
    if (lb) {
        lb.addEventListener('click', (e) => {
            if (e.target === lb) window.closeLightbox();
        });
    }
});

// Cargar desde Firebase
db.ref('products').once('value').then(snap => {
    const data = snap.val();
    if (data) {
        allProducts = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
    }
    
    // Poblar dropdown de franquicias
    const franchises = [...new Set(allProducts.map(p => p.franchise))].filter(Boolean);
    const select = document.getElementById('cat-franchise');
    if (select) {
        franchises.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.innerText = f;
            select.appendChild(opt);
        });
    }

    renderCatalog();
    
});

// Renderizado de Selección Especial (Random 2 productos del tipo actual)
function renderSpecialSelection() {
    const container = document.getElementById('special-selection');
    if (!container) return;
    
    let filtered = allProducts.filter(p => p.type === currentFilterType);
    // Shuffle
    filtered = filtered.sort(() => 0.5 - Math.random()).slice(0, 2);
    
    container.innerHTML = '';
    filtered.forEach(p => {
        const badgeColor = p.condition.toLowerCase() === 'preventa' ? '#e1f5fe' : '#fcf3cf';
        const badgeText = p.condition.toLowerCase() === 'preventa' ? '#0288d1' : '#f39c12';
        
        container.innerHTML += `
            <div class="special-card">
                <img src="${p.image || 'https://via.placeholder.com/300?text=Sin+Foto'}" onclick="openLightbox(this.src)">
                <div class="special-card-info">
                    <span class="badge" style="background:${badgeColor}; color:${badgeText};">${p.condition.toUpperCase()}</span>
                    <h4>${p.name}</h4>
                    <p>$${(p.price || 0).toLocaleString()}</p>
                </div>
            </div>
        `;
    });
}

// Renderizado del Grid principal con filtros
function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    const info = document.getElementById('catalog-info');
    if (!grid || !info) return;

    // Obtener valores de filtros
    const search = (document.getElementById('cat-search').value || '').toLowerCase();
    const franchise = document.getElementById('cat-franchise').value;
    const sort = document.getElementById('cat-sort').value;
    const maxPrice = parseFloat(document.getElementById('cat-max-price').value);

    // Filtrar
    let filtered = allProducts.filter(p => p.type === currentFilterType);
    
    if (search) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(search) || 
            (p.manufacturer || '').toLowerCase().includes(search)
        );
    }
    if (franchise) {
        filtered = filtered.filter(p => p.franchise === franchise);
    }
    if (maxPrice) {
        filtered = filtered.filter(p => p.price <= maxPrice);
    }
    // Stock filter buttons
    if (currentStockFilter === 'in_stock') filtered = filtered.filter(p => p.stock > 0);
    else if (currentStockFilter === 'out_stock') filtered = filtered.filter(p => p.stock <= 0);

    // Ordenar
    if (sort === 'price_asc') filtered.sort((a,b) => a.price - b.price);
    else if (sort === 'price_desc') filtered.sort((a,b) => b.price - a.price);
    else if (sort === 'name_asc') filtered.sort((a,b) => a.name.localeCompare(b.name));

    info.innerText = `Mostrando ${filtered.length} productos`;
    
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:#888;">No se encontraron productos con estos filtros.</p>';
        return;
    }

    filtered.forEach(p => {
        const inStock = p.stock > 0;
        let stylesHTML = '';
        if (p.styles && Array.isArray(p.styles) && p.styles.length > 0) {
            const opts = p.styles.map((s, idx) => {
                const isUnavailable = p.unavailableStyles && p.unavailableStyles.includes(s);
                const styleAttr = isUnavailable ? 'color: #ff4444; text-decoration: line-through;' : '';
                const disabledAttr = isUnavailable ? 'disabled' : '';
                return `<option value="${s}" style="${styleAttr}" ${disabledAttr} data-idx="${idx}">${s}${isUnavailable ? ' (Agotado)' : ''}</option>`;
            }).join('');
            stylesHTML = `<select id="style-${p.id}" onchange="window.updateProductImage(this, '${p.id}')" style="width:100%; margin-top:10px; padding:8px; border-radius:5px; background:#111; color:#fff; border:1px solid #333;"><option value="" data-idx="-1">-- Elige un estilo --</option>${opts}</select>`;
        }
        const stockBadge = inStock 
            ? `<span class="dyn-badge-stock badge-in-stock">EN STOCK (${p.stock})</span>` 
            : `<span class="dyn-badge-stock badge-out-stock">AGOTADO</span>`;
        
        const typeText = p.type === 'figura' ? 'Figura de Acción' : 'Pin Metálico';

        // Build image gallery (support multiple images)
        const images = Array.isArray(p.images) && p.images.length > 0
            ? p.images
            : (p.image ? [p.image] : ['https://via.placeholder.com/300?text=Sin+Foto']);
        
        let galleryHTML = '';
        if (images.length > 1) {
            const thumbs = images.map((src, i) =>
                `<img src="${src}" class="dyn-thumb ${i === 0 ? 'active' : ''}" onclick="selectThumb(this, '${src}')" />`
            ).join('');
            galleryHTML = `<div class="dyn-thumbs">${thumbs}</div>`;
        }

        const waMsg = encodeURIComponent(`Hola! Quiero consultar disponibilidad de: ${p.name}`);
        const waLink = `https://wa.me/573108014660?text=${waMsg}`;
        const outOfStockAction = `<a href="${waLink}" target="_blank" class="btn-wa-stock">📲 Consultar por WhatsApp</a>`;

        grid.innerHTML += `
            <article class="dyn-card">
                <div class="dyn-card-gallery">
                    <img src="${images[0]}" class="dyn-card-img" id="main-img-${p.id || Math.random().toString(36).slice(2)}" onclick="openLightbox(this.src)">
                    ${galleryHTML}
                </div>
                <div class="dyn-card-body">
                    <h3 class="dyn-card-title">${p.name}</h3>
                    <div class="dyn-card-meta">
                        <span>Tipo:</span> ${typeText}<br>
                        <span>Franquicia:</span> ${p.franchise}<br>
                        <span>Fabricante:</span> ${p.manufacturer}<br>
                        <span>Estado:</span> ${p.condition}
                    </div>
                    ${stylesHTML}
                    <div class="dyn-card-footer" style="margin-top:10px;">
                        <div class="dyn-card-price">${(p.price || 0).toLocaleString()}</div>
                        ${stockBadge}
                        ${inStock
                            ? `<button class="btn-dyn-add" onclick="window.addCatalogToCart('${p.name}', ${p.price}, '${p.id}')">Añadir al Carrito</button>`
                            : outOfStockAction
                        }
                    </div>
                </div>
            </article>
        `;
    });
}

// Event Listeners para filtros
['cat-search', 'cat-franchise', 'cat-sort', 'cat-max-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderCatalog);
});

// Stock filter buttons
window.setStockFilter = (filter) => {
    currentStockFilter = filter;
    document.querySelectorAll('.stock-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderCatalog();
};

// Thumbnail selector for multi-image cards
window.selectThumb = (thumbEl, src) => {
    const card = thumbEl.closest('.dyn-card');
    if (!card) return;
    card.querySelector('.dyn-card-img').src = src;
    card.querySelectorAll('.dyn-thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
};

// Función global para añadir al carrito
window.addCatalogToCart = (name, price, id) => {
    let finalName = name;
    if (id) {
        const styleSel = document.getElementById('style-' + id);
        if (styleSel) {
            if (!styleSel.value) {
                alert('Por favor elige un estilo/diseño antes de añadir al carrito.');
                return;
            }
            finalName += ' (' + styleSel.value + ')';
        }
    }
    cart.push({ name: finalName, price });
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    // Efecto de botón o recargar UI si está en script.js, pero para simplicidad mostramos alerta y forzamos updateCartUI
    alert('¡Añadido al carrito con éxito!');
    if(typeof updateCartUI === 'function') updateCartUI();
};
