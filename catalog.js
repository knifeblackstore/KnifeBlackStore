// Lógica del Catálogo Dinámico

let allProducts = [];
let currentFilterType = document.body.getAttribute('data-catalog-type') || 'pin';

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
        const stockBadge = inStock 
            ? `<span class="dyn-badge-stock badge-in-stock">EN STOCK (${p.stock})</span>` 
            : `<span class="dyn-badge-stock badge-out-stock">AGOTADO</span>`;
        
        const typeText = p.type === 'figura' ? 'Figura de Acción' : 'Pin Metálico';

        grid.innerHTML += `
            <article class="dyn-card">
                <img src="${p.image || 'https://via.placeholder.com/300?text=Sin+Foto'}" class="dyn-card-img" onclick="openLightbox(this.src)">
                <div class="dyn-card-body">
                    <h3 class="dyn-card-title">${p.name}</h3>
                    <div class="dyn-card-meta">
                        <span>Tipo:</span> ${typeText}<br>
                        <span>Franquicia:</span> ${p.franchise}<br>
                        <span>Fabricante:</span> ${p.manufacturer}<br>
                        <span>Estado:</span> ${p.condition}
                    </div>
                    <div class="dyn-card-footer">
                        <div class="dyn-card-price">$${(p.price || 0).toLocaleString()}</div>
                        ${stockBadge}
                        <button class="btn-dyn-add" onclick="window.addCatalogToCart('${p.name}', ${p.price})" ${!inStock ? 'disabled' : ''}>
                            ${inStock ? 'Añadir al Carrito' : 'Sin Stock'}
                        </button>
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

// Función global para añadir al carrito
window.addCatalogToCart = (name, price) => {
    cart.push({ name, price });
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    // Efecto de botón o recargar UI si está en script.js, pero para simplicidad mostramos alerta y forzamos updateCartUI
    alert('¡Añadido al carrito con éxito!');
    if(typeof updateCartUI === 'function') updateCartUI();
};
