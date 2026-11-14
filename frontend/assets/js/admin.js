import { apiRequest, getCsrfToken, ApiError } from './api.js';

const loginView = document.querySelector('#login-view');
const dashboardView = document.querySelector('#dashboard-view');
const loginError = document.querySelector('#login-error');
let currentUser = null;
const productState = { page: 1, totalPages: 1 };
const userState = { page: 1, totalPages: 1 };
let cloudinaryConfigured = false;
let currentProductImages = [];
const maxProductImages = 20;
const maxImageSize = 5 * 1024 * 1024;

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function showNotice(element, message, tone = 'error') {
  element.textContent = message;
  element.classList.remove('notice-error', 'notice-success');
  element.classList.add(tone === 'success' ? 'notice-success' : 'notice-error');
  element.hidden = false;
}

function hideNotice(element) {
  element.hidden = true;
  element.textContent = '';
}

function errorMessage(error) {
  if (error instanceof ApiError && error.status === 401 && currentUser) {
    showLogin('Tu sesión terminó. Ingresa de nuevo para continuar.');
    return 'Tu sesión terminó. Ingresa de nuevo para continuar.';
  }
  return error.message || 'No se pudo completar la solicitud. Intenta de nuevo.';
}

function showLogin(message) {
  loginView.hidden = false;
  dashboardView.hidden = true;
  currentUser = null;
  if (message) showNotice(loginError, message);
}

async function showDashboard(user) {
  currentUser = user;
  loginView.hidden = true;
  dashboardView.hidden = false;
  document.querySelector('#admin-name').textContent = user.name.split(' ')[0];
  document.querySelector('#admin-role').textContent = user.role;
  document.querySelector('#users-tab').hidden = user.role !== 'ADMIN';
  document.querySelector('#users-panel').hidden = true;
  document.querySelector('#products-panel').hidden = false;
  document.querySelector('#categories-panel').hidden = true;
  document.querySelectorAll('.dashboard-tab').forEach((tab) => {
    const active = tab.dataset.panel === 'products-panel';
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  await Promise.all([loadCategories(), loadProducts(), loadImageUploadStatus()]);
  if (user.role === 'ADMIN') await loadUsers();
}

async function loadImageUploadStatus() {
  const status = document.querySelector('#product-image-status');
  const input = document.querySelector('#product-images');
  try {
    const result = await apiRequest('/admin/uploads/status');
    cloudinaryConfigured = result.cloudinaryConfigured;
    input.disabled = !cloudinaryConfigured;
    status.textContent = cloudinaryConfigured
      ? 'JPEG, PNG o WebP; máximo 5 MB por imagen y 20 por producto.'
      : 'La carga requiere configurar las credenciales de Cloudinary en backend/.env.';
  } catch (requestError) {
    input.disabled = true;
    status.textContent = errorMessage(requestError);
  }
}

async function loadCategories() {
  const list = document.querySelector('#category-list');
  const empty = document.querySelector('#categories-empty');
  const error = document.querySelector('#categories-error');
  try {
    const categories = await apiRequest('/admin/categories');
    list.replaceChildren();
    const productCategory = document.querySelector('#product-category');
    productCategory.replaceChildren(createElement('option', '', 'Selecciona una categoría'));
    for (const category of categories) {
      const option = createElement('option', '', category.name);
      option.value = category.id;
      productCategory.append(option);

      const item = createElement('li', 'category-list-item');
      const name = createElement('span', 'category-list-name', category.name);
      const status = createElement(
        'span',
        `category-state ${category.isActive ? 'is-active' : ''}`,
        category.isActive ? 'Activa' : 'Inactiva',
      );
      item.append(name, status);
      list.append(item);
    }
    empty.hidden = categories.length > 0;
    hideNotice(error);
  } catch (requestError) {
    showNotice(error, errorMessage(requestError));
  }
}

async function loadProducts() {
  const tbody = document.querySelector('#products-table-body');
  const error = document.querySelector('#products-error');
  const empty = document.querySelector('#products-empty');
  const params = new URLSearchParams({
    page: String(productState.page),
    limit: '20',
  });
  const query = document.querySelector('#admin-product-search').value.trim();
  const publicationState = document.querySelector('#admin-publication-filter').value;
  const activeState = document.querySelector('#admin-active-filter').value;
  if (query) params.set('q', query);
  if (publicationState) params.set('publicationState', publicationState);
  if (activeState) params.set('isActive', activeState);

  try {
    const result = await apiRequest(`/admin/products?${params}`);
    productState.totalPages = Math.max(result.pagination.totalPages, 1);
    if (productState.page > productState.totalPages) {
      productState.page = productState.totalPages;
      return loadProducts();
    }
    tbody.replaceChildren();
    for (const product of result.items) tbody.append(createProductRow(product));
    empty.hidden = result.items.length > 0;
    const navigation = document.querySelector('#products-pagination');
    navigation.hidden = productState.totalPages <= 1;
    document.querySelector('#products-page-label').textContent = `Página ${productState.page} de ${productState.totalPages}`;
    document.querySelector('#products-previous').disabled = productState.page <= 1;
    document.querySelector('#products-next').disabled = productState.page >= productState.totalPages;
    hideNotice(error);
  } catch (requestError) {
    showNotice(error, errorMessage(requestError));
  }
}

function createProductRow(product) {
  const row = createElement('tr');
  const productCell = createElement('td');
  const productName = createElement('strong', 'table-primary-text', product.name);
  const productMaterial = createElement('span', 'table-secondary-text', product.material || 'Material no especificado');
  productCell.append(productName, productMaterial);

  const categoryCell = createElement('td', '', product.category?.name || '—');
  const availabilityCell = createElement('td', '', availabilityLabel(product.availability));
  const statusCell = createElement('td');
  statusCell.append(createElement(
    'span',
    `state-badge state-${product.publicationState.toLowerCase()}`,
    publicationLabel(product.publicationState),
  ), createElement(
    'span',
    `state-badge state-${product.isActive ? 'active' : 'inactive'}`,
    product.isActive ? 'Activo' : 'Inactivo',
  ));
  const actionsCell = createElement('td', 'table-actions');
  const editButton = createElement('button', 'table-action', 'Editar');
  editButton.type = 'button';
  editButton.addEventListener('click', () => editProduct(product));
  const activeButton = createElement(
    'button',
    `table-action ${product.isActive ? 'table-action-danger' : ''}`,
    product.isActive ? 'Desactivar' : 'Activar',
  );
  activeButton.type = 'button';
  activeButton.addEventListener('click', () => toggleProductActive(product));
  const archiveButton = createElement('button', 'table-action table-action-danger', 'Archivar');
  archiveButton.type = 'button';
  archiveButton.addEventListener('click', () => archiveProduct(product));
  actionsCell.append(editButton, activeButton, archiveButton);
  row.append(productCell, categoryCell, availabilityCell, statusCell, actionsCell);
  return row;
}

function availabilityLabel(value) {
  return {
    AVAILABLE: 'Disponible',
    MADE_TO_ORDER: 'Sobre pedido',
    OUT_OF_STOCK: 'Agotado',
  }[value] || value;
}

function publicationLabel(value) {
  return { DRAFT: 'Borrador', PUBLISHED: 'Publicado', HIDDEN: 'Oculto' }[value] || value;
}

function editProduct(product) {
  const form = document.querySelector('#product-form');
  document.querySelector('#product-form-heading').textContent = 'Editar producto';
  document.querySelector('#product-id').value = product.id;
  document.querySelector('#product-name').value = product.name;
  document.querySelector('#product-description').value = product.description;
  document.querySelector('#product-category').value = product.categoryId;
  document.querySelector('#product-material').value = product.material || '';
  document.querySelector('#product-price').value = product.price ?? '';
  document.querySelector('#product-currency').value = product.currency || 'COP';
  document.querySelector('#product-availability').value = product.availability;
  document.querySelector('#product-publication').value = product.publicationState;
  document.querySelector('#product-show-price').checked = product.showPrice;
  document.querySelector('#product-active').checked = product.isActive;
  currentProductImages = [...(product.images || [])];
  renderProductImages();
  hideNotice(document.querySelector('#product-form-error'));
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetProductForm() {
  const form = document.querySelector('#product-form');
  form.reset();
  document.querySelector('#product-id').value = '';
  document.querySelector('#product-form-heading').textContent = 'Nuevo producto';
  currentProductImages = [];
  renderProductImages();
  hideNotice(document.querySelector('#product-form-error'));
  form.hidden = true;
}

function renderProductImages() {
  const list = document.querySelector('#product-image-list');
  list.replaceChildren();
  for (const productImage of currentProductImages) {
    const item = createElement('div', 'product-image-item');
    const image = createElement('img');
    image.alt = productImage.altText || 'Fotografía del producto';
    try {
      const url = new URL(productImage.url);
      if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com') {
        image.src = url.href;
        image.loading = 'lazy';
      }
    } catch {
      image.alt = 'Imagen no disponible';
    }
    const primary = createElement('span', 'product-image-label', productImage.isPrimary ? 'Principal' : 'Galería');
    const removeButton = createElement('button', 'table-action table-action-danger', 'Quitar');
    removeButton.type = 'button';
    removeButton.disabled = !cloudinaryConfigured;
    removeButton.addEventListener('click', () => removeProductImage(productImage, removeButton));
    item.append(image, primary, removeButton);
    list.append(item);
  }
  list.hidden = currentProductImages.length === 0;
}

async function removeProductImage(productImage, button) {
  if (!window.confirm('¿Eliminar esta fotografía del producto?')) return;
  button.disabled = true;
  try {
    const productId = document.querySelector('#product-id').value;
    const result = await apiRequest(
      `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(productImage.id)}`,
      { method: 'DELETE' },
    );
    currentProductImages = result.items;
    renderProductImages();
    showNotice(document.querySelector('#dashboard-notice'), 'La fotografía se eliminó correctamente.', 'success');
  } catch (requestError) {
    button.disabled = false;
    showNotice(document.querySelector('#product-form-error'), errorMessage(requestError));
  }
}

async function uploadSelectedProductImages(productId) {
  const input = document.querySelector('#product-images');
  const files = Array.from(input.files);
  if (files.length === 0) return;
  if (!cloudinaryConfigured) throw new Error('Configura Cloudinary antes de cargar fotografías.');
  if (currentProductImages.length + files.length > maxProductImages) {
    throw new Error(`Un producto puede tener como máximo ${maxProductImages} fotografías.`);
  }
  const oversizedFile = files.find((file) => file.size > maxImageSize);
  if (oversizedFile) throw new Error(`"${oversizedFile.name}" supera el límite de 5 MB.`);

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const formData = new FormData();
    formData.append('image', file, file.name);
    try {
      const result = await apiRequest(`/admin/products/${encodeURIComponent(productId)}/images`, {
        method: 'POST',
        body: formData,
      });
      currentProductImages.push(result.image);
      renderProductImages();
    } catch (requestError) {
      const remainingFiles = new DataTransfer();
      files.slice(index).forEach((remainingFile) => remainingFiles.items.add(remainingFile));
      input.files = remainingFiles.files;
      throw new Error(`No se pudo subir "${file.name}". ${errorMessage(requestError)} Las fotos pendientes siguen seleccionadas.`);
    }
  }
  input.value = '';
}

async function archiveProduct(product) {
  if (!window.confirm(`¿Archivar “${product.name}”? Dejará de aparecer en el catálogo.`)) return;
  try {
    await apiRequest(`/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
    showNotice(document.querySelector('#dashboard-notice'), 'El producto se archivó correctamente.', 'success');
    await loadProducts();
  } catch (error) {
    showNotice(document.querySelector('#products-error'), errorMessage(error));
  }
}

async function toggleProductActive(product) {
  const nextActive = !product.isActive;
  if (!nextActive && !window.confirm(`¿Desactivar “${product.name}”? Dejará de aparecer en el catálogo.`)) return;
  try {
    await apiRequest(`/admin/products/${encodeURIComponent(product.id)}`, {
      method: 'PATCH',
      body: { isActive: nextActive },
    });
    const message = nextActive
      ? 'El producto volvió a estar visible en el catálogo.'
      : 'El producto se desactivó y ya no aparece en el catálogo.';
    showNotice(document.querySelector('#dashboard-notice'), message, 'success');
    await loadProducts();
  } catch (error) {
    showNotice(document.querySelector('#products-error'), errorMessage(error));
  }
}

async function loadUsers() {
  const tbody = document.querySelector('#users-table-body');
  const error = document.querySelector('#users-error');
  try {
    const result = await apiRequest(`/admin/users?page=${userState.page}&limit=20`);
    userState.totalPages = Math.max(result.pagination.totalPages, 1);
    if (userState.page > userState.totalPages) {
      userState.page = userState.totalPages;
      return loadUsers();
    }
    tbody.replaceChildren();
    for (const user of result.items) tbody.append(createUserRow(user));
    document.querySelector('#users-empty').hidden = result.items.length > 0;
    document.querySelector('#users-pagination').hidden = userState.totalPages <= 1;
    document.querySelector('#users-page-label').textContent = `Página ${userState.page} de ${userState.totalPages}`;
    document.querySelector('#users-previous').disabled = userState.page <= 1;
    document.querySelector('#users-next').disabled = userState.page >= userState.totalPages;
    hideNotice(error);
  } catch (requestError) {
    showNotice(error, errorMessage(requestError));
  }
}

function createUserRow(user) {
  const row = createElement('tr');
  const userCell = createElement('td');
  userCell.append(
    createElement('strong', 'table-primary-text', user.name),
    createElement('span', 'table-secondary-text', user.email),
  );
  const roleCell = createElement('td');
  const roleSelect = createElement('select', 'table-select');
  roleSelect.setAttribute('aria-label', `Rol de ${user.email}`);
  for (const [value, label] of [['ADMIN', 'Administrador'], ['EDITOR', 'Editor']]) {
    const option = createElement('option', '', label);
    option.value = value;
    option.selected = user.role.name === value;
    roleSelect.append(option);
  }
  roleSelect.disabled = user.id === currentUser.id;
  roleCell.append(roleSelect);

  const statusCell = createElement('td', '', user.status === 'ACTIVE' ? 'Activa' : 'Desactivada');
  const actionsCell = createElement('td', 'table-actions');
  const saveRole = createElement('button', 'table-action', 'Guardar rol');
  saveRole.type = 'button';
  saveRole.disabled = user.id === currentUser.id || roleSelect.value === user.role.name;
  roleSelect.addEventListener('change', () => {
    saveRole.disabled = user.id === currentUser.id || roleSelect.value === user.role.name;
  });
  saveRole.addEventListener('click', () => updateUserRole(user.id, roleSelect.value));

  const toggleStatus = createElement('button', 'table-action table-action-danger', user.status === 'ACTIVE' ? 'Desactivar' : 'Activar');
  toggleStatus.type = 'button';
  toggleStatus.disabled = user.id === currentUser.id;
  toggleStatus.addEventListener('click', () => updateUserStatus(
    user.id,
    user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
  ));
  actionsCell.append(saveRole, toggleStatus);
  row.append(userCell, roleCell, statusCell, actionsCell);
  return row;
}

async function updateUserRole(id, role) {
  try {
    await apiRequest(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { role } });
    showNotice(document.querySelector('#dashboard-notice'), 'El rol se actualizó y las sesiones existentes fueron revocadas.', 'success');
    await loadUsers();
  } catch (error) {
    showNotice(document.querySelector('#users-error'), errorMessage(error));
  }
}

async function updateUserStatus(id, status) {
  const verb = status === 'DISABLED' ? 'desactivar' : 'activar';
  if (!window.confirm(`¿Quieres ${verb} esta cuenta?`)) return;
  try {
    await apiRequest(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
    showNotice(document.querySelector('#dashboard-notice'), 'El estado de la cuenta se actualizó.', 'success');
    await loadUsers();
  } catch (error) {
    showNotice(document.querySelector('#users-error'), errorMessage(error));
  }
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  hideNotice(loginError);
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: document.querySelector('#login-email').value.trim(),
        password: document.querySelector('#login-password').value,
      },
    });
    document.querySelector('#login-password').value = '';
    await showDashboard(result.user);
  } catch (error) {
    showNotice(loginError, errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
    document.querySelector('#login-password').value = '';
    showLogin('Has cerrado la sesión.');
  } catch (error) {
    showNotice(document.querySelector('#dashboard-notice'), errorMessage(error));
  }
});

document.querySelectorAll('.dashboard-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const panelId = tab.dataset.panel;
    document.querySelectorAll('.dashboard-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.dashboard-panel').forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
  });
});

document.querySelector('#new-product-button').addEventListener('click', () => {
  resetProductForm();
  const form = document.querySelector('#product-form');
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#cancel-product-edit').addEventListener('click', resetProductForm);
document.querySelector('#cancel-product-button').addEventListener('click', resetProductForm);
document.querySelector('#admin-product-filters').addEventListener('submit', (event) => {
  event.preventDefault();
  productState.page = 1;
  loadProducts();
});
document.querySelector('#products-previous').addEventListener('click', () => {
  if (productState.page > 1) {
    productState.page -= 1;
    loadProducts();
  }
});
document.querySelector('#products-next').addEventListener('click', () => {
  if (productState.page < productState.totalPages) {
    productState.page += 1;
    loadProducts();
  }
});

document.querySelector('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#product-form-error');
  hideNotice(error);
  const id = document.querySelector('#product-id').value;
  const priceValue = document.querySelector('#product-price').value;
  const body = {
    name: document.querySelector('#product-name').value.trim(),
    description: document.querySelector('#product-description').value.trim(),
    categoryId: document.querySelector('#product-category').value,
    material: document.querySelector('#product-material').value.trim() || null,
    price: priceValue === '' ? null : Number(priceValue),
    currency: document.querySelector('#product-currency').value.trim().toUpperCase(),
    showPrice: document.querySelector('#product-show-price').checked,
    availability: document.querySelector('#product-availability').value,
    publicationState: document.querySelector('#product-publication').value,
    isActive: document.querySelector('#product-active').checked,
  };
  let savedProductId = id;
  try {
    const savedProduct = await apiRequest(id ? `/admin/products/${encodeURIComponent(id)}` : '/admin/products', {
      method: id ? 'PATCH' : 'POST',
      body,
    });
    savedProductId = id || savedProduct.id;
    document.querySelector('#product-id').value = savedProductId;
    currentProductImages = [...(savedProduct.images || currentProductImages)];
    renderProductImages();
    await uploadSelectedProductImages(savedProductId);
    resetProductForm();
    productState.page = 1;
    showNotice(document.querySelector('#dashboard-notice'), 'El producto se guardó correctamente.', 'success');
    await loadProducts();
  } catch (requestError) {
    if (savedProductId) document.querySelector('#product-id').value = savedProductId;
    showNotice(error, errorMessage(requestError));
    await loadProducts();
  }
});

document.querySelector('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector('#category-error');
  hideNotice(error);
  try {
    await apiRequest('/admin/categories', {
      method: 'POST',
      body: {
        name: document.querySelector('#category-name').value.trim(),
        description: document.querySelector('#category-description').value.trim() || null,
        isActive: true,
      },
    });
    form.reset();
    showNotice(document.querySelector('#dashboard-notice'), 'La categoría se creó correctamente.', 'success');
    await loadCategories();
  } catch (requestError) {
    showNotice(error, errorMessage(requestError));
  }
});

document.querySelector('#user-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector('#user-form-error');
  hideNotice(error);
  try {
    await apiRequest('/admin/users', {
      method: 'POST',
      body: {
        name: document.querySelector('#user-name').value.trim(),
        email: document.querySelector('#user-email').value.trim(),
        password: document.querySelector('#user-password').value,
        role: document.querySelector('#user-role').value,
      },
    });
    form.reset();
    showNotice(document.querySelector('#dashboard-notice'), 'La cuenta se creó correctamente.', 'success');
    userState.page = 1;
    await loadUsers();
  } catch (requestError) {
    showNotice(error, errorMessage(requestError));
  }
});

document.querySelector('#users-previous').addEventListener('click', () => {
  if (userState.page > 1) {
    userState.page -= 1;
    loadUsers();
  }
});
document.querySelector('#users-next').addEventListener('click', () => {
  if (userState.page < userState.totalPages) {
    userState.page += 1;
    loadUsers();
  }
});

try {
  await getCsrfToken();
  const result = await apiRequest('/auth/me');
  await showDashboard(result.user);
} catch (error) {
  showLogin(error instanceof ApiError && error.status === 401
    ? null
    : 'No pudimos conectar con el servicio. Verifica que la API esté disponible e inténtalo de nuevo.');
}
