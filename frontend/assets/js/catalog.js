import { apiRequest } from './api.js';

const grid = document.querySelector('#product-grid');
const status = document.querySelector('#catalog-status');
const emptyState = document.querySelector('#catalog-empty');
const errorState = document.querySelector('#catalog-error');
const pagination = document.querySelector('#catalog-pagination');
const categoryFilter = document.querySelector('#category-filter');
const availabilityFilter = document.querySelector('#availability-filter');
const searchInput = document.querySelector('#catalog-search');
const productDialog = document.querySelector('#product-dialog');
let whatsappPhone = null;
let currentPage = 1;
let totalPages = 1;

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const safeImageUrl = (value) => {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' ? url.href : null;
  } catch {
    return null;
  }
};

const safeSocialUrl = (value, platform) => {
  const domains = {
    instagram: 'instagram.com',
    facebook: 'facebook.com',
    tiktok: 'tiktok.com',
  };
  try {
    const url = new URL(value);
    const domain = domains[platform];
    return url.protocol === 'https:' && domain
      && (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const availabilityLabel = {
  AVAILABLE: 'Disponible',
  MADE_TO_ORDER: 'Sobre pedido',
  OUT_OF_STOCK: 'Agotado',
};

function formatPrice(product) {
  if (product.price == null) return 'Precio bajo consulta';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: product.currency || 'COP',
    maximumFractionDigits: 2,
  }).format(product.price);
}

function addProductImage(container, product, className) {
  const image = product.images?.find((item) => item.isPrimary) || product.images?.[0];
  const wrapper = createElement('div', className);
  if (image && safeImageUrl(image.url)) {
    const img = createElement('img');
    img.src = safeImageUrl(image.url);
    img.alt = image.altText || product.name;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.remove();
      wrapper.classList.add('is-placeholder');
    }, { once: true });
    wrapper.append(img);
  } else {
    wrapper.classList.add('is-placeholder');
    wrapper.setAttribute('aria-label', 'Imagen no disponible');
  }
  container.append(wrapper);
  return wrapper;
}

function createProductCard(product) {
  const card = createElement('article', 'product-card');
  const imageWrap = createElement('button', 'product-image-button');
  imageWrap.type = 'button';
  imageWrap.setAttribute('aria-label', `Ver detalles de ${product.name}`);
  addProductImage(imageWrap, product, 'product-image');

  const content = createElement('div', 'product-card-content');
  const category = createElement('p', 'product-category', product.category?.name || 'Luna Negra');
  const name = createElement('h3', 'product-name', product.name);
  const meta = createElement('div', 'product-card-meta');
  const price = createElement('span', 'product-price', formatPrice(product));
  const availability = createElement(
    'span',
    `availability-tag availability-${product.availability?.toLowerCase() || 'unknown'}`,
    availabilityLabel[product.availability] || 'Consultar',
  );
  const details = createElement('button', 'product-details-button', 'Ver detalles');
  details.type = 'button';
  details.addEventListener('click', () => openProductDetails(product));
  imageWrap.addEventListener('click', () => openProductDetails(product));

  meta.append(price, availability);
  content.append(category, name, meta, details);
  card.append(imageWrap, content);
  return card;
}

function openProductDetails(product) {
  document.querySelector('#dialog-category').textContent = product.category?.name || 'Luna Negra Joyas';
  document.querySelector('#dialog-title').textContent = product.name;
  document.querySelector('#dialog-description').textContent = product.description;
  document.querySelector('#dialog-material').textContent = product.material ? `Material: ${product.material}` : '';
  document.querySelector('#dialog-availability').textContent = availabilityLabel[product.availability] || '';
  document.querySelector('#dialog-price').textContent = formatPrice(product);
  const imageWrap = document.querySelector('#dialog-image-wrap');
  imageWrap.replaceChildren();
  addProductImage(imageWrap, product, 'dialog-image');
  const whatsappLink = document.querySelector('#dialog-whatsapp');
  whatsappLink.hidden = !whatsappPhone;
  if (whatsappPhone) {
    const message = `Hola, quisiera consultar por esta pieza: ${product.name}.`;
    whatsappLink.href = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  }
  productDialog.showModal();
}

function setLoading(isLoading) {
  grid.setAttribute('aria-busy', String(isLoading));
  errorState.hidden = true;
  emptyState.hidden = true;
  pagination.hidden = true;
}

async function loadCategories() {
  categoryFilter.replaceChildren(createElement('option', '', 'Todas las categorías'));
  categoryFilter.firstElementChild.value = '';
  const categories = await apiRequest('/public/categories');
  for (const category of categories) {
    const option = createElement('option', '', category.name);
    option.value = category.id;
    categoryFilter.append(option);
  }
}

async function loadContactSettings() {
  const status = document.querySelector('#contact-status');
  try {
    const settings = await apiRequest('/public/contact');
    whatsappPhone = settings.whatsappPhone;
    const whatsappLink = document.querySelector('#contact-whatsapp');
    whatsappLink.hidden = !whatsappPhone;
    if (whatsappPhone) whatsappLink.href = `https://wa.me/${whatsappPhone}`;

    let activeSocialCount = 0;
    for (const [platform, url] of Object.entries(settings.socialLinks || {})) {
      const safeUrl = safeSocialUrl(url, platform);
      if (!safeUrl) continue;
      document.querySelectorAll(`[data-social-link="${platform}"]`).forEach((link) => {
        link.href = safeUrl;
        link.hidden = false;
        activeSocialCount += 1;
      });
    }

    status.textContent = whatsappPhone
      ? 'Escríbenos para conocer más sobre nuestras piezas.'
      : activeSocialCount
        ? 'Encuéntranos en nuestras redes sociales.'
        : 'Los canales de contacto se habilitarán próximamente.';
  } catch (error) {
    status.textContent = `No fue posible cargar los canales de contacto. ${error.message}`;
  }
}

async function refreshCatalog() {
  const warning = document.querySelector('#category-warning');
  try {
    await loadCategories();
    warning.hidden = true;
  } catch {
    warning.textContent = 'No pudimos cargar las categorías. Puedes seguir explorando todo el catálogo.';
    warning.hidden = false;
  }
  await loadContactSettings();
  await loadProducts();
}

async function loadProducts() {
  setLoading(true);
  status.textContent = 'Cargando colección…';
  grid.replaceChildren();

  const params = new URLSearchParams({ page: String(currentPage), limit: '12' });
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (categoryFilter.value) params.set('categoryId', categoryFilter.value);
  if (availabilityFilter.value) params.set('availability', availabilityFilter.value);

  try {
    const result = await apiRequest(`/public/products?${params}`);
    totalPages = result.pagination.totalPages;
    for (const product of result.items) grid.append(createProductCard(product));
    const count = result.pagination.total;
    status.textContent = count === 1 ? '1 pieza en la colección' : `${count} piezas en la colección`;
    emptyState.hidden = result.items.length > 0;
    if (result.items.length === 0) status.textContent = '0 piezas en la colección';
    pagination.hidden = totalPages <= 1;
    document.querySelector('#page-label').textContent = `Página ${currentPage} de ${totalPages}`;
    document.querySelector('#page-previous').disabled = currentPage <= 1;
    document.querySelector('#page-next').disabled = currentPage >= totalPages;
  } catch (error) {
    status.textContent = 'El catálogo no está disponible en este momento.';
    errorState.hidden = false;
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

document.querySelector('#catalog-filters').addEventListener('submit', (event) => {
  event.preventDefault();
  currentPage = 1;
  loadProducts();
});
document.querySelector('#catalog-retry').addEventListener('click', () => {
  refreshCatalog();
});
document.querySelector('#page-previous').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadProducts();
  }
});
document.querySelector('#page-next').addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    loadProducts();
  }
});
document.querySelector('#dialog-close').addEventListener('click', () => productDialog.close());
productDialog.addEventListener('click', (event) => {
  if (event.target === productDialog) productDialog.close();
});
document.querySelector('#current-year').textContent = String(new Date().getFullYear());

const navToggle = document.querySelector('.nav-toggle');
navToggle.addEventListener('click', () => {
  const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!isExpanded));
  document.querySelector('#site-navigation').classList.toggle('is-open', !isExpanded);
});
document.querySelectorAll('#site-navigation a').forEach((link) => {
  link.addEventListener('click', () => {
    navToggle.setAttribute('aria-expanded', 'false');
    document.querySelector('#site-navigation').classList.remove('is-open');
  });
});

refreshCatalog();
