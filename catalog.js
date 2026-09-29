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
                <img src="${p.image || 'https://via.placeholder.com/300?text=Sin+Foto'}" onclick="window.handleImageClick(this.src, event)">
                <div class="special-card-info">
                    <span class="badge" style="background:${badgeColor}; color:${badgeText};">${p.condition.toUpperCase()}</span>
                    <h4>${p.name}</h4>
                    <p>$${(p.price || 0).toLocaleString()}</p>
                </div>
            </div>
        `;
    });
}

let currentCatalogPage = 1;

function getCatalogItemsPerPage() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return 20;
    const comp = window.getComputedStyle(grid).gridTemplateColumns;
    if (comp && comp !== 'none') {
        const cols = comp.split(' ').filter(Boolean).length;
        if (cols > 0) return cols * 5; // Exactamente 5 filas
    }
    return 20; // Fallback predeterminado
}

function renderPaginationControls(totalItems, itemsPerPage, currentPage) {
    const topContainer = document.getElementById('catalog-pagination-top');
    const bottomContainer = document.getElementById('catalog-pagination-bottom');
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        if (topContainer) topContainer.innerHTML = '';
        if (bottomContainer) bottomContainer.innerHTML = '';
        return;
    }

    let buttonsHTML = '';
    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    buttonsHTML += `<button class="pag-btn" ${prevDisabled} onclick="window.changeCatalogPage(-1)" aria-label="Página anterior">&lt;</button>`;

    const maxVisible = 7;
    let startPage = 1;
    let endPage = totalPages;

    if (totalPages > maxVisible) {
        if (currentPage <= 4) {
            startPage = 1;
            endPage = 5;
        } else if (currentPage + 3 >= totalPages) {
            startPage = totalPages - 4;
            endPage = totalPages;
        } else {
            startPage = currentPage - 2;
            endPage = currentPage + 2;
        }
    }

    if (startPage > 1) {
        buttonsHTML += `<button class="pag-btn ${currentPage === 1 ? 'active' : ''}" onclick="window.goToCatalogPage(1)">1</button>`;
        if (startPage > 2) {
            buttonsHTML += `<span class="pag-ellipsis">...</span>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const isActive = p === currentPage ? 'active' : '';
        buttonsHTML += `<button class="pag-btn ${isActive}" onclick="window.goToCatalogPage(${p})">${p}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            buttonsHTML += `<span class="pag-ellipsis">...</span>`;
        }
        buttonsHTML += `<button class="pag-btn ${currentPage === totalPages ? 'active' : ''}" onclick="window.goToCatalogPage(${totalPages})">${totalPages}</button>`;
    }

    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
    buttonsHTML += `<button class="pag-btn" ${nextDisabled} onclick="window.changeCatalogPage(1)" aria-label="Página siguiente">&gt;</button>`;

    if (topContainer) topContainer.innerHTML = buttonsHTML;
    if (bottomContainer) bottomContainer.innerHTML = buttonsHTML;
}

window.goToCatalogPage = (page) => {
    currentCatalogPage = page;
    renderCatalog(false);
    const target = document.getElementById('catalog-info') || document.getElementById('catalog-grid');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.changeCatalogPage = (delta) => {
    window.goToCatalogPage(currentCatalogPage + delta);
};

// Renderizado del Grid principal con filtros
function renderCatalog(resetPage = true) {
    const grid = document.getElementById('catalog-grid');
    const info = document.getElementById('catalog-info');
    if (!grid || !info) return;

    if (resetPage) {
        currentCatalogPage = 1;
    }

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

    const itemsPerPage = getCatalogItemsPerPage();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentCatalogPage > totalPages && totalPages > 0) {
        currentCatalogPage = totalPages;
    }

    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        info.innerText = `Mostrando 0 productos`;
        grid.innerHTML = '<p style="color:#888;">No se encontraron productos con estos filtros.</p>';
        renderPaginationControls(0, itemsPerPage, 1);
        return;
    }

    const startIndex = (currentCatalogPage - 1) * itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    if (totalPages > 1) {
        info.innerText = `Mostrando ${pageItems.length} de ${filtered.length} productos (Página ${currentCatalogPage} de ${totalPages})`;
    } else {
        info.innerText = `Mostrando ${filtered.length} productos`;
    }

    renderPaginationControls(filtered.length, itemsPerPage, currentCatalogPage);

    pageItems.forEach(p => {
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
                  `<img src="${src}" class="dyn-thumb ${i === 0 ? 'active' : ''}" onclick="window.selectThumb('${p.id}', ${i}, event)" />`
              ).join('');
            galleryHTML = `<div class="dyn-thumbs">${thumbs}</div>`;
        }

        const waMsg = encodeURIComponent(`Hola! Quiero consultar disponibilidad de: ${p.name}`);
        const waLink = `https://wa.me/573108014660?text=${waMsg}`;
        const outOfStockAction = `<a href="${waLink}" target="_blank" class="btn-wa-stock">📲 Consultar por WhatsApp</a>`;

        grid.innerHTML += `
            <article class="dyn-card">
                <div class="dyn-card-gallery">
                      <img src="${images[0]}" class="dyn-card-img" id="main-img-${p.id || Math.random().toString(36).slice(2)}" onclick="window.handleImageClick(this.src, event)" ${images.length > 1 ? `ontouchstart="window.handleSwipeStart(event)" ontouchend="window.handleSwipeEnd(event, '${p.id}')"` : ''}>
                      ${images.length > 1 ? `<button class="carousel-btn prev-btn" onclick="window.nextProductImage('${p.id}', -1, event)">&#10094;</button><button class="carousel-btn next-btn" onclick="window.nextProductImage('${p.id}', 1, event)">&#10095;</button>` : ''}
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
    if (el) el.addEventListener('input', () => renderCatalog(true));
});

// Stock filter buttons
window.setStockFilter = (filter) => {
    currentStockFilter = filter;
    document.querySelectorAll('.stock-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderCatalog(true);
};

// Re-render on window resize to recalculate 5 rows dynamically
let catalogResizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(catalogResizeTimer);
    catalogResizeTimer = setTimeout(() => {
        renderCatalog(false);
    }, 200);
});

// Thumbnail selector for multi-image cards
let isSwiping = false;
window.handleSwipeStart = (e) => {
    isSwiping = false;
    e.target.dataset.startX = e.changedTouches[0].screenX;
};

window.handleSwipeEnd = (e, productId) => {
    const startX = parseFloat(e.target.dataset.startX);
    const endX = e.changedTouches[0].screenX;
    if (isNaN(startX)) return;
    
    if (Math.abs(startX - endX) > 40) {
        isSwiping = true;
        if (startX - endX > 40) window.nextProductImage(productId, 1, e);
        else if (endX - startX > 40) window.nextProductImage(productId, -1, e);
    }
};

window.handleImageClick = (src, e) => {
    if (isSwiping) {
        isSwiping = false;
        return;
    }
    openLightbox(src);
};

window.setProductImageIndex = (productId, index) => {
    const p = allProducts.find(prod => prod.id === productId);
    if (!p || !p.images || p.images.length <= index) return;
    
    const card = document.getElementById('style-' + productId)?.closest('.dyn-card') 
                 || document.getElementById('main-img-' + productId)?.closest('.dyn-card');
    if (!card) return;
    
    const mainImg = card.querySelector('.dyn-card-img');
    if (mainImg) mainImg.src = p.images[index];
    
    const thumbs = card.querySelectorAll('.dyn-thumb');
    if (thumbs.length > 0) {
        thumbs.forEach(t => t.classList.remove('active'));
        if (thumbs[index]) thumbs[index].classList.add('active');
    }
    
    const selectEl = document.getElementById('style-' + productId);
    if (selectEl && selectEl.options.length > index + 1) {
        selectEl.selectedIndex = index + 1;
    }
};

window.nextProductImage = (productId, direction, e) => {
    e.stopPropagation();
    const p = allProducts.find(prod => prod.id === productId);
    if (!p || !p.images || p.images.length <= 1) return;
    
    const card = document.getElementById('main-img-' + productId).closest('.dyn-card');
    if (!card) return;
    
    const thumbs = card.querySelectorAll('.dyn-thumb');
    let activeIdx = 0;
    thumbs.forEach((t, idx) => { if (t.classList.contains('active')) activeIdx = idx; });
    
    let nextIdx = activeIdx + direction;
    if (nextIdx < 0) nextIdx = p.images.length - 1;
    if (nextIdx >= p.images.length) nextIdx = 0;
    
    window.setProductImageIndex(productId, nextIdx);
};

window.selectThumb = (productId, index, e) => {
    e.stopPropagation();
    window.setProductImageIndex(productId, index);
};

window.updateProductImage = (selectEl, productId) => {
    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    if (!selectedOpt) return;
    const idx = parseInt(selectedOpt.getAttribute('data-idx'), 10);
    if (isNaN(idx) || idx < 0) return;
    window.setProductImageIndex(productId, idx);
};

window.addCatalogToCart = (name, price, id) => {
    let cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];
    const numPrice = parseFloat(price) || 0;
    cart.push({ name: name || 'Producto', price: numPrice, id: id || '' });
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    
    if (typeof window.updateCartUI === 'function') {
        window.updateCartUI();
    }
    
    if (window.event && window.event.target) {
        const btn = window.event.target;
        const origText = btn.innerText;
        btn.innerText = '¡AÑADIDO! ✨';
        btn.style.borderColor = 'var(--neon-green)';
        setTimeout(() => {
            btn.innerText = origText;
            btn.style.borderColor = '';
        }, 1000);
    }
};

/* ========================================================
   LÓGICA DE PESTAÑAS Y SECCIÓN DE OFERTAS EXCLUSIVAS
   ======================================================== */
let allOffers = [];
let isOffersInitialized = false;
let selectedOfferBase64 = null;
let currentOfferTab = 'catalog'; // 'catalog' | 'offers'

function checkIsAdminUser() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (user && (user.role === 'admin' || (user.email && user.email.toLowerCase() === 'knifeblackstore@gmail.com'))) {
            return true;
        }
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            const authUser = firebase.auth().currentUser;
            if (authUser.email && authUser.email.toLowerCase() === 'knifeblackstore@gmail.com') {
                return true;
            }
        }
    } catch(e) {}
    return false;
}

window.switchCatalogTab = (tab) => {
    currentOfferTab = tab;
    const btnCatalog = document.getElementById('tab-btn-catalog');
    const btnOffers = document.getElementById('tab-btn-offers');
    const filtersBar = document.getElementById('catalog-filters-bar');
    const catalogLayout = document.getElementById('catalog-main-layout');
    const offersLayout = document.getElementById('offers-layout');
    const heroStockFilter = document.querySelector('.stock-filter-bar');

    if (tab === 'catalog') {
        if (btnCatalog) btnCatalog.classList.add('active');
        if (btnOffers) btnOffers.classList.remove('active');
        if (filtersBar) filtersBar.style.display = 'flex';
        if (catalogLayout) catalogLayout.style.display = 'block';
        if (offersLayout) offersLayout.style.display = 'none';
        if (heroStockFilter) heroStockFilter.style.display = 'flex';
    } else {
        if (btnCatalog) btnCatalog.classList.remove('active');
        if (btnOffers) btnOffers.classList.add('active');
        if (filtersBar) filtersBar.style.display = 'none';
        if (catalogLayout) catalogLayout.style.display = 'none';
        if (offersLayout) offersLayout.style.display = 'block';
        if (heroStockFilter) heroStockFilter.style.display = 'none';

        if (!isOffersInitialized) {
            initOffersSection();
        }
    }
};

function initOffersSection() {
    isOffersInitialized = true;
    updateAdminOffersVisibility();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
            updateAdminOffersVisibility();
        });
    }

    // Escuchar ofertas en tiempo real desde Firebase
    db.ref('offers/' + currentFilterType).on('value', snap => {
        const data = snap.val() || {};
        allOffers = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        // Ordenar más recientes primero
        allOffers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        renderOffers();
        updateOffersCountBadge();

        // Si la URL traía un parámetro de oferta directa, abrir lightbox
        const urlParams = new URLSearchParams(window.location.search);
        const directOfferId = urlParams.get('oferta');
        if (directOfferId) {
            const match = allOffers.find(o => o.id === directOfferId);
            if (match && match.imageUrl) {
                window.openLightbox(match.imageUrl);
            }
        }
    });
}

function updateAdminOffersVisibility() {
    const adminActions = document.getElementById('admin-offers-actions');
    if (!adminActions) return;
    if (checkIsAdminUser()) {
        adminActions.style.display = 'block';
    } else {
        adminActions.style.display = 'none';
    }
}

function updateOffersCountBadge() {
    const badge = document.getElementById('offers-count-badge');
    if (!badge) return;
    const activeCount = allOffers.filter(o => !o.isSoldOut).length;
    if (activeCount > 0) {
        badge.innerText = activeCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderOffers() {
    const grid = document.getElementById('offers-grid');
    if (!grid) return;

    if (allOffers.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(20,20,30,0.5); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                <span style="font-size: 3.5rem; display: block; margin-bottom: 12px;">🏷️</span>
                <h3 style="color: #fff; margin-bottom: 8px;">No hay ofertas disponibles por ahora</h3>
                <p style="color: #888; font-size: 0.95rem; max-width: 500px; margin: 0 auto;">Pronto publicaremos promociones y combos especiales aquí. ¡Mantente atento!</p>
            </div>
        `;
        return;
    }

    const isAdmin = checkIsAdminUser();
    const categoryName = currentFilterType === 'pin' ? 'Pin' : 'Figura';

    grid.innerHTML = allOffers.map(offer => {
        const isSoldOut = Boolean(offer.isSoldOut);
        const pageUrl = window.location.origin + window.location.pathname;
        const offerDirectUrl = `${pageUrl}?tab=ofertas&oferta=${offer.id}`;

        let waMessage = '';
        let waButtonHtml = '';

        if (!isSoldOut) {
            waMessage = `¡Hola Knifeblack! Me interesa esta oferta exclusiva de ${categoryName}: ${offerDirectUrl}`;
            waButtonHtml = `
                <a href="https://wa.me/573108014660?text=${encodeURIComponent(waMessage)}" target="_blank" class="btn-offer-wa">
                    <span>📲</span> Pedir por WhatsApp
                </a>
            `;
        } else {
            waMessage = `¡Hola Knifeblack! Vi esta oferta exclusiva de ${categoryName} que está AGOTADA, pero quería saber si volverá a estar disponible: ${offerDirectUrl}`;
            waButtonHtml = `
                <a href="https://wa.me/573108014660?text=${encodeURIComponent(waMessage)}" target="_blank" class="btn-offer-wa is-soldout-btn">
                    <span>❌</span> Oferta Agotada - Consultar
                </a>
            `;
        }

        let adminControlsHtml = '';
        if (isAdmin) {
            adminControlsHtml = `
                <div class="offer-admin-controls">
                    <button class="btn-offer-toggle-stock" onclick="toggleOfferSoldOut('${offer.id}', ${!isSoldOut})">
                        ${isSoldOut ? '✅ Marcar Disponible' : '❌ Marcar Agotada'}
                    </button>
                    <button class="btn-offer-delete" onclick="deleteOffer('${offer.id}')">
                        🗑️ Eliminar
                    </button>
                </div>
            `;
        }

        return `
            <div class="offer-card ${isSoldOut ? 'is-soldout' : ''}" id="offer-card-${offer.id}">
                <div class="offer-img-wrapper" onclick="openLightbox('${offer.imageUrl}')" title="Clic para ampliar imagen">
                    <img src="${offer.imageUrl}" class="offer-card-img" alt="Oferta Exclusiva ${categoryName}" loading="lazy">
                    <span class="offer-zoom-hint">🔍 Ampliar</span>
                    ${isSoldOut ? `
                        <div class="offer-soldout-overlay">
                            <div class="offer-soldout-badge">❌ AGOTADA</div>
                        </div>
                    ` : ''}
                </div>
                <div class="offer-card-body">
                    ${waButtonHtml}
                    ${adminControlsHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Modal Admin
window.openAddOfferModal = () => {
    selectedOfferBase64 = null;
    const modal = document.getElementById('add-offer-modal');
    const preview = document.getElementById('offer-preview-img');
    const prompt = document.getElementById('offer-upload-prompt');
    const check = document.getElementById('offer-is-soldout-check');
    const fileInput = document.getElementById('offer-file-input');

    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (prompt) prompt.style.display = 'block';
    if (check) check.checked = false;
    if (fileInput) fileInput.value = '';
    if (modal) modal.style.display = 'flex';
};

window.closeAddOfferModal = () => {
    const modal = document.getElementById('add-offer-modal');
    if (modal) modal.style.display = 'none';
    selectedOfferBase64 = null;
};

window.handleOfferFileSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1000;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            selectedOfferBase64 = canvas.toDataURL('image/webp', 0.82);

            const preview = document.getElementById('offer-preview-img');
            const prompt = document.getElementById('offer-upload-prompt');
            if (preview) {
                preview.src = selectedOfferBase64;
                preview.style.display = 'block';
            }
            if (prompt) prompt.style.display = 'none';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

async function ensureFirebaseAdminAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        throw new Error('Firebase Auth no está disponible.');
    }

    // 1. Si ya hay usuario autenticado en Firebase
    if (firebase.auth().currentUser) {
        return firebase.auth().currentUser;
    }

    // 2. Esperar si la sesión persistente de Firebase se está restaurando desde el navegador
    const restoredUser = await new Promise(resolve => {
        let unsub;
        const timer = setTimeout(() => {
            if (unsub) unsub();
            resolve(null);
        }, 1200);
        unsub = firebase.auth().onAuthStateChanged(user => {
            clearTimeout(timer);
            if (unsub) unsub();
            resolve(user);
        });
    });

    if (restoredUser) {
        return restoredUser;
    }

    // 3. Si no hay sesión activa en Firebase, solicitar contraseña para reconectar
    const userLocal = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const adminEmail = (userLocal && userLocal.email) ? userLocal.email : 'knifeblackstore@gmail.com';
    const pass = prompt(`⚠️ Tu sesión de administrador en Firebase está inactiva o desconectada.\n\nIngresa la contraseña de ${adminEmail} para autenticarte y guardar la oferta:`);

    if (!pass) {
        throw new Error('Se requiere autenticación de administrador para guardar o modificar ofertas.');
    }

    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const cred = await firebase.auth().signInWithEmailAndPassword(adminEmail, pass);
    return cred.user;
}

window.saveNewOffer = async () => {
    if (!selectedOfferBase64) {
        alert('Por favor selecciona una imagen para la oferta.');
        return;
    }

    const check = document.getElementById('offer-is-soldout-check');
    const isSoldOut = check ? Boolean(check.checked) : false;
    const btnSave = document.getElementById('btn-save-offer');

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerText = 'Verificando sesión... ⏳';
    }

    try {
        await ensureFirebaseAdminAuth();

        if (btnSave) {
            btnSave.innerText = 'Publicando oferta... 🚀';
        }

        const newOfferData = {
            imageUrl: selectedOfferBase64,
            isSoldOut: isSoldOut,
            createdAt: Date.now()
        };

        await db.ref('offers/' + currentFilterType).push(newOfferData);
        alert('¡Oferta exclusiva publicada exitosamente! 🎉');
        window.closeAddOfferModal();
    } catch (err) {
        console.error('Error al guardar oferta:', err);
        alert('Error al publicar la oferta: ' + (err.message || err));
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerText = 'Publicar Oferta 🚀';
        }
    }
};

window.toggleOfferSoldOut = async (offerId, newStatus) => {
    try {
        await ensureFirebaseAdminAuth();
        await db.ref('offers/' + currentFilterType + '/' + offerId + '/isSoldOut').set(newStatus);
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        alert('Error al actualizar estado: ' + (err.message || err));
    }
};

window.deleteOffer = async (offerId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta oferta exclusiva permanentemente?')) {
        return;
    }
    try {
        await ensureFirebaseAdminAuth();
        await db.ref('offers/' + currentFilterType + '/' + offerId).remove();
    } catch (err) {
        console.error('Error al eliminar oferta:', err);
        alert('Error al eliminar oferta: ' + (err.message || err));
    }
};

// Cargar estado inicial según URL
function initCatalogOffersOnStart() {
    if (typeof db === 'undefined') return;
    db.ref('offers/' + currentFilterType).once('value').then(snap => {
        const data = snap.val() || {};
        allOffers = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        updateOffersCountBadge();
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'ofertas' || urlParams.has('oferta')) {
        window.switchCatalogTab('offers');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCatalogOffersOnStart);
} else {
    initCatalogOffersOnStart();
}

